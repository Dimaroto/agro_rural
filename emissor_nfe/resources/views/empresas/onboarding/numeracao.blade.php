@extends('layouts.emissor')

@section('title', 'Numeração — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <form method="post" action="{{ route('empresas.onboarding.store', 'numeracao') }}">
            @csrf
            <div class="grid">
                @if($empresa->emite_nfe)
                    <div class="field">
                        <label for="serie_55">Série NF-e (55)</label>
                        <input id="serie_55" name="serie_55" type="number" min="1" max="999"
                               value="{{ old('serie_55', $num55?->serie ?? 1) }}" required>
                    </div>
                    <div class="field">
                        <label for="proximo_55">Próximo número NF-e</label>
                        <input id="proximo_55" name="proximo_55" type="number" min="1"
                               value="{{ old('proximo_55', $num55?->proximo_numero ?? 1) }}" required>
                    </div>
                @endif
                @if($empresa->emite_nfce)
                    <div class="field">
                        <label for="serie_65">Série NFC-e (65)</label>
                        <input id="serie_65" name="serie_65" type="number" min="1" max="999"
                               value="{{ old('serie_65', $num65?->serie ?? 1) }}" required>
                    </div>
                    <div class="field">
                        <label for="proximo_65">Próximo número NFC-e</label>
                        <input id="proximo_65" name="proximo_65" type="number" min="1"
                               value="{{ old('proximo_65', $num65?->proximo_numero ?? 1) }}" required>
                    </div>
                @endif
                @if($empresa->emite_nfse)
                    <div class="field">
                        <label for="serie_0">Série NFS-e</label>
                        <input id="serie_0" name="serie_0" type="number" min="1" max="999"
                               value="{{ old('serie_0', $num0?->serie ?? $cfg->serie_nfse ?? 1) }}" required>
                    </div>
                    <div class="field">
                        <label for="proximo_0">Próximo número NFS-e</label>
                        <input id="proximo_0" name="proximo_0" type="number" min="1"
                               value="{{ old('proximo_0', $num0?->proximo_numero ?? 1) }}" required>
                    </div>
                @endif
                @if(! $empresa->emite_nfe && ! $empresa->emite_nfce && ! $empresa->emite_nfse)
                    <p class="muted span-2">Nenhum documento habilitado. A numeração não é necessária.</p>
                @endif
            </div>

            <div class="wizard-nav">
                <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                <button class="btn btn-primary" type="submit">Salvar e próximo</button>
            </div>
        </form>
    </div>
</div>
@endsection
