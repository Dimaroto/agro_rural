<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmpresaConfiguracaoFiscal extends Model
{
    protected $table = 'empresa_configuracoes_fiscais';

    protected $fillable = [
        'empresa_id',
        'nat_op',
        'nat_op_servico',
        'cfop_interno',
        'cfop_interestadual',
        'ind_final',
        'ind_pres',
        'mod_frete',
        't_pag',
        'perc_aprox_tributos',
        'perc_aprox_tributos_servico',
        'csosn_padrao',
        'p_cred_sn',
        'anexo_simples_mercadoria',
        'anexo_simples_servico',
        'cst_icms_padrao',
        'p_icms_interno',
        'p_red_bc',
        'p_fcp',
        'cst_ipi',
        'p_ipi',
        'cod_enq_ipi',
        'regime_pis_cofins',
        'cst_pis',
        'p_pis',
        'cst_cofins',
        'p_cofins',
        'usa_icms_st',
        'cest_padrao',
        'p_mva_st',
        'p_red_bc_st',
        'p_icms_st',
        'aplica_difal',
        'serie_nfse',
        'item_lc116',
        'codigo_tributacao_municipio',
        'provedor_nfse',
        'perfil_efd',
        'ind_atividade',
        'versao_efd_layout',
        'p_iss',
        'iss_retido',
        'p_irrf',
        'p_csll',
        'p_pis_ret',
        'p_cofins_ret',
        'p_inss_ret',
    ];

    protected function casts(): array
    {
        return [
            'ind_final' => 'integer',
            'ind_pres' => 'integer',
            'mod_frete' => 'integer',
            'perc_aprox_tributos' => 'float',
            'perc_aprox_tributos_servico' => 'float',
            'p_cred_sn' => 'float',
            'anexo_simples_mercadoria' => 'integer',
            'anexo_simples_servico' => 'integer',
            'p_icms_interno' => 'float',
            'p_red_bc' => 'float',
            'p_fcp' => 'float',
            'p_ipi' => 'float',
            'p_pis' => 'float',
            'p_cofins' => 'float',
            'usa_icms_st' => 'boolean',
            'p_mva_st' => 'float',
            'p_red_bc_st' => 'float',
            'p_icms_st' => 'float',
            'aplica_difal' => 'boolean',
            'serie_nfse' => 'integer',
            'ind_atividade' => 'integer',
            'p_iss' => 'float',
            'iss_retido' => 'boolean',
            'p_irrf' => 'float',
            'p_csll' => 'float',
            'p_pis_ret' => 'float',
            'p_cofins_ret' => 'float',
            'p_inss_ret' => 'float',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * @param  string  $tipo  mercadoria|peca|produto|servico|mao_de_obra
     */
    public function anexoPara(string $tipo): ?int
    {
        $tipo = strtolower(trim($tipo));

        if (in_array($tipo, ['servico', 'serviço', 'mao_de_obra', 'mao-de-obra', 'servicos'], true)) {
            return $this->anexo_simples_servico;
        }

        return $this->anexo_simples_mercadoria;
    }

    /**
     * @param  string  $tipo  mercadoria|peca|produto|servico|mao_de_obra
     */
    public function percAproxTributosPara(string $tipo): float
    {
        $tipo = strtolower(trim($tipo));

        if (in_array($tipo, ['servico', 'serviço', 'mao_de_obra', 'mao-de-obra', 'servicos'], true)) {
            $valor = $this->perc_aprox_tributos_servico;

            return $valor !== null && (float) $valor > 0 ? (float) $valor : 13.45;
        }

        $valor = $this->perc_aprox_tributos;

        return $valor !== null && (float) $valor > 0 ? (float) $valor : 13.45;
    }

    /** @return array<string, mixed> */
    public function toApiArray(): array
    {
        return [
            'nat_op' => $this->nat_op,
            'nat_op_servico' => $this->nat_op_servico,
            'cfop_interno' => $this->cfop_interno,
            'cfop_interestadual' => $this->cfop_interestadual,
            'ind_final' => $this->ind_final,
            'ind_pres' => $this->ind_pres,
            'mod_frete' => $this->mod_frete,
            't_pag' => $this->t_pag,
            'perc_aprox_tributos' => $this->perc_aprox_tributos,
            'perc_aprox_tributos_servico' => $this->perc_aprox_tributos_servico,
            'csosn_padrao' => $this->csosn_padrao,
            'p_cred_sn' => $this->p_cred_sn,
            'anexo_simples_mercadoria' => $this->anexo_simples_mercadoria,
            'anexo_simples_servico' => $this->anexo_simples_servico,
            'cst_icms_padrao' => $this->cst_icms_padrao,
            'p_icms_interno' => $this->p_icms_interno,
            'regime_pis_cofins' => $this->regime_pis_cofins,
            'cst_pis' => $this->cst_pis,
            'p_pis' => $this->p_pis,
            'cst_cofins' => $this->cst_cofins,
            'p_cofins' => $this->p_cofins,
            'serie_nfse' => $this->serie_nfse,
            'item_lc116' => $this->item_lc116,
            'codigo_tributacao_municipio' => $this->codigo_tributacao_municipio,
            'provedor_nfse' => $this->provedor_nfse ?? 'nacional',
            'perfil_efd' => $this->perfil_efd ?? 'A',
            'ind_atividade' => $this->ind_atividade ?? 1,
            'versao_efd_layout' => $this->versao_efd_layout ?? '019',
            'p_iss' => $this->p_iss,
            'iss_retido' => (bool) $this->iss_retido,
        ];
    }
}
