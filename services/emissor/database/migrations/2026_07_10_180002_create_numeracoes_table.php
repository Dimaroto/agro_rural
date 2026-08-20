<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('numeracoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->unsignedTinyInteger('modelo')->default(55);
            $table->unsignedSmallInteger('serie')->default(1);
            $table->unsignedInteger('proximo_numero')->default(1);
            $table->timestamps();

            $table->unique(['empresa_id', 'modelo', 'serie']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('numeracoes');
    }
};
