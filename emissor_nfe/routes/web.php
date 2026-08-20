<?php

use App\Http\Controllers\Web\AuthController;
use App\Http\Controllers\Web\ConfiguracaoController;
use App\Http\Controllers\Web\OnboardingEmpresaController;
use App\Http\Controllers\Web\PainelController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.attempt');
});

Route::middleware('auth')->group(function () {
    Route::get('/', [PainelController::class, 'index'])->name('painel');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/notas/{chave}/xml', [PainelController::class, 'xml'])->name('notas.xml');
    Route::get('/notas/{chave}/danfe', [PainelController::class, 'danfe'])->name('notas.danfe');

    // Wizard de cadastro fiscal (substitui as abas de /configuracoes)
    Route::get('/empresas/onboarding', [OnboardingEmpresaController::class, 'index'])->name('empresas.onboarding.index');
    Route::get('/empresas/onboarding/{etapa}', [OnboardingEmpresaController::class, 'show'])->name('empresas.onboarding.show');
    Route::post('/empresas/onboarding/{etapa}', [OnboardingEmpresaController::class, 'store'])->name('empresas.onboarding.store');
    Route::post('/empresas/ativa', [OnboardingEmpresaController::class, 'selectEmpresa'])->name('empresas.ativa');
    Route::post('/empresas/nova', [OnboardingEmpresaController::class, 'createEmpresa'])->name('empresas.nova');

    Route::get('/configuracoes', fn () => redirect()->route('empresas.onboarding.index'))->name('configuracoes');

    // Token Sanctum para o app Agro
    Route::post('/configuracoes/token', [ConfiguracaoController::class, 'createToken'])->name('configuracoes.token');
    Route::post('/configuracoes/empresa-ativa', [OnboardingEmpresaController::class, 'selectEmpresa'])->name('configuracoes.empresa-ativa');
});
