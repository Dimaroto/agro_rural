<?php

namespace App\Models;

use App\Enums\RegimeTributario;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Empresa extends Model
{
    protected $fillable = [
        'cnpj',
        'ie',
        'iest',
        'razao_social',
        'nome_fantasia',
        'email',
        'telefone',
        'logradouro',
        'numero',
        'complemento',
        'bairro',
        'municipio',
        'codigo_municipio',
        'uf',
        'cep',
        'crt',
        'regime_tributario',
        'simples_excesso_sublimite',
        'ambiente',
        'csc_id',
        'csc_token',
        'inscricao_municipal',
        'cnae_fiscal',
        'ativa',
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
    ];

    protected function casts(): array
    {
        return [
            'ativa' => 'boolean',
            'crt' => 'integer',
            'regime_tributario' => RegimeTributario::class,
            'simples_excesso_sublimite' => 'boolean',
            'emite_nfe' => 'boolean',
            'emite_nfce' => 'boolean',
            'emite_nfse' => 'boolean',
            'onboarding_concluido' => 'boolean',
        ];
    }

    public function certificado(): HasOne
    {
        return $this->hasOne(Certificado::class);
    }

    public function configuracaoFiscal(): HasOne
    {
        return $this->hasOne(EmpresaConfiguracaoFiscal::class);
    }

    public function numeracoes(): HasMany
    {
        return $this->hasMany(Numeracao::class);
    }

    public function notas(): HasMany
    {
        return $this->hasMany(Nota::class);
    }

    public function eventos(): HasMany
    {
        return $this->hasMany(Evento::class);
    }

    public function inutilizacoes(): HasMany
    {
        return $this->hasMany(Inutilizacao::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function cnpjDigits(): string
    {
        return preg_replace('/\D/', '', $this->cnpj) ?? '';
    }

    public function isProducao(): bool
    {
        return $this->ambiente === 'producao';
    }

    public function tpAmb(): int
    {
        return $this->isProducao() ? 1 : 2;
    }

    public function sincronizarCrt(): void
    {
        $regime = $this->regime_tributario;
        if (! $regime instanceof RegimeTributario) {
            return;
        }
        $this->crt = $regime->crt((bool) $this->simples_excesso_sublimite);
    }

    public function garantirConfiguracaoFiscal(): EmpresaConfiguracaoFiscal
    {
        if ($this->relationLoaded('configuracaoFiscal') && $this->configuracaoFiscal) {
            return $this->configuracaoFiscal;
        }

        $existente = $this->configuracaoFiscal()->first();
        if ($existente) {
            $this->setRelation('configuracaoFiscal', $existente);

            return $existente;
        }

        $regime = $this->regime_tributario instanceof RegimeTributario
            ? $this->regime_tributario
            : RegimeTributario::SimplesNacional;

        $pis = $regime->defaultsPisCofins();

        $criado = $this->configuracaoFiscal()->create(array_merge([
            'nat_op' => 'VENDA',
            'cfop_interno' => '5102',
            'cfop_interestadual' => '6102',
            'ind_final' => 1,
            'ind_pres' => 1,
            'mod_frete' => 9,
            't_pag' => '01',
            'perc_aprox_tributos' => 13.45,
            'cod_enq_ipi' => '999',
            'regime_pis_cofins' => $regime->regimePisCofins(),
            'csosn_padrao' => $regime->isSimples() ? '102' : null,
            'cst_icms_padrao' => $regime->isRegimeNormal() ? '00' : null,
            'p_icms_interno' => $regime->isRegimeNormal() ? 17 : null,
            'cst_ipi' => '99',
            'aplica_difal' => $regime->isRegimeNormal(),
            'usa_icms_st' => false,
            'iss_retido' => false,
        ], $pis));

        $this->setRelation('configuracaoFiscal', $criado);

        return $criado;
    }
}
