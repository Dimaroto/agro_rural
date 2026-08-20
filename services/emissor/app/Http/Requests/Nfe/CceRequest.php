<?php

namespace App\Http\Requests\Nfe;

use Illuminate\Foundation\Http\FormRequest;

class CceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'correcao' => ['required', 'string', 'min:15', 'max:1000'],
            'sequencial' => ['nullable', 'integer', 'min:1'],
            'sincrono' => ['nullable', 'boolean'],
        ];
    }
}
