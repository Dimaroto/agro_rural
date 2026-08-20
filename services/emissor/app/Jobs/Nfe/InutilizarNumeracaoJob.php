<?php

namespace App\Jobs\Nfe;

use App\Models\Inutilizacao;
use App\Services\Nfe\InutilizacaoService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class InutilizarNumeracaoJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public Inutilizacao $inutilizacao) {}

    public function handle(InutilizacaoService $service): void
    {
        $service->processar($this->inutilizacao->fresh());
    }
}
