<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $empresas = DB::table('empresas')->get();
        $now = now();

        foreach ($empresas as $empresa) {
            $crt = (int) $empresa->crt;
            $regime = match ($crt) {
                1, 2 => 'simples_nacional',
                4 => 'mei',
                default => 'lucro_presumido',
            };
            $excesso = $crt === 2;

            DB::table('empresas')->where('id', $empresa->id)->update([
                'regime_tributario' => $regime,
                'simples_excesso_sublimite' => $excesso,
                'onboarding_concluido' => true,
                'onboarding_etapa' => 'revisao',
                'emite_nfe' => true,
                'emite_nfce' => ! empty($empresa->csc_id),
                'updated_at' => $now,
            ]);

            $exists = DB::table('empresa_configuracoes_fiscais')
                ->where('empresa_id', $empresa->id)
                ->exists();

            if ($exists) {
                continue;
            }

            $config = match ($regime) {
                'simples_nacional', 'mei' => [
                    'csosn_padrao' => '102',
                    'regime_pis_cofins' => 'sn',
                    'cst_pis' => '49',
                    'p_pis' => 0,
                    'cst_cofins' => '49',
                    'p_cofins' => 0,
                    'cst_ipi' => '99',
                    'aplica_difal' => false,
                ],
                'lucro_real' => [
                    'cst_icms_padrao' => '00',
                    'p_icms_interno' => 17,
                    'regime_pis_cofins' => 'nao_cumulativo',
                    'cst_pis' => '01',
                    'p_pis' => 1.65,
                    'cst_cofins' => '01',
                    'p_cofins' => 7.60,
                    'cst_ipi' => '99',
                    'aplica_difal' => true,
                ],
                default => [ // lucro_presumido
                    'cst_icms_padrao' => '00',
                    'p_icms_interno' => 17,
                    'regime_pis_cofins' => 'cumulativo',
                    'cst_pis' => '01',
                    'p_pis' => 0.65,
                    'cst_cofins' => '01',
                    'p_cofins' => 3.00,
                    'cst_ipi' => '99',
                    'aplica_difal' => true,
                ],
            };

            DB::table('empresa_configuracoes_fiscais')->insert(array_merge([
                'empresa_id' => $empresa->id,
                'nat_op' => 'VENDA',
                'cfop_interno' => '5102',
                'cfop_interestadual' => '6102',
                'ind_final' => 1,
                'ind_pres' => 1,
                'mod_frete' => 9,
                't_pag' => '01',
                'perc_aprox_tributos' => 13.45,
                'cod_enq_ipi' => '999',
                'usa_icms_st' => false,
                'iss_retido' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ], $config));
        }
    }

    public function down(): void
    {
        // Dados derivados — não reverte automaticamente.
    }
};
