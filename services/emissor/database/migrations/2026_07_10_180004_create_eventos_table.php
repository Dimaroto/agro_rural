<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('eventos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->foreignId('nota_id')->nullable()->constrained('notas')->nullOnDelete();
            $table->string('tipo', 30); // cancelamento, cce, inutilizacao
            $table->string('chave', 44)->nullable()->index();
            $table->unsignedInteger('sequencial')->nullable();
            $table->string('status', 30)->default('processando');
            $table->string('protocolo', 20)->nullable();
            $table->string('c_stat', 10)->nullable();
            $table->string('x_motivo')->nullable();
            $table->longText('xml_envio')->nullable();
            $table->longText('xml_retorno')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eventos');
    }
};
