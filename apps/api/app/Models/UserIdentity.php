<?php

namespace App\Models;

use App\Domains\IdentityAccess\Support\SsoProvider;
use Database\Factories\UserIdentityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * An external identity (Google or Microsoft subject) linked to a login User.
 *
 * @property int $id
 * @property int $user_id
 * @property SsoProvider $provider
 * @property string $subject
 * @property string|null $email
 * @property Carbon $linked_at
 */
#[Fillable([
    'user_id',
    'provider',
    'subject',
    'email',
    'linked_at',
])]
class UserIdentity extends Model
{
    /** @use HasFactory<UserIdentityFactory> */
    use CentralConnection, HasFactory;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider' => SsoProvider::class,
            'linked_at' => 'datetime',
        ];
    }
}
