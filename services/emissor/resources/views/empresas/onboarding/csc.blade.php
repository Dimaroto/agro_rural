@extends('layouts.emissor')

@section('title', 'CSC — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">
            O <strong>CSC</strong> (Código de Segurança do Contribuinte) é gerado no portal da SEFAZ da sua UF
            e é obrigatório para NFC-e (modelo 65).
        </div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'csc') }}">
            @csrf
            <div class="grid">
                <div class="field">
                    <label for="csc_id">CSC ID</label>
                    <input id="csc_id" name="csc_id" value="{{ old('csc_id', $empresa->csc_id) }}" required maxlength="10">
                </div>
                <div class="field">
                    <label for="csc_token">CSC Token</label>
                    <input id="csc_token" name="csc_token" value="{{ old('csc_token', $empresa->csc_token) }}" required maxlength="60">
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
