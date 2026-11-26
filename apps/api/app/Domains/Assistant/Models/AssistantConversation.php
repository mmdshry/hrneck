<?php

namespace App\Domains\Assistant\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * One Copilot Studio conversation started by a user in a tenant. Stored centrally so a tool call can
 * resolve the tenant from the token alone.
 *
 * @property string $id
 * @property string $tenant_id
 * @property int $user_id
 * @property string $copilot_conversation_id
 * @property string $direct_line_token
 * @property string|null $watermark
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 */
#[Fillable([
    'id',
    'tenant_id',
    'user_id',
    'copilot_conversation_id',
    'direct_line_token',
    'watermark',
    'expires_at',
    'revoked_at',
])]
class AssistantConversation extends Model
{
    use CentralConnection, HasUuids;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isUsable(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'direct_line_token' => 'encrypted',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }
}
