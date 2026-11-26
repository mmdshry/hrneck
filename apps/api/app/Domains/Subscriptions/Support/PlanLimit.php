<?php

namespace App\Domains\Subscriptions\Support;

enum PlanLimit: string
{
    case Employees = 'employees';
    case Users = 'users';

    public function label(): string
    {
        return match ($this) {
            self::Employees => 'employees',
            self::Users => 'users',
        };
    }
}
