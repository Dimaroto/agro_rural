<?php

namespace App\Services\Nfe;

use App\Enums\NotaStatus;
use App\Models\Nota;
use InvalidArgumentException;
use NFePHP\DA\NFe\Danfe;
use RuntimeException;

class DanfeService
{
    public function gerarPdf(Nota $nota): string
    {
        $xml = $nota->xml_autorizado ?: $nota->xml_assinado;

        if (! $xml) {
            throw new InvalidArgumentException('NF-e sem XML para gerar DANFE.');
        }

        if ($nota->status === NotaStatus::Rascunho) {
            throw new InvalidArgumentException('NF-e ainda não processada.');
        }

        try {
            $danfe = new Danfe($xml);
            $danfe->creditsIntegratorFooter('Edem Software — Mecânica Bedendo');
            $pdf = $danfe->render($this->logoPath());
        } catch (\Throwable $e) {
            throw new RuntimeException('Falha ao gerar DANFE: '.$e->getMessage(), 0, $e);
        }

        if (! is_string($pdf) || $pdf === '') {
            throw new RuntimeException('DANFE gerado está vazio.');
        }

        return $pdf;
    }

    /** Alias usado pelo painel web. */
    public function gerar(Nota $nota): string
    {
        return $this->gerarPdf($nota);
    }

    private function logoPath(): string
    {
        $candidates = [
            public_path('branding/bedendo_logo.png'),
            storage_path('app/branding/bedendo_logo.png'),
            base_path('../assets/branding/bedendo_logo.png'),
        ];
        foreach ($candidates as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        return '';
    }
}
