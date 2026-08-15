<?php

namespace App\Jobs\Nfe;

use App\Models\Evento;
use App\Services\Nfe\CancelamentoService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CancelarNfeJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public Evento $evento) {}

    public function handle(CancelamentoService $service): void
    {
        $service->processar($this->evento->fresh());
    }
}
