<?php

namespace App\Enums;

enum RegimeTributario: string
{
    case SimplesNacional = 'simples_nacional';
    case LucroPresumido = 'lucro_presumido';
    case LucroReal = 'lucro_real';
    case Mei = 'mei';

    public function label(): string
    {
        return match ($this) {
            self::SimplesNacional => 'Simples Nacional',
            self::LucroPresumido => 'Lucro Presumido',
            self::LucroReal => 'Lucro Real',
            self::Mei => 'MEI',
        };
    }

    /**
     * CRT da NF-e (tag emit/CRT).
     * 1 = Simples, 2 = Simples excesso sublimite, 3 = Regime normal, 4 = MEI.
     */
    public function crt(bool $excessoSublimite = false): int
    {
        return match ($this) {
            self::SimplesNacional => $excessoSublimite ? 2 : 1,
            self::Mei => 4,
            self::LucroPresumido, self::LucroReal => 3,
        };
    }

    public function isSimples(): bool
    {
        return $this === self::SimplesNacional || $this === self::Mei;
    }

    public function isRegimeNormal(): bool
    {
        return $this === self::LucroPresumido || $this === self::LucroReal;
    }

    public function regimePisCofins(): string
    {
        return match ($this) {
            self::SimplesNacional, self::Mei => 'sn',
            self::LucroPresumido => 'cumulativo',
            self::LucroReal => 'nao_cumulativo',
        };
    }

    /** @return array{cst_pis: string, p_pis: float, cst_cofins: string, p_cofins: float} */
    public function defaultsPisCofins(): array
    {
        return match ($this) {
            self::SimplesNacional, self::Mei => [
                'cst_pis' => '49',
                'p_pis' => 0.0,
                'cst_cofins' => '49',
                'p_cofins' => 0.0,
            ],
            self::LucroPresumido => [
                'cst_pis' => '01',
                'p_pis' => 0.65,
                'cst_cofins' => '01',
                'p_cofins' => 3.00,
            ],
            self::LucroReal => [
                'cst_pis' => '01',
                'p_pis' => 1.65,
                'cst_cofins' => '01',
                'p_cofins' => 7.60,
            ],
        };
    }

    /** @return list<self> */
    public static function opcoesCadastro(): array
    {
        return [
            self::SimplesNacional,
            self::LucroPresumido,
            self::LucroReal,
            self::Mei,
        ];
    }
}
