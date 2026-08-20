<?php

namespace App\Http\Requests\Nfe;

use Illuminate\Foundation\Http\FormRequest;

class InutilizarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'serie' => ['required', 'integer', 'min:0', 'max:999'],
            'numero_inicial' => ['required', 'integer', 'min:1'],
            'numero_final' => ['required', 'integer', 'min:1'],
            'ano' => ['nullable', 'integer', 'min:0', 'max:99'],
            'modelo' => ['nullable', 'integer', 'in:55'],
            'justificativa' => ['required', 'string', 'min:15', 'max:255'],
            'sincrono' => ['nullable', 'boolean'],
        ];
    }
}
