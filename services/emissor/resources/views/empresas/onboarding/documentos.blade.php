@extends('layouts.emissor')

@section('title', 'Documentos — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">Escolha quais documentos esta empresa emite. Isso define as próximas etapas (CSC, NFS-e, numeração).</div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'documentos') }}">
            @csrf
            <div class="check-row">
                <input type="checkbox" id="emite_nfe" name="emite_nfe" value="1"
                    @checked(old('emite_nfe', $empresa->emite_nfe))>
                <div>
                    <label for="emite_nfe">NF-e (modelo 55)</label>
                    <div class="desc">Nota fiscal eletrônica de produto.</div>
                </div>
            </div>
            <div class="check-row">
                <input type="checkbox" id="emite_nfce" name="emite_nfce" value="1"
                    @checked(old('emite_nfce', $empresa->emite_nfce))>
                <div>
                    <label for="emite_nfce">NFC-e (modelo 65)</label>
                    <div class="desc">Cupom fiscal eletrônico — exige CSC da SEFAZ.</div>
                </div>
            </div>
            <div class="check-row">
                <input type="checkbox" id="emite_nfse" name="emite_nfse" value="1"
                    @checked(old('emite_nfse', $empresa->emite_nfse))>
                <div>
                    <label for="emite_nfse">NFS-e</label>
                    <div class="desc">Nota de serviço — exige IM e item da LC 116.</div>
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
