<?php

namespace App\Domains\IdentityAccess\Models;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;
use Symfony\Component\Uid\Uuid;
use Webauthn\CredentialRecord;
use Webauthn\PublicKeyCredentialDescriptor;
use Webauthn\TrustPath\EmptyTrustPath;

/**
 * @property Carbon|null $last_used_at
 */
#[Fillable([
    'user_id',
    'credential_id',
    'public_key',
    'counter',
    'name',
    'transports',
    'aaguid',
    'attestation_type',
    'backup_eligible',
    'backup_status',
    'uv_initialized',
    'last_used_at',
])]
#[Hidden(['credential_id', 'public_key'])]
class WebauthnCredential extends Model
{
    use CentralConnection;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Rebuilds the library's credential record from the stored columns.
     *
     * The user handle is the owner's primary key, which is what registration
     * used as the WebAuthn user ID.
     */
    public function toCredentialRecord(): CredentialRecord
    {
        return CredentialRecord::create(
            publicKeyCredentialId: (string) $this->credential_id,
            type: PublicKeyCredentialDescriptor::CREDENTIAL_TYPE_PUBLIC_KEY,
            transports: $this->transports ?? [],
            attestationType: (string) $this->attestation_type,
            trustPath: EmptyTrustPath::create(),
            aaguid: Uuid::fromString($this->aaguid ?? '00000000-0000-0000-0000-000000000000'),
            credentialPublicKey: (string) $this->public_key,
            userHandle: (string) $this->user_id,
            counter: (int) $this->counter,
            backupEligible: $this->backup_eligible,
            backupStatus: $this->backup_status,
            uvInitialized: $this->uv_initialized,
        );
    }

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'counter' => 'integer',
            'transports' => 'array',
            'backup_eligible' => 'boolean',
            'backup_status' => 'boolean',
            'uv_initialized' => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }
}
