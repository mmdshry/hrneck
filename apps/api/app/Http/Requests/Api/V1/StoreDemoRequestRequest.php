<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDemoRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'work_email' => ['required', 'string', 'email:rfc', 'max:191'],
            'company' => ['required', 'string', 'max:160'],
            'role' => ['required', 'string', Rule::in(['msp', 'organization', 'other'])],
            'message' => ['nullable', 'string', 'max:2000'],
            'locale' => ['nullable', 'string', 'max:8'],
            'cf-turnstile-response' => ['required', 'string', 'max:2048'],
            // Honeypot: visitors never see this field, so any value here means a bot.
            'website' => ['nullable', 'string', 'max:255'],
        ];
    }
}
