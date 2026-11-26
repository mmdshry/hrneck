<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\SignInEligibility;
use App\Domains\IdentityAccess\Support\SsoError;
use App\Domains\IdentityAccess\Support\SsoLoginException;
use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Models\User;
use App\Models\UserIdentity;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Two\User as SocialiteUser;

/**
 * Resolves the login User for a completed SSO sign-in. Accounts are never created here: only users that an
 * administrator already provisioned can sign in with SSO.
 */
class SsoLogin
{
    public function __construct(private readonly SignInEligibility $eligibility) {}

    /**
     * An identity already linked to (provider, subject) wins. Otherwise a verified provider email links the identity
     * to the User with that email, provided that User has no identity from the same provider yet.
     *
     * @param  array<string, mixed>  $idTokenClaims
     *
     * @throws SsoLoginException
     */
    public function handle(SsoProvider $provider, SocialiteUser $ssoUser, array $idTokenClaims): User
    {
        $subject = (string) $ssoUser->getId();
        if ($subject === '') {
            throw new SsoLoginException(SsoError::ProviderError, 'Provider returned no subject.');
        }

        $identity = UserIdentity::query()
            ->where('provider', $provider->value)
            ->where('subject', $subject)
            ->first();

        if ($identity !== null) {
            return $this->ensureSignInAllowed($identity->user);
        }

        $email = $this->providerEmail($provider, $ssoUser);
        if ($email === null || ! $provider->emailIsVerified($idTokenClaims)) {
            throw new SsoLoginException(SsoError::NotLinked, 'Provider email is missing or not verified.');
        }

        // Organization logins can share an email. Only link when the address identifies exactly one login.
        $candidates = User::query()->withEmail($email)->limit(2)->get();
        $user = $this->ensureSignInAllowed($candidates->count() === 1 ? $candidates->first() : null);

        if ($user->identities()->where('provider', $provider->value)->exists()) {
            throw new SsoLoginException(SsoError::NotLinked, 'Account already has a different '.$provider->value.' identity.');
        }

        $this->link($user, $provider, $subject, $email);

        return $user;
    }

    /**
     * @throws SsoLoginException
     */
    private function ensureSignInAllowed(?User $user): User
    {
        if ($user === null) {
            throw new SsoLoginException(SsoError::NotLinked, 'No account is linked to this identity.');
        }

        if ($this->eligibility->blockReason($user, viaPassword: false) !== null) {
            throw new SsoLoginException(SsoError::AccountDisabled, 'Account is disabled.');
        }

        return $user;
    }

    private function link(User $user, SsoProvider $provider, string $subject, string $email): void
    {
        DB::transaction(function () use ($user, $provider, $subject, $email): void {
            // Proving ownership of the provider email also verifies it for the local account.
            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            UserIdentity::query()->create([
                'user_id' => $user->id,
                'provider' => $provider,
                'subject' => $subject,
                'email' => $email,
                'linked_at' => now(),
            ]);
        });
    }

    /**
     * Microsoft returns mail for accounts that have a mailbox; userPrincipalName is the sign-in name and the fallback.
     */
    private function providerEmail(SsoProvider $provider, SocialiteUser $ssoUser): ?string
    {
        $email = match ($provider) {
            SsoProvider::Google => $ssoUser->getEmail(),
            SsoProvider::Microsoft => ($ssoUser->getRaw()['mail'] ?? null) ?: $ssoUser->getEmail(),
        };

        if (! is_string($email)) {
            return null;
        }

        $normalized = strtolower(trim($email));

        return $normalized === '' ? null : $normalized;
    }
}
