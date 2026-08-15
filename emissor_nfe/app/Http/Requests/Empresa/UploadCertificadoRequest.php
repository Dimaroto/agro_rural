<?php

namespace App\Http\Requests\Empresa;

use Illuminate\Foundation\Http\FormRequest;

class UploadCertificadoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pfx' => ['required', 'file', 'max:5120'],
            'senha' => ['required', 'string'],
        ];
    }
}
