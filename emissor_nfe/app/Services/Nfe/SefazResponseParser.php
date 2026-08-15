<?php

namespace App\Services\Nfe;

use SimpleXMLElement;

class SefazResponseParser
{
    public function parse(string $xml): array
    {
        $xml = trim($xml);
        if ($xml === '') {
            return [
                'cStat' => null,
                'xMotivo' => 'Retorno SEFAZ vazio',
                'nProt' => null,
                'chNFe' => null,
            ];
        }

        try {
            $sx = new SimpleXMLElement($xml);
        } catch (\Throwable) {
            return [
                'cStat' => null,
                'xMotivo' => 'Retorno SEFAZ inválido',
                'nProt' => null,
                'chNFe' => null,
                'raw' => $xml,
            ];
        }

        $sx->registerXPathNamespace('n', 'http://www.portalfiscal.inf.br/nfe');
        $sx->registerXPathNamespace('soap', 'http://www.w3.org/2003/05/soap-envelope');

        // Preferência: protocolo da NF (infProt). cStat 104 = só "lote processado".
        $cStat = $this->first($sx, '//n:infProt/n:cStat|//infProt/cStat')
            ?? $this->first($sx, '//n:protNFe//n:cStat|//protNFe//cStat');
        $xMotivo = $this->first($sx, '//n:infProt/n:xMotivo|//infProt/xMotivo')
            ?? $this->first($sx, '//n:protNFe//n:xMotivo|//protNFe//xMotivo');

        if ($cStat === null) {
            $cStat = $this->first($sx, '//n:cStat|//cStat');
            $xMotivo = $this->first($sx, '//n:xMotivo|//xMotivo');
        }

        $nProt = $this->first($sx, '//n:infProt/n:nProt|//infProt/nProt|//n:nProt|//nProt');
        $chNFe = $this->first($sx, '//n:infProt/n:chNFe|//infProt/chNFe|//n:chNFe|//chNFe');
        $chNFe = $this->normalizarChave($chNFe);

        return [
            'cStat' => $cStat,
            'xMotivo' => $xMotivo,
            'nProt' => $nProt,
            'chNFe' => $chNFe,
            'raw' => $xml,
        ];
    }

    public function isAutorizado(?string $cStat): bool
    {
        return in_array($cStat, ['100', '150'], true);
    }

    public function isEventoAutorizado(?string $cStat): bool
    {
        return in_array($cStat, ['135', '136', '155'], true);
    }

    public function isInutilizacaoAutorizada(?string $cStat): bool
    {
        return $cStat === '102';
    }

    private function normalizarChave(?string $chave): ?string
    {
        if ($chave === null || $chave === '') {
            return null;
        }

        $value = trim($chave);
        if (str_starts_with(strtoupper($value), 'NFE')) {
            $value = substr($value, 3);
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (strlen($digits) > 44) {
            $digits = substr($digits, -44);
        }

        return strlen($digits) === 44 ? $digits : ($digits !== '' ? $digits : null);
    }

    private function first(SimpleXMLElement $sx, string $xpath): ?string
    {
        $nodes = $sx->xpath($xpath);
        if (! $nodes || ! isset($nodes[0])) {
            return null;
        }

        return trim((string) $nodes[0]) ?: null;
    }
}
