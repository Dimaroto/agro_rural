{{-- Partial: cabeçalho + stepper do onboarding --}}
@php
    $idxAtual = array_search($etapa, $etapas, true);
@endphp
<div class="topbar">
    <div class="brand">
        <h1>Cadastro fiscal</h1>
        <div class="sub">{{ $empresa->razao_social }} · CRT {{ $empresa->crt }}
            @if($empresa->regime_tributario)
                · {{ $empresa->regime_tributario->label() }}
            @endif
        </div>
    </div>
    <div class="actions">
        <a class="btn btn-ghost" href="/">Painel</a>
        <form method="post" action="{{ route('empresas.nova') }}" style="display:inline">
            @csrf
            <button class="btn btn-ghost" type="submit">Nova empresa</button>
        </form>
        <form method="post" action="/logout" style="display:inline">@csrf
            <button class="btn btn-ghost" type="submit">Sair</button>
        </form>
    </div>
</div>

@if($empresas->count() > 1)
<form method="post" action="{{ route('empresas.ativa') }}" class="card" style="margin-bottom:1rem;display:flex;gap:0.75rem;align-items:end;flex-wrap:wrap;">
    @csrf
    <div class="field" style="flex:1;min-width:220px;margin:0;">
        <label for="empresa_id">Empresa ativa</label>
        <select id="empresa_id" name="empresa_id">
            @foreach($empresas as $e)
                <option value="{{ $e->id }}" @selected($e->id === $empresa->id)>
                    #{{ $e->id }} — {{ $e->razao_social }}
                </option>
            @endforeach
        </select>
    </div>
    <button class="btn" type="submit">Trocar</button>
</form>
@endif

@if(session('success'))
    <div class="flash ok">{{ session('success') }}</div>
@endif
@if($errors->any())
    <div class="flash err">
        <ul style="margin:0;padding-left:1.1rem;">
            @foreach($errors->all() as $err)<li>{{ $err }}</li>@endforeach
        </ul>
    </div>
@endif

<ol class="steps">
    @foreach($etapas as $i => $e)
        <li>
            <a href="{{ route('empresas.onboarding.show', $e) }}"
               class="{{ $e === $etapa ? 'active' : ($idxAtual !== false && $i < $idxAtual ? 'done' : '') }}">
                <span class="num">{{ $i + 1 }}</span>
                {{ $labels[$e] ?? $e }}
            </a>
        </li>
    @endforeach
</ol>
