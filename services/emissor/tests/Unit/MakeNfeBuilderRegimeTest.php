<?php

namespace Tests\Unit;

use App\Enums\RegimeTributario;
use App\Models\Empresa;
use App\Models\EmpresaConfiguracaoFiscal;
use App\Services\Nfe\MakeNfeBuilder;
use App\Services\Nfe\TributacaoResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MakeNfeBuilderRegimeTest extends TestCase
{
    use RefreshDatabase;

    private function empresaBase(array $extra = []): Empresa
    {
        $empresa = Empresa::query()->create(array_merge([
            'cnpj' => '12345678000199',
            'ie' => '123456789',
            'razao_social' => 'EMPRESA TESTE LTDA',
            'nome_fantasia' => 'TESTE',
            'email' => 'teste@example.com',
            'telefone' => '4935551234',
            'logradouro' => 'RUA A',
            'numero' => '100',
            'bairro' => 'CENTRO',
            'municipio' => 'CHAPECO',
            'codigo_municipio' => '4204202',
            'uf' => 'SC',
            'cep' => '89801000',
            'crt' => 1,
            'regime_tributario' => RegimeTributario::SimplesNacional,
            'ambiente' => 'homologacao',
            'ativa' => true,
            'emite_nfe' => true,
            'onboarding_concluido' => true,
        ], $extra));

        return $empresa;
    }

    private function payloadBase(array $overrides = []): array
    {
        return array_replace_recursive([
            'ide' => ['mod' => 55, 'natOp' => 'VENDA'],
            'destinatario' => [
                'documento' => '52998224725',
                'xNome' => 'CLIENTE TESTE',
                'logradouro' => 'RUA B',
                'numero' => '50',
                'bairro' => 'CENTRO',
                'municipio' => 'CHAPECO',
                'codigo_municipio' => '4204202',
                'uf' => 'SC',
                'cep' => '89801001',
                'indIEDest' => 9,
            ],
            'itens' => [[
                'cProd' => '1',
                'xProd' => 'PECA',
                'NCM' => '87089990',
                'CFOP' => '5102',
                'uCom' => 'UN',
                'qCom' => 1,
                'vUnCom' => 100,
                'vProd' => 100,
                'imposto' => [],
            ]],
            'totais' => [],
        ], $overrides);
    }

    public function test_simples_nacional_usa_csosn_e_pis_49(): void
    {
        $empresa = $this->empresaBase();
        $empresa->garantirConfiguracaoFiscal();

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa,
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('<CSOSN>102</CSOSN>', $xml);
        $this->assertStringContainsString('<CRT>1</CRT>', $xml);
        $this->assertStringContainsString('<CST>49</CST>', $xml);
        $this->assertStringNotContainsString('<ICMSUFDest>', $xml);
    }

    public function test_lucro_presumido_usa_cst_e_pis_cumulativo(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000188',
            'crt' => 3,
            'regime_tributario' => RegimeTributario::LucroPresumido,
        ]);
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'cst_icms_padrao' => '00',
            'p_icms_interno' => 17,
            'regime_pis_cofins' => 'cumulativo',
            'cst_pis' => '01',
            'p_pis' => 0.65,
            'cst_cofins' => '01',
            'p_cofins' => 3.00,
            'aplica_difal' => false,
        ]);

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa->fresh(['configuracaoFiscal']),
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('<CRT>3</CRT>', $xml);
        $this->assertStringContainsString('<CST>00</CST>', $xml);
        $this->assertMatchesRegularExpression('/<pPIS>0\.65(00)?<\/pPIS>/', $xml);
        $this->assertMatchesRegularExpression('/<pCOFINS>3\.00(00)?<\/pCOFINS>/', $xml);
        $this->assertStringNotContainsString('<CSOSN>', $xml);
    }

    public function test_lucro_real_usa_pis_nao_cumulativo(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000177',
            'crt' => 3,
            'regime_tributario' => RegimeTributario::LucroReal,
        ]);
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'cst_icms_padrao' => '00',
            'p_icms_interno' => 18,
            'regime_pis_cofins' => 'nao_cumulativo',
            'cst_pis' => '01',
            'p_pis' => 1.65,
            'cst_cofins' => '01',
            'p_cofins' => 7.60,
            'aplica_difal' => false,
        ]);

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa->fresh(['configuracaoFiscal']),
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertMatchesRegularExpression('/<pPIS>1\.65(00)?<\/pPIS>/', $xml);
        $this->assertMatchesRegularExpression('/<pCOFINS>7\.60(00)?<\/pCOFINS>/', $xml);
    }

    public function test_difal_interestadual_consumidor_final(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000166',
            'crt' => 3,
            'regime_tributario' => RegimeTributario::LucroPresumido,
            'uf' => 'SC',
        ]);
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'cst_icms_padrao' => '00',
            'p_icms_interno' => 17,
            'aplica_difal' => true,
            'cst_pis' => '01',
            'p_pis' => 0.65,
            'cst_cofins' => '01',
            'p_cofins' => 3.00,
        ]);

        $payload = $this->payloadBase([
            'destinatario' => [
                'uf' => 'SP',
                'municipio' => 'SAO PAULO',
                'codigo_municipio' => '3550308',
                'cep' => '01001000',
            ],
            'ide' => ['indFinal' => 1],
        ]);

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa->fresh(['configuracaoFiscal']),
            $payload,
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('<ICMSUFDest>', $xml);
        $this->assertStringContainsString('<pICMSInter>', $xml);
    }

    public function test_icms_st_preenche_grupos(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000155',
            'crt' => 3,
            'regime_tributario' => RegimeTributario::LucroPresumido,
        ]);
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'cst_icms_padrao' => '00',
            'p_icms_interno' => 17,
            'usa_icms_st' => true,
            'p_mva_st' => 40,
            'p_icms_st' => 18,
            'cest_padrao' => '0100100',
            'aplica_difal' => false,
            'cst_pis' => '01',
            'p_pis' => 0.65,
            'cst_cofins' => '01',
            'p_cofins' => 3.00,
        ]);

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa->fresh(['configuracaoFiscal']),
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('<CST>10</CST>', $xml);
        $this->assertStringContainsString('<vBCST>', $xml);
        $this->assertStringContainsString('<vICMSST>', $xml);
        $this->assertStringContainsString('<CEST>0100100</CEST>', $xml);
    }

    public function test_emit_inclui_im_cnae_iest(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000144',
            'inscricao_municipal' => '12345',
            'cnae_fiscal' => '4520001',
            'iest' => '999888777',
        ]);
        $empresa->garantirConfiguracaoFiscal();

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa,
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('<IM>12345</IM>', $xml);
        $this->assertStringContainsString('<CNAE>4520001</CNAE>', $xml);
        $this->assertStringContainsString('<IEST>999888777</IEST>', $xml);
    }

    public function test_resp_tec_nao_usa_dados_pessoais_chumbados(): void
    {
        $empresa = $this->empresaBase([
            'cnpj' => '12345678000133',
            'resp_tec_contato' => 'Sistema Emissor',
            'resp_tec_email' => 'suporte@emissor.local',
            'resp_tec_fone' => '4930000000',
        ]);
        $empresa->garantirConfiguracaoFiscal();

        $make = (new MakeNfeBuilder(new TributacaoResolver))->build(
            $empresa,
            $this->payloadBase(),
            1,
            1
        );

        $xml = $make->getXML();
        $this->assertStringContainsString('Sistema Emissor', $xml);
        $this->assertStringNotContainsString('Diogo Pieri', $xml);
        $this->assertStringNotContainsString('diogo.pieri53@gmail.com', $xml);
    }
}
