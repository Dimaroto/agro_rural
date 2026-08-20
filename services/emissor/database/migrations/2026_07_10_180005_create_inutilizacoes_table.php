<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inutilizacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('evento_id')->nullable()->constrained('eventos')->nullOnDelete();
            $table->unsignedTinyInteger('modelo')->default(55);
            $table->unsignedSmallInteger('serie');
            $table->unsignedInteger('numero_inicial');
            $table->unsignedInteger('numero_final');
            $table->unsignedSmallInteger('ano');
            $table->string('justificativa');
            $table->string('status', 30)->default('processando');
            $table->string('protocolo', 20)->nullable();
            $table->string('c_stat', 10)->nullable();
            $table->string('x_motivo')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inutilizacoes');
    }
};
