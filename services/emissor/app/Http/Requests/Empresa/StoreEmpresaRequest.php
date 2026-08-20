<?php

namespace App\Http\Requests\Empresa;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmpresaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cnpj' => ['required', 'string', 'size:14', 'unique:empresas,cnpj'],
            'ie' => ['nullable', 'string', 'max:20'],
            'razao_social' => ['required', 'string', 'max:255'],
            'nome_fantasia' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'logradouro' => ['required', 'string', 'max:255'],
            'numero' => ['required', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['required', 'string', 'max:255'],
            'municipio' => ['required', 'string', 'max:255'],
            'codigo_municipio' => ['required', 'string', 'size:7'],
            'uf' => ['required', 'string', 'size:2'],
            'cep' => ['required', 'string', 'size:8'],
            'crt' => ['required', 'integer', Rule::in([1, 2, 3, 4])],
            'regime_tributario' => ['nullable', Rule::in(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'])],
            'ambiente' => ['nullable', Rule::in(['homologacao', 'producao'])],
            'serie_inicial' => ['nullable', 'integer', 'min:1', 'max:999'],
            'proximo_numero' => ['nullable', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'cnpj' => preg_replace('/\D/', '', (string) $this->cnpj),
            'cep' => preg_replace('/\D/', '', (string) $this->cep),
            'uf' => strtoupper((string) $this->uf),
            'ambiente' => $this->ambiente ?? 'homologacao',
        ]);
    }
}
