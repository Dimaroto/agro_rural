<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('regime_tributario', 32)->nullable()->after('crt');
            $table->boolean('simples_excesso_sublimite')->default(false)->after('regime_tributario');
            $table->string('cnae_fiscal', 7)->nullable()->after('inscricao_municipal');
            $table->string('iest', 20)->nullable()->after('ie');
            $table->boolean('emite_nfe')->default(true)->after('ativa');
            $table->boolean('emite_nfce')->default(false)->after('emite_nfe');
            $table->boolean('emite_nfse')->default(false)->after('emite_nfce');
            $table->string('onboarding_etapa', 40)->nullable()->after('emite_nfse');
            $table->boolean('onboarding_concluido')->default(false)->after('onboarding_etapa');
            $table->string('resp_tec_cnpj', 14)->nullable()->after('onboarding_concluido');
            $table->string('resp_tec_contato')->nullable()->after('resp_tec_cnpj');
            $table->string('resp_tec_email')->nullable()->after('resp_tec_contato');
            $table->string('resp_tec_fone', 20)->nullable()->after('resp_tec_email');
            $table->string('resp_tec_csrt')->nullable()->after('resp_tec_fone');
            $table->string('resp_tec_id_csrt', 2)->nullable()->after('resp_tec_csrt');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn([
                'regime_tributario',
                'simples_excesso_sublimite',
                'cnae_fiscal',
                'iest',
                'emite_nfe',
                'emite_nfce',
                'emite_nfse',
                'onboarding_etapa',
                'onboarding_concluido',
                'resp_tec_cnpj',
                'resp_tec_contato',
                'resp_tec_email',
                'resp_tec_fone',
                'resp_tec_csrt',
                'resp_tec_id_csrt',
            ]);
        });
    }
};
