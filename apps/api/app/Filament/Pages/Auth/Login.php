<?php

namespace App\Filament\Pages\Auth;

use Filament\Auth\Pages\Login as BaseLogin;

class Login extends BaseLogin
{
    // Intentionally use the generic Filament failure message to avoid
    // account enumeration (org vs platform) on the admin login form.
}
