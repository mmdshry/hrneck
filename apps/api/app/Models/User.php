<?php

namespace App\Models;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

#[Fillable(['name', 'email', 'password', 'tenant_id', 'mfa_secret', 'mfa_enabled', 'mfa_confirmed_at'])]
#[Hidden(['password', 'remember_token', 'mfa_secret'])]
class User extends Authenticatable implements FilamentUser
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
        ];
    }
}
