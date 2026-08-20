<?php

namespace Tests\Unit;

use App\Enums\RegimeTributario;
use App\Models\Empresa;
use App\Services\Integracoes\Mecanica\MecanicaNfsePayloadMapper;
use App\Services\Nfse\NfseEmissaoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NfseDefaultsEmpresaTest extends TestCase
{
    use RefreshDatabase;

    public function test_mapper_usa_defaults_do_cadastro_quando_payload_omite_codigo_e_aliquota(): void
    {
        $empresa = Empresa::query()->create([
            'cnpj' => '12345678000199',
            'ie' => '123456789',
            'razao_social' => 'OFICINA NFSE LTDA',
            'logradouro' => 'RUA A',
            'numero' => '1',
            'bairro' => 'CENTRO',
            'municipio' => 'CHAPECO',
            'codigo_municipio' => '4204202',
            'uf' => 'SC',
            'cep' => '89801000',
            'crt' => 1,
            'regime_tributario' => RegimeTributario::SimplesNacional,
            'ambiente' => 'homologacao',
            'ativa' => true,
            'emite_nfse' => true,
        ]);

        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'item_lc116' => '14.01',
            'p_iss' => 3.5,
            'anexo_simples_servico' => 3,
            'perc_aprox_tributos_servico' => 9.0,
            'nat_op_servico' => 'PRESTACAO DE SERVICO MECANICO',
        ]);

        $payload = (new MecanicaNfsePayloadMapper)->map([
            'tomador' => [
                'nome' => 'CLIENTE',
                'documento' => '52998224725',
            ],
            'itens' => [
                [
                    'tipo' => 'servico',
                    'nome' => 'Troca de óleo',
                    'quantidade' => 1,
                    'precoUnitario' => 150,
                ],
            ],
            'ordemNumero' => 'OS-10',
        ], $empresa);

        $this->assertSame('14.01', $payload['servico']['codigoServicoLc116']);
        $this->assertSame(3.5, $payload['servico']['aliquotaIss']);
        $this->assertSame(150.0, $payload['servico']['valorServico']);
        $this->assertSame(3, $payload['anexoSimples']);
        $this->assertSame('PRESTACAO DE SERVICO MECANICO', $payload['natOp']);
        $this->assertStringContainsString('Anexo 3', $payload['observacao'] ?? '');

        $result = (new NfseEmissaoService)->emitir($empresa, $payload);
        $this->assertSame('autorizada', $result['status']);
        $this->assertTrue($result['mock']);
    }

    public function test_mapper_exige_cadastro_quando_faltam_codigo_e_aliquota(): void
    {
        $empresa = Empresa::query()->create([
            'cnpj' => '12345678000188',
            'ie' => '123456789',
            'razao_social' => 'OFICINA SEM CFG LTDA',
            'logradouro' => 'RUA A',
            'numero' => '1',
            'bairro' => 'CENTRO',
            'municipio' => 'CHAPECO',
            'codigo_municipio' => '4204202',
            'uf' => 'SC',
            'cep' => '89801000',
            'crt' => 1,
            'regime_tributario' => RegimeTributario::SimplesNacional,
            'ambiente' => 'homologacao',
            'ativa' => true,
        ]);
        $empresa->garantirConfiguracaoFiscal();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('codigoServicoLc116');

        (new MecanicaNfsePayloadMapper)->map([
            'tomador' => ['nome' => 'CLIENTE', 'documento' => '52998224725'],
            'servico' => ['valorServico' => 100],
        ], $empresa);
    }
}
