<?php

namespace App\Services\Integracoes\Agro;

use App\Models\Empresa;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

/**
 * Converte o payload simplificado do app Agro Rural Zortea
 * para o formato interno de emissão NF-e / NFC-e (NFePHP).
 */
class AgroNfePayloadMapper
{
    public function map(array $input, Empresa $empresa): array
    {
        $destIn = $input['destinatario'] ?? [];
        $endereco = $destIn['endereco'] ?? [];
        $itensIn = $input['itens'] ?? [];
        $ideIn = is_array($input['ide'] ?? null) ? $input['ide'] : [];

        if ($itensIn === []) {
            throw new InvalidArgumentException('A nota precisa de ao menos um item.');
        }

        $documento = preg_replace('/\D/', '', (string) ($destIn['documento'] ?? ''));
        if (strlen($documento) !== 11 && strlen($documento) !== 14) {
            throw new InvalidArgumentException('CPF/CNPJ do destinatário inválido.');
        }

        $cep = preg_replace('/\D/', '', (string) ($endereco['cep'] ?? ''));
        $uf = strtoupper((string) ($endereco['uf'] ?? ''));
        $municipio = (string) ($endereco['cidade'] ?? $endereco['municipio'] ?? '');
        $codigoMunicipio = preg_replace('/\D/', '', (string) (
            $endereco['codigoMunicipio']
            ?? $endereco['codigo_municipio']
            ?? ''
        ));

        if (strlen($codigoMunicipio) !== 7 && strlen($cep) === 8) {
            $codigoMunicipio = $this->resolverCodigoMunicipioPorCep($cep) ?? '';
        }

        if (strlen($codigoMunicipio) !== 7) {
            throw new InvalidArgumentException(
                'Informe o código IBGE do município do destinatário (7 dígitos) ou um CEP válido.'
            );
        }

        if ($municipio === '' || $uf === '' || strlen($cep) !== 8) {
            throw new InvalidArgumentException('Endereço do destinatário incompleto (cidade, UF e CEP).');
        }

        $modelo = (int) ($input['modelo'] ?? $ideIn['mod'] ?? 55);
        if (! in_array($modelo, [55, 65], true)) {
            $modelo = 55;
        }

        $itens = [];
        $vProdTotal = 0.0;
        $vIcmsTotal = 0.0;
        $vPisTotal = 0.0;
        $vCofinsTotal = 0.0;
        $vIpiTotal = 0.0;

        foreach ($itensIn as $item) {
            $qCom = (float) ($item['quantidade'] ?? 1);
            $vUn = (float) ($item['precoUnitario'] ?? 0);
            $vProd = round($qCom * $vUn, 2);
            $vProdTotal += $vProd;

            $ncm = preg_replace('/\D/', '', (string) ($item['ncm'] ?? ''));
            $cfop = preg_replace('/\D/', '', (string) ($item['cfop'] ?? '5102'));
            $cest = preg_replace('/\D/', '', (string) ($item['cest'] ?? ''));
            $origem = preg_replace('/\D/', '', (string) ($item['origemMercadoria'] ?? '0'));
            $csosn = preg_replace('/\D/', '', (string) ($item['csosn'] ?? '102'));
            $cstIcms = preg_replace('/\D/', '', (string) ($item['cstIcms'] ?? '00'));
            // Simples Nacional / mecânica: CST 49 (outras operações) é o padrão usual
            $cstPis = preg_replace('/\D/', '', (string) ($item['cstPis'] ?? '49'));
            $cstCofins = preg_replace('/\D/', '', (string) ($item['cstCofins'] ?? '49'));
            $cstIpi = preg_replace('/\D/', '', (string) ($item['cstIpi'] ?? ''));
            $pIcms = $this->nullableFloat($item['aliquotaIcms'] ?? null);
            $pPis = $this->nullableFloat($item['aliquotaPis'] ?? null);
            $pCofins = $this->nullableFloat($item['aliquotaCofins'] ?? null);
            $pIpi = $this->nullableFloat($item['aliquotaIpi'] ?? null);

            $icms = [
                'orig' => $origem !== '' ? (int) $origem : 0,
                'CSOSN' => $empresa->crt === 3 ? null : ($csosn !== '' ? $csosn : '102'),
                'CST' => $empresa->crt === 3 ? ($cstIcms !== '' ? $cstIcms : '00') : null,
            ];
            if ($pIcms !== null && ($empresa->crt === 3 || $csosn === '900')) {
                $icms['modBC'] = 3;
                $icms['vBC'] = $vProd;
                $icms['pICMS'] = $pIcms;
                $icms['vICMS'] = round($vProd * $pIcms / 100, 2);
                $vIcmsTotal += $icms['vICMS'];
            }

            // CST 01/02/49/99 usam grupo *outr e exigem vBC/p/v no XML (mesmo zerados).
            $cstPis = $cstPis !== '' ? $cstPis : '49';
            $cstCofins = $cstCofins !== '' ? $cstCofins : '49';
            $pisComValor = in_array($cstPis, ['01', '02', '49', '99'], true);
            $cofinsComValor = in_array($cstCofins, ['01', '02', '49', '99'], true);

            $vPisItem = $this->nullableFloat($item['valorPis'] ?? null);
            $vCofinsItem = $this->nullableFloat($item['valorCofins'] ?? null);
            $pPisEfetivo = $pPis ?? ($pisComValor ? 0.0 : null);
            $pCofinsEfetivo = $pCofins ?? ($cofinsComValor ? 0.0 : null);

            $pis = ['CST' => $cstPis];
            if ($pisComValor) {
                $vPisCalc = $vPisItem ?? round($vProd * (($pPisEfetivo ?? 0) / 100), 2);
                $pis += [
                    'vBC' => $vProd,
                    'pPIS' => $pPisEfetivo ?? 0,
                    'vPIS' => $vPisCalc,
                ];
                $vPisTotal += $vPisCalc;
            }

            $cofins = ['CST' => $cstCofins];
            if ($cofinsComValor) {
                $vCofinsCalc = $vCofinsItem ?? round($vProd * (($pCofinsEfetivo ?? 0) / 100), 2);
                $cofins += [
                    'vBC' => $vProd,
                    'pCOFINS' => $pCofinsEfetivo ?? 0,
                    'vCOFINS' => $vCofinsCalc,
                ];
                $vCofinsTotal += $vCofinsCalc;
            }

            $imposto = [
                'ICMS' => $icms,
                'PIS' => $pis,
                'COFINS' => $cofins,
            ];
            if ($cstIpi !== '' || $pIpi !== null) {
                $ipi = [
                    'CST' => $cstIpi !== '' ? $cstIpi : '99',
                    'cEnq' => '999',
                ];
                if ($pIpi !== null && in_array($cstIpi, ['50', '99'], true)) {
                    $ipi += [
                        'vBC' => $vProd,
                        'pIPI' => $pIpi,
                        'vIPI' => round($vProd * $pIpi / 100, 2),
                    ];
                    $vIpiTotal += $ipi['vIPI'];
                }
                $imposto['IPI'] = $ipi;
            }

            $itens[] = [
                'cProd' => (string) ($item['codigo'] ?? $item['itemId'] ?? 'ITEM'),
                'xProd' => (string) ($item['nome'] ?? 'PRODUTO'),
                'NCM' => $ncm !== '' ? $ncm : '87089990',
                'CFOP' => $cfop !== '' ? $cfop : '5102',
                'CEST' => $cest !== '' ? $cest : null,
                'uCom' => (string) ($item['unidade'] ?? 'UN'),
                'qCom' => $qCom,
                'vUnCom' => $vUn,
                'vProd' => $vProd,
                'imposto' => $imposto,
            ];
        }

        $vProdTotal = round($vProdTotal, 2);
        $vIcmsTotal = round($vIcmsTotal, 2);
        $vPisTotal = round($vPisTotal, 2);
        $vCofinsTotal = round($vCofinsTotal, 2);
        $vIpiTotal = round($vIpiTotal, 2);
        $vNfTotal = round($vProdTotal + $vIpiTotal, 2);

        // Lei 12.741/2012 — vTotTrib (aparece no DANFE como "V. TOT. TRIB.").
        // No Simples (CSOSN 102) o ICMS destacado fica 0; o valor aproximado é o campo correto.
        $pctAprox = $this->nullableFloat(
            $input['percentualAproxTributos']
            ?? $ideIn['percentualAproxTributos']
            ?? null
        );
        if ($pctAprox === null || $pctAprox <= 0) {
            $pctAprox = 13.45;
        }
        $vTotTrib = $this->nullableFloat(
            $input['valorAproxTributos']
            ?? $input['vTotTrib']
            ?? $ideIn['vTotTrib']
            ?? null
        );
        if ($vTotTrib === null || $vTotTrib <= 0) {
            $vTotTrib = round($vProdTotal * $pctAprox / 100, 2);
        } else {
            $vTotTrib = round($vTotTrib, 2);
        }

        if ($vTotTrib > 0 && $vProdTotal > 0 && $itens !== []) {
            $restante = $vTotTrib;
            $last = count($itens) - 1;
            foreach ($itens as $idx => &$itemRef) {
                if ($idx === $last) {
                    $itemTrib = round($restante, 2);
                } else {
                    $itemTrib = round(((float) $itemRef['vProd'] / $vProdTotal) * $vTotTrib, 2);
                    $restante = round($restante - $itemTrib, 2);
                }
                $itemRef['imposto']['vTotTrib'] = $itemTrib;
            }
            unset($itemRef);
        }

        $pedidoNumero = $input['pedidoNumero'] ?? $input['ordemNumero'] ?? null;
        $pedidoId = $input['pedidoId'] ?? $input['ordemId'] ?? null;

        $obsParts = array_filter([
            $input['observacao'] ?? null,
            $pedidoNumero !== null ? 'Pedido '.$pedidoNumero : null,
            isset($input['referenciaId']) ? 'Ref app: '.$input['referenciaId'] : null,
            $vTotTrib > 0
                ? sprintf(
                    'Trib. approx. R$ %s (%.2f%%) — fonte IBPT / Lei 12.741/2012',
                    number_format($vTotTrib, 2, ',', '.'),
                    $pctAprox
                )
                : null,
        ]);

        $totais = [
            'vProd' => $vProdTotal,
            'vNF' => $vNfTotal,
            'vBC' => $vIcmsTotal > 0 ? $vProdTotal : 0,
            'vICMS' => $vIcmsTotal,
            'vPIS' => $vPisTotal,
            'vCOFINS' => $vCofinsTotal,
            'vFrete' => 0,
            'vSeg' => 0,
            'vDesc' => 0,
            'vOutro' => 0,
            'vIPI' => $vIpiTotal,
            'vTotTrib' => $vTotTrib,
        ];

        $ide = [
            'mod' => $modelo,
            'natOp' => (string) ($ideIn['natOp'] ?? 'VENDA DE MERCADORIA'),
            'finNFe' => (int) ($ideIn['finNFe'] ?? 1),
            'indFinal' => (int) ($ideIn['indFinal'] ?? 1),
            'indPres' => (int) ($ideIn['indPres'] ?? ($modelo === 65 ? 1 : 1)),
        ];
        if ($modelo === 65) {
            $ide['tpImp'] = (int) ($ideIn['tpImp'] ?? 4);
        }

        return [
            'serie' => (int) ($input['serie'] ?? 1),
            'ide' => $ide,
            'destinatario' => [
                'documento' => $documento,
                'xNome' => (string) ($destIn['nome'] ?? 'DESTINATARIO'),
                'indIEDest' => 9,
                'email' => $destIn['email'] ?? null,
                'logradouro' => (string) ($endereco['logradouro'] ?? 'NAO INFORMADO'),
                'numero' => (string) (($endereco['numero'] ?? '') !== '' ? $endereco['numero'] : 'S/N'),
                'complemento' => $endereco['complemento'] ?? null,
                'bairro' => (string) (($endereco['bairro'] ?? '') !== '' ? $endereco['bairro'] : 'CENTRO'),
                'codigo_municipio' => $codigoMunicipio,
                'municipio' => $municipio,
                'uf' => $uf,
                'cep' => $cep,
                'telefone' => isset($destIn['telefone'])
                    ? preg_replace('/\D/', '', (string) $destIn['telefone'])
                    : null,
            ],
            'itens' => $itens,
            'totais' => $totais,
            'transporte' => ['modFrete' => 9],
            'pagamentos' => [
                ['tPag' => '01', 'vPag' => $vNfTotal],
            ],
            'infAdic' => [
                'infCpl' => $obsParts !== [] ? implode(' | ', $obsParts) : null,
            ],
            'meta_agro' => [
                'referenciaId' => $input['referenciaId'] ?? null,
                'pedidoId' => $pedidoId,
                'pedidoNumero' => $pedidoNumero,
            ],
        ];
    }

    private function resolverCodigoMunicipioPorCep(string $cep): ?string
    {
        $cep = preg_replace('/\D/', '', $cep) ?? '';
        if (strlen($cep) !== 8) {
            return null;
        }

        try {
            $response = Http::timeout(8)->get('https://viacep.com.br/ws/'.$cep.'/json/');
            if ($response->successful()) {
                $data = $response->json();
                if (! ($data['erro'] ?? false)) {
                    $digits = preg_replace('/\D/', '', (string) ($data['ibge'] ?? ''));
                    if (strlen($digits) === 7) {
                        return $digits;
                    }
                }
            }
        } catch (\Throwable) {
            /* fallback abaixo */
        }

        try {
            $response = Http::timeout(8)->get('https://brasilapi.com.br/api/cep/v1/'.$cep);
            if (! $response->successful()) {
                return null;
            }
            $data = $response->json();
            $ibge = $data['city_ibge']
                ?? $data['ibge']
                ?? ($data['location']['ibge'] ?? null);

            if (is_array($ibge)) {
                $ibge = $ibge['city'] ?? $ibge['codigo_ibge'] ?? $ibge['code'] ?? null;
            }

            $digits = preg_replace('/\D/', '', (string) $ibge);

            return strlen($digits) === 7 ? $digits : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function nullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) str_replace(',', '.', (string) $value);
    }
}
