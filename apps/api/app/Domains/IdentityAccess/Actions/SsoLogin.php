<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\SignInEligibility;
use App\Domains\IdentityAccess\Support\SsoError;
use App\Domains\IdentityAccess\Support\SsoLoginException;
use App\Domains\IdentityAccess\Support\SsoProvider;
use App\Models\User;
use App\Models\UserIdentity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
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
     * A login of the organization being signed into that already has this (provider, subject) identity wins. Otherwise a
     * verified provider email links the identity to that organization's login with the email, provided that login has no
     * identity from the same provider yet. One provider account can link to one login per organization.
     *
     * @param  array<string, mixed>  $idTokenClaims
     *
     * @throws SsoLoginException
     */
    public function handle(SsoProvider $provider, SocialiteUser $ssoUser, array $idTokenClaims, string $tenantId): User
    {
        $subject = (string) $ssoUser->getId();
        if ($subject === '') {
            throw new SsoLoginException(SsoError::ProviderError, 'Provider returned no subject.');
        }

        $linkedLogins = $this->organizationLogins($this->loginsWithIdentity($provider, $subject), $tenantId);
        if ($linkedLogins->isNotEmpty()) {
            return $this->ensureSignInAllowed($this->onlyLogin($linkedLogins));
        }

        $email = $this->providerEmail($provider, $ssoUser);
        if ($email === null || ! $provider->emailIsVerified($idTokenClaims)) {
            throw new SsoLoginException(SsoError::NotLinked, 'Provider email is missing or not verified.');
        }

        $user = $this->ensureSignInAllowed($this->onlyLogin($this->organizationLogins(User::query()->withEmail($email), $tenantId)));

        if ($user->identities()->where('provider', $provider->value)->exists()) {
            throw new SsoLoginException(SsoError::NotLinked, 'Account already has a different '.$provider->value.' identity.');
        }

        $this->link($user, $provider, $subject, $email);

        return $user;
    }

    /**
     * Logins that hold this (provider, subject) identity, whatever organization they belong to.
     *
     * @return Builder<User>
     */
    private function loginsWithIdentity(SsoProvider $provider, string $subject): Builder
    {
        return User::query()->whereHas('identities', fn (Builder $identity) => $identity
            ->where('provider', $provider->value)
            ->where('subject', $subject));
    }

    /**
     * The logins among $logins that belong to the organization being signed into: its own logins win, and logins that
     * only hold an active membership there are the fallback. At most two are fetched, enough to tell one match from many.
     *
     * @param  Builder<User>  $logins
     * @return Collection<int, User>
     */
    private function organizationLogins(Builder $logins, string $tenantId): Collection
    {
        $ownLogins = (clone $logins)->where('tenant_id', $tenantId)->limit(2)->get();
        if ($ownLogins->isNotEmpty()) {
            return $ownLogins;
        }

        return (clone $logins)
            ->whereHas('memberships', fn (Builder $membership) => $membership->where('tenant_id', $tenantId)->active())
            ->limit(2)
            ->get();
    }

    /**
     * @param  Collection<int, User>  $logins
     */
    private function onlyLogin(Collection $logins): ?User
    {
        return $logins->count() === 1 ? $logins->first() : null;
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
