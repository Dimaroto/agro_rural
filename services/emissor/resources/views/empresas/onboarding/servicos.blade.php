@extends('layouts.emissor')

@section('title', 'Serviços — Emissor NFe')

@section('body')
@php
    $regime = $empresa->regime_tributario;
    $isSimples = $regime?->isSimples() ?? false;
@endphp
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">Configuração para NFS-e e retenções federais (retTrib) quando aplicável.</div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'servicos') }}">
            @csrf

            <h3 style="margin:0 0 0.75rem;font-size:1rem;">Prestação de serviços</h3>
            @if($isSimples)
                <div class="help" style="margin-bottom:0.85rem;">
                    No Simples Nacional, serviços usam Anexo III, IV ou V (independente do anexo de venda de peças).
                </div>
            @endif
            <div class="grid">
                <div class="field">
                    <label for="inscricao_municipal">Inscrição municipal</label>
                    <input id="inscricao_municipal" name="inscricao_municipal"
                           value="{{ old('inscricao_municipal', $empresa->inscricao_municipal) }}">
                </div>
                <div class="field">
                    <label for="item_lc116">Item LC 116</label>
                    <input id="item_lc116" name="item_lc116" value="{{ old('item_lc116', $cfg->item_lc116) }}">
                </div>
                <div class="field">
                    <label for="codigo_tributacao_municipio">Código tributação município</label>
                    <input id="codigo_tributacao_municipio" name="codigo_tributacao_municipio"
                           value="{{ old('codigo_tributacao_municipio', $cfg->codigo_tributacao_municipio) }}">
                </div>
                <div class="field">
                    <label for="provedor_nfse">Provedor NFS-e</label>
                    <select id="provedor_nfse" name="provedor_nfse">
                        <option value="nacional" @selected(old('provedor_nfse', $cfg->provedor_nfse ?? 'nacional') === 'nacional')>Nacional (SEFIN)</option>
                        <option value="municipal" @selected(old('provedor_nfse', $cfg->provedor_nfse ?? 'nacional') === 'municipal')>Municipal</option>
                    </select>
                </div>
                <div class="field">
                    <label for="p_iss">Alíquota ISS (%)</label>
                    <input id="p_iss" name="p_iss" type="number" step="0.0001"
                           value="{{ old('p_iss', $cfg->p_iss) }}">
                </div>
                <div class="field">
                    <label for="nat_op_servico">Natureza da operação (serviços)</label>
                    <input id="nat_op_servico" name="nat_op_servico" maxlength="60"
                           value="{{ old('nat_op_servico', $cfg->nat_op_servico ?: 'PRESTACAO DE SERVICO') }}">
                </div>
                <div class="field">
                    <label for="perc_aprox_tributos_servico">% tributos aproximados — serviços (Lei 12.741)</label>
                    <input id="perc_aprox_tributos_servico" name="perc_aprox_tributos_servico" type="number" step="0.01"
                           value="{{ old('perc_aprox_tributos_servico', $cfg->perc_aprox_tributos_servico) }}">
                </div>
                @if($isSimples)
                    <div class="field">
                        <label for="anexo_simples_servico">Anexo do Simples (serviços)</label>
                        <select id="anexo_simples_servico" name="anexo_simples_servico">
                            <option value="">—</option>
                            <option value="3" @selected((int) old('anexo_simples_servico', $cfg->anexo_simples_servico) === 3)>Anexo III — Serviços (Fator R)</option>
                            <option value="4" @selected((int) old('anexo_simples_servico', $cfg->anexo_simples_servico) === 4)>Anexo IV — Serviços (ISS)</option>
                            <option value="5" @selected((int) old('anexo_simples_servico', $cfg->anexo_simples_servico) === 5)>Anexo V — Serviços (Fator R)</option>
                        </select>
                    </div>
                @endif
            </div>
            <div class="check-row">
                <input type="checkbox" id="iss_retido" name="iss_retido" value="1"
                    @checked(old('iss_retido', $cfg->iss_retido))>
                <div><label for="iss_retido">ISS retido pelo tomador</label></div>
            </div>

            <h3 style="margin:1.1rem 0 0.75rem;font-size:1rem;">Retenções federais (%)</h3>
            <div class="grid">
                <div class="field">
                    <label for="p_irrf">IRRF</label>
                    <input id="p_irrf" name="p_irrf" type="number" step="0.0001" value="{{ old('p_irrf', $cfg->p_irrf) }}">
                </div>
                <div class="field">
                    <label for="p_csll">CSLL</label>
                    <input id="p_csll" name="p_csll" type="number" step="0.0001" value="{{ old('p_csll', $cfg->p_csll) }}">
                </div>
                <div class="field">
                    <label for="p_pis_ret">PIS retido</label>
                    <input id="p_pis_ret" name="p_pis_ret" type="number" step="0.0001" value="{{ old('p_pis_ret', $cfg->p_pis_ret) }}">
                </div>
                <div class="field">
                    <label for="p_cofins_ret">COFINS retido</label>
                    <input id="p_cofins_ret" name="p_cofins_ret" type="number" step="0.0001" value="{{ old('p_cofins_ret', $cfg->p_cofins_ret) }}">
                </div>
                <div class="field">
                    <label for="p_inss_ret">INSS retido</label>
                    <input id="p_inss_ret" name="p_inss_ret" type="number" step="0.0001" value="{{ old('p_inss_ret', $cfg->p_inss_ret) }}">
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
