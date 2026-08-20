<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();
            $table->string('cnpj', 14)->unique();
            $table->string('ie', 20)->nullable();
            $table->string('razao_social');
            $table->string('nome_fantasia')->nullable();
            $table->string('email')->nullable();
            $table->string('telefone', 20)->nullable();
            $table->string('logradouro');
            $table->string('numero', 20);
            $table->string('complemento')->nullable();
            $table->string('bairro');
            $table->string('municipio');
            $table->string('codigo_municipio', 7);
            $table->char('uf', 2);
            $table->string('cep', 8);
            $table->unsignedTinyInteger('crt')->default(1); // 1=Simples, 2=Simples excesso, 3=Normal
            $table->enum('ambiente', ['homologacao', 'producao'])->default('homologacao');
            $table->boolean('ativa')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresas');
    }
};
