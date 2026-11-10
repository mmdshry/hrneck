<?php

namespace App\Models;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use Database\Factories\UserFactory;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthenticationRecovery;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
 */
#[Fillable(['name', 'email', 'password', 'tenant_id'])]
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
        if ($this->tenant_id !== null) {
            return false;
        }

        $previous = getPermissionsTeamId();
        setPermissionsTeamId(null);

        try {
            return $this->hasAnyRole(OrgPermissionCatalog::platformRoles());
        } finally {
            setPermissionsTeamId($previous);
        }
    }

    public function isOrgUser(): bool
    {
        return $this->tenant_id !== null;
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
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
            $this->forceFill([
                'mfa_secret' => null,
                'mfa_enabled' => false,
                'mfa_confirmed_at' => null,
                'mfa_recovery_codes' => null,
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
            'mfa_enabled' => 'boolean',
            'mfa_confirmed_at' => 'datetime',
            'mfa_recovery_codes' => 'array',
        ];
    }
}
