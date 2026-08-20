<?php

namespace App\Http\Requests\Nfe;

use Illuminate\Foundation\Http\FormRequest;

class EmitirNfeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'serie' => ['nullable', 'integer', 'min:1', 'max:999'],
            'ide' => ['nullable', 'array'],
            'ide.natOp' => ['nullable', 'string', 'max:60'],
            'ide.tpNF' => ['nullable', 'integer'],
            'ide.idDest' => ['nullable', 'integer'],
            'ide.indFinal' => ['nullable', 'integer'],
            'ide.indPres' => ['nullable', 'integer'],
            'ide.finNFe' => ['nullable', 'integer'],
            'destinatario' => ['required', 'array'],
            'destinatario.documento' => ['required', 'string'],
            'destinatario.xNome' => ['required', 'string', 'max:60'],
            'destinatario.indIEDest' => ['nullable', 'integer'],
            'destinatario.IE' => ['nullable', 'string'],
            'destinatario.email' => ['nullable', 'email'],
            'destinatario.logradouro' => ['required', 'string'],
            'destinatario.numero' => ['required', 'string'],
            'destinatario.complemento' => ['nullable', 'string'],
            'destinatario.bairro' => ['required', 'string'],
            'destinatario.codigo_municipio' => ['required', 'string', 'size:7'],
            'destinatario.municipio' => ['required', 'string'],
            'destinatario.uf' => ['required', 'string', 'size:2'],
            'destinatario.cep' => ['required', 'string'],
            'destinatario.telefone' => ['nullable', 'string'],
            'itens' => ['required', 'array', 'min:1'],
            'itens.*.cProd' => ['required', 'string'],
            'itens.*.xProd' => ['required', 'string'],
            'itens.*.NCM' => ['required', 'string'],
            'itens.*.CFOP' => ['required', 'string'],
            'itens.*.uCom' => ['required', 'string'],
            'itens.*.qCom' => ['required', 'numeric'],
            'itens.*.vUnCom' => ['required', 'numeric'],
            'itens.*.vProd' => ['required', 'numeric'],
            'itens.*.imposto' => ['nullable', 'array'],
            'totais' => ['required', 'array'],
            'totais.vProd' => ['required', 'numeric'],
            'totais.vNF' => ['required', 'numeric'],
            'transporte' => ['nullable', 'array'],
            'pagamentos' => ['required', 'array', 'min:1'],
            'pagamentos.*.tPag' => ['required', 'string'],
            'pagamentos.*.vPag' => ['required', 'numeric'],
            'infAdic' => ['nullable', 'array'],
            'sincrono' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('destinatario.documento')) {
            $dest = $this->input('destinatario');
            $dest['documento'] = preg_replace('/\D/', '', (string) ($dest['documento'] ?? ''));
            $dest['cep'] = preg_replace('/\D/', '', (string) ($dest['cep'] ?? ''));
            $dest['uf'] = strtoupper((string) ($dest['uf'] ?? ''));
            $this->merge(['destinatario' => $dest]);
        }
    }
}
