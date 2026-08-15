<?php

/**
 * Rotaciona senha do admin conhecido (vazou no git) e grava SEED_ADMIN_* no .env.
 * Uso: php scripts/rotate-admin-password.php
 * Remover apos uso se preferir.
 */

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = getenv('SEED_ADMIN_EMAIL') ?: 'diogo.pieri53@gmail.com';
$user = User::query()->where('email', $email)->first();
if (! $user) {
    fwrite(STDERR, "USER_NOT_FOUND: {$email}\n");
    exit(1);
}

$pw = Str::password(20);
$user->forceFill(['password' => Hash::make($pw)])->save();
$user->tokens()->delete();

$envPath = base_path('.env');
$raw = file_get_contents($envPath);
$pairs = [
    'SEED_ADMIN_EMAIL' => $email,
    'SEED_ADMIN_PASSWORD' => $pw,
    'SEED_ADMIN_NAME' => $user->name ?: 'Administrador',
];
foreach ($pairs as $k => $v) {
    // Valores com espaco precisam de aspas no .env
    $encoded = preg_match('/\s/', $v) ? '"'.$v.'"' : $v;
    if (preg_match('/^'.preg_quote($k, '/').'=.*/m', $raw)) {
        $raw = preg_replace('/^'.preg_quote($k, '/').'=.*/m', $k.'='.$encoded, $raw);
    } else {
        $raw = rtrim($raw)."\n{$k}={$encoded}\n";
    }
}
file_put_contents($envPath, $raw);

echo "PASSWORD_ROTATED_OK\n";
echo "Credenciais gravadas em emissor_nfe/.env (SEED_ADMIN_*). Tokens Sanctum revogados.\n";
