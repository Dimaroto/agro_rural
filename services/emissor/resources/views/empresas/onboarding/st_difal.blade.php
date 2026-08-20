@extends('layouts.emissor')

@section('title', 'ST e DIFAL — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">
            Disponível apenas para <strong>regime normal (CRT 3)</strong>.
            DIFAL aplica-se em venda interestadual a consumidor final não contribuinte.
        </div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'st_difal') }}">
            @csrf
            <div class="check-row">
                <input type="checkbox" id="usa_icms_st" name="usa_icms_st" value="1"
                    @checked(old('usa_icms_st', $cfg->usa_icms_st))>
                <div>
                    <label for="usa_icms_st">Usar ICMS-ST por padrão</label>
                    <div class="desc">Preenche grupos CST 10/30/70 com MVA e alíquota ST.</div>
                </div>
            </div>
            <div class="grid">
                <div class="field">
                    <label for="cest_padrao">CEST padrão</label>
                    <input id="cest_padrao" name="cest_padrao" value="{{ old('cest_padrao', $cfg->cest_padrao) }}" maxlength="7">
                </div>
                <div class="field">
                    <label for="p_mva_st">% MVA ST</label>
                    <input id="p_mva_st" name="p_mva_st" type="number" step="0.0001"
                           value="{{ old('p_mva_st', $cfg->p_mva_st) }}">
                </div>
                <div class="field">
                    <label for="p_red_bc_st">% redução BC ST</label>
                    <input id="p_red_bc_st" name="p_red_bc_st" type="number" step="0.0001"
                           value="{{ old('p_red_bc_st', $cfg->p_red_bc_st) }}">
                </div>
                <div class="field">
                    <label for="p_icms_st">Alíquota ICMS ST (%)</label>
                    <input id="p_icms_st" name="p_icms_st" type="number" step="0.0001"
                           value="{{ old('p_icms_st', $cfg->p_icms_st) }}">
                </div>
            </div>

            <div class="check-row" style="margin-top:0.85rem;">
                <input type="checkbox" id="aplica_difal" name="aplica_difal" value="1"
                    @checked(old('aplica_difal', $cfg->aplica_difal))>
                <div>
                    <label for="aplica_difal">Calcular DIFAL automaticamente</label>
                    <div class="desc">Gera tag ICMSUFDest usando as alíquotas internas por UF.</div>
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
