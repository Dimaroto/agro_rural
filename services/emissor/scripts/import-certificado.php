<?php

use App\Models\Empresa;
use App\Services\Nfe\CertificadoService;
use Illuminate\Http\UploadedFile;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$pfxPath = $argv[1] ?? null;
$senha = $argv[2] ?? null;
$empresaId = (int) ($argv[3] ?? 1);

if (! $pfxPath || $senha === null) {
    fwrite(STDERR, "Uso: php scripts/import-certificado.php caminho.pfx senha [empresaId]\n");
    exit(1);
}

$empresa = Empresa::query()->findOrFail($empresaId);
$file = new UploadedFile($pfxPath, basename($pfxPath), 'application/x-pkcs12', null, true);

try {
    $cert = app(CertificadoService::class)->store($empresa, $file, $senha);
    echo json_encode([
        'ok' => true,
        'id' => $cert->id,
        'cnpj' => $cert->cnpj_certificado,
        'razao' => $cert->razao_social_certificado,
        'valido_ate' => (string) $cert->valido_ate,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'ERRO: '.$e->getMessage().PHP_EOL);
    exit(1);
}
