@extends('layouts.emissor')

@section('title', 'Ambiente — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <form method="post" action="{{ route('empresas.onboarding.store', 'ambiente') }}">
            @csrf
            <div class="grid">
                <div class="field span-2">
                    <label for="ambiente">Ambiente SEFAZ</label>
                    <select id="ambiente" name="ambiente" required>
                        <option value="homologacao" @selected(old('ambiente', $empresa->ambiente) === 'homologacao')>Homologação</option>
                        <option value="producao" @selected(old('ambiente', $empresa->ambiente) === 'producao')>Produção</option>
                    </select>
                </div>
            </div>

            <h3 style="margin:1.1rem 0 0.75rem;font-size:1rem;">SPED Fiscal (EFD-ICMS/IPI)</h3>
            <div class="help">Usado pelo app na geração do arquivo SPED. CNAE principal fica na etapa Identificação.</div>
            <div class="grid">
                <div class="field">
                    <label for="perfil_efd">Perfil EFD</label>
                    <select id="perfil_efd" name="perfil_efd">
                        <option value="A" @selected(old('perfil_efd', $cfg->perfil_efd ?? 'A') === 'A')>A</option>
                        <option value="B" @selected(old('perfil_efd', $cfg->perfil_efd ?? 'A') === 'B')>B</option>
                    </select>
                </div>
                <div class="field">
                    <label for="ind_atividade">Indicador de atividade</label>
                    <select id="ind_atividade" name="ind_atividade">
                        <option value="0" @selected((int) old('ind_atividade', $cfg->ind_atividade ?? 1) === 0)>0 — Industrial</option>
                        <option value="1" @selected((int) old('ind_atividade', $cfg->ind_atividade ?? 1) === 1)>1 — Outros</option>
                    </select>
                </div>
                <div class="field">
                    <label for="versao_efd_layout">Versão do layout EFD</label>
                    <input id="versao_efd_layout" name="versao_efd_layout" maxlength="10"
                           value="{{ old('versao_efd_layout', $cfg->versao_efd_layout ?? '019') }}">
                </div>
            </div>

            <h3 style="margin:1.1rem 0 0.75rem;font-size:1rem;">Responsável técnico (infRespTec)</h3>
            <div class="help">Obrigatório em várias UFs. Se vazio, usa o CNPJ/contato da própria empresa ou o .env.</div>
            <div class="grid">
                <div class="field">
                    <label for="resp_tec_cnpj">CNPJ</label>
                    <input id="resp_tec_cnpj" name="resp_tec_cnpj" value="{{ old('resp_tec_cnpj', $empresa->resp_tec_cnpj) }}" maxlength="14">
                </div>
                <div class="field">
                    <label for="resp_tec_contato">Nome do contato</label>
                    <input id="resp_tec_contato" name="resp_tec_contato" value="{{ old('resp_tec_contato', $empresa->resp_tec_contato) }}">
                </div>
                <div class="field">
                    <label for="resp_tec_email">E-mail</label>
                    <input id="resp_tec_email" name="resp_tec_email" type="email" value="{{ old('resp_tec_email', $empresa->resp_tec_email) }}">
                </div>
                <div class="field">
                    <label for="resp_tec_fone">Telefone</label>
                    <input id="resp_tec_fone" name="resp_tec_fone" value="{{ old('resp_tec_fone', $empresa->resp_tec_fone) }}">
                </div>
                <div class="field">
                    <label for="resp_tec_csrt">CSRT</label>
                    <input id="resp_tec_csrt" name="resp_tec_csrt" value="{{ old('resp_tec_csrt', $empresa->resp_tec_csrt) }}">
                </div>
                <div class="field">
                    <label for="resp_tec_id_csrt">idCSRT</label>
                    <input id="resp_tec_id_csrt" name="resp_tec_id_csrt" value="{{ old('resp_tec_id_csrt', $empresa->resp_tec_id_csrt) }}" maxlength="2">
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
