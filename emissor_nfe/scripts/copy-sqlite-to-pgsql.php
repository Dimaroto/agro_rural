<?php

/**
 * Copia dados do SQLite local (database/database.sqlite) para o Postgres
 * configurado no .env (Neon). Rode DEPOIS de: php artisan migrate
 *
 * Uso (na pasta emissor_nfe):
 *   php scripts/copy-sqlite-to-pgsql.php
 *
 * Mantém IDs. Campos criptografados (certificado) são copiados como estão —
 * o APP_KEY do .env deve ser o mesmo usado quando o SQLite foi gerado.
 */

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$sqlitePath = database_path('database.sqlite');
if (! is_file($sqlitePath)) {
    fwrite(STDERR, "SQLite nao encontrado em {$sqlitePath}\n");
    exit(1);
}

if (config('database.default') !== 'pgsql') {
    fwrite(STDERR, 'DB_CONNECTION atual: '.config('database.default')." — configure pgsql/Neon no .env antes.\n");
    exit(1);
}

try {
    DB::connection()->getPdo();
} catch (Throwable $e) {
    fwrite(STDERR, 'Falha ao conectar no Postgres: '.$e->getMessage()."\n");
    exit(1);
}

$config = config('database.connections.sqlite');
$config['database'] = $sqlitePath;
$config['url'] = null;
config(['database.connections.sqlite_source' => $config]);
DB::purge('sqlite_source');

$src = DB::connection('sqlite_source');
$dst = DB::connection();

echo 'SQLite tables: '.implode(', ', array_map(
    static fn ($r) => $r->name,
    $src->select("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
))."\n";

/** @var list<string> $tables Ordem respeitando FKs */
$tables = [
    'users',
    'password_reset_tokens',
    'sessions',
    'cache',
    'cache_locks',
    'jobs',
    'job_batches',
    'failed_jobs',
    'personal_access_tokens',
    'empresas',
    'empresa_user',
    'certificados',
    'numeracoes',
    'notas',
    'eventos',
    'inutilizacoes',
];

echo "Origem: {$sqlitePath}\n";
echo 'Destino: '.config('database.connections.pgsql.host').' / '.config('database.default')."\n\n";

Schema::disableForeignKeyConstraints();

foreach ($tables as $table) {
    $sqliteHas = $src->getSchemaBuilder()->hasTable($table);
    if (! $sqliteHas) {
        echo "[skip] {$table} (nao existe no SQLite)\n";
        continue;
    }
    if (! Schema::hasTable($table)) {
        echo "[skip] {$table} (nao existe no Postgres — rode migrate)\n";
        continue;
    }

    $rows = $src->table($table)->get();
    if ($rows->isEmpty()) {
        echo "[ok] {$table}: 0 linhas\n";
        continue;
    }

    $dst->table($table)->delete();

    $chunk = [];
    $count = 0;
    foreach ($rows as $row) {
        $chunk[] = (array) $row;
        if (count($chunk) >= 100) {
            $dst->table($table)->insert($chunk);
            $count += count($chunk);
            $chunk = [];
        }
    }
    if ($chunk !== []) {
        $dst->table($table)->insert($chunk);
        $count += count($chunk);
    }

    // Ajusta sequence Postgres para o max id (quando houver)
    if (Schema::hasColumn($table, 'id')) {
        $max = (int) $dst->table($table)->max('id');
        if ($max > 0) {
            $seq = $table.'_id_seq';
            try {
                $dst->statement("SELECT setval(pg_get_serial_sequence('{$table}', 'id'), {$max}, true)");
            } catch (Throwable) {
                try {
                    $dst->statement("SELECT setval('{$seq}', {$max}, true)");
                } catch (Throwable) {
                    // tabelas sem serial
                }
            }
        }
    }

    echo "[ok] {$table}: {$count} linhas\n";
}

Schema::enableForeignKeyConstraints();

echo "\nConcluido. Valide o login no painel e o certificado.\n";
