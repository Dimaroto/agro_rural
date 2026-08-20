@extends('layouts.emissor')

@section('title', 'Tributação — Emissor NFe')

@section('body')
@php
    $regime = $empresa->regime_tributario;
    $isSimples = $regime?->isSimples() ?? true;
@endphp
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">
            Defaults aplicados na emissão quando o sistema integrador não informar o campo no item.
            @if($isSimples)
                Regime <strong>Simples/MEI</strong>: ICMS via CSOSN; PIS/COFINS CST 49 (sem destaque).
            @elseif($regime?->value === 'lucro_presumido')
                Regime <strong>Lucro Presumido</strong>: ICMS via CST; PIS/COFINS cumulativo (0,65% / 3%).
            @else
                Regime <strong>Lucro Real</strong>: ICMS via CST; PIS/COFINS não cumulativo (1,65% / 7,60%).
            @endif
        </div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'tributacao') }}">
            @csrf
            <h3 style="margin:0 0 0.75rem;font-size:1rem;">Operação padrão</h3>
            <div class="grid">
                <div class="field span-2">
                    <label for="nat_op">Natureza da operação</label>
                    <input id="nat_op" name="nat_op" value="{{ old('nat_op', $cfg->nat_op) }}" required maxlength="60">
                </div>
                <div class="field">
                    <label for="cfop_interno">CFOP interno</label>
                    <input id="cfop_interno" name="cfop_interno" value="{{ old('cfop_interno', $cfg->cfop_interno) }}" required maxlength="4">
                </div>
                <div class="field">
                    <label for="cfop_interestadual">CFOP interestadual</label>
                    <input id="cfop_interestadual" name="cfop_interestadual"
                           value="{{ old('cfop_interestadual', $cfg->cfop_interestadual) }}" required maxlength="4">
                </div>
                <div class="field">
                    <label for="ind_final">Consumidor final (indFinal)</label>
                    <select id="ind_final" name="ind_final">
                        <option value="1" @selected((int) old('ind_final', $cfg->ind_final) === 1)>1 — Sim</option>
                        <option value="0" @selected((int) old('ind_final', $cfg->ind_final) === 0)>0 — Não</option>
                    </select>
                </div>
                <div class="field">
                    <label for="ind_pres">Indicador de presença (indPres)</label>
                    <select id="ind_pres" name="ind_pres">
                        @foreach([0=>'Não se aplica',1=>'Presencial',2=>'Internet',3=>'Teleatendimento',4=>'NFC-e entrega',5=>'Fora do estabelecimento',9=>'Outros'] as $v=>$l)
                            <option value="{{ $v }}" @selected((int) old('ind_pres', $cfg->ind_pres) === $v)>{{ $v }} — {{ $l }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="field">
                    <label for="mod_frete">Modalidade do frete</label>
                    <select id="mod_frete" name="mod_frete">
                        @foreach([0=>'Emitente',1=>'Destinatário',2=>'Terceiros',9=>'Sem frete'] as $v=>$l)
                            <option value="{{ $v }}" @selected((int) old('mod_frete', $cfg->mod_frete) === $v)>{{ $v }} — {{ $l }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="field">
                    <label for="t_pag">Forma de pagamento padrão</label>
                    <input id="t_pag" name="t_pag" value="{{ old('t_pag', $cfg->t_pag) }}" required maxlength="2" placeholder="01">
                </div>
                <div class="field">
                    <label for="perc_aprox_tributos">% tributos aproximados — mercadorias (Lei 12.741)</label>
                    <input id="perc_aprox_tributos" name="perc_aprox_tributos" type="number" step="0.01"
                           value="{{ old('perc_aprox_tributos', $cfg->perc_aprox_tributos) }}">
                </div>
            </div>

            @if($isSimples)
                <h3 style="margin:1.25rem 0 0.75rem;font-size:1rem;">Venda de peças / mercadorias</h3>
                <div class="help" style="margin-bottom:0.85rem;">
                    Anexo e CSOSN usados na NF-e / NFC-e de peças. A mão de obra (NFS-e) usa outro anexo,
                    configurado na etapa <strong>Serviços</strong>.
                </div>
                <div class="grid">
                    <div class="field">
                        <label for="csosn_padrao">CSOSN padrão</label>
                        <select id="csosn_padrao" name="csosn_padrao" required>
                            @foreach(['101','102','103','201','202','203','300','400','500','900'] as $c)
                                <option value="{{ $c }}" @selected(old('csosn_padrao', $cfg->csosn_padrao) === $c)>{{ $c }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="field">
                        <label for="p_cred_sn">% crédito ICMS (CSOSN 101/201)</label>
                        <input id="p_cred_sn" name="p_cred_sn" type="number" step="0.0001"
                               value="{{ old('p_cred_sn', $cfg->p_cred_sn) }}">
                    </div>
                    <div class="field">
                        <label for="anexo_simples_mercadoria">Anexo do Simples (mercadorias)</label>
                        <select id="anexo_simples_mercadoria" name="anexo_simples_mercadoria">
                            <option value="">—</option>
                            <option value="1" @selected((int) old('anexo_simples_mercadoria', $cfg->anexo_simples_mercadoria) === 1)>Anexo I — Comércio</option>
                            <option value="2" @selected((int) old('anexo_simples_mercadoria', $cfg->anexo_simples_mercadoria) === 2)>Anexo II — Indústria</option>
                        </select>
                    </div>
                </div>
            @else
                <h3 style="margin:1.25rem 0 0.75rem;font-size:1rem;">ICMS / IPI (regime normal)</h3>
                <div class="grid">
                    <div class="field">
                        <label for="cst_icms_padrao">CST ICMS padrão</label>
                        <select id="cst_icms_padrao" name="cst_icms_padrao" required>
                            @foreach(['00','10','20','30','40','41','50','51','60','70','90'] as $c)
                                <option value="{{ $c }}" @selected(old('cst_icms_padrao', $cfg->cst_icms_padrao) === $c)>{{ $c }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="field">
                        <label for="p_icms_interno">Alíquota ICMS interna (%)</label>
                        <input id="p_icms_interno" name="p_icms_interno" type="number" step="0.0001"
                               value="{{ old('p_icms_interno', $cfg->p_icms_interno) }}" required>
                    </div>
                    <div class="field">
                        <label for="p_red_bc">% redução de base (CST 20/70)</label>
                        <input id="p_red_bc" name="p_red_bc" type="number" step="0.0001"
                               value="{{ old('p_red_bc', $cfg->p_red_bc) }}">
                    </div>
                    <div class="field">
                        <label for="p_fcp">% FCP</label>
                        <input id="p_fcp" name="p_fcp" type="number" step="0.0001"
                               value="{{ old('p_fcp', $cfg->p_fcp) }}">
                    </div>
                    <div class="field">
                        <label for="cst_ipi">CST IPI</label>
                        <input id="cst_ipi" name="cst_ipi" value="{{ old('cst_ipi', $cfg->cst_ipi ?: '99') }}" maxlength="2">
                    </div>
                    <div class="field">
                        <label for="p_ipi">Alíquota IPI (%)</label>
                        <input id="p_ipi" name="p_ipi" type="number" step="0.0001"
                               value="{{ old('p_ipi', $cfg->p_ipi) }}">
                    </div>
                    <div class="field">
                        <label for="cod_enq_ipi">Código de enquadramento IPI</label>
                        <input id="cod_enq_ipi" name="cod_enq_ipi" value="{{ old('cod_enq_ipi', $cfg->cod_enq_ipi ?: '999') }}" maxlength="3">
                    </div>
                </div>

                <h3 style="margin:1.25rem 0 0.75rem;font-size:1rem;">PIS / COFINS</h3>
                <div class="grid">
                    <div class="field">
                        <label for="cst_pis">CST PIS</label>
                        <input id="cst_pis" name="cst_pis" value="{{ old('cst_pis', $cfg->cst_pis) }}" required maxlength="2">
                    </div>
                    <div class="field">
                        <label for="p_pis">Alíquota PIS (%)</label>
                        <input id="p_pis" name="p_pis" type="number" step="0.0001"
                               value="{{ old('p_pis', $cfg->p_pis) }}" required>
                    </div>
                    <div class="field">
                        <label for="cst_cofins">CST COFINS</label>
                        <input id="cst_cofins" name="cst_cofins" value="{{ old('cst_cofins', $cfg->cst_cofins) }}" required maxlength="2">
                    </div>
                    <div class="field">
                        <label for="p_cofins">Alíquota COFINS (%)</label>
                        <input id="p_cofins" name="p_cofins" type="number" step="0.0001"
                               value="{{ old('p_cofins', $cfg->p_cofins) }}" required>
                    </div>
                </div>
            @endif

            <div class="wizard-nav">
                <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                <button class="btn btn-primary" type="submit">Salvar e próximo</button>
            </div>
        </form>
    </div>
</div>
@endsection
