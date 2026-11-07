<?php

namespace App\Filament\Pages\Auth;

use App\Models\User;
use Filament\Auth\Pages\Login as BaseLogin;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class Login extends BaseLogin
{
    protected function throwFailureValidationException(): never
    {
        $email = $this->data['email'] ?? null;
        $password = $this->data['password'] ?? null;
        $user = is_string($email)
            ? User::query()->where('email', $email)->first()
            : null;

        if (
            $user instanceof User
            && is_string($password)
            && $password !== ''
            && Hash::check($password, $user->getAuthPassword())
            && ! $user->canAccessPanel(Filament::getCurrentOrDefaultPanel())
        ) {
            throw ValidationException::withMessages([
                'data.email' => 'This account belongs to an organization and cannot open the platform admin.',
            ]);
        }

        parent::throwFailureValidationException();
    }
}
