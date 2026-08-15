<?php

namespace App\Services\Nfe;

use App\Enums\EventoStatus;
use App\Enums\EventoTipo;
use App\Enums\NotaStatus;
use App\Models\Evento;
use App\Models\Nota;
use InvalidArgumentException;
use Throwable;

class CancelamentoService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
        private SefazResponseParser $parser,
    ) {}

    public function criarEvento(Nota $nota, string $justificativa): Evento
    {
        if ($nota->status !== NotaStatus::Autorizada) {
            throw new InvalidArgumentException('Somente NF-e autorizada pode ser cancelada.');
        }

        if (! $nota->protocolo) {
            throw new InvalidArgumentException('NF-e sem protocolo de autorização.');
        }

        if (strlen(trim($justificativa)) < 15) {
            throw new InvalidArgumentException('Justificativa deve ter no mínimo 15 caracteres.');
        }

        return Evento::create([
            'empresa_id' => $nota->empresa_id,
            'nota_id' => $nota->id,
            'tipo' => EventoTipo::Cancelamento,
            'chave' => $nota->chave,
            'sequencial' => 1,
            'status' => EventoStatus::Processando,
            'payload' => ['justificativa' => $justificativa],
        ]);
    }

    public function processar(Evento $evento): Evento
    {
        $nota = $evento->nota()->firstOrFail();
        $empresa = $evento->empresa()->with('certificado')->firstOrFail();
        $justificativa = $evento->payload['justificativa'] ?? '';

        $tools = $this->toolsFactory->make($empresa, (int) ($nota->modelo ?: 55));

        try {
            $response = $tools->sefazCancela($nota->chave, $justificativa, $nota->protocolo);
        } catch (Throwable $e) {
            $evento->status = EventoStatus::Rejeitado;
            $evento->x_motivo = $e->getMessage();
            $evento->save();

            throw $e;
        }

        $evento->xml_retorno = $response;
        $parsed = $this->parser->parse($response);
        $evento->c_stat = $parsed['cStat'];
        $evento->x_motivo = $parsed['xMotivo'];
        $evento->protocolo = $parsed['nProt'];

        if ($this->parser->isEventoAutorizado($parsed['cStat'])) {
            $evento->status = EventoStatus::Autorizado;
            $nota->status = NotaStatus::Cancelada;
            $nota->cancelada_em = now();
            $nota->save();
        } else {
            $evento->status = EventoStatus::Rejeitado;
        }

        $evento->save();

        return $evento->fresh();
    }
}
