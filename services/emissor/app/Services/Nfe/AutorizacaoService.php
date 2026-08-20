<?php

namespace App\Services\Nfe;

use App\Enums\NotaStatus;
use App\Models\Nota;
use Illuminate\Support\Facades\Storage;
use NFePHP\NFe\Complements;
use Throwable;

class AutorizacaoService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
        private MakeNfeBuilder $builder,
        private NumeracaoService $numeracaoService,
        private SefazResponseParser $parser,
    ) {}

    public function criarEEnfileirar(Nota $nota, array $payload): Nota
    {
        $serie = (int) ($payload['serie'] ?? 1);
        $modelo = $this->resolverModelo($nota, $payload);
        $reserva = $this->numeracaoService->reservar($nota->empresa, $serie, $modelo);

        $make = $this->builder->build($nota->empresa, $payload, $reserva['numero'], $reserva['serie']);

        $nota->numero = $reserva['numero'];
        $nota->serie = $reserva['serie'];
        $nota->modelo = $modelo;
        $nota->chave = $this->normalizarChave($make->getChave() ?: $make->chNFe);
        $nota->payload = $payload;
        $nota->status = NotaStatus::Processando;
        $nota->save();

        return $nota->fresh();
    }

    public function autorizar(Nota $nota): Nota
    {
        $empresa = $nota->empresa()->with('certificado')->firstOrFail();
        $payload = $nota->payload ?? [];
        $modelo = $this->resolverModelo($nota, $payload);

        $tools = $this->toolsFactory->make($empresa, $modelo);

        if (! $nota->xml_assinado) {
            $make = $this->builder->build($empresa, $payload, (int) $nota->numero, (int) $nota->serie);
            // NFC-e: com CSC/CSCid no config do Tools, signNFe inclui o QR Code
            $xml = $tools->signNFe($make->getXML());
            $nota->chave = $this->normalizarChave($make->getChave() ?: $make->chNFe) ?: $nota->chave;
            $nota->xml_assinado = $xml;
            $nota->save();
        }

        $idLote = str_pad((string) $nota->id, 15, '0', STR_PAD_LEFT);

        try {
            $response = $tools->sefazEnviaLote([$nota->xml_assinado], $idLote, 1);
        } catch (Throwable $e) {
            $nota->status = NotaStatus::Rejeitada;
            $nota->x_motivo = $e->getMessage();
            $nota->save();

            throw $e;
        }

        $nota->xml_retorno = $response;
        $parsed = $this->parser->parse($response);
        $nota->c_stat = $parsed['cStat'];
        $nota->x_motivo = $parsed['cStat']
            ? trim($parsed['cStat'].' - '.($parsed['xMotivo'] ?? ''))
            : ($parsed['xMotivo'] ?? null);

        if ($this->parser->isAutorizado($parsed['cStat'])) {
            try {
                $xmlAutorizado = Complements::toAuthorize($nota->xml_assinado, $response);
            } catch (Throwable) {
                $xmlAutorizado = $nota->xml_assinado;
            }

            $nota->xml_autorizado = $xmlAutorizado;
            $nota->protocolo = $parsed['nProt'];
            $nota->status = NotaStatus::Autorizada;
            $nota->autorizada_em = now();
            $nota->chave = $this->normalizarChave($parsed['chNFe'] ?: $nota->chave);

            $this->persistXml($nota, $xmlAutorizado);
        } elseif (in_array($parsed['cStat'], ['110', '301', '302', '303'], true)) {
            $nota->status = NotaStatus::Denegada;
            $nota->chave = $this->normalizarChave($parsed['chNFe'] ?: $nota->chave);
        } else {
            $nota->status = NotaStatus::Rejeitada;
            $nota->chave = $this->normalizarChave($parsed['chNFe'] ?: $nota->chave);
        }

        $nota->save();

        return $nota->fresh();
    }

    private function resolverModelo(Nota $nota, array $payload): int
    {
        $mod = (int) ($payload['ide']['mod'] ?? $nota->modelo ?? 55);

        return in_array($mod, [55, 65], true) ? $mod : 55;
    }

    private function normalizarChave(?string $chave): ?string
    {
        if ($chave === null || $chave === '') {
            return null;
        }

        $digits = preg_replace('/\D/', '', $chave) ?? '';
        if (str_starts_with(strtoupper($chave), 'NFE') && strlen($digits) > 44) {
            $digits = substr($digits, -44);
        }
        if (strlen($digits) > 44) {
            $digits = substr($digits, 0, 44);
        }

        return strlen($digits) === 44 ? $digits : ($digits !== '' ? $digits : null);
    }

    private function persistXml(Nota $nota, string $xml): void
    {
        $relative = "nfe/{$nota->empresa_id}/{$nota->chave}/nfe.xml";

        try {
            $this->ensureStorageDir(storage_path('app/private/nfe/'.$nota->empresa_id.'/'.$nota->chave));
            Storage::disk('local')->put($relative, $xml);

            return;
        } catch (Throwable $e) {
            // Fallback: AppData do usuario (instalacao em pasta sem permissao de escrita)
            try {
                $base = rtrim((string) (getenv('LOCALAPPDATA') ?: sys_get_temp_dir()), DIRECTORY_SEPARATOR);
                $dir = $base.DIRECTORY_SEPARATOR.'Edem Software'.DIRECTORY_SEPARATOR
                    .'Mecanica Bedendo'.DIRECTORY_SEPARATOR.'nfe-xml'
                    .DIRECTORY_SEPARATOR.$nota->empresa_id.DIRECTORY_SEPARATOR.$nota->chave;
                $this->ensureStorageDir($dir);
                file_put_contents($dir.DIRECTORY_SEPARATOR.'nfe.xml', $xml);
            } catch (Throwable) {
                // XML ja esta em xml_autorizado no banco — nao aborta a emissao.
                report($e);
            }
        }
    }

    private function ensureStorageDir(string $dir): void
    {
        if (is_dir($dir)) {
            return;
        }
        if (! @mkdir($dir, 0777, true) && ! is_dir($dir)) {
            throw new \RuntimeException('mkdir(): Permission denied ('.$dir.')');
        }
    }
}
