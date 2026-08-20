<?php

namespace App\Services\Nfe;

use App\Models\Empresa;
use NFePHP\Common\UFList;
use NFePHP\NFe\Make;
use RuntimeException;
use stdClass;

class MakeNfeBuilder
{
    public function __construct(
        private ?TributacaoResolver $tributacaoResolver = null,
    ) {
        $this->tributacaoResolver ??= app(TributacaoResolver::class);
    }

    public function build(Empresa $empresa, array $payload, int $numero, int $serie): Make
    {
        $payload = $this->tributacaoResolver->apply($empresa, $payload);

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

        $stdEmit = new stdClass;
        $stdEmit->xNome = $empresa->razao_social;
        $stdEmit->xFant = $empresa->nome_fantasia ?: $empresa->razao_social;
        $stdEmit->IE = $empresa->ie;
        if (! empty($empresa->iest)) {
            $stdEmit->IEST = $empresa->iest;
        }
        if (! empty($empresa->inscricao_municipal)) {
            $stdEmit->IM = $empresa->inscricao_municipal;
        }
        if (! empty($empresa->cnae_fiscal)) {
            $stdEmit->CNAE = preg_replace('/\D/', '', $empresa->cnae_fiscal);
        }
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

            $this->aplicarIcms($make, $nItem, (int) $empresa->crt, $imposto['ICMS'] ?? [], (float) $stdProd->vProd);
            $this->aplicarPis($make, $nItem, $imposto['PIS'] ?? []);
            $this->aplicarCofins($make, $nItem, $imposto['COFINS'] ?? []);

            if (! empty($imposto['IPI'])) {
                $this->aplicarIpi($make, $nItem, $imposto['IPI']);
            }

            if (! empty($imposto['ICMSUFDest'])) {
                $this->aplicarIcmsUfDest($make, $nItem, $imposto['ICMSUFDest']);
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

        if (! empty($payload['retTrib'])) {
            $this->aplicarRetTrib($make, $payload['retTrib']);
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

    private function aplicarIcms(Make $make, int $nItem, int $crt, array $icms, float $vProd): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->orig = $icms['orig'] ?? 0;

        if (in_array($crt, [1, 2, 4], true)) {
            $csosn = (string) ($icms['CSOSN'] ?? '102');
            $std->CSOSN = $csosn;

            if (in_array($csosn, ['101', '201'], true)) {
                $std->pCredSN = $this->num($icms['pCredSN'] ?? 0);
                $std->vCredICMSSN = $this->num($icms['vCredICMSSN'] ?? 0);
            }

            if (in_array($csosn, ['201', '202', '203'], true)) {
                $this->preencherSt($std, $icms, $vProd);
            }

            if ($csosn === '900') {
                $std->modBC = $icms['modBC'] ?? 3;
                $std->vBC = $this->num($icms['vBC'] ?? $vProd);
                $std->pICMS = $this->num($icms['pICMS'] ?? 0);
                $std->vICMS = $this->num($icms['vICMS'] ?? 0);
                if (isset($icms['vBCST']) || isset($icms['pMVAST'])) {
                    $this->preencherSt($std, $icms, $vProd);
                }
            }

            $make->tagICMSSN($std);

            return;
        }

        $cst = (string) ($icms['CST'] ?? '00');
        $std->CST = $cst;

        if (in_array($cst, ['00', '10', '20', '51', '70', '90'], true)) {
            $std->modBC = $icms['modBC'] ?? 3;
            $std->vBC = $this->num($icms['vBC'] ?? $vProd);
            $std->pICMS = $this->num($icms['pICMS'] ?? 0);
            $std->vICMS = $this->num($icms['vICMS'] ?? 0);
        }

        if (in_array($cst, ['20', '70'], true) && isset($icms['pRedBC'])) {
            $std->pRedBC = $this->num($icms['pRedBC']);
        }

        if (in_array($cst, ['40', '41', '50'], true)) {
            if (isset($icms['vICMSDeson'])) {
                $std->vICMSDeson = $this->num($icms['vICMSDeson']);
            }
            if (isset($icms['motDesICMS'])) {
                $std->motDesICMS = $icms['motDesICMS'];
            }
        }

        if ($cst === '51') {
            $std->vICMSOp = isset($icms['vICMSOp']) ? $this->num($icms['vICMSOp']) : null;
            $std->pDif = isset($icms['pDif']) ? $this->num($icms['pDif']) : null;
            $std->vICMSDif = isset($icms['vICMSDif']) ? $this->num($icms['vICMSDif']) : null;
        }

        if (in_array($cst, ['10', '30', '70', '90'], true)) {
            $this->preencherSt($std, $icms, $vProd);
        }

        if (isset($icms['pFCP'])) {
            $std->pFCP = $this->num($icms['pFCP']);
            $std->vFCP = $this->num($icms['vFCP'] ?? 0);
            if (isset($icms['vBCFCP'])) {
                $std->vBCFCP = $this->num($icms['vBCFCP']);
            }
        }

        $make->tagICMS($std);
    }

    private function preencherSt(stdClass $std, array $icms, float $vProd): void
    {
        $std->modBCST = $icms['modBCST'] ?? 4;
        if (isset($icms['pMVAST'])) {
            $std->pMVAST = $this->num($icms['pMVAST']);
        }
        if (isset($icms['pRedBCST'])) {
            $std->pRedBCST = $this->num($icms['pRedBCST']);
        }
        $std->vBCST = $this->num($icms['vBCST'] ?? $vProd);
        $std->pICMSST = $this->num($icms['pICMSST'] ?? 0);
        $std->vICMSST = $this->num($icms['vICMSST'] ?? 0);
    }

    private function aplicarIcmsUfDest(Make $make, int $nItem, array $difal): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->vBCUFDest = $this->num($difal['vBCUFDest'] ?? 0);
        $std->vBCFCPUFDest = isset($difal['vBCFCPUFDest'])
            ? $this->num($difal['vBCFCPUFDest'])
            : $std->vBCUFDest;
        $std->pFCPUFDest = $this->num($difal['pFCPUFDest'] ?? 0);
        $std->pICMSUFDest = $this->num($difal['pICMSUFDest'] ?? 0);
        $std->pICMSInter = $this->num($difal['pICMSInter'] ?? 12);
        $std->pICMSInterPart = $this->num($difal['pICMSInterPart'] ?? 100);
        $std->vFCPUFDest = $this->num($difal['vFCPUFDest'] ?? 0);
        $std->vICMSUFDest = $this->num($difal['vICMSUFDest'] ?? 0);
        $std->vICMSUFRemet = $this->num($difal['vICMSUFRemet'] ?? 0);
        $make->tagICMSUFDest($std);
    }

    private function aplicarRetTrib(Make $make, array $ret): void
    {
        $std = new stdClass;
        foreach (['vRetPIS', 'vRetCOFINS', 'vRetCSLL', 'vBCIRRF', 'vIRRF', 'vBCRetPrev', 'vRetPrev'] as $f) {
            if (isset($ret[$f])) {
                $std->{$f} = $this->num($ret[$f]);
            }
        }
        $make->tagretTrib($std);
    }

    private function aplicarRespTec(Make $make, Empresa $empresa, array $payload): void
    {
        $cfg = config('nfe.resp_tec', []);
        $fromPayload = $payload['respTec'] ?? [];

        $cnpj = preg_replace('/\D/', '', (string) (
            $this->primeiroNaoVazio(
                $fromPayload['cnpj'] ?? null,
                $empresa->resp_tec_cnpj,
                $cfg['cnpj'] ?? null,
                $empresa->cnpjDigits()
            )
        ));
        $contato = (string) $this->primeiroNaoVazio(
            $fromPayload['xContato'] ?? null,
            $empresa->resp_tec_contato,
            $cfg['contato'] ?? null,
            $empresa->nome_fantasia,
            $empresa->razao_social,
            'Responsavel Tecnico'
        );
        $email = (string) $this->primeiroNaoVazio(
            $fromPayload['email'] ?? null,
            $empresa->resp_tec_email,
            $cfg['email'] ?? null,
            $empresa->email,
            'nfe@localhost'
        );
        $fone = preg_replace('/\D/', '', (string) $this->primeiroNaoVazio(
            $fromPayload['fone'] ?? null,
            $empresa->resp_tec_fone,
            $cfg['fone'] ?? null,
            $empresa->telefone,
            '0000000000'
        ));

        if (strlen((string) $fone) < 6) {
            $fone = '0000000000';
        }

        $std = new stdClass;
        $std->CNPJ = $cnpj;
        $std->xContato = mb_substr($contato, 0, 60);
        $std->email = mb_substr($email, 0, 60);
        $std->fone = $fone;

        $csrt = $fromPayload['CSRT'] ?? $empresa->resp_tec_csrt ?? $cfg['csrt'] ?? null;
        $idCsrt = $fromPayload['idCSRT'] ?? $empresa->resp_tec_id_csrt ?? $cfg['id_csrt'] ?? null;
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

    private function aplicarPis(Make $make, int $nItem, array $pis): void
    {
        $std = new stdClass;
        $std->item = $nItem;
        $cst = (string) ($pis['CST'] ?? '49');
        $std->CST = $cst;
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
        $cst = (string) ($cofins['CST'] ?? '49');
        $std->CST = $cst;
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
        $std->vBC = $this->num($ipi['vBC'] ?? 0);
        $std->pIPI = $this->num($ipi['pIPI'] ?? 0);
        $std->vIPI = $this->num($ipi['vIPI'] ?? 0);
        $make->tagIPI($std);
    }
}
