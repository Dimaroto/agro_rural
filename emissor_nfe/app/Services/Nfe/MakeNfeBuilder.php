<?php

namespace App\Services\Nfe;

use App\Models\Empresa;
use NFePHP\Common\UFList;
use NFePHP\NFe\Make;
use RuntimeException;
use stdClass;

class MakeNfeBuilder
{
    public function build(Empresa $empresa, array $payload, int $numero, int $serie): Make
    {
        $make = new Make();
        $make->setOnlyAscii(true);

        $stdInf = new stdClass;
        $stdInf->versao = '4.00';
        $make->taginfNFe($stdInf);

        $dest = $payload['destinatario'] ?? [];
        $ide = $payload['ide'] ?? [];

        $mod = (int) ($ide['mod'] ?? 55);
        if (! in_array($mod, [55, 65], true)) {
            $mod = 55;
        }

        $stdIde = new stdClass;
        $stdIde->cUF = UFList::getCodeByUF(strtoupper($empresa->uf));
        $stdIde->natOp = $ide['natOp'] ?? 'VENDA';
        $stdIde->mod = $mod;
        $stdIde->serie = $serie;
        $stdIde->nNF = $numero;
        $stdIde->dhEmi = $ide['dhEmi'] ?? now()->format('Y-m-d\TH:i:sP');
        $stdIde->dhSaiEnt = $ide['dhSaiEnt'] ?? null;
        $stdIde->tpNF = $ide['tpNF'] ?? 1;
        $stdIde->idDest = $ide['idDest'] ?? $this->resolverIdDest($empresa->uf, $dest['uf'] ?? $empresa->uf);
        $stdIde->cMunFG = $empresa->codigo_municipio;
        // NFC-e (65): DANFE NFC-e (tpImp=4); NF-e (55): retrato (tpImp=1)
        $stdIde->tpImp = $ide['tpImp'] ?? ($mod === 65 ? 4 : 1);
        $stdIde->tpEmis = $ide['tpEmis'] ?? 1;
        $stdIde->cDV = null;
        $stdIde->tpAmb = $empresa->tpAmb();
        $stdIde->finNFe = $ide['finNFe'] ?? 1;
        $stdIde->indFinal = $ide['indFinal'] ?? 1;
        $stdIde->indPres = $ide['indPres'] ?? 1;
        $stdIde->procEmi = 0;
        $stdIde->verProc = $ide['verProc'] ?? 'emissor_nfe 1.0';
        $make->tagide($stdIde);

        // NF-e referenciada (ex.: devolução de compra)
        $refs = $payload['NFref'] ?? [];
        if (! is_array($refs)) {
            $refs = [];
        }
        foreach ($refs as $ref) {
            $chaveRef = preg_replace(
                '/\D/',
                '',
                (string) (is_array($ref) ? ($ref['refNFe'] ?? '') : $ref)
            );
            if (strlen($chaveRef) === 44) {
                $stdRef = new stdClass;
                $stdRef->refNFe = $chaveRef;
                $make->tagrefNFe($stdRef);
            }
        }

        $stdEmit = new stdClass;
        $stdEmit->xNome = $empresa->razao_social;
        $stdEmit->xFant = $empresa->nome_fantasia ?: $empresa->razao_social;
        $stdEmit->IE = $empresa->ie;
        $stdEmit->CRT = $empresa->crt;
        $stdEmit->CNPJ = $empresa->cnpjDigits();
        $make->tagemit($stdEmit);

        $stdEnderEmit = new stdClass;
        $stdEnderEmit->xLgr = $empresa->logradouro;
        $stdEnderEmit->nro = $empresa->numero;
        $stdEnderEmit->xCpl = $empresa->complemento;
        $stdEnderEmit->xBairro = $empresa->bairro;
        $stdEnderEmit->cMun = $empresa->codigo_municipio;
        $stdEnderEmit->xMun = $empresa->municipio;
        $stdEnderEmit->UF = strtoupper($empresa->uf);
        $stdEnderEmit->CEP = preg_replace('/\D/', '', $empresa->cep);
        $stdEnderEmit->cPais = '1058';
        $stdEnderEmit->xPais = 'BRASIL';
        $stdEnderEmit->fone = preg_replace('/\D/', '', (string) $empresa->telefone) ?: null;
        $make->tagenderEmit($stdEnderEmit);

        $stdDest = new stdClass;
        $stdDest->xNome = $empresa->tpAmb() === 2
            ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : ($dest['xNome'] ?? '');
        $doc = preg_replace('/\D/', '', (string) ($dest['documento'] ?? ''));
        if (strlen($doc) === 11) {
            $stdDest->CPF = $doc;
        } else {
            $stdDest->CNPJ = $doc;
        }
        $stdDest->indIEDest = $dest['indIEDest'] ?? 9;
        $stdDest->IE = $dest['IE'] ?? null;
        $stdDest->email = $dest['email'] ?? null;
        $make->tagdest($stdDest);

        $stdEnderDest = new stdClass;
        $stdEnderDest->xLgr = $dest['logradouro'] ?? '';
        $stdEnderDest->nro = $dest['numero'] ?? 'S/N';
        $stdEnderDest->xCpl = $dest['complemento'] ?? null;
        $stdEnderDest->xBairro = $dest['bairro'] ?? '';
        $stdEnderDest->cMun = $dest['codigo_municipio'] ?? '';
        $stdEnderDest->xMun = $dest['municipio'] ?? '';
        $stdEnderDest->UF = strtoupper($dest['uf'] ?? '');
        $stdEnderDest->CEP = preg_replace('/\D/', '', (string) ($dest['cep'] ?? ''));
        $stdEnderDest->cPais = $dest['cPais'] ?? '1058';
        $stdEnderDest->xPais = $dest['xPais'] ?? 'BRASIL';
        $stdEnderDest->fone = preg_replace('/\D/', '', (string) ($dest['telefone'] ?? '')) ?: null;
        $make->tagenderDest($stdEnderDest);

        $itens = $payload['itens'] ?? [];
        if ($itens === []) {
            throw new RuntimeException('A NF-e deve conter ao menos um item.');
        }

        foreach (array_values($itens) as $index => $item) {
            $nItem = $index + 1;

            $stdProd = new stdClass;
            $stdProd->item = $nItem;
            $stdProd->cProd = $item['cProd'] ?? (string) $nItem;
            $stdProd->cEAN = $item['cEAN'] ?? 'SEM GTIN';
            $stdProd->xProd = $item['xProd'] ?? 'PRODUTO';
            $stdProd->NCM = $item['NCM'] ?? '00000000';
            $stdProd->CEST = $item['CEST'] ?? null;
            $stdProd->CFOP = $item['CFOP'] ?? '5102';
            $stdProd->uCom = $item['uCom'] ?? 'UN';
            $stdProd->qCom = $this->num($item['qCom'] ?? 1);
            $stdProd->vUnCom = $this->num($item['vUnCom'] ?? 0);
            $stdProd->vProd = $this->num($item['vProd'] ?? ($stdProd->qCom * $stdProd->vUnCom));
            $stdProd->cEANTrib = $item['cEANTrib'] ?? ($item['cEAN'] ?? 'SEM GTIN');
            $stdProd->uTrib = $item['uTrib'] ?? $stdProd->uCom;
            $stdProd->qTrib = $this->num($item['qTrib'] ?? $stdProd->qCom);
            $stdProd->vUnTrib = $this->num($item['vUnTrib'] ?? $stdProd->vUnCom);
            $stdProd->indTot = $item['indTot'] ?? 1;
            $stdProd->vDesc = isset($item['vDesc']) ? $this->num($item['vDesc']) : null;
            $stdProd->vFrete = isset($item['vFrete']) ? $this->num($item['vFrete']) : null;
            $stdProd->vSeg = isset($item['vSeg']) ? $this->num($item['vSeg']) : null;
            $stdProd->vOutro = isset($item['vOutro']) ? $this->num($item['vOutro']) : null;
            $make->tagprod($stdProd);

            $stdImposto = new stdClass;
            $stdImposto->item = $nItem;
            $imposto = $item['imposto'] ?? [];
            if (isset($imposto['vTotTrib'])) {
                $stdImposto->vTotTrib = $this->num($imposto['vTotTrib']);
            }
            $make->tagimposto($stdImposto);

            $this->aplicarIcms($make, $nItem, $empresa->crt, $imposto['ICMS'] ?? [], (float) $stdProd->vProd);
            $this->aplicarPis($make, $nItem, $imposto['PIS'] ?? []);
            $this->aplicarCofins($make, $nItem, $imposto['COFINS'] ?? []);

            if (! empty($imposto['IPI'])) {
                $this->aplicarIpi($make, $nItem, $imposto['IPI']);
            }
        }

        $totais = $payload['totais'] ?? [];
        $stdIcmsTot = new stdClass;
        foreach ([
            'vBC', 'vICMS', 'vICMSDeson', 'vFCP', 'vBCST', 'vST', 'vFCPST', 'vFCPSTRet',
            'vProd', 'vFrete', 'vSeg', 'vDesc', 'vII', 'vIPI', 'vIPIDevol', 'vPIS', 'vCOFINS',
            'vOutro', 'vNF', 'vTotTrib',
        ] as $field) {
            if (array_key_exists($field, $totais)) {
                $stdIcmsTot->{$field} = $this->num($totais[$field]);
            }
        }
        $make->tagICMSTot($stdIcmsTot);

        $transp = $payload['transporte'] ?? ['modFrete' => 9];
        $stdTransp = new stdClass;
        $stdTransp->modFrete = $transp['modFrete'] ?? 9;
        $make->tagtransp($stdTransp);

        $pagamentos = $payload['pagamentos'] ?? [['tPag' => '01', 'vPag' => $totais['vNF'] ?? 0]];
        $stdPag = new stdClass;
        $stdPag->vTroco = isset($payload['vTroco']) ? $this->num($payload['vTroco']) : null;
        $make->tagpag($stdPag);

        foreach ($pagamentos as $pag) {
            $stdDetPag = new stdClass;
            $stdDetPag->tPag = $pag['tPag'] ?? '01';
            $stdDetPag->vPag = $this->num($pag['vPag'] ?? 0);
            $stdDetPag->indPag = $pag['indPag'] ?? 0;
            $make->tagdetPag($stdDetPag);
        }

        if (! empty($payload['infAdic'])) {
            $stdAdic = new stdClass;
            $stdAdic->infCpl = $payload['infAdic']['infCpl'] ?? null;
            $stdAdic->infAdFisco = $payload['infAdic']['infAdFisco'] ?? null;
            $make->taginfAdic($stdAdic);
        }

        $this->aplicarRespTec($make, $empresa, $payload);

        $xml = $make->getXML();
        $errors = $make->getErrors();
        if ($xml === '' || $errors !== []) {
            $msgs = implode('; ', $errors);
            throw new RuntimeException('Falha ao montar XML da NF-e: '.$msgs);
        }

        return $make;
    }

    private function aplicarRespTec(Make $make, Empresa $empresa, array $payload): void
    {
        $cfg = config('nfe.resp_tec', []);
        $fromPayload = $payload['respTec'] ?? [];

        $cnpj = preg_replace('/\D/', '', (string) (
            $this->primeiroNaoVazio(
                $fromPayload['cnpj'] ?? null,
                $cfg['cnpj'] ?? null,
                $empresa->cnpjDigits()
            )
        ));
        $contato = (string) $this->primeiroNaoVazio(
            $fromPayload['xContato'] ?? null,
            $cfg['contato'] ?? null,
            $empresa->nome_fantasia,
            $empresa->razao_social,
            'Diogo Pieri'
        );
        $email = (string) $this->primeiroNaoVazio(
            $fromPayload['email'] ?? null,
            $cfg['email'] ?? null,
            $empresa->email,
            'diogo.pieri53@gmail.com'
        );
        $fone = preg_replace('/\D/', '', (string) $this->primeiroNaoVazio(
            $fromPayload['fone'] ?? null,
            $cfg['fone'] ?? null,
            $empresa->telefone,
            '4935570634'
        ));

        if (strlen($fone) < 6) {
            $fone = '4935570634';
        }

        $std = new stdClass;
        $std->CNPJ = $cnpj;
        $std->xContato = mb_substr($contato, 0, 60);
        $std->email = mb_substr($email, 0, 60);
        $std->fone = $fone;

        $csrt = $fromPayload['CSRT'] ?? $cfg['csrt'] ?? null;
        $idCsrt = $fromPayload['idCSRT'] ?? $cfg['id_csrt'] ?? null;
        if (! empty($csrt) && ! empty($idCsrt)) {
            $std->CSRT = (string) $csrt;
            $std->idCSRT = str_pad((string) $idCsrt, 2, '0', STR_PAD_LEFT);
        }

        $make->taginfRespTec($std);
    }

    private function primeiroNaoVazio(mixed ...$valores): mixed
    {
        foreach ($valores as $valor) {
            if ($valor === null) {
                continue;
            }
            if (is_string($valor) && trim($valor) === '') {
                continue;
            }
            if (is_string($valor)) {
                return trim($valor);
            }

            return $valor;
        }

        return null;
    }

    private function resolverIdDest(string $ufEmit, string $ufDest): int
    {
        return strtoupper($ufEmit) === strtoupper($ufDest) ? 1 : 2;
    }

    private function num(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    private function aplicarIcms(Make $make, int $nItem, int $crt, array $icms, float $vProd): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->orig = $icms['orig'] ?? 0;

        if ($crt === 1 || $crt === 2) {
            $std->CSOSN = $icms['CSOSN'] ?? '102';
            $std->pCredSN = $icms['pCredSN'] ?? null;
            $std->vCredICMSSN = $icms['vCredICMSSN'] ?? null;
            $std->modBC = $icms['modBC'] ?? null;
            $std->vBC = isset($icms['vBC']) ? $this->num($icms['vBC']) : null;
            $std->pICMS = isset($icms['pICMS']) ? $this->num($icms['pICMS']) : null;
            $std->vICMS = isset($icms['vICMS']) ? $this->num($icms['vICMS']) : null;
            $make->tagICMSSN($std);

            return;
        }

        $std->CST = $icms['CST'] ?? '00';
        $std->modBC = $icms['modBC'] ?? 3;
        $std->vBC = $this->num($icms['vBC'] ?? $vProd);
        $std->pICMS = $this->num($icms['pICMS'] ?? 0);
        $std->vICMS = $this->num($icms['vICMS'] ?? 0);
        $make->tagICMS($std);
    }

    private function aplicarPis(Make $make, int $nItem, array $pis): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $cst = (string) ($pis['CST'] ?? '07');
        $std->CST = $cst;
        // Grupo PISoutr (01/02/49/99): schema exige vBC/pPIS/vPIS.
        if (in_array($cst, ['01', '02', '49', '99'], true)) {
            $std->vBC = $this->num($pis['vBC'] ?? 0);
            $std->pPIS = $this->num($pis['pPIS'] ?? 0);
            $std->vPIS = $this->num($pis['vPIS'] ?? 0);
        } else {
            $std->vBC = isset($pis['vBC']) ? $this->num($pis['vBC']) : null;
            $std->pPIS = isset($pis['pPIS']) ? $this->num($pis['pPIS']) : null;
            $std->vPIS = isset($pis['vPIS']) ? $this->num($pis['vPIS']) : null;
        }
        $make->tagPIS($std);
    }

    private function aplicarCofins(Make $make, int $nItem, array $cofins): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $cst = (string) ($cofins['CST'] ?? '07');
        $std->CST = $cst;
        // Grupo COFINSoutr (01/02/49/99): schema exige vBC/pCOFINS/vCOFINS.
        if (in_array($cst, ['01', '02', '49', '99'], true)) {
            $std->vBC = $this->num($cofins['vBC'] ?? 0);
            $std->pCOFINS = $this->num($cofins['pCOFINS'] ?? 0);
            $std->vCOFINS = $this->num($cofins['vCOFINS'] ?? 0);
        } else {
            $std->vBC = isset($cofins['vBC']) ? $this->num($cofins['vBC']) : null;
            $std->pCOFINS = isset($cofins['pCOFINS']) ? $this->num($cofins['pCOFINS']) : null;
            $std->vCOFINS = isset($cofins['vCOFINS']) ? $this->num($cofins['vCOFINS']) : null;
        }
        $make->tagCOFINS($std);
    }

    private function aplicarIpi(Make $make, int $nItem, array $ipi): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->cEnq = $ipi['cEnq'] ?? '999';
        $std->CST = $ipi['CST'] ?? '99';
        $std->vBC = isset($ipi['vBC']) ? $this->num($ipi['vBC']) : null;
        $std->pIPI = isset($ipi['pIPI']) ? $this->num($ipi['pIPI']) : null;
        $std->vIPI = isset($ipi['vIPI']) ? $this->num($ipi['vIPI']) : null;
        $make->tagIPI($std);
    }
}
