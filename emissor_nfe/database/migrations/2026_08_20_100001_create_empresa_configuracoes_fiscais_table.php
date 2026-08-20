<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empresa_configuracoes_fiscais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empresa_id')->unique()->constrained('empresas')->cascadeOnDelete();

            // Defaults de operação
            $table->string('nat_op')->default('VENDA');
            $table->string('cfop_interno', 4)->default('5102');
            $table->string('cfop_interestadual', 4)->default('6102');
            $table->unsignedTinyInteger('ind_final')->default(1);
            $table->unsignedTinyInteger('ind_pres')->default(1);
            $table->unsignedTinyInteger('mod_frete')->default(9);
            $table->string('t_pag', 2)->default('01');
            $table->decimal('perc_aprox_tributos', 5, 2)->default(13.45);

            // Simples Nacional
            $table->string('csosn_padrao', 3)->nullable();
            $table->decimal('p_cred_sn', 7, 4)->nullable();
            $table->unsignedTinyInteger('anexo_simples')->nullable();

            // Regime normal (CRT 3)
            $table->string('cst_icms_padrao', 2)->nullable();
            $table->decimal('p_icms_interno', 7, 4)->nullable();
            $table->decimal('p_red_bc', 7, 4)->nullable();
            $table->decimal('p_fcp', 7, 4)->nullable();
            $table->string('cst_ipi', 2)->nullable();
            $table->decimal('p_ipi', 7, 4)->nullable();
            $table->string('cod_enq_ipi', 3)->default('999');

            // PIS / COFINS
            $table->string('regime_pis_cofins', 20)->nullable(); // cumulativo | nao_cumulativo | sn
            $table->string('cst_pis', 2)->nullable();
            $table->decimal('p_pis', 7, 4)->nullable();
            $table->string('cst_cofins', 2)->nullable();
            $table->decimal('p_cofins', 7, 4)->nullable();

            // ICMS-ST
            $table->boolean('usa_icms_st')->default(false);
            $table->string('cest_padrao', 7)->nullable();
            $table->decimal('p_mva_st', 7, 4)->nullable();
            $table->decimal('p_red_bc_st', 7, 4)->nullable();
            $table->decimal('p_icms_st', 7, 4)->nullable();

            // DIFAL
            $table->boolean('aplica_difal')->default(false);

            // NFS-e / serviços
            $table->string('item_lc116', 10)->nullable();
            $table->decimal('p_iss', 7, 4)->nullable();
            $table->boolean('iss_retido')->default(false);
            $table->decimal('p_irrf', 7, 4)->nullable();
            $table->decimal('p_csll', 7, 4)->nullable();
            $table->decimal('p_pis_ret', 7, 4)->nullable();
            $table->decimal('p_cofins_ret', 7, 4)->nullable();
            $table->decimal('p_inss_ret', 7, 4)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresa_configuracoes_fiscais');
    }
};
