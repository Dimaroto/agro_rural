<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cria o schema PostgreSQL `emissor` antes das demais migrations.
 * No mesmo Neon do Agro Rural, o Prisma usa `public`; o Laravel usa `emissor`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('CREATE SCHEMA IF NOT EXISTS emissor');
        DB::statement('SET search_path TO emissor, public');
    }

    public function down(): void
    {
        // Não remove o schema automaticamente (pode conter dados fiscais).
    }
};
