<?php

namespace App\Services\Nfe;

use App\Enums\EventoStatus;
use App\Enums\EventoTipo;
use App\Models\Empresa;
use App\Models\Evento;
use App\Models\Inutilizacao;
use InvalidArgumentException;
use Throwable;

class InutilizacaoService
{
    public function __construct(
        private ToolsFactory $toolsFactory,
        private SefazResponseParser $parser,
    ) {}

    public function criar(Empresa $empresa, array $data): Inutilizacao
    {
        if (strlen(trim($data['justificativa'])) < 15) {
            throw new InvalidArgumentException('Justificativa deve ter no mínimo 15 caracteres.');
        }

        if ((int) $data['numero_inicial'] > (int) $data['numero_final']) {
            throw new InvalidArgumentException('Número inicial não pode ser maior que o final.');
        }

        $evento = Evento::create([
            'empresa_id' => $empresa->id,
            'nota_id' => null,
            'tipo' => EventoTipo::Inutilizacao,
            'chave' => null,
            'sequencial' => null,
            'status' => EventoStatus::Processando,
            'payload' => $data,
        ]);

        return Inutilizacao::create([
            'empresa_id' => $empresa->id,
            'evento_id' => $evento->id,
            'modelo' => $data['modelo'] ?? 55,
            'serie' => $data['serie'],
            'numero_inicial' => $data['numero_inicial'],
            'numero_final' => $data['numero_final'],
            'ano' => $data['ano'] ?? (int) now()->format('y'),
            'justificativa' => $data['justificativa'],
            'status' => EventoStatus::Processando,
        ]);
    }

    public function processar(Inutilizacao $inutilizacao): Inutilizacao
    {
        $empresa = $inutilizacao->empresa()->with('certificado')->firstOrFail();
        $evento = $inutilizacao->evento;
        $tools = $this->toolsFactory->make($empresa);

        $nSerie = (int) $inutilizacao->serie;
        $nIni = (int) $inutilizacao->numero_inicial;
        $nFin = (int) $inutilizacao->numero_final;
        $xJust = $inutilizacao->justificativa;
        $tpAmb = $empresa->tpAmb();
        $ano = (int) $inutilizacao->ano;

        try {
            $response = $tools->sefazInutiliza($nSerie, $nIni, $nFin, $xJust, $tpAmb, (string) $ano);
        } catch (Throwable $e) {
            $inutilizacao->status = EventoStatus::Rejeitado;
            $inutilizacao->x_motivo = $e->getMessage();
            $inutilizacao->save();

            if ($evento) {
                $evento->status = EventoStatus::Rejeitado;
                $evento->x_motivo = $e->getMessage();
                $evento->save();
            }

            throw $e;
        }

        $parsed = $this->parser->parse($response);
        $inutilizacao->c_stat = $parsed['cStat'];
        $inutilizacao->x_motivo = $parsed['xMotivo'];
        $inutilizacao->protocolo = $parsed['nProt'];
        $inutilizacao->status = $this->parser->isInutilizacaoAutorizada($parsed['cStat'])
            ? EventoStatus::Autorizado
            : EventoStatus::Rejeitado;
        $inutilizacao->save();

        if ($evento) {
            $evento->xml_retorno = $response;
            $evento->c_stat = $parsed['cStat'];
            $evento->x_motivo = $parsed['xMotivo'];
            $evento->protocolo = $parsed['nProt'];
            $evento->status = $inutilizacao->status;
            $evento->save();
        }

        return $inutilizacao->fresh();
    }
}
