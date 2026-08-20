@extends('layouts.emissor')

@section('title', 'Revisão — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <h3 style="margin:0 0 0.75rem;font-size:1.05rem;">Resumo</h3>
        <table>
            <tr><th>CNPJ</th><td class="mono">{{ $empresa->cnpj }}</td></tr>
            <tr><th>Razão social</th><td>{{ $empresa->razao_social }}</td></tr>
            <tr><th>Regime</th><td>{{ $empresa->regime_tributario?->label() ?? '—' }} (CRT {{ $empresa->crt }})</td></tr>
            @if($empresa->regime_tributario?->isSimples())
                <tr><th>Anexo — mercadorias</th>
                    <td>{{ $cfg->anexo_simples_mercadoria ? 'Anexo '.$cfg->anexo_simples_mercadoria : '—' }}</td>
                </tr>
                @if($empresa->emite_nfse)
                    <tr><th>Anexo — serviços</th>
                        <td>{{ $cfg->anexo_simples_servico ? 'Anexo '.$cfg->anexo_simples_servico : '—' }}</td>
                    </tr>
                @endif
            @endif
            <tr><th>Ambiente</th><td>{{ $empresa->ambiente }}</td></tr>
            <tr><th>Documentos</th>
                <td>
                    @if($empresa->emite_nfe) NF-e @endif
                    @if($empresa->emite_nfce) · NFC-e @endif
                    @if($empresa->emite_nfse) · NFS-e @endif
                </td>
            </tr>
            <tr><th>Certificado</th>
                <td>
                    @if($empresa->certificado)
                        <span class="badge ok">OK</span>
                        até {{ optional($empresa->certificado->valido_ate)->format('d/m/Y') ?: '—' }}
                    @else
                        <span class="badge danger">Ausente</span>
                    @endif
                </td>
            </tr>
        </table>

        <h3 style="margin:1.25rem 0 0.75rem;font-size:1.05rem;">Checklist</h3>
        @if(count($pendencias) === 0)
            <div class="flash ok">Nenhuma pendência bloqueante. Pode concluir o cadastro.</div>
        @else
            <ul style="padding-left:1.1rem;margin:0;">
                @foreach($pendencias as $p)
                    <li style="margin-bottom:0.4rem;">
                        {{ $p['mensagem'] }}
                        — <a href="{{ route('empresas.onboarding.show', $p['etapa']) }}">corrigir</a>
                    </li>
                @endforeach
            </ul>
        @endif

        <form method="post" action="{{ route('empresas.onboarding.store', 'revisao') }}">
            @csrf
            <div class="wizard-nav">
                <a class="btn btn-ghost" href="{{ route('empresas.onboarding.show', $anterior) }}">Voltar</a>
                <button class="btn btn-primary" type="submit" @disabled(count($pendencias) > 0)>
                    {{ $empresa->onboarding_concluido ? 'Atualizar conclusão' : 'Concluir cadastro' }}
                </button>
            </div>
        </form>

        <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);">
            <p class="muted" style="margin:0 0 0.65rem;">Integração com apps (token Sanctum):</p>
            <form method="post" action="{{ route('configuracoes.token') }}">
                @csrf
                <button class="btn" type="submit">Gerar token de integração</button>
            </form>
            @if(session('token_criado'))
                <div class="token-box">{{ session('token_criado') }}</div>
            @endif
        </div>
    </div>
</div>
@endsection
