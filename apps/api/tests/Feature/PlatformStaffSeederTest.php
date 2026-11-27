<?php

use App\Models\User;
use Database\Seeders\PlatformStaffSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

function platformStaffSeederEmails(): array
{
    return ['hamed.fazli@itneck.com', 'hadi.fazli@itneck.com', 'mo.fard@itneck.com'];
}

function platformStaffAccount(string $email): User
{
    return User::query()->withEmail($email)->whereNull('tenant_id')->firstOrFail();
}

test('seeder creates platform super admins without an organization and sends set-password links', function () {
    Notification::fake();

    $this->seed(PlatformStaffSeeder::class);

    foreach (platformStaffSeederEmails() as $email) {
        $user = platformStaffAccount($email);

        expect($user->tenant_id)->toBeNull()
            ->and($user->isPlatformStaff())->toBeTrue()
            ->and($user->must_set_password)->toBeFalse()
            ->and($user->isPlatformSuperAdmin())->toBeTrue();

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user): bool {
            $url = $notification->toMail($user)->actions[0]['url'];

            return str_contains($url, '/login/reset?token=')
                && str_contains($url, 'email='.rawurlencode($user->email));
        });
    }

    Notification::assertCount(3);
});

test('seeder run again creates no duplicates, keeps passwords and sends no new links', function () {
    Notification::fake();

    $this->seed(PlatformStaffSeeder::class);
    $hash = platformStaffAccount('hamed.fazli@itneck.com')->password;

    $this->seed(PlatformStaffSeeder::class);

    expect(User::query()->whereIn('email', platformStaffSeederEmails())->count())->toBe(3)
        ->and(platformStaffAccount('hamed.fazli@itneck.com')->password)->toBe($hash);

    Notification::assertCount(3);
});

test('an existing platform account keeps its password and gets the role and sign-in state back', function () {
    Notification::fake();

    $existing = User::factory()->create([
        'name' => 'Mo Fard',
        'email' => 'mo.fard@itneck.com',
        'tenant_id' => null,
        'password' => 'OldPass!234',
        'must_set_password' => true,
    ]);

    $this->seed(PlatformStaffSeeder::class);

    $fresh = $existing->fresh();

    expect($fresh->must_set_password)->toBeFalse()
        ->and(Hash::check('OldPass!234', $fresh->password))->toBeTrue()
        ->and($fresh->isPlatformStaff())->toBeTrue();

    Notification::assertNotSentTo($fresh, ResetPassword::class);
});
