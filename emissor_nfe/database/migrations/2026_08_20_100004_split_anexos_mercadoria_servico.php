<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->unsignedTinyInteger('anexo_simples_mercadoria')->nullable()->after('p_cred_sn');
            $table->unsignedTinyInteger('anexo_simples_servico')->nullable()->after('anexo_simples_mercadoria');
            $table->decimal('perc_aprox_tributos_servico', 5, 2)->nullable()->after('perc_aprox_tributos');
            $table->string('nat_op_servico')->default('PRESTACAO DE SERVICO')->after('nat_op');
            $table->unsignedSmallInteger('serie_nfse')->nullable()->after('aplica_difal');
        });

        if (Schema::hasColumn('empresa_configuracoes_fiscais', 'anexo_simples')) {
            DB::table('empresa_configuracoes_fiscais')->update([
                'anexo_simples_mercadoria' => DB::raw('anexo_simples'),
            ]);

            Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
                $table->dropColumn('anexo_simples');
            });
        }
    }

    public function down(): void
    {
        Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->unsignedTinyInteger('anexo_simples')->nullable()->after('p_cred_sn');
        });

        DB::table('empresa_configuracoes_fiscais')->update([
            'anexo_simples' => DB::raw('anexo_simples_mercadoria'),
        ]);

        Schema::table('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->dropColumn([
                'anexo_simples_mercadoria',
                'anexo_simples_servico',
                'perc_aprox_tributos_servico',
                'nat_op_servico',
                'serie_nfse',
            ]);
        });
    }
};
