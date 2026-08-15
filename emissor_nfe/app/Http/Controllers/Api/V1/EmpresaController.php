<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Empresa\StoreEmpresaRequest;
use App\Http\Requests\Empresa\UpdateEmpresaRequest;
use App\Http\Requests\Empresa\UploadCertificadoRequest;
use App\Models\Empresa;
use App\Models\Numeracao;
use App\Services\Nfe\CertificadoService;
use App\Services\Nfe\ConsultaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class EmpresaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Empresa::class);

        $empresas = $request->user()
            ->empresas()
            ->with('certificado')
            ->orderBy('razao_social')
            ->get()
            ->map(fn (Empresa $e) => $this->serialize($e));

        return response()->json(['data' => $empresas]);
    }

    public function store(StoreEmpresaRequest $request): JsonResponse
    {
        $this->authorize('create', Empresa::class);

        $data = $request->validated();
        $serie = (int) ($data['serie_inicial'] ?? 1);
        $proximo = (int) ($data['proximo_numero'] ?? 1);
        unset($data['serie_inicial'], $data['proximo_numero']);

        $empresa = Empresa::create($data);
        $request->user()->empresas()->attach($empresa->id);

        Numeracao::create([
            'empresa_id' => $empresa->id,
            'modelo' => 55,
            'serie' => $serie,
            'proximo_numero' => $proximo,
        ]);

        return response()->json(['data' => $this->serialize($empresa->fresh('certificado'))], 201);
    }

    public function show(Request $request, Empresa $empresa): JsonResponse
    {
        $this->authorize('view', $empresa);

        return response()->json(['data' => $this->serialize($empresa->load('certificado', 'numeracoes'))]);
    }

    public function update(UpdateEmpresaRequest $request, Empresa $empresa): JsonResponse
    {
        $this->authorize('update', $empresa);
        $empresa->update($request->validated());

        return response()->json(['data' => $this->serialize($empresa->fresh(['certificado', 'numeracoes']))]);
    }

    public function updateNumeracao(Request $request, Empresa $empresa): JsonResponse
    {
        $this->authorize('update', $empresa);

        $data = $request->validate([
            'serie_55' => ['required', 'integer', 'min:1', 'max:999'],
            'proximo_55' => ['required', 'integer', 'min:1'],
            'serie_65' => ['required', 'integer', 'min:1', 'max:999'],
            'proximo_65' => ['required', 'integer', 'min:1'],
        ]);

        Numeracao::query()->updateOrCreate(
            ['empresa_id' => $empresa->id, 'modelo' => 55],
            ['serie' => $data['serie_55'], 'proximo_numero' => $data['proximo_55']]
        );
        Numeracao::query()->updateOrCreate(
            ['empresa_id' => $empresa->id, 'modelo' => 65],
            ['serie' => $data['serie_65'], 'proximo_numero' => $data['proximo_65']]
        );

        return response()->json([
            'message' => 'Numeração atualizada.',
            'data' => $this->serialize($empresa->fresh(['certificado', 'numeracoes'])),
        ]);
    }

    public function uploadCertificado(
        UploadCertificadoRequest $request,
        Empresa $empresa,
        CertificadoService $service
    ): JsonResponse {
        $this->authorize('manageCertificado', $empresa);

        try {
            $certificado = $service->store($empresa, $request->file('pfx'), $request->string('senha'));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Certificado A1 armazenado com sucesso.',
            'data' => $certificado->toMetaArray(),
        ]);
    }

    public function showCertificado(Request $request, Empresa $empresa): JsonResponse
    {
        $this->authorize('manageCertificado', $empresa);

        if (! $empresa->certificado) {
            return response()->json(['message' => 'Empresa sem certificado.'], 404);
        }

        return response()->json(['data' => $empresa->certificado->toMetaArray()]);
    }

    public function statusSefaz(Request $request, Empresa $empresa, ConsultaService $consulta): JsonResponse
    {
        $this->authorize('manageNfe', $empresa);

        try {
            $status = $consulta->statusServico($empresa);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json(['data' => $status]);
    }

    private function serialize(Empresa $empresa): array
    {
        return [
            'id' => $empresa->id,
            'cnpj' => $empresa->cnpj,
            'ie' => $empresa->ie,
            'inscricao_municipal' => $empresa->inscricao_municipal,
            'razao_social' => $empresa->razao_social,
            'nome_fantasia' => $empresa->nome_fantasia,
            'email' => $empresa->email,
            'telefone' => $empresa->telefone,
            'logradouro' => $empresa->logradouro,
            'numero' => $empresa->numero,
            'complemento' => $empresa->complemento,
            'bairro' => $empresa->bairro,
            'municipio' => $empresa->municipio,
            'codigo_municipio' => $empresa->codigo_municipio,
            'uf' => $empresa->uf,
            'cep' => $empresa->cep,
            'crt' => $empresa->crt,
            'ambiente' => $empresa->ambiente,
            'csc_id' => $empresa->csc_id,
            'csc_token' => $empresa->csc_token,
            'ativa' => $empresa->ativa,
            'certificado' => $empresa->relationLoaded('certificado') && $empresa->certificado
                ? $empresa->certificado->toMetaArray()
                : null,
            'numeracoes' => $empresa->relationLoaded('numeracoes')
                ? $empresa->numeracoes
                : null,
            'created_at' => $empresa->created_at,
            'updated_at' => $empresa->updated_at,
        ];
    }
}
