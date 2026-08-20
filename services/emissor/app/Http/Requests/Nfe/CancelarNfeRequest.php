<?php

namespace App\Http\Requests\Nfe;

use Illuminate\Foundation\Http\FormRequest;

class CancelarNfeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'justificativa' => ['required', 'string', 'min:15', 'max:255'],
            'sincrono' => ['nullable', 'boolean'],
        ];
    }
}
