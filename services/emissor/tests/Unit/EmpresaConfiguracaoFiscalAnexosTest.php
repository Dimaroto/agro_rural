<?php

namespace Tests\Unit;

use App\Enums\RegimeTributario;
use App\Models\Empresa;
use App\Models\EmpresaConfiguracaoFiscal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmpresaConfiguracaoFiscalAnexosTest extends TestCase
{
    use RefreshDatabase;

    private function cfg(array $extra = []): EmpresaConfiguracaoFiscal
    {
        $empresa = Empresa::query()->create([
            'cnpj' => '12345678000199',
            'ie' => '123456789',
            'razao_social' => 'EMPRESA ANEXOS LTDA',
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

        return $empresa->configuracaoFiscal()->create(array_merge([
            'anexo_simples_mercadoria' => 1,
            'anexo_simples_servico' => 3,
            'perc_aprox_tributos' => 14.50,
            'perc_aprox_tributos_servico' => 8.25,
        ], $extra));
    }

    public function test_anexo_para_distinguindo_mercadoria_e_servico(): void
    {
        $cfg = $this->cfg();

        $this->assertSame(1, $cfg->anexoPara('mercadoria'));
        $this->assertSame(1, $cfg->anexoPara('peca'));
        $this->assertSame(1, $cfg->anexoPara('produto'));
        $this->assertSame(3, $cfg->anexoPara('servico'));
        $this->assertSame(3, $cfg->anexoPara('mao_de_obra'));
    }

    public function test_perc_aprox_tributos_por_tipo(): void
    {
        $cfg = $this->cfg();

        $this->assertSame(14.50, $cfg->percAproxTributosPara('mercadoria'));
        $this->assertSame(8.25, $cfg->percAproxTributosPara('servico'));
    }

    public function test_perc_aprox_fallback_quando_nulo(): void
    {
        $cfg = $this->cfg([
            'perc_aprox_tributos' => 0,
            'perc_aprox_tributos_servico' => 0,
        ]);

        $this->assertSame(13.45, $cfg->percAproxTributosPara('peca'));
        $this->assertSame(13.45, $cfg->percAproxTributosPara('servico'));
    }
}
