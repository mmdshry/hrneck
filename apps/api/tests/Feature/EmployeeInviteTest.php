<?php

use App\Domains\IdentityAccess\Jobs\SendEmployeeInviteJob;
use App\Domains\IdentityAccess\Notifications\EmployeeInviteNotification;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

function createInvitedEmployee(string $email): User
{
    return User::factory()->create([
        'email' => $email,
        'tenant_id' => 'itneck',
        'must_set_password' => true,
    ]);
}

function inviteResetPayload(string $email, string $token): array
{
    return [
        'email' => $email,
        'token' => $token,
        'password' => 'NewPass!23456',
        'password_confirmation' => 'NewPass!23456',
    ];
}

test('employee invite sends a set-password link stored in the invite token table', function () {
    Notification::fake();
    $employee = createInvitedEmployee('invited.employee@itneck.test');

    (new SendEmployeeInviteJob($employee->id))->handle();

    Notification::assertSentTo($employee, EmployeeInviteNotification::class);
    Notification::assertNotSentTo($employee, ResetPassword::class);
    // Token rows are keyed by the organization login (tenant|email), so the same email can be invited elsewhere too.
    expect(DB::table('employee_invite_tokens')->where('email', $employee->getEmailForPasswordReset())->exists())->toBeTrue()
        ->and(DB::table('employee_invite_tokens')->where('email', 'itneck|invited.employee@itneck.test')->exists())->toBeTrue()
        ->and(DB::table('password_reset_tokens')->where('email', $employee->getEmailForPasswordReset())->exists())->toBeFalse();
});

test('an invite email links to the set-password page with the invite flag', function () {
    $employee = createInvitedEmployee('invite.mail@itneck.test');

    $mail = (new EmployeeInviteNotification('tok123'))->toMail($employee);

    expect($mail->hasTo('invite.mail@itneck.test'))->toBeTrue()
        ->and($mail->render())
        ->toContain('token=tok123')
        ->toContain('email=invite.mail%40itneck.test')
        ->toContain('invite=1')
        ->toContain('This link expires in 7 days.');
});

test('an invite token sets the password, clears must_set_password and cannot be reused', function () {
    $employee = createInvitedEmployee('set.password@itneck.test');
    $token = Password::broker(EmployeeInviteNotification::PASSWORD_BROKER)->createToken($employee);

    $this->postJson('/api/v1/auth/password/reset', inviteResetPayload('set.password@itneck.test', $token))
        ->assertOk()
        ->assertJsonPath('message', 'Password has been reset.');

    $employee->refresh();
    expect($employee->must_set_password)->toBeFalse()
        ->and(Hash::check('NewPass!23456', $employee->getAuthPassword()))->toBeTrue();

    $this->postJson('/api/v1/auth/password/reset', inviteResetPayload('set.password@itneck.test', $token))
        ->assertStatus(422);
});

test('an invite link still works on day six', function () {
    $employee = createInvitedEmployee('invite.valid@itneck.test');
    $token = Password::broker(EmployeeInviteNotification::PASSWORD_BROKER)->createToken($employee);
    $this->travel(6)->days();

    $this->postJson('/api/v1/auth/password/reset', inviteResetPayload('invite.valid@itneck.test', $token))
        ->assertOk();

    $this->travelBack();
});

test('an invite link is rejected once the seven day window has passed', function () {
    $employee = createInvitedEmployee('invite.expired@itneck.test');
    $token = Password::broker(EmployeeInviteNotification::PASSWORD_BROKER)->createToken($employee);
    $this->travel(8)->days();

    $this->postJson('/api/v1/auth/password/reset', inviteResetPayload('invite.expired@itneck.test', $token))
        ->assertStatus(422);

    expect(Hash::check('NewPass!23456', $employee->fresh()->getAuthPassword()))->toBeFalse()
        ->and($employee->fresh()->must_set_password)->toBeTrue();

    $this->travelBack();
});

test('an invite link does not re-enable a disabled employee account', function () {
    $employee = createInvitedEmployee('disabled.invite@itneck.test');
    $employee->forceFill(['disabled_at' => now()])->save();
    $token = Password::broker(EmployeeInviteNotification::PASSWORD_BROKER)->createToken($employee);

    $this->postJson('/api/v1/auth/password/reset', inviteResetPayload('disabled.invite@itneck.test', $token))
        ->assertStatus(422);

    $employee->refresh();
    expect($employee->disabled_at)->not->toBeNull()
        ->and(Hash::check('NewPass!23456', $employee->getAuthPassword()))->toBeFalse();
});
