@extends('layouts.emissor')

@section('title', 'Login · '.config('app.name'))

@section('body')
<div class="login-wrap">
    <main class="card login-card">
        <h1 style="margin:0 0 0.35rem;font-size:1.4rem;">{{ config('app.name', 'Emissor NFe') }}</h1>
        <p class="muted" style="margin:0 0 1.25rem;line-height:1.45;">
            Painel local do emissor NF-e / NFS-e.
        </p>

        @if ($errors->any())
            <div class="flash err">
                {{ $errors->first() }}
            </div>
        @endif

        <form method="post" action="{{ route('login.attempt') }}">
            @csrf
            <div class="field" style="margin-bottom:0.85rem;">
                <label for="email">E-mail</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username">
            </div>
            <div class="field" style="margin-bottom:0.85rem;">
                <label for="password">Senha</label>
                <input id="password" type="password" name="password" required autocomplete="current-password">
            </div>
            <label style="display:flex;align-items:center;gap:0.45rem;margin-bottom:1rem;">
                <input type="checkbox" name="remember" value="1" style="width:auto;">
                <span>Manter conectado</span>
            </label>
            <button class="btn btn-primary" type="submit" style="width:100%;">Entrar</button>
        </form>
    </main>
</div>
@endsection
