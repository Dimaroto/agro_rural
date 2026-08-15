<?php

namespace App\Services\Nfe;

use App\Models\Empresa;
use DOMDocument;
use NFePHP\NFe\Common\Standardize;
use NFePHP\NFe\Tools;
use RuntimeException;
use Throwable;

/**
 * Baixa XML completo (nfeProc) de NF-e de compra pela chave de 44 dígitos.
 *
 * Fluxo SEFAZ: DistDFe por chave → se vier só resumo (resNFe), registra
 * Ciência da Operação (210210) → consulta de novo até obter procNFe.
 *
 * Só funciona quando o CNPJ do certificado é destinatário/autorizado da NF-e.
 * Notas reais de fornecedor ficam no ambiente nacional de produção.
 */
class DistDfeDownloadService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
    ) {}

    /**
     * @return array{xml: string, chave: string, manifesto: bool, schema: string}
     */
    public function baixarXmlPorChave(Empresa $empresa, string $chave, bool $forcarProducao = true): array
    {
        $chave = $this->normalizeChave($chave);
        if (strlen($chave) !== 44) {
            throw new RuntimeException('Chave de acesso inválida (precisa ter 44 dígitos).');
        }

        $tools = $this->toolsFactory->make($empresa);
        if ($forcarProducao) {
            $tools->setEnvironment(1);
        }

        $xml = $this->consultarProcNfe($tools, $chave);
        if ($xml !== null) {
            return [
                'xml' => $xml,
                'chave' => $chave,
                'manifesto' => false,
                'schema' => 'procNFe',
            ];
        }

        $this->cienciaDaOperacao($tools, $chave);

        $delays = [2, 3, 4, 5];
        foreach ($delays as $seconds) {
            sleep($seconds);
            $xml = $this->consultarProcNfe($tools, $chave);
            if ($xml !== null) {
                return [
                    'xml' => $xml,
                    'chave' => $chave,
                    'manifesto' => true,
                    'schema' => 'procNFe',
                ];
            }
        }

        throw new RuntimeException(
            'A SEFAZ ainda não liberou o XML completo desta chave. '
            .'Confirme que o CNPJ da Mecânica é o destinatário da NF-e e tente '
            .'novamente em alguns minutos, ou suba o XML manualmente.'
        );
    }

    private function consultarProcNfe(Tools $tools, string $chave): ?string
    {
        $response = $tools->sefazDownload($chave);
        $docs = $this->extrairDocumentos($response);

        foreach ($docs as $doc) {
            $schema = strtolower($doc['schema']);
            if (str_starts_with($schema, 'procnfe')) {
                return $doc['content'];
            }
            if (
                ! str_starts_with($schema, 'resnfe')
                && ! str_starts_with($schema, 'resevento')
                && (
                    str_contains($doc['content'], '<det>')
                    || str_contains($doc['content'], '<det ')
                )
            ) {
                return $doc['content'];
            }
        }

        if ($docs === []) {
            $this->assertDistLocalizou($response);
        }

        // Há documentos (ex.: resNFe), mas ainda sem XML completo.
        return null;
    }

    private function cienciaDaOperacao(Tools $tools, string $chave): void
    {
        try {
            $response = $tools->sefazManifesta($chave, Tools::EVT_CIENCIA);
            $std = (new Standardize($response))->toStd();
            $cStat = (string) (
                $std->retEvento->infEvento->cStat
                ?? $std->cStat
                ?? ''
            );
            $xMotivo = (string) (
                $std->retEvento->infEvento->xMotivo
                ?? $std->xMotivo
                ?? 'Manifestação rejeitada'
            );

            // 135/136 ok; 573/650/655/577 = já registrada / duplicidade → segue.
            // 596 = prazo da Ciência esgotado (10 dias) — não dá para liberar XML pela SEFAZ.
            $jaRegistrada = in_array($cStat, ['573', '650', '655', '577'], true);
            $ok = in_array($cStat, ['135', '136'], true) || $jaRegistrada;

            if ($cStat === '596') {
                throw new RuntimeException(
                    'Prazo da Ciência da Operação esgotado (10 dias). '
                    .'A SEFAZ não libera mais o XML completo por chave nesta nota. '
                    .'Importe pelo arquivo XML (e-mail do fornecedor / portal).'
                );
            }

            if ($cStat !== '' && ! $ok) {
                throw new RuntimeException("Manifestação Ciência rejeitada ($cStat): $xMotivo");
            }
        } catch (RuntimeException $e) {
            throw $e;
        } catch (Throwable $e) {
            throw new RuntimeException(
                'Falha ao registrar Ciência da Operação: '.$e->getMessage(),
                0,
                $e
            );
        }
    }

    /**
     * @return list<array{schema: string, content: string, nsu: string}>
     */
    private function extrairDocumentos(string $response): array
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = false;
        if (! @$dom->loadXML($response)) {
            throw new RuntimeException('Resposta inválida da Distribuição DF-e.');
        }

        $docs = [];
        foreach ($dom->getElementsByTagName('docZip') as $node) {
            $raw = base64_decode((string) $node->nodeValue, true);
            if ($raw === false) {
                continue;
            }
            $content = @gzdecode($raw);
            if ($content === false || $content === '') {
                continue;
            }
            $docs[] = [
                'schema' => (string) $node->getAttribute('schema'),
                'content' => $content,
                'nsu' => (string) $node->getAttribute('NSU'),
            ];
        }

        return $docs;
    }

    private function assertDistLocalizou(string $response): void
    {
        $std = (new Standardize($response))->toStd();
        $cStat = (string) ($std->cStat ?? '');
        $xMotivo = (string) ($std->xMotivo ?? '');

        if ($cStat === '138') {
            return;
        }

        $detail = $xMotivo !== ''
            ? "SEFAZ DistDFe ($cStat): $xMotivo"
            : 'Nenhum documento encontrado na SEFAZ para esta chave.';

        throw new RuntimeException(
            $detail.' A Mecânica precisa ser destinatária (ou autorizada) desta NF-e.'
        );
    }

    private function normalizeChave(string $chave): string
    {
        $value = trim($chave);
        if (str_starts_with(strtoupper($value), 'NFE')) {
            $value = substr($value, 3);
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (strlen($digits) > 44) {
            $digits = substr($digits, -44);
        }

        return $digits;
    }
}
