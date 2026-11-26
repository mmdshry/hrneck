<?php

namespace App\Models;

use App\Domains\IdentityAccess\Models\WebauthnCredential;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Support\ActiveOrgTenant;
use Database\Factories\UserFactory;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthenticationRecovery;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Crypt;
use Laravel\Sanctum\HasApiTokens;
use SensitiveParameter;
use Spatie\Permission\Traits\HasRoles;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * @property array<int, string>|null $mfa_recovery_codes
 * @property string|null $mfa_secret
 * @property string|null $tenant_id
 */
#[Fillable([
    'name',
    'email',
    'avatar_path',
    'password',
    'tenant_id',
    'department_id',
    'department',
    'locale',
    'must_set_password',
    'disabled_at',
])]
#[Hidden(['password', 'remember_token', 'mfa_secret', 'mfa_recovery_codes'])]
class User extends Authenticatable implements FilamentUser, HasAppAuthentication, HasAppAuthenticationRecovery
{
    /** @use HasFactory<UserFactory> */
    use CentralConnection, HasApiTokens, HasFactory, HasRoles, Notifiable;

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->isPlatformStaff();
    }

    public function isPlatformStaff(): bool
    {
        if ($this->belongsToAnyTenant()) {
            return false;
        }

        return $this->hasGlobalPlatformRole(OrgPermissionCatalog::platformRoles());
    }

    public function isPlatformSuperAdmin(): bool
    {
        if ($this->belongsToAnyTenant()) {
            return false;
        }

        return $this->hasGlobalPlatformRole(OrgPermissionCatalog::PLATFORM_SUPER_ADMIN);
    }

    /**
     * Platform roles are global (team id null). Spatie caches the roles relation per instance, and
     * any permission check under a tenant team (for example Spatie's own Gate::before) loads a relation
     * that omits them. Drop that cache so the check always reads the global team, then restore both.
     *
     * @param  string|list<string>  $roles
     */
    private function hasGlobalPlatformRole(string|array $roles): bool
    {
        $previous = getPermissionsTeamId();
        setPermissionsTeamId(null);
        $this->unsetRelation('roles');

        try {
            return $this->hasRole($roles);
        } finally {
            $this->unsetRelation('roles');
            setPermissionsTeamId($previous);
        }
    }

    /**
     * Key used for password-reset and invite tokens. Organization logins can share an email,
     * so the tenant is part of the key; platform staff keep the plain email.
     */
    public function getEmailForPasswordReset(): string
    {
        $email = (string) $this->email;

        return $this->tenant_id !== null ? $this->tenant_id.'|'.$email : $email;
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeWithEmail(Builder $query, string $email): Builder
    {
        return $query->whereRaw('LOWER(email) = ?', [strtolower(trim($email))]);
    }

    public function isOrgUser(): bool
    {
        return $this->belongsToAnyTenant();
    }

    public function belongsToAnyTenant(): bool
    {
        if ($this->relationLoaded('memberships')) {
            return $this->memberships->isNotEmpty();
        }

        if ($this->tenant_id !== null) {
            return true;
        }

        return $this->memberships()->exists();
    }

    public function belongsToTenant(string $tenantId, bool $activeOnly = true): bool
    {
        if ($this->relationLoaded('memberships')) {
            return $this->memberships->contains(
                fn (TenantMembership $m): bool => $m->tenant_id === $tenantId
                    && (! $activeOnly || $m->isActive())
            );
        }

        $query = $this->memberships()->forTenant($tenantId);
        if ($activeOnly) {
            $query->active();
        }

        return $query->exists();
    }

    public function membershipFor(string $tenantId): ?TenantMembership
    {
        if ($this->relationLoaded('memberships')) {
            return $this->memberships->firstWhere('tenant_id', $tenantId);
        }

        return $this->memberships()->forTenant($tenantId)->first();
    }

    /**
     * Active org context for API responses: session → sole membership → null when multi.
     */
    public function resolvedActiveTenantId(): ?string
    {
        $sessionId = ActiveOrgTenant::id();
        if (is_string($sessionId) && $sessionId !== '' && $this->belongsToTenant($sessionId)) {
            return $sessionId;
        }

        $active = $this->relationLoaded('memberships')
            ? $this->memberships->filter(fn (TenantMembership $m): bool => $m->isActive())->values()
            : $this->memberships()->active()->get();

        if ($active->count() === 1) {
            return $active->first()?->tenant_id;
        }

        // Multiple (or zero) memberships and no session: do not guess from legacy tenant_id.
        return null;
    }

    public function needsOrgSelection(): bool
    {
        if ($this->isPlatformStaff()) {
            return false;
        }

        $active = $this->relationLoaded('memberships')
            ? $this->memberships->filter(fn (TenantMembership $m): bool => $m->isActive())
            : $this->memberships()->active()->get();

        if ($active->count() <= 1) {
            return false;
        }

        $sessionId = ActiveOrgTenant::id();

        return ! (is_string($sessionId) && $sessionId !== '' && $active->contains(
            fn (TenantMembership $m): bool => $m->tenant_id === $sessionId
        ));
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /** @return HasMany<TenantMembership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(TenantMembership::class);
    }

    /** @return HasMany<UserIdentity, $this> */
    public function identities(): HasMany
    {
        return $this->hasMany(UserIdentity::class);
    }

    /** @return HasMany<WebauthnCredential, $this> */
    public function webauthnCredentials(): HasMany
    {
        return $this->hasMany(WebauthnCredential::class);
    }

    /** @param  Builder<static>  $query */
    public function scopeInTenant(Builder $query, string $tenantId, bool $activeOnly = true): Builder
    {
        return $query->whereHas(
            'memberships',
            function (Builder $q) use ($tenantId, $activeOnly): void {
                $q->where('tenant_id', $tenantId);
                if ($activeOnly) {
                    $q->whereNull('disabled_at');
                }
            }
        );
    }

    public function getAppAuthenticationSecret(): ?string
    {
        if (! is_string($this->mfa_secret) || $this->mfa_secret === '') {
            return null;
        }

        return Crypt::decryptString($this->mfa_secret);
    }

    public function saveAppAuthenticationSecret(#[SensitiveParameter] ?string $secret): void
    {
        if ($secret === null || $secret === '') {
            // Removing the authenticator app must not drop a still-active passkey factor.
            $hasPasskeys = $this->webauthnCredentials()->exists();

            $this->forceFill([
                'mfa_secret' => null,
                'mfa_enabled' => $hasPasskeys,
                'mfa_confirmed_at' => $hasPasskeys ? $this->mfa_confirmed_at : null,
                'mfa_recovery_codes' => $hasPasskeys ? $this->mfa_recovery_codes : null,
            ])->save();

            return;
        }

        $this->forceFill([
            'mfa_secret' => Crypt::encryptString($secret),
            'mfa_enabled' => true,
            'mfa_confirmed_at' => $this->mfa_confirmed_at ?? now(),
        ])->save();
    }

    public function getAppAuthenticationHolderName(): string
    {
        return $this->email;
    }

    /**
     * @return ?array<string>
     */
    public function getAppAuthenticationRecoveryCodes(): ?array
    {
        return $this->mfa_recovery_codes;
    }

    /**
     * @param  ?array<string>  $codes
     */
    public function saveAppAuthenticationRecoveryCodes(#[SensitiveParameter] ?array $codes): void
    {
        $this->forceFill([
            'mfa_recovery_codes' => $codes,
        ])->save();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_set_password' => 'boolean',
            'disabled_at' => 'datetime',
            'department_id' => 'integer',
            'mfa_enabled' => 'boolean',
            'mfa_confirmed_at' => 'datetime',
            'mfa_recovery_codes' => 'array',
        ];
    }
}
