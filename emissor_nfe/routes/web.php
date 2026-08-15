<?php

use App\Http\Controllers\Web\AuthController;
use App\Http\Controllers\Web\ConfiguracaoController;
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

    Route::get('/configuracoes', [ConfiguracaoController::class, 'show'])->name('configuracoes');
    Route::post('/configuracoes/empresa-ativa', [ConfiguracaoController::class, 'selectEmpresa'])->name('configuracoes.empresa-ativa');
    Route::post('/configuracoes/empresa', [ConfiguracaoController::class, 'updateEmpresa'])->name('configuracoes.empresa');
    Route::post('/configuracoes/certificado', [ConfiguracaoController::class, 'uploadCertificado'])->name('configuracoes.certificado');
    Route::post('/configuracoes/numeracao', [ConfiguracaoController::class, 'updateNumeracao'])->name('configuracoes.numeracao');
    Route::post('/configuracoes/csc', [ConfiguracaoController::class, 'updateCsc'])->name('configuracoes.csc');
    Route::post('/configuracoes/token', [ConfiguracaoController::class, 'createToken'])->name('configuracoes.token');
});
