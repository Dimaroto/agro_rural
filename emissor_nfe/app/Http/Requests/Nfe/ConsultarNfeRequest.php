<?php

namespace App\Http\Requests\Nfe;

use Illuminate\Foundation\Http\FormRequest;

class ConsultarNfeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'chave' => ['required', 'string', 'size:44'],
        ];
    }
}
