<?php

namespace App\Services\Nfe;

use App\Models\Empresa;

class ConsultaService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
        private SefazResponseParser $parser,
    ) {}

    public function statusServico(Empresa $empresa): array
    {
        $tools = $this->toolsFactory->make($empresa);
        $response = $tools->sefazStatus(strtoupper($empresa->uf), $empresa->tpAmb());

        return $this->parser->parse($response);
    }

    public function consultarChave(Empresa $empresa, string $chave): array
    {
        $tools = $this->toolsFactory->make($empresa);
        $response = $tools->sefazConsultaChave($chave, $empresa->tpAmb());

        return $this->parser->parse($response);
    }
}
