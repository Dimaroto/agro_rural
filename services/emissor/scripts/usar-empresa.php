<?php

/**
 * Vincula o usuário admin à empresa indicada e define como ativa.
 *
 * Uso (na pasta emissor_nfe):
 *   runtime\php\php.exe scripts\usar-empresa.php 1
 */

use App\Models\Empresa;
use App\Models\User;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$empresaId = (int) ($argv[1] ?? 1);
$email = (string) (env('SEED_ADMIN_EMAIL') ?: 'admin@emissor.local');

$empresa = Empresa::query()->find($empresaId);
if (! $empresa) {
    fwrite(STDERR, "Empresa id={$empresaId} nao encontrada.\n");
    exit(1);
}

$user = User::query()->where('email', $email)->first()
    ?? User::query()->orderBy('id')->first();

if (! $user) {
    fwrite(STDERR, "Nenhum usuario encontrado.\n");
    exit(1);
}

$user->empresas()->syncWithoutDetaching([$empresa->id]);

// Remove sessões antigas que apontavam para outra empresa (file driver).
$sessionPath = storage_path('framework/sessions');
if (is_dir($sessionPath)) {
    foreach (glob($sessionPath.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
        if (is_file($file)) {
            @unlink($file);
        }
    }
}

echo json_encode([
    'ok' => true,
    'user' => $user->email,
    'empresa_id' => $empresa->id,
    'cnpj' => $empresa->cnpj,
    'razao_social' => $empresa->razao_social,
    'vinculos' => $user->empresas()->orderBy('empresas.id')->pluck('empresas.id'),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT).PHP_EOL;

// Dica: no Flutter use empresaId = $empresa->id
echo "Pronto. No painel, use empresaId={$empresa->id}. No Flutter: Configuracoes > Fiscal > empresaId={$empresa->id}.\n";
