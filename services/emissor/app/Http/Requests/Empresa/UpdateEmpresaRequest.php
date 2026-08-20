<?php

namespace App\Http\Requests\Empresa;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmpresaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $empresaId = $this->route('empresa')?->id ?? $this->route('empresa');

        return [
            'cnpj' => ['sometimes', 'string', 'size:14', Rule::unique('empresas', 'cnpj')->ignore($empresaId)],
            'ie' => ['nullable', 'string', 'max:20'],
            'razao_social' => ['sometimes', 'string', 'max:255'],
            'nome_fantasia' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'logradouro' => ['sometimes', 'string', 'max:255'],
            'numero' => ['sometimes', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['sometimes', 'string', 'max:255'],
            'municipio' => ['sometimes', 'string', 'max:255'],
            'codigo_municipio' => ['sometimes', 'string', 'size:7'],
            'uf' => ['sometimes', 'string', 'size:2'],
            'cep' => ['sometimes', 'string', 'size:8'],
            'crt' => ['sometimes', 'integer', Rule::in([1, 2, 3, 4])],
            'regime_tributario' => ['sometimes', Rule::in(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'])],
            'ambiente' => ['sometimes', Rule::in(['homologacao', 'producao'])],
            'ativa' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $data = [];
        if ($this->has('cnpj')) {
            $data['cnpj'] = preg_replace('/\D/', '', (string) $this->cnpj);
        }
        if ($this->has('cep')) {
            $data['cep'] = preg_replace('/\D/', '', (string) $this->cep);
        }
        if ($this->has('uf')) {
            $data['uf'] = strtoupper((string) $this->uf);
        }
        $this->merge($data);
    }
}
