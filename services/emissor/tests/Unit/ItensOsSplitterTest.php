<?php

namespace Tests\Unit;

use App\Services\Integracoes\Mecanica\ItensOsSplitter;
use PHPUnit\Framework\TestCase;

class ItensOsSplitterTest extends TestCase
{
    public function test_separa_pecas_e_servicos_por_tipo(): void
    {
        $splitter = new ItensOsSplitter;
        $result = $splitter->split([
            ['nome' => 'Filtro', 'tipo' => 'peca', 'precoUnitario' => 50],
            ['nome' => 'Mão de obra', 'tipo' => 'servico', 'precoUnitario' => 120],
            ['nome' => 'Óleo', 'tipo' => 'produto', 'precoUnitario' => 30],
            ['nome' => 'Diagnóstico', 'tipo' => 'mao_de_obra', 'precoUnitario' => 80],
        ]);

        $this->assertCount(2, $result['pecas']);
        $this->assertCount(2, $result['servicos']);
        $this->assertSame('Filtro', $result['pecas'][0]['nome']);
        $this->assertSame('Óleo', $result['pecas'][1]['nome']);
        $this->assertSame('Mão de obra', $result['servicos'][0]['nome']);
        $this->assertSame('Diagnóstico', $result['servicos'][1]['nome']);
    }

    public function test_sem_tipo_cai_como_peca(): void
    {
        $splitter = new ItensOsSplitter;
        $result = $splitter->split([
            ['nome' => 'Item legado', 'precoUnitario' => 10],
        ]);

        $this->assertCount(1, $result['pecas']);
        $this->assertCount(0, $result['servicos']);
    }

    public function test_is_servico(): void
    {
        $splitter = new ItensOsSplitter;

        $this->assertTrue($splitter->isServico(['tipo' => 'servico']));
        $this->assertTrue($splitter->isServico(['tipo' => 'mao_de_obra']));
        $this->assertFalse($splitter->isServico(['tipo' => 'peca']));
        $this->assertFalse($splitter->isServico([]));
    }
}
