<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->string('codigo_tributacao_municipio', 20)->nullable()->after('item_lc116');
            $table->string('provedor_nfse', 20)->default('nacional')->after('codigo_tributacao_municipio');
            $table->string('perfil_efd', 1)->default('A')->after('provedor_nfse');
            $table->unsignedTinyInteger('ind_atividade')->default(1)->after('perfil_efd');
            $table->string('versao_efd_layout', 10)->default('019')->after('ind_atividade');
        });
    }

    public function down(): void
    {
        Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->dropColumn([
                'codigo_tributacao_municipio',
                'provedor_nfse',
                'perfil_efd',
                'ind_atividade',
                'versao_efd_layout',
            ]);
        });
    }
};
