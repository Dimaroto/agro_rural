<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\NotaStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Nfe\CancelarNfeRequest;
use App\Http\Requests\Nfe\CceRequest;
use App\Http\Requests\Nfe\ConsultarNfeRequest;
use App\Http\Requests\Nfe\EmitirNfeRequest;
use App\Http\Requests\Nfe\InutilizarRequest;
use App\Jobs\Nfe\AutorizarNfeJob;
use App\Jobs\Nfe\CancelarNfeJob;
use App\Jobs\Nfe\EnviarCceJob;
use App\Jobs\Nfe\InutilizarNumeracaoJob;
use App\Models\Empresa;
use App\Models\Nota;
use App\Services\Nfe\AutorizacaoService;
use App\Services\Nfe\CancelamentoService;
use App\Services\Nfe\CartaCorrecaoService;
use App\Services\Nfe\ConsultaService;
use App\Services\Nfe\DanfeService;
use App\Services\Nfe\InutilizacaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use InvalidArgumentException;

class NfeController extends Controller
{
    public function index(Request $request, Empresa $empresa): JsonResponse
    {
        $this->authorize('manageNfe', $empresa);

        $query = $empresa->notas()->latest('id');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($chave = $request->query('chave')) {
            $query->where('chave', $chave);
        }
        if ($de = $request->query('de')) {
            $query->whereDate('created_at', '>=', $de);
        }
        if ($ate = $request->query('ate')) {
            $query->whereDate('created_at', '<=', $ate);
        }

        $notas = $query
            ->select([
                'id',
                'empresa_id',
                'chave',
                'numero',
                'serie',
                'modelo',
                'status',
                'protocolo',
                'c_stat',
                'x_motivo',
                'autorizada_em',
                'cancelada_em',
                'payload',
                'created_at',
                'updated_at',
            ])
            ->paginate((int) $request->query('per_page', 50));

        $notas->setCollection(
            $notas->getCollection()->map(fn (Nota $nota) => $this->serializeNota($nota))
        );

        return response()->json($notas);
    }

    public function store(
        EmitirNfeRequest $request,
        Empresa $empresa,
        AutorizacaoService $autorizacao
    ): JsonResponse {
        $this->authorize('manageNfe', $empresa);

        if (! $empresa->certificado) {
            return response()->json(['message' => 'Cadastre o certificado A1 antes de emitir.'], 422);
        }

        $payload = $request->validated();
        $sincrono = (bool) ($payload['sincrono'] ?? false);
        unset($payload['sincrono']);

        $nota = Nota::create([
            'empresa_id' => $empresa->id,
            'status' => NotaStatus::Rascunho,
            'payload' => $payload,
            'serie' => $payload['serie'] ?? 1,
            'modelo' => 55,
        ]);

        try {
            $nota = $autorizacao->criarEEnfileirar($nota, $payload);
        } catch (\Throwable $e) {
            $nota->delete();

            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($sincrono) {
            try {
                $nota = $autorizacao->autorizar($nota);
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'data' => $this->serializeNota($nota->fresh()),
                ], 502);
            }
        } else {
            AutorizarNfeJob::dispatch($nota);
        }

        return response()->json([
            'message' => $sincrono ? 'NF-e processada.' : 'NF-e enfileirada para autorização.',
            'data' => $this->serializeNota($nota->fresh()),
        ], 202);
    }

    public function show(Request $request, Empresa $empresa, string $chave): JsonResponse
    {
        $this->authorize('manageNfe', $empresa);
        $nota = $this->findNota($empresa, $chave);

        return response()->json(['data' => $this->serializeNota($nota->load('eventos'))]);
    }

    public function xml(Request $request, Empresa $empresa, string $chave): Response
    {
        $this->authorize('manageNfe', $empresa);
        $nota = $this->findNota($empresa, $chave);
        $xml = $nota->xml_autorizado ?: $nota->xml_assinado;

        if (! $xml) {
            abort(404, 'XML não disponível.');
        }

        return response($xml, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => 'attachment; filename="'.$chave.'.xml"',
        ]);
    }

    public function danfe(Request $request, Empresa $empresa, string $chave, DanfeService $danfe): Response|JsonResponse
    {
        $this->authorize('manageNfe', $empresa);
        $nota = $this->findNota($empresa, $chave);

        try {
            $pdf = $danfe->gerarPdf($nota);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        // response() binário (streamDownload às vezes marca text/html)
        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$chave.'.pdf"',
            'Content-Length' => (string) strlen($pdf),
        ]);
    }

    public function cancelar(
        CancelarNfeRequest $request,
        Empresa $empresa,
        string $chave,
        CancelamentoService $service
    ): JsonResponse {
        $this->authorize('manageNfe', $empresa);
        $nota = $this->findNota($empresa, $chave);

        try {
            $evento = $service->criarEvento($nota, $request->string('justificativa'));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($request->boolean('sincrono')) {
            try {
                $evento = $service->processar($evento);
            } catch (\Throwable $e) {
                return response()->json(['message' => $e->getMessage(), 'data' => $evento->fresh()], 502);
            }
        } else {
            CancelarNfeJob::dispatch($evento);
        }

        return response()->json(['data' => $evento->fresh()], 202);
    }

    public function cce(
        CceRequest $request,
        Empresa $empresa,
        string $chave,
        CartaCorrecaoService $service
    ): JsonResponse {
        $this->authorize('manageNfe', $empresa);
        $nota = $this->findNota($empresa, $chave);

        try {
            $evento = $service->criarEvento(
                $nota,
                $request->string('correcao'),
                $request->integer('sequencial') ?: null
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($request->boolean('sincrono')) {
            try {
                $evento = $service->processar($evento);
            } catch (\Throwable $e) {
                return response()->json(['message' => $e->getMessage(), 'data' => $evento->fresh()], 502);
            }
        } else {
            EnviarCceJob::dispatch($evento);
        }

        return response()->json(['data' => $evento->fresh()], 202);
    }

    public function inutilizar(
        InutilizarRequest $request,
        Empresa $empresa,
        InutilizacaoService $service
    ): JsonResponse {
        $this->authorize('manageNfe', $empresa);

        try {
            $inutilizacao = $service->criar($empresa, $request->validated());
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($request->boolean('sincrono')) {
            try {
                $inutilizacao = $service->processar($inutilizacao);
            } catch (\Throwable $e) {
                return response()->json(['message' => $e->getMessage(), 'data' => $inutilizacao->fresh()], 502);
            }
        } else {
            InutilizarNumeracaoJob::dispatch($inutilizacao);
        }

        return response()->json(['data' => $inutilizacao->fresh()], 202);
    }

    public function consultar(
        ConsultarNfeRequest $request,
        Empresa $empresa,
        ConsultaService $consulta
    ): JsonResponse {
        $this->authorize('manageNfe', $empresa);

        try {
            $resultado = $consulta->consultarChave($empresa, $request->string('chave'));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['data' => $resultado]);
    }

    private function findNota(Empresa $empresa, string $chave): Nota
    {
        $digits = preg_replace('/\D+/', '', $chave) ?: $chave;

        return $empresa->notas()
            ->where(function ($q) use ($chave, $digits) {
                $q->where('chave', $chave)->orWhere('chave', $digits);
            })
            ->firstOrFail();
    }

    private function serializeNota(Nota $nota): array
    {
        $payload = is_array($nota->payload) ? $nota->payload : [];
        $dest = is_array($payload['destinatario'] ?? null) ? $payload['destinatario'] : [];
        $meta = is_array($payload['meta_agro'] ?? null) ? $payload['meta_agro'] : [];

        $destinatarioNome = $dest['xNome'] ?? $dest['nome'] ?? null;
        $pedidoNumero = $meta['pedidoNumero'] ?? null;
        $pedidoId = $meta['pedidoId'] ?? null;

        return [
            'id' => $nota->id,
            'empresa_id' => $nota->empresa_id,
            'chave' => $nota->chave,
            'numero' => $nota->numero,
            'serie' => $nota->serie,
            'modelo' => $nota->modelo,
            'status' => $nota->status instanceof NotaStatus
                ? $nota->status->value
                : (string) $nota->status,
            'protocolo' => $nota->protocolo,
            'c_stat' => $nota->c_stat,
            'x_motivo' => $nota->x_motivo,
            'autorizada_em' => $nota->autorizada_em,
            'cancelada_em' => $nota->cancelada_em,
            'destinatarioNome' => $destinatarioNome ? (string) $destinatarioNome : null,
            'pedidoNumero' => $pedidoNumero !== null && $pedidoNumero !== ''
                ? (string) $pedidoNumero
                : null,
            'pedidoId' => $pedidoId !== null && $pedidoId !== ''
                ? (string) $pedidoId
                : null,
            'tipo' => isset($meta['tipo']) ? (string) $meta['tipo'] : null,
            'finNFe' => isset($payload['ide']['finNFe'])
                ? (int) $payload['ide']['finNFe']
                : null,
            'purchaseInvoiceId' => isset($meta['purchaseInvoiceId'])
                ? (string) $meta['purchaseInvoiceId']
                : null,
            'eventos' => $nota->relationLoaded('eventos') ? $nota->eventos : null,
            'created_at' => $nota->created_at,
            'updated_at' => $nota->updated_at,
        ];
    }
}
