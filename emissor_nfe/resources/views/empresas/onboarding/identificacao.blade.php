@extends('layouts.emissor')

@section('title', 'Identificação — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">Dados do emitente que vão para a tag <strong>emit</strong> da NF-e (CNPJ, IE, IEST, IM, CNAE).</div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'identificacao') }}">
            @csrf
            <div class="grid">
                <div class="field">
                    <label for="cnpj">CNPJ</label>
                    <input id="cnpj" name="cnpj" value="{{ old('cnpj', $empresa->cnpj) }}" required maxlength="14">
                </div>
                <div class="field">
                    <label for="ie">Inscrição estadual</label>
                    <input id="ie" name="ie" value="{{ old('ie', $empresa->ie) }}" maxlength="20">
                </div>
                <div class="field">
                    <label for="iest">IEST (substituto tributário)</label>
                    <input id="iest" name="iest" value="{{ old('iest', $empresa->iest) }}" maxlength="20"
                           placeholder="Opcional — só se for ST em outra UF">
                </div>
                <div class="field">
                    <label for="inscricao_municipal">Inscrição municipal</label>
                    <input id="inscricao_municipal" name="inscricao_municipal"
                           value="{{ old('inscricao_municipal', $empresa->inscricao_municipal) }}" maxlength="30">
                </div>
                <div class="field">
                    <label for="cnae_fiscal">CNAE fiscal (7 dígitos)</label>
                    <input id="cnae_fiscal" name="cnae_fiscal" value="{{ old('cnae_fiscal', $empresa->cnae_fiscal) }}" maxlength="7">
                </div>
                <div class="field">
                    <label for="razao_social">Razão social</label>
                    <input id="razao_social" name="razao_social" value="{{ old('razao_social', $empresa->razao_social) }}" required>
                </div>
                <div class="field">
                    <label for="nome_fantasia">Nome fantasia</label>
                    <input id="nome_fantasia" name="nome_fantasia" value="{{ old('nome_fantasia', $empresa->nome_fantasia) }}">
                </div>
                <div class="field">
                    <label for="email">E-mail</label>
                    <input id="email" name="email" type="email" value="{{ old('email', $empresa->email) }}">
                </div>
                <div class="field">
                    <label for="telefone">Telefone</label>
                    <input id="telefone" name="telefone" value="{{ old('telefone', $empresa->telefone) }}" maxlength="20">
                </div>
            </div>

            <div class="wizard-nav">
                @if($anterior)
                    <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                @else
                    <span></span>
                @endif
                <button class="btn btn-primary" type="submit">Salvar e próximo</button>
            </div>
        </form>
    </div>
</div>
@endsection
