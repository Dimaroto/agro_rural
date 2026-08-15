<?php

/**
 * Garante um token Sanctum em .agro_token.txt (+ LocalAppData\config)
 * para o admin Agro Rural emitir NF-e sem Unauthenticated.
 *
 * Uso:
 *   runtime\php\php.exe scripts\ensure-agro-token.php
 *   runtime\php\php.exe scripts\ensure-agro-token.php --force
 */

use App\Models\User;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$force = in_array('--force', $argv ?? [], true);
$emissorRoot = dirname(__DIR__);
$tokenFile = $emissorRoot.DIRECTORY_SEPARATOR.'.agro_token.txt';
$localApp = getenv('LOCALAPPDATA') ?: '';
$configDir = $localApp !== ''
    ? $localApp.DIRECTORY_SEPARATOR.'Agro Rural Zortea'.DIRECTORY_SEPARATOR.'emissor'.DIRECTORY_SEPARATOR.'config'
    : '';
$configToken = $configDir !== '' ? $configDir.DIRECTORY_SEPARATOR.'.agro_token.txt' : '';

function tokenLooksValid(?string $token): bool
{
    if ($token === null) {
        return false;
    }
    $token = trim($token);

    // Sanctum: "{id}|{plain}"
    return (bool) preg_match('/^\d+\|[A-Za-z0-9]{20,}$/', $token);
}

function writeTokenFiles(string $token, string $tokenFile, string $configDir, string $configToken): void
{
    file_put_contents($tokenFile, $token);
    if ($configDir !== '' && $configToken !== '') {
        if (! is_dir($configDir)) {
            @mkdir($configDir, 0777, true);
        }
        @file_put_contents($configToken, $token);
    }
}

$existing = is_file($tokenFile) ? trim((string) file_get_contents($tokenFile)) : '';
if (! $force && tokenLooksValid($existing)) {
    // Valida se ainda existe no banco (personal_access_tokens)
    $parts = explode('|', $existing, 2);
    $id = (int) ($parts[0] ?? 0);
    $exists = $id > 0 && DB::table('personal_access_tokens')->where('id', $id)->exists();
    if ($exists) {
        writeTokenFiles($existing, $tokenFile, $configDir, $configToken);
        echo json_encode(['ok' => true, 'reused' => true, 'token_file' => $tokenFile], JSON_UNESCAPED_SLASHES).PHP_EOL;
        exit(0);
    }
}

$email = (string) (env('SEED_ADMIN_EMAIL') ?: '');
$user = $email !== ''
    ? User::query()->where('email', $email)->first()
    : null;
$user ??= User::query()->orderBy('id')->first();

if (! $user) {
    fwrite(STDERR, "Nenhum usuario no emissor para gerar token.\n");
    exit(1);
}

// Revoga tokens antigos agro-app para nao acumular
$user->tokens()->where('name', 'agro-app')->delete();
$plain = $user->createToken('agro-app')->plainTextToken;
writeTokenFiles($plain, $tokenFile, $configDir, $configToken);

echo json_encode([
    'ok' => true,
    'created' => true,
    'user' => $user->email,
    'token_file' => $tokenFile,
    'token_prefix' => explode('|', $plain, 2)[0].'|…',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL;
