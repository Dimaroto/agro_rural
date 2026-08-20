<?php

namespace App\Services\Integracoes\Mecanica;

/**
 * Separa itens de uma OS em mercadorias (NF-e/NFC-e) e serviços (NFS-e).
 */
class ItensOsSplitter
{
    private const TIPOS_SERVICO = [
        'servico',
        'serviço',
        'servicos',
        'serviços',
        'mao_de_obra',
        'mao-de-obra',
        'mao de obra',
        'mo',
        'labor',
        'service',
    ];

    private const TIPOS_MERCADORIA = [
        'peca',
        'peça',
        'pecas',
        'peças',
        'produto',
        'produtos',
        'mercadoria',
        'mercadorias',
        'item',
        'part',
        'parts',
    ];

    /**
     * @param  list<array<string, mixed>>  $itens
     * @return array{pecas: list<array<string, mixed>>, servicos: list<array<string, mixed>>}
     */
    public function split(array $itens): array
    {
        $pecas = [];
        $servicos = [];

        foreach ($itens as $item) {
            if (! is_array($item)) {
                continue;
            }

            if ($this->isServico($item)) {
                $servicos[] = $item;
            } else {
                $pecas[] = $item;
            }
        }

        return [
            'pecas' => $pecas,
            'servicos' => $servicos,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    public function isServico(array $item): bool
    {
        $tipo = strtolower(trim((string) (
            $item['tipo']
            ?? $item['tipoItem']
            ?? $item['tipo_item']
            ?? ''
        )));

        if ($tipo === '') {
            // Sem tipo: mantém comportamento legado (tudo vira peça/NF-e).
            return false;
        }

        if (in_array($tipo, self::TIPOS_SERVICO, true)) {
            return true;
        }

        if (in_array($tipo, self::TIPOS_MERCADORIA, true)) {
            return false;
        }

        // Tipo desconhecido: trata como peça para não perder emissão.
        return false;
    }
}
