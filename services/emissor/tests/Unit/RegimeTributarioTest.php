<?php

namespace Tests\Unit;

use App\Enums\RegimeTributario;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RegimeTributarioTest extends TestCase
{
    #[Test]
    public function deriva_crt_corretamente(): void
    {
        $this->assertSame(1, RegimeTributario::SimplesNacional->crt(false));
        $this->assertSame(2, RegimeTributario::SimplesNacional->crt(true));
        $this->assertSame(3, RegimeTributario::LucroPresumido->crt());
        $this->assertSame(3, RegimeTributario::LucroReal->crt());
        $this->assertSame(4, RegimeTributario::Mei->crt());
    }

    #[Test]
    public function defaults_pis_cofins_por_regime(): void
    {
        $this->assertSame(0.65, RegimeTributario::LucroPresumido->defaultsPisCofins()['p_pis']);
        $this->assertSame(3.00, RegimeTributario::LucroPresumido->defaultsPisCofins()['p_cofins']);
        $this->assertSame(1.65, RegimeTributario::LucroReal->defaultsPisCofins()['p_pis']);
        $this->assertSame(7.60, RegimeTributario::LucroReal->defaultsPisCofins()['p_cofins']);
        $this->assertSame('49', RegimeTributario::SimplesNacional->defaultsPisCofins()['cst_pis']);
    }
}
