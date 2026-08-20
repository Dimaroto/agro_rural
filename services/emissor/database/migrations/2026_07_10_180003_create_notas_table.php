<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->string('chave', 44)->nullable()->index();
            $table->unsignedInteger('numero')->nullable();
            $table->unsignedSmallInteger('serie')->default(1);
            $table->unsignedTinyInteger('modelo')->default(55);
            $table->string('status', 30)->default('rascunho')->index();
            $table->string('protocolo', 20)->nullable();
            $table->string('c_stat', 10)->nullable();
            $table->string('x_motivo')->nullable();
            $table->longText('xml_assinado')->nullable();
            $table->longText('xml_autorizado')->nullable();
            $table->longText('xml_retorno')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('autorizada_em')->nullable();
            $table->timestamp('cancelada_em')->nullable();
            $table->timestamps();

            $table->unique(['empresa_id', 'chave']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notas');
    }
};
