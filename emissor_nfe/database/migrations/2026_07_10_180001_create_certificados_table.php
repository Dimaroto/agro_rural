<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificados', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->text('pfx_encrypted');
            $table->text('senha_encrypted');
            $table->string('cnpj_certificado', 14)->nullable();
            $table->string('razao_social_certificado')->nullable();
            $table->timestamp('valido_de')->nullable();
            $table->timestamp('valido_ate')->nullable();
            $table->timestamps();

            $table->unique('empresa_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificados');
    }
};
