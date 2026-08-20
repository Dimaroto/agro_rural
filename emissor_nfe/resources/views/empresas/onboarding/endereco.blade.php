@extends('layouts.emissor')

@section('title', 'Endereço — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <form method="post" action="{{ route('empresas.onboarding.store', 'endereco') }}">
            @csrf
            <div class="grid">
                <div class="field">
                    <label for="cep">CEP (8 dígitos)</label>
                    <input id="cep" name="cep" value="{{ old('cep', $empresa->cep) }}" required maxlength="8">
                </div>
                <div class="field">
                    <label for="uf">UF</label>
                    <input id="uf" name="uf" value="{{ old('uf', $empresa->uf) }}" required maxlength="2">
                </div>
                <div class="field span-2">
                    <label for="logradouro">Logradouro</label>
                    <input id="logradouro" name="logradouro" value="{{ old('logradouro', $empresa->logradouro) }}" required>
                </div>
                <div class="field">
                    <label for="numero">Número</label>
                    <input id="numero" name="numero" value="{{ old('numero', $empresa->numero) }}" required>
                </div>
                <div class="field">
                    <label for="complemento">Complemento</label>
                    <input id="complemento" name="complemento" value="{{ old('complemento', $empresa->complemento) }}">
                </div>
                <div class="field">
                    <label for="bairro">Bairro</label>
                    <input id="bairro" name="bairro" value="{{ old('bairro', $empresa->bairro) }}" required>
                </div>
                <div class="field">
                    <label for="municipio">Município</label>
                    <input id="municipio" name="municipio" value="{{ old('municipio', $empresa->municipio) }}" required>
                </div>
                <div class="field">
                    <label for="codigo_municipio">Código IBGE (7 dígitos)</label>
                    <input id="codigo_municipio" name="codigo_municipio"
                           value="{{ old('codigo_municipio', $empresa->codigo_municipio) }}" required maxlength="7">
                </div>
            </div>

            <div class="wizard-nav">
                <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                <button class="btn btn-primary" type="submit">Salvar e próximo</button>
            </div>
        </form>
    </div>
</div>
@endsection
