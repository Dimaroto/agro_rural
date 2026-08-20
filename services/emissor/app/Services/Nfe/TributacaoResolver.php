<?php

namespace App\Services\Nfe;

use App\Enums\RegimeTributario;
use App\Models\AliquotaIcmsUf;
use App\Models\Empresa;
use App\Models\EmpresaConfiguracaoFiscal;

/**
 * Aplica defaults fiscais da empresa ao payload de emissão.
 * Campos explícitos no payload têm prioridade (não quebra integradores).
 */
class TributacaoResolver
{
    public function apply(Empresa $empresa, array $payload): array
    {
        $empresa->loadMissing('configuracaoFiscal');
        $cfg = $empresa->configuracaoFiscal ?? $empresa->garantirConfiguracaoFiscal();
        $regime = $empresa->regime_tributario instanceof RegimeTributario
            ? $empresa->regime_tributario
            : RegimeTributario::SimplesNacional;

        $dest = $payload['destinatario'] ?? [];
        $ufDest = strtoupper((string) ($dest['uf'] ?? $empresa->uf));
        $interestadual = strtoupper($empresa->uf) !== $ufDest;

        $ide = $payload['ide'] ?? [];
        $ide['natOp'] = $ide['natOp'] ?? $cfg->nat_op ?? 'VENDA';
        $ide['indFinal'] = $ide['indFinal'] ?? $cfg->ind_final ?? 1;
        $ide['indPres'] = $ide['indPres'] ?? $cfg->ind_pres ?? 1;
        $ide['tpNF'] = $ide['tpNF'] ?? 1;
        $ide['finNFe'] = $ide['finNFe'] ?? 1;
        $payload['ide'] = $ide;

        $payload['transporte'] = $payload['transporte'] ?? ['modFrete' => $cfg->mod_frete ?? 9];
        if (! isset($payload['transporte']['modFrete'])) {
            $payload['transporte']['modFrete'] = $cfg->mod_frete ?? 9;
        }

        $itens = $payload['itens'] ?? [];
        $vIcms = 0.0;
        $vPis = 0.0;
        $vCofins = 0.0;
        $vIpi = 0.0;
        $vFcp = 0.0;
        $vBc = 0.0;
        $vBcSt = 0.0;
        $vSt = 0.0;
        $vProd = 0.0;
        $vTotTrib = 0.0;

        foreach ($itens as $i => $item) {
            $vProdItem = (float) ($item['vProd'] ?? 0);
            $vProd += $vProdItem;

            $item['CFOP'] = $item['CFOP'] ?? ($interestadual
                ? ($cfg->cfop_interestadual ?? '6102')
                : ($cfg->cfop_interno ?? '5102'));

            if (empty($item['CEST']) && $cfg->cest_padrao) {
                $item['CEST'] = $cfg->cest_padrao;
            }

            $imposto = $item['imposto'] ?? [];
            $imposto['ICMS'] = $this->resolverIcms(
                $imposto['ICMS'] ?? [],
                $empresa,
                $cfg,
                $regime,
                $vProdItem
            );
            $imposto['PIS'] = $this->resolverPisCofins(
                $imposto['PIS'] ?? [],
                $cfg,
                $regime,
                $vProdItem,
                'PIS'
            );
            $imposto['COFINS'] = $this->resolverPisCofins(
                $imposto['COFINS'] ?? [],
                $cfg,
                $regime,
                $vProdItem,
                'COFINS'
            );

            if (! empty($imposto['IPI']) || ($regime->isRegimeNormal() && $cfg->p_ipi)) {
                $imposto['IPI'] = $this->resolverIpi($imposto['IPI'] ?? [], $cfg, $vProdItem);
            }

            if ($cfg->aplica_difal && $regime->isRegimeNormal()) {
                $difal = $this->resolverDifal(
                    $imposto['ICMSUFDest'] ?? [],
                    $empresa,
                    $cfg,
                    $ufDest,
                    $vProdItem,
                    (int) ($ide['indFinal'] ?? 1),
                    $interestadual
                );
                if ($difal !== null) {
                    $imposto['ICMSUFDest'] = $difal;
                }
            }

            $perc = (float) ($cfg->perc_aprox_tributos ?? 0);
            if (! isset($imposto['vTotTrib']) && $perc > 0) {
                $imposto['vTotTrib'] = round($vProdItem * $perc / 100, 2);
            }
            $vTotTrib += (float) ($imposto['vTotTrib'] ?? 0);

            $icms = $imposto['ICMS'];
            $vIcms += (float) ($icms['vICMS'] ?? 0);
            $vBc += (float) ($icms['vBC'] ?? 0);
            $vFcp += (float) ($icms['vFCP'] ?? 0);
            $vBcSt += (float) ($icms['vBCST'] ?? 0);
            $vSt += (float) ($icms['vICMSST'] ?? 0);
            $vPis += (float) ($imposto['PIS']['vPIS'] ?? 0);
            $vCofins += (float) ($imposto['COFINS']['vCOFINS'] ?? 0);
            $vIpi += (float) ($imposto['IPI']['vIPI'] ?? 0);

            $item['imposto'] = $imposto;
            $itens[$i] = $item;
        }

        $payload['itens'] = $itens;

        $totais = $payload['totais'] ?? [];
        $totais['vProd'] = $totais['vProd'] ?? round($vProd, 2);
        $totais['vBC'] = $totais['vBC'] ?? round($vBc, 2);
        $totais['vICMS'] = $totais['vICMS'] ?? round($vIcms, 2);
        $totais['vFCP'] = $totais['vFCP'] ?? round($vFcp, 2);
        $totais['vBCST'] = $totais['vBCST'] ?? round($vBcSt, 2);
        $totais['vST'] = $totais['vST'] ?? round($vSt, 2);
        $totais['vPIS'] = $totais['vPIS'] ?? round($vPis, 2);
        $totais['vCOFINS'] = $totais['vCOFINS'] ?? round($vCofins, 2);
        $totais['vIPI'] = $totais['vIPI'] ?? round($vIpi, 2);
        $totais['vTotTrib'] = $totais['vTotTrib'] ?? round($vTotTrib, 2);
        $totais['vNF'] = $totais['vNF'] ?? round(
            $vProd + $vSt + $vIpi - (float) ($totais['vDesc'] ?? 0) + (float) ($totais['vFrete'] ?? 0) + (float) ($totais['vOutro'] ?? 0),
            2
        );
        $payload['totais'] = $totais;

        if (empty($payload['pagamentos'])) {
            $payload['pagamentos'] = [[
                'tPag' => $cfg->t_pag ?? '01',
                'vPag' => $totais['vNF'],
            ]];
        }

        $ret = $this->resolverRetTrib($cfg, $totais['vNF'] ?? $vProd);
        if ($ret !== null) {
            $payload['retTrib'] = $payload['retTrib'] ?? $ret;
        }

        return $payload;
    }

    private function resolverIcms(
        array $icms,
        Empresa $empresa,
        EmpresaConfiguracaoFiscal $cfg,
        RegimeTributario $regime,
        float $vProd
    ): array {
        $icms['orig'] = $icms['orig'] ?? 0;

        if ($regime->isSimples() || in_array($empresa->crt, [1, 2, 4], true)) {
            $icms['CSOSN'] = $icms['CSOSN'] ?? $cfg->csosn_padrao ?? '102';
            if (in_array($icms['CSOSN'], ['101', '201'], true) && ! isset($icms['pCredSN']) && $cfg->p_cred_sn) {
                $icms['pCredSN'] = $cfg->p_cred_sn;
                $icms['vCredICMSSN'] = $icms['vCredICMSSN'] ?? round($vProd * $cfg->p_cred_sn / 100, 2);
            }
            if (($icms['CSOSN'] ?? '') === '900' && ! isset($icms['pICMS']) && $cfg->p_icms_interno) {
                $icms['modBC'] = $icms['modBC'] ?? 3;
                $icms['vBC'] = $icms['vBC'] ?? $vProd;
                $icms['pICMS'] = $cfg->p_icms_interno;
                $icms['vICMS'] = round($vProd * $cfg->p_icms_interno / 100, 2);
            }

            return $icms;
        }

        $cst = $icms['CST'] ?? $cfg->cst_icms_padrao ?? '00';
        if ($cfg->usa_icms_st && ! isset($icms['CST']) && in_array($cst, ['00', '20'], true)) {
            $cst = $cst === '20' ? '70' : '10';
        }
        $icms['CST'] = $cst;

        $pIcms = $icms['pICMS'] ?? $cfg->p_icms_interno ?? 0;
        $pRed = $icms['pRedBC'] ?? $cfg->p_red_bc;

        if (in_array($cst, ['00', '10', '20', '51', '70', '90'], true)) {
            $icms['modBC'] = $icms['modBC'] ?? 3;
            $base = $vProd;
            if ($pRed && in_array($cst, ['20', '70'], true)) {
                $icms['pRedBC'] = $pRed;
                $base = round($vProd * (1 - $pRed / 100), 2);
            }
            $icms['vBC'] = $icms['vBC'] ?? $base;
            $icms['pICMS'] = $icms['pICMS'] ?? $pIcms;
            $icms['vICMS'] = $icms['vICMS'] ?? round(($icms['vBC']) * $pIcms / 100, 2);
        }

        if ($cfg->p_fcp && ! isset($icms['pFCP']) && in_array($cst, ['00', '10', '20', '70', '90'], true)) {
            $icms['pFCP'] = $cfg->p_fcp;
            $icms['vFCP'] = round(($icms['vBC'] ?? $vProd) * $cfg->p_fcp / 100, 2);
        }

        if (in_array($cst, ['10', '30', '70', '90'], true) || $cfg->usa_icms_st) {
            $icms['modBCST'] = $icms['modBCST'] ?? 4;
            if (! isset($icms['pMVAST']) && $cfg->p_mva_st) {
                $icms['pMVAST'] = $cfg->p_mva_st;
            }
            if (! isset($icms['pRedBCST']) && $cfg->p_red_bc_st) {
                $icms['pRedBCST'] = $cfg->p_red_bc_st;
            }
            $pSt = $icms['pICMSST'] ?? $cfg->p_icms_st ?? $pIcms;
            $icms['pICMSST'] = $pSt;
            if (! isset($icms['vBCST'])) {
                $mva = (float) ($icms['pMVAST'] ?? 0);
                $baseSt = round($vProd * (1 + $mva / 100), 2);
                if (! empty($icms['pRedBCST'])) {
                    $baseSt = round($baseSt * (1 - $icms['pRedBCST'] / 100), 2);
                }
                $icms['vBCST'] = $baseSt;
                $icms['vICMSST'] = round(max(0, $baseSt * $pSt / 100 - (float) ($icms['vICMS'] ?? 0)), 2);
            }
        }

        return $icms;
    }

    private function resolverPisCofins(
        array $grupo,
        EmpresaConfiguracaoFiscal $cfg,
        RegimeTributario $regime,
        float $vProd,
        string $tipo
    ): array {
        $isPis = $tipo === 'PIS';
        $cstKey = $isPis ? 'cst_pis' : 'cst_cofins';
        $pKey = $isPis ? 'p_pis' : 'p_cofins';
        $pTag = $isPis ? 'pPIS' : 'pCOFINS';
        $vTag = $isPis ? 'vPIS' : 'vCOFINS';

        $defaults = $regime->defaultsPisCofins();
        $cst = (string) ($grupo['CST'] ?? $cfg->{$cstKey} ?? $defaults[$cstKey]);
        $grupo['CST'] = $cst;

        $comValor = in_array($cst, ['01', '02', '49', '99'], true);
        if ($comValor) {
            $p = $grupo[$pTag] ?? $cfg->{$pKey} ?? $defaults[$pKey];
            $grupo['vBC'] = $grupo['vBC'] ?? $vProd;
            $grupo[$pTag] = $p;
            $grupo[$vTag] = $grupo[$vTag] ?? round($vProd * (float) $p / 100, 2);
        }

        return $grupo;
    }

    private function resolverIpi(array $ipi, EmpresaConfiguracaoFiscal $cfg, float $vProd): array
    {
        $ipi['CST'] = $ipi['CST'] ?? $cfg->cst_ipi ?? '99';
        $ipi['cEnq'] = $ipi['cEnq'] ?? $cfg->cod_enq_ipi ?? '999';
        if ($cfg->p_ipi && in_array($ipi['CST'], ['00', '49', '50', '99'], true)) {
            $ipi['vBC'] = $ipi['vBC'] ?? $vProd;
            $ipi['pIPI'] = $ipi['pIPI'] ?? $cfg->p_ipi;
            $ipi['vIPI'] = $ipi['vIPI'] ?? round($vProd * $cfg->p_ipi / 100, 2);
        }

        return $ipi;
    }

    private function resolverDifal(
        array $existente,
        Empresa $empresa,
        EmpresaConfiguracaoFiscal $cfg,
        string $ufDest,
        float $vProd,
        int $indFinal,
        bool $interestadual
    ): ?array {
        if (! $interestadual || $indFinal !== 1) {
            return $existente !== [] ? $existente : null;
        }
        if ($existente !== []) {
            return $existente;
        }

        $aliqDest = AliquotaIcmsUf::porUf($ufDest);
        $pDest = $aliqDest?->aliquota_interna ?? 18.0;
        $pFcp = $aliqDest?->aliquota_fcp ?? (float) ($cfg->p_fcp ?? 0);
        $pOrigem = (float) ($cfg->p_icms_interno ?? 17);
        $pInter = $this->aliquotaInterestadual($empresa->uf, $ufDest);

        $vBcUfDest = $vProd;
        $vIcmsInter = round($vBcUfDest * $pInter / 100, 2);
        $vIcmsUfDest = round($vBcUfDest * ($pDest - $pInter) / 100, 2);
        if ($vIcmsUfDest < 0) {
            $vIcmsUfDest = 0;
        }

        return [
            'vBCUFDest' => $vBcUfDest,
            'pFCPUFDest' => $pFcp,
            'pICMSUFDest' => $pDest,
            'pICMSInter' => $pInter,
            'pICMSInterPart' => 100,
            'vFCPUFDest' => round($vBcUfDest * $pFcp / 100, 2),
            'vICMSUFDest' => $vIcmsUfDest,
            'vICMSUFRemet' => 0,
        ];
    }

    private function aliquotaInterestadual(string $ufOrigem, string $ufDest): float
    {
        // Simplificação: Sul/Sudeste (exceto ES) → Norte/Nordeste/CO/ES = 7%; demais = 12%.
        // Importados usariam 4% — fica a cargo do payload explícito.
        $sulSudeste = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'];
        $orig = strtoupper($ufOrigem);
        $dest = strtoupper($ufDest);
        if (in_array($orig, $sulSudeste, true) && ! in_array($dest, array_merge($sulSudeste, ['ES']), true)) {
            return 7.0;
        }

        return 12.0;
    }

    private function resolverRetTrib(EmpresaConfiguracaoFiscal $cfg, float $base): ?array
    {
        $tem = ($cfg->p_irrf || $cfg->p_csll || $cfg->p_pis_ret || $cfg->p_cofins_ret || $cfg->p_inss_ret);
        if (! $tem) {
            return null;
        }

        return [
            'vRetPIS' => round($base * (float) ($cfg->p_pis_ret ?? 0) / 100, 2),
            'vRetCOFINS' => round($base * (float) ($cfg->p_cofins_ret ?? 0) / 100, 2),
            'vRetCSLL' => round($base * (float) ($cfg->p_csll ?? 0) / 100, 2),
            'vBCIRRF' => ($cfg->p_irrf ? $base : 0),
            'vIRRF' => round($base * (float) ($cfg->p_irrf ?? 0) / 100, 2),
            'vBCRetPrev' => ($cfg->p_inss_ret ? $base : 0),
            'vRetPrev' => round($base * (float) ($cfg->p_inss_ret ?? 0) / 100, 2),
        ];
    }
}
