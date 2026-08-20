<?php

namespace App\Services\Nfe;

use App\Enums\EventoStatus;
use App\Enums\EventoTipo;
use App\Enums\NotaStatus;
use App\Models\Evento;
use App\Models\Nota;
use InvalidArgumentException;
use Throwable;

class CartaCorrecaoService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
        private SefazResponseParser $parser,
    ) {}

    public function criarEvento(Nota $nota, string $correcao, ?int $sequencial = null): Evento
    {
        if ($nota->status !== NotaStatus::Autorizada) {
            throw new InvalidArgumentException('Somente NF-e autorizada aceita carta de correção.');
        }

        if (strlen(trim($correcao)) < 15) {
            throw new InvalidArgumentException('Texto da correção deve ter no mínimo 15 caracteres.');
        }

        $sequencial ??= ((int) $nota->eventos()
            ->where('tipo', EventoTipo::Cce)
            ->where('status', EventoStatus::Autorizado)
            ->max('sequencial')) + 1;

        return Evento::create([
            'empresa_id' => $nota->empresa_id,
            'nota_id' => $nota->id,
            'tipo' => EventoTipo::Cce,
            'chave' => $nota->chave,
            'sequencial' => max(1, $sequencial),
            'status' => EventoStatus::Processando,
            'payload' => ['correcao' => $correcao],
        ]);
    }

    public function processar(Evento $evento): Evento
    {
        $nota = $evento->nota()->firstOrFail();
        $empresa = $evento->empresa()->with('certificado')->firstOrFail();
        $correcao = $evento->payload['correcao'] ?? '';

        $tools = $this->toolsFactory->make($empresa);

        try {
            $response = $tools->sefazCCe($nota->chave, $correcao, (int) $evento->sequencial);
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
        $evento->status = $this->parser->isEventoAutorizado($parsed['cStat'])
            ? EventoStatus::Autorizado
            : EventoStatus::Rejeitado;
        $evento->save();

        return $evento->fresh();
    }
}
