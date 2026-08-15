<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmpresaController;
use App\Http\Controllers\Api\V1\Integracoes\AgroNfeController;
use App\Http\Controllers\Api\V1\NfeController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
    // Token gerado no PC (arquivo local) — só faz sentido em 127.0.0.1
    Route::get('/integracoes/agro/token-local', [AgroNfeController::class, 'tokenLocal']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::get('/empresas', [EmpresaController::class, 'index']);
        Route::post('/empresas', [EmpresaController::class, 'store']);
        Route::get('/empresas/{empresa}', [EmpresaController::class, 'show']);
        Route::put('/empresas/{empresa}', [EmpresaController::class, 'update']);
        Route::put('/empresas/{empresa}/numeracao', [EmpresaController::class, 'updateNumeracao']);
        Route::post('/empresas/{empresa}/certificado', [EmpresaController::class, 'uploadCertificado']);
        Route::get('/empresas/{empresa}/certificado', [EmpresaController::class, 'showCertificado']);
        Route::get('/empresas/{empresa}/sefaz/status', [EmpresaController::class, 'statusSefaz']);

        Route::get('/empresas/{empresa}/nfe', [NfeController::class, 'index']);
        Route::post('/empresas/{empresa}/nfe', [NfeController::class, 'store']);
        Route::post('/empresas/{empresa}/nfe/inutilizar', [NfeController::class, 'inutilizar']);
        Route::post('/empresas/{empresa}/nfe/consultar', [NfeController::class, 'consultar']);
        Route::get('/empresas/{empresa}/nfe/{chave}', [NfeController::class, 'show']);
        Route::get('/empresas/{empresa}/nfe/{chave}/xml', [NfeController::class, 'xml']);
        Route::get('/empresas/{empresa}/nfe/{chave}/danfe', [NfeController::class, 'danfe']);
        Route::post('/empresas/{empresa}/nfe/{chave}/cancelar', [NfeController::class, 'cancelar']);
        Route::post('/empresas/{empresa}/nfe/{chave}/cce', [NfeController::class, 'cce']);

        // Adaptador para o admin Agro Rural (browser -> 127.0.0.1:8000)
        Route::post('/integracoes/agro/nfe/emitir', [AgroNfeController::class, 'emitir']);
        Route::post('/integracoes/agro/nfce/emitir', [AgroNfeController::class, 'emitirNfce']);
        Route::post('/integracoes/agro/nfse/emitir', [AgroNfeController::class, 'emitirNfse']);
        Route::post('/integracoes/agro/nfe/download-por-chave', [AgroNfeController::class, 'downloadPorChave']);
    });
});
