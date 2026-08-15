@extends('layouts.emissor')

@section('title', 'Painel · '.config('app.name'))

@section('body')
@php
    $ambienteLabel = $empresa->ambiente === 'producao' ? 'Produção' : 'Homologação';
    $ambienteClass = $empresa->ambiente === 'producao' ? 'warn' : 'ok';
@endphp
<div class="wrap">
    <header class="topbar">
        <div class="brand">
            <h1>{{ config('app.name', 'Emissor NFe') }}</h1>
            <div class="sub">{{ $empresa->razao_social }} · CNPJ {{ $empresa->cnpj }}</div>
        </div>
        <div class="actions">
            <span class="pill ok">Online</span>
            <span class="pill {{ $ambienteClass }}">{{ $ambienteLabel }}</span>
            @if ($certOk)
                <span class="pill ok" title="{{ $certMeta['valido_ate'] ?? '' }}">Certificado válido</span>
            @elseif ($certMeta)
                <span class="pill danger">Certificado vencido</span>
            @else
                <span class="pill warn">Sem certificado</span>
            @endif
            <a class="btn btn-primary" href="{{ route('configuracoes') }}">Configurações</a>
            <form method="post" action="{{ route('logout') }}" style="display:inline;">
                @csrf
                <button class="btn btn-ghost" type="submit">Sair</button>
            </form>
        </div>
    </header>

    @if (session('success'))
        <div class="flash ok">{{ session('success') }}</div>
    @endif

    <section class="card">
        <h2 style="margin:0 0 0.85rem;font-size:1.05rem;">Histórico de emissões</h2>

        @if ($notas->isEmpty())
            <div class="empty">Nenhuma nota emitida ainda. As emissões feitas pelo admin Agro Rural aparecem aqui.</div>
        @else
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Modelo</th>
                            <th>Número / série</th>
                            <th>Status</th>
                            <th>Chave</th>
                            <th>Protocolo</th>
                            <th>Motivo SEFAZ</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($notas as $nota)
                            @php
                                $st = $nota->status?->value ?? '';
                                $badge = match ($st) {
                                    'autorizada' => 'ok',
                                    'rejeitada', 'cancelada', 'denegada' => 'danger',
                                    default => 'warn',
                                };
                                $chave = (string) ($nota->chave ?? '');
                                $chaveCurta = strlen($chave) > 14
                                    ? substr($chave, 0, 8).'…'.substr($chave, -6)
                                    : $chave;
                                $data = $nota->autorizada_em
                                    ?? $nota->cancelada_em
                                    ?? $nota->created_at;
                            @endphp
                            <tr>
                                <td>{{ $data?->format('d/m/Y H:i') ?? '—' }}</td>
                                <td class="mono">{{ $nota->modelo }}</td>
                                <td class="mono">{{ $nota->numero }} / {{ $nota->serie }}</td>
                                <td><span class="badge {{ $badge }}">{{ $st }}</span></td>
                                <td class="mono" title="{{ $chave }}">{{ $chaveCurta ?: '—' }}</td>
                                <td class="mono">{{ $nota->protocolo ?: '—' }}</td>
                                <td class="muted" style="max-width:220px;">
                                    @if ($nota->c_stat || $nota->x_motivo)
                                        <span class="mono">{{ $nota->c_stat }}</span>
                                        {{ $nota->x_motivo }}
                                    @else
                                        —
                                    @endif
                                </td>
                                <td>
                                    <div class="row-actions">
                                        @if ($nota->xml_autorizado || $nota->xml_assinado)
                                            <a class="btn" href="{{ route('notas.xml', $chave) }}" target="_blank" rel="noopener">XML</a>
                                        @endif
                                        @if ($nota->status === \App\Enums\NotaStatus::Autorizada || $nota->xml_autorizado)
                                            <a class="btn" href="{{ route('notas.danfe', $chave) }}" target="_blank" rel="noopener">DANFE</a>
                                        @endif
                                    </div>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            @if ($notas->hasPages())
                <div class="pagination">
                    @if ($notas->onFirstPage())
                        <span>Anterior</span>
                    @else
                        <a href="{{ $notas->previousPageUrl() }}">Anterior</a>
                    @endif
                    <span class="current">Página {{ $notas->currentPage() }} de {{ $notas->lastPage() }}</span>
                    @if ($notas->hasMorePages())
                        <a href="{{ $notas->nextPageUrl() }}">Próxima</a>
                    @else
                        <span>Próxima</span>
                    @endif
                </div>
            @endif
        @endif
    </section>
</div>
@endsection
