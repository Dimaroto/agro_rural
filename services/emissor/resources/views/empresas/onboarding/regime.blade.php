@extends('layouts.emissor')

@section('title', 'Regime tributário — Emissor NFe')

@section('body')
<div class="wrap">
    @include('empresas.onboarding._header')

    <div class="card">
        <div class="help">
            O <strong>regime tributário</strong> define como a NF-e é montada (CSOSN vs CST, PIS/COFINS).
            Lucro Presumido e Lucro Real usam o mesmo CRT (3) na SEFAZ — a diferença está no PIS/COFINS.
        </div>

        <form method="post" action="{{ route('empresas.onboarding.store', 'regime') }}">
            @csrf
            <div class="grid">
                <div class="field span-2">
                    <label for="regime_tributario">Regime</label>
                    <select id="regime_tributario" name="regime_tributario" required>
                        @foreach($regimes as $r)
                            <option value="{{ $r->value }}"
                                @selected(old('regime_tributario', $empresa->regime_tributario?->value) === $r->value)>
                                {{ $r->label() }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div class="field span-2">
                    <div class="check-row">
                        <input type="checkbox" id="simples_excesso_sublimite" name="simples_excesso_sublimite" value="1"
                            @checked(old('simples_excesso_sublimite', $empresa->simples_excesso_sublimite))>
                        <div>
                            <label for="simples_excesso_sublimite">Simples Nacional com excesso de sublimite</label>
                            <div class="desc">Marque apenas se a empresa ultrapassou o sublimite estadual (CRT = 2).</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="wizard-nav">
                <span></span>
                <button class="btn btn-primary" type="submit">Salvar e próximo</button>
            </div>
        </form>
    </div>
</div>
@endsection
