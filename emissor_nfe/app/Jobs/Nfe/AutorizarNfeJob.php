<?php

namespace App\Jobs\Nfe;

use App\Models\Nota;
use App\Services\Nfe\AutorizacaoService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class AutorizarNfeJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public Nota $nota) {}

    public function handle(AutorizacaoService $service): void
    {
        $service->autorizar($this->nota->fresh());
    }

    public function failed(?Throwable $exception): void
    {
        $nota = $this->nota->fresh();
        if ($nota && $nota->status->value === 'processando') {
            $nota->x_motivo = $exception?->getMessage() ?? 'Falha no processamento';
            $nota->status = \App\Enums\NotaStatus::Rejeitada;
            $nota->save();
        }
    }
}
