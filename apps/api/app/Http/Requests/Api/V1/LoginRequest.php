<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `tenant` is the organization the sign-in address names. `scope=platform` is the platform staff host and
     * carries no tenant.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
            'tenant' => ['nullable', 'string', 'max:64'],
            'scope' => ['nullable', 'string', Rule::in(['tenant', 'platform'])],
        ];
    }
}
