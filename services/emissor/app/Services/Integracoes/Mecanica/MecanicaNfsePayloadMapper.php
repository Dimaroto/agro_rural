<?php

namespace App\Services\Integracoes\Mecanica;

use App\Models\Empresa;
use InvalidArgumentException;

/**
 * Converte itens de serviço (OS / payload Mecânica) em payload NFS-e,
 * preenchendo defaults a partir de EmpresaConfiguracaoFiscal.
 */
class MecanicaNfsePayloadMapper
{
    /**
     * @param  array<string, mixed>  $input
     * @param  list<array<string, mixed>>|null  $itensServico  quando já separados pelo splitter
     * @return array<string, mixed>
     */
    public function map(array $input, Empresa $empresa, ?array $itensServico = null): array
    {
        $empresa->loadMissing('configuracaoFiscal');
        $cfg = $empresa->garantirConfiguracaoFiscal();

        $tomadorIn = $input['tomador'] ?? $input['destinatario'] ?? [];
        if (! is_array($tomadorIn)) {
            $tomadorIn = [];
        }

        $nome = trim((string) ($tomadorIn['nome'] ?? $tomadorIn['xNome'] ?? ''));
        $documento = preg_replace('/\D/', '', (string) ($tomadorIn['documento'] ?? '')) ?? '';

        if ($nome === '') {
            throw new InvalidArgumentException('Nome do tomador é obrigatório.');
        }
        if (strlen($documento) !== 11 && strlen($documento) !== 14) {
            throw new InvalidArgumentException('CPF/CNPJ do tomador inválido.');
        }

        $servicoIn = is_array($input['servico'] ?? null) ? $input['servico'] : [];
        $itens = $itensServico;
        if ($itens === null) {
            $itens = is_array($input['itens'] ?? null) ? $input['itens'] : [];
        }

        $valorServico = $this->nullableFloat(
            $servicoIn['valorServico']
            ?? $servicoIn['valor_servico']
            ?? $input['valorServico']
            ?? null
        );

        if (($valorServico === null || $valorServico <= 0) && $itens !== []) {
            $valorServico = 0.0;
            foreach ($itens as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $q = (float) ($item['quantidade'] ?? 1);
                $vu = (float) ($item['precoUnitario'] ?? $item['valorUnitario'] ?? 0);
                $valorServico += round($q * $vu, 2);
            }
            $valorServico = round($valorServico, 2);
        }

        if ($valorServico === null || $valorServico <= 0) {
            throw new InvalidArgumentException('valorServico deve ser maior que zero.');
        }

        $codigo = trim((string) (
            $servicoIn['codigoServicoLc116']
            ?? $servicoIn['codigo_servico_lc116']
            ?? $cfg->item_lc116
            ?? ''
        ));
        if ($codigo === '') {
            throw new InvalidArgumentException(
                'codigoServicoLc116 é obrigatório (informe no payload ou cadastre o Item LC 116 da empresa).'
            );
        }

        $aliquota = $this->nullableFloat(
            $servicoIn['aliquotaIss']
            ?? $servicoIn['aliquota_iss']
            ?? $cfg->p_iss
        );
        if ($aliquota === null) {
            throw new InvalidArgumentException(
                'aliquotaIss é obrigatória (informe no payload ou cadastre a alíquota ISS da empresa).'
            );
        }

        $issRetido = array_key_exists('issRetido', $servicoIn) || array_key_exists('iss_retido', $servicoIn)
            ? (bool) ($servicoIn['issRetido'] ?? $servicoIn['iss_retido'])
            : (bool) $cfg->iss_retido;

        $descricao = trim((string) (
            $servicoIn['discriminacao']
            ?? $servicoIn['descricao']
            ?? $input['observacao']
            ?? ''
        ));
        if ($descricao === '' && $itens !== []) {
            $linhas = [];
            foreach ($itens as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $nomeItem = (string) ($item['nome'] ?? $item['descricao'] ?? 'Serviço');
                $q = (float) ($item['quantidade'] ?? 1);
                $vu = (float) ($item['precoUnitario'] ?? $item['valorUnitario'] ?? 0);
                $linhas[] = sprintf('%s — qtd %.2f × R$ %.2f', $nomeItem, $q, $vu);
            }
            $descricao = implode('; ', $linhas);
        }

        $anexo = $cfg->anexoPara('servico');
        $pctAprox = $cfg->percAproxTributosPara('servico');
        $vTotTrib = round($valorServico * $pctAprox / 100, 2);

        $obsParts = array_filter([
            $descricao !== '' ? $descricao : null,
            isset($input['ordemNumero']) ? 'OS '.$input['ordemNumero'] : null,
            isset($input['referenciaId']) ? 'Ref app: '.$input['referenciaId'] : null,
            $anexo ? 'Simples Nacional — Anexo '.$anexo : null,
            $vTotTrib > 0
                ? sprintf(
                    'Trib. approx. R$ %s (%.2f%%) — Lei 12.741/2012',
                    number_format($vTotTrib, 2, ',', '.'),
                    $pctAprox
                )
                : null,
        ]);

        $serie = (int) (
            $input['serie']
            ?? $cfg->serie_nfse
            ?? config('nfse.serie_padrao', 1)
        );

        $endereco = is_array($tomadorIn['endereco'] ?? null) ? $tomadorIn['endereco'] : [];

        return [
            'serie' => $serie,
            'referenciaId' => $input['referenciaId'] ?? null,
            'ordemId' => $input['ordemId'] ?? null,
            'ordemNumero' => $input['ordemNumero'] ?? null,
            'observacao' => $obsParts !== [] ? implode(' | ', $obsParts) : null,
            'natOp' => (string) ($cfg->nat_op_servico ?: 'PRESTACAO DE SERVICO'),
            'anexoSimples' => $anexo,
            'tomador' => [
                'nome' => $nome,
                'documento' => $documento,
                'email' => $tomadorIn['email'] ?? null,
                'telefone' => isset($tomadorIn['telefone'])
                    ? preg_replace('/\D/', '', (string) $tomadorIn['telefone'])
                    : null,
                'endereco' => $endereco !== [] ? $endereco : null,
            ],
            'servico' => [
                'codigoServicoLc116' => $codigo,
                'aliquotaIss' => $aliquota,
                'valorServico' => $valorServico,
                'issRetido' => $issRetido,
                'discriminacao' => $obsParts !== [] ? implode(' | ', $obsParts) : $descricao,
                'valorAproxTributos' => $vTotTrib,
                'percentualAproxTributos' => $pctAprox,
            ],
            'retencoes' => [
                'irrf' => $cfg->p_irrf,
                'csll' => $cfg->p_csll,
                'pis' => $cfg->p_pis_ret,
                'cofins' => $cfg->p_cofins_ret,
                'inss' => $cfg->p_inss_ret,
            ],
            'meta_mecanica' => [
                'referenciaId' => $input['referenciaId'] ?? null,
                'ordemId' => $input['ordemId'] ?? null,
                'ordemNumero' => $input['ordemNumero'] ?? null,
                'tipo' => 'servico',
            ],
        ];
    }

    private function nullableFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) str_replace(',', '.', (string) $value);
    }
}
