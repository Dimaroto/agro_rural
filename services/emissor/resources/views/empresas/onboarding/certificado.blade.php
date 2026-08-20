@extends('layouts.emissor')

@section('title', 'Certificado — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        @if($empresa->certificado)
            <div class="help">
                Certificado atual:
                <strong>{{ $empresa->certificado->razao_social_certificado ?: 'A1' }}</strong>
                · válido até
                <strong>{{ optional($empresa->certificado->valido_ate)->format('d/m/Y H:i') ?: '—' }}</strong>.
                Envie outro arquivo apenas se quiser substituir.
            </div>
        @else
            <div class="help">Envie o certificado digital A1 (.pfx / .p12) e a senha. Obrigatório para autorizar na SEFAZ.</div>
        @endif

        <form method="post" action="{{ route('empresas.onboarding.store', 'certificado') }}" enctype="multipart/form-data">
            @csrf
            <div class="grid">
                <div class="field">
                    <label for="pfx">Arquivo .pfx</label>
                    <input id="pfx" name="pfx" type="file" accept=".pfx,.p12" {{ $empresa->certificado ? '' : 'required' }}>
                </div>
                <div class="field">
                    <label for="senha">Senha do certificado</label>
                    <input id="senha" name="senha" type="password" {{ $empresa->certificado ? '' : 'required' }}>
                </div>
            </div>

            <div class="wizard-nav">
                <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                <button class="btn btn-primary" type="submit">
                    {{ $empresa->certificado ? 'Manter / atualizar e próximo' : 'Salvar e próximo' }}
                </button>
            </div>
        </form>
    </div>
</div>
@endsection
