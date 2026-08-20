<?php

namespace App\Http\Controllers\Api\V1\Integracoes;

use App\Enums\NotaStatus;
use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\Nota;
use App\Services\Integracoes\Agro\AgroNfePayloadMapper;
use App\Services\Nfe\AutorizacaoService;
use App\Services\Nfe\DistDfeDownloadService;
use App\Services\Nfse\NfseEmissaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class AgroNfeController extends Controller
{
    /**
     * Baixa XML completo de NF-e de compra pela chave (DistDFe + Ciência se preciso).
     */
    public function downloadPorChave(
        Request $request,
        DistDfeDownloadService $download
    ): JsonResponse {
        $validator = Validator::make($request->all(), [
            'empresaId' => ['nullable', 'integer'],
            'chave' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'mensagem' => $validator->errors()->first(),
                'erros' => $validator->errors(),
            ], 422);
        }

        try {
            $empresa = $this->resolverEmpresa($request);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $this->authorize('manageNfe', $empresa);

        if (! $empresa->certificado) {
            return response()->json([
                'mensagem' => 'Cadastre o certificado A1 da empresa no emissor antes de baixar XML da SEFAZ.',
            ], 422);
        }

        try {
            $result = $download->baixarXmlPorChave(
                $empresa,
                (string) $request->input('chave')
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'mensagem' => 'Falha ao consultar DistDFe: '.$e->getMessage(),
            ], 500);
        }

        return response()->json([
            'chave' => $result['chave'],
            'xml' => $result['xml'],
            'manifesto' => $result['manifesto'],
            'schema' => $result['schema'],
            'mensagem' => $result['manifesto']
                ? 'XML baixado após Ciência da Operação.'
                : 'XML baixado da SEFAZ.',
        ]);
    }

    public function emitir(
        Request $request,
        AgroNfePayloadMapper $mapper,
        AutorizacaoService $autorizacao
    ): JsonResponse {
        $validator = Validator::make($request->all(), [
            'empresaId' => ['nullable', 'integer'],
            'referenciaId' => ['nullable', 'string'],
            'pedidoId' => ['nullable', 'string'],
            'ordemId' => ['nullable', 'string'],
            'pedidoNumero' => ['nullable', 'string'],
            'ordemNumero' => ['nullable', 'string'],
            'serie' => ['nullable', 'integer', 'min:1'],
            'destinatario' => ['required', 'array'],
            'destinatario.nome' => ['required', 'string'],
            'destinatario.documento' => ['required', 'string'],
            'destinatario.endereco' => ['required', 'array'],
            'itens' => ['required', 'array', 'min:1'],
            'valorTotal' => ['nullable', 'numeric'],
            'observacao' => ['nullable', 'string'],
            'emitente.cnpj' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'mensagem' => $validator->errors()->first(),
                'erros' => $validator->errors(),
            ], 422);
        }

        try {
            $empresa = $this->resolverEmpresa($request);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $this->authorize('manageNfe', $empresa);

        if (! $empresa->certificado) {
            return response()->json([
                'mensagem' => 'Cadastre o certificado A1 da empresa no emissor antes de emitir.',
            ], 422);
        }

        $this->sincronizarEmitenteDoPayload($empresa, $request->all());
        $empresa->refresh();

        $ie = strtoupper(trim((string) $empresa->ie));
        $ieDigits = preg_replace('/\D/', '', (string) $empresa->ie) ?? '';
        if ($ie === '' || $ie === 'ISENTO' || $ie === 'ISENTA' || $ieDigits === '') {
            return response()->json([
                'mensagem' => 'Inscrição Estadual do emitente inválida/ausente. '
                    .'Atualize a IE real da Agro Rural Zortea no emissor (empresa) e em Configurações → Fiscal. '
                    .'A SEFAZ rejeita com cStat 209 quando a IE está como ISENTO.',
            ], 422);
        }

        try {
            $payload = $mapper->map($request->all(), $empresa);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $nota = Nota::create([
            'empresa_id' => $empresa->id,
            'status' => NotaStatus::Rascunho,
            'payload' => $payload,
            'serie' => $payload['serie'] ?? 1,
            'modelo' => 55,
        ]);

        try {
            $nota = $autorizacao->criarEEnfileirar($nota, $payload);
            $nota = $autorizacao->autorizar($nota);
        } catch (Throwable $e) {
            $nota = $nota->fresh();

            return response()->json([
                'status' => $this->mapStatus($nota?->status),
                'chaveAcesso' => $this->chave44($nota?->chave),
                'protocolo' => $nota?->protocolo,
                'xmlUrl' => $this->xmlUrl($empresa, $nota),
                'xmlConteudo' => $nota?->xml_autorizado,
                'danfeUrl' => $this->danfeUrl($empresa, $nota),
                'mensagem' => $nota?->x_motivo ?: $e->getMessage(),
                'numero' => $nota?->numero,
                'serie' => $nota?->serie,
                'referenciaId' => $request->input('referenciaId'),
            ], 200);
        }

        $nota = $nota->fresh();

        return response()->json([
            'status' => $this->mapStatus($nota->status),
            'chaveAcesso' => $this->chave44($nota->chave),
            'protocolo' => $nota->protocolo,
            'xmlUrl' => $this->xmlUrl($empresa, $nota),
            'xmlConteudo' => $nota->xml_autorizado,
            'danfeUrl' => $this->danfeUrl($empresa, $nota),
            'mensagem' => $nota->x_motivo ?: 'NF-e processada.',
            'numero' => $nota->numero,
            'serie' => $nota->serie,
            'referenciaId' => $request->input('referenciaId'),
        ]);
    }

    public function emitirNfce(
        Request $request,
        AgroNfePayloadMapper $mapper,
        AutorizacaoService $autorizacao
    ): JsonResponse {
        $validator = Validator::make($request->all(), [
            'empresaId' => ['nullable', 'integer'],
            'referenciaId' => ['nullable', 'string'],
            'pedidoId' => ['nullable', 'string'],
            'ordemId' => ['nullable', 'string'],
            'pedidoNumero' => ['nullable', 'string'],
            'ordemNumero' => ['nullable', 'string'],
            'serie' => ['nullable', 'integer', 'min:1'],
            'modelo' => ['nullable', 'integer', 'in:65'],
            'destinatario' => ['required', 'array'],
            'destinatario.nome' => ['required', 'string'],
            'destinatario.documento' => ['required', 'string'],
            'destinatario.endereco' => ['required', 'array'],
            'itens' => ['required', 'array', 'min:1'],
            'valorTotal' => ['nullable', 'numeric'],
            'valorAproxTributos' => ['nullable', 'numeric'],
            'observacao' => ['nullable', 'string'],
            'emitente.cnpj' => ['nullable', 'string'],
            'emitente.cscId' => ['nullable', 'string'],
            'emitente.cscToken' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'mensagem' => $validator->errors()->first(),
                'erros' => $validator->errors(),
            ], 422);
        }

        try {
            $empresa = $this->resolverEmpresa($request);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $this->authorize('manageNfe', $empresa);

        if (! $empresa->certificado) {
            return response()->json([
                'mensagem' => 'Cadastre o certificado A1 da empresa no emissor antes de emitir.',
            ], 422);
        }

        $this->sincronizarEmitenteDoPayload($empresa, $request->all());
        $empresa->refresh();

        $ie = strtoupper(trim((string) $empresa->ie));
        $ieDigits = preg_replace('/\D/', '', (string) $empresa->ie) ?? '';
        if ($ie === '' || $ie === 'ISENTO' || $ie === 'ISENTA' || $ieDigits === '') {
            return response()->json([
                'mensagem' => 'Inscrição Estadual do emitente inválida/ausente. '
                    .'Atualize a IE real da Agro Rural Zortea no emissor (empresa) e em Configurações → Fiscal. '
                    .'A SEFAZ rejeita com cStat 209 quando a IE está como ISENTO.',
            ], 422);
        }

        if (blank($empresa->csc_id) || blank($empresa->csc_token)) {
            return response()->json([
                'mensagem' => 'CSC (cscId/cscToken) obrigatório para NFC-e. '
                    .'Informe em Configurações → Fiscal (emitente) ou cadastre na empresa do emissor.',
            ], 422);
        }

        $input = $request->all();
        $input['modelo'] = 65;

        try {
            $payload = $mapper->map($input, $empresa);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $nota = Nota::create([
            'empresa_id' => $empresa->id,
            'status' => NotaStatus::Rascunho,
            'payload' => $payload,
            'serie' => $payload['serie'] ?? 1,
            'modelo' => 65,
        ]);

        try {
            $nota = $autorizacao->criarEEnfileirar($nota, $payload);
            $nota = $autorizacao->autorizar($nota);
        } catch (Throwable $e) {
            $nota = $nota->fresh();

            return response()->json([
                'status' => $this->mapStatus($nota?->status),
                'chaveAcesso' => $this->chave44($nota?->chave),
                'protocolo' => $nota?->protocolo,
                'xmlUrl' => $this->xmlUrl($empresa, $nota),
                'xmlConteudo' => $nota?->xml_autorizado,
                'danfeUrl' => $this->danfeUrl($empresa, $nota),
                'mensagem' => $nota?->x_motivo ?: $e->getMessage(),
                'numero' => $nota?->numero,
                'serie' => $nota?->serie,
                'referenciaId' => $request->input('referenciaId'),
            ], 200);
        }

        $nota = $nota->fresh();

        return response()->json([
            'status' => $this->mapStatus($nota->status),
            'chaveAcesso' => $this->chave44($nota->chave),
            'protocolo' => $nota->protocolo,
            'xmlUrl' => $this->xmlUrl($empresa, $nota),
            'xmlConteudo' => $nota->xml_autorizado,
            'danfeUrl' => $this->danfeUrl($empresa, $nota),
            'mensagem' => $nota->x_motivo ?: 'NFC-e processada.',
            'numero' => $nota->numero,
            'serie' => $nota->serie,
            'referenciaId' => $request->input('referenciaId'),
        ]);
    }

    public function emitirNfse(
        Request $request,
        NfseEmissaoService $nfse
    ): JsonResponse {
        $validator = Validator::make($request->all(), [
            'empresaId' => ['nullable', 'integer'],
            'referenciaId' => ['nullable', 'string'],
            'pedidoId' => ['nullable', 'string'],
            'ordemId' => ['nullable', 'string'],
            'pedidoNumero' => ['nullable', 'string'],
            'ordemNumero' => ['nullable', 'string'],
            'serie' => ['nullable', 'integer', 'min:1'],
            'tomador' => ['required', 'array'],
            'tomador.nome' => ['required', 'string'],
            'tomador.documento' => ['required', 'string'],
            'servico' => ['required', 'array'],
            'servico.codigoServicoLc116' => ['required', 'string'],
            'servico.aliquotaIss' => ['required', 'numeric'],
            'servico.valorServico' => ['required', 'numeric', 'gt:0'],
            'observacao' => ['nullable', 'string'],
            'emitente.cnpj' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'mensagem' => $validator->errors()->first(),
                'erros' => $validator->errors(),
            ], 422);
        }

        try {
            $empresa = $this->resolverEmpresa($request);
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        }

        $this->authorize('manageNfe', $empresa);
        $this->sincronizarEmitenteDoPayload($empresa, $request->all());
        $empresa->refresh();

        try {
            $result = $nfse->emitir($empresa, $request->all());
        } catch (InvalidArgumentException $e) {
            return response()->json(['mensagem' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'rejeitada',
                'chaveAcesso' => null,
                'protocolo' => null,
                'mensagem' => $e->getMessage(),
                'numero' => null,
                'serie' => null,
                'referenciaId' => $request->input('referenciaId'),
            ], 200);
        }

        // Registro leve estilo Nota para rastreio no emissor (sem XML SEFAZ)
        $nota = Nota::create([
            'empresa_id' => $empresa->id,
            'status' => NotaStatus::Autorizada,
            'payload' => $request->all(),
            'serie' => $result['serie'],
            'numero' => $result['numero'],
            'modelo' => 0, // NFS-e (não é modelo 55/65)
            'chave' => $result['chaveAcesso'],
            'protocolo' => $result['protocolo'],
            'x_motivo' => $result['mensagem'],
            'autorizada_em' => now(),
        ]);

        return response()->json([
            'status' => $result['status'],
            'chaveAcesso' => $result['chaveAcesso'],
            'protocolo' => $result['protocolo'],
            'mensagem' => $result['mensagem'],
            'numero' => $result['numero'],
            'serie' => $result['serie'],
            'referenciaId' => $request->input('referenciaId'),
            'notaId' => $nota->id,
            'mock' => $result['mock'] ?? false,
        ]);
    }

    private function resolverEmpresa(Request $request): Empresa
    {
        $user = $request->user();
        $user->detachEmpresasDeOutrosApps();

        if ($request->filled('empresaId')) {
            $empresa = Empresa::query()->find((int) $request->input('empresaId'));
            if (! $empresa || ! $user->temAcessoEmpresa($empresa)) {
                throw new InvalidArgumentException(
                    'Empresa não encontrada neste aplicativo ou sem permissão.'
                );
            }

            return $empresa->load('certificado');
        }

        $cnpj = preg_replace('/\D/', '', (string) data_get($request->all(), 'emitente.cnpj', ''));
        if (strlen($cnpj) === 14) {
            $empresa = $user->empresas()
                ->get()
                ->first(fn (Empresa $e) => $e->cnpjDigits() === $cnpj);
            if ($empresa) {
                return $empresa->load('certificado');
            }
        }

        $empresas = $user->empresas()->with('certificado')->get();
        if ($empresas->count() === 1) {
            return $empresas->first();
        }

        throw new InvalidArgumentException(
            'Informe empresaId no body (ou cadastre apenas uma empresa no usuário do emissor).'
        );
    }

    /**
     * Espelha dados fiscais do app (Configurações → Fiscal) na empresa do emissor.
     * Evita rejeição 209 quando o cadastro local ainda está com IE = ISENTO.
     */
    private function sincronizarEmitenteDoPayload(Empresa $empresa, array $payload): void
    {
        $emitente = data_get($payload, 'emitente');
        if (! is_array($emitente)) {
            return;
        }

        $updates = [];

        $ieRaw = trim((string) ($emitente['inscricaoEstadual'] ?? $emitente['ie'] ?? ''));
        $ieUpper = strtoupper($ieRaw);
        $ieDigits = preg_replace('/\D/', '', $ieRaw) ?? '';
        if ($ieDigits !== '' && $ieUpper !== 'ISENTO' && $ieUpper !== 'ISENTA') {
            $updates['ie'] = $ieDigits;
        }

        foreach ([
            'razao_social' => $emitente['razaoSocial'] ?? null,
            'nome_fantasia' => $emitente['nomeFantasia'] ?? null,
        ] as $field => $value) {
            if (is_string($value) && trim($value) !== '') {
                $updates[$field] = trim($value);
            }
        }

        if (isset($emitente['crt']) && is_numeric($emitente['crt'])) {
            $updates['crt'] = (int) $emitente['crt'];
        }

        $cscId = trim((string) ($emitente['cscId'] ?? $emitente['csc_id'] ?? ''));
        if ($cscId !== '') {
            $updates['csc_id'] = $cscId;
        }
        $cscToken = trim((string) ($emitente['cscToken'] ?? $emitente['csc_token'] ?? ''));
        if ($cscToken !== '') {
            $updates['csc_token'] = $cscToken;
        }
        $im = trim((string) (
            $emitente['inscricaoMunicipal']
            ?? $emitente['inscricao_municipal']
            ?? ''
        ));
        if ($im !== '') {
            $updates['inscricao_municipal'] = $im;
        }

        $endereco = $emitente['endereco'] ?? null;
        if (is_array($endereco)) {
            $map = [
                'cep' => 'cep',
                'logradouro' => 'logradouro',
                'numero' => 'numero',
                'complemento' => 'complemento',
                'bairro' => 'bairro',
                'cidade' => 'municipio',
                'uf' => 'uf',
                'codigoMunicipio' => 'codigo_municipio',
            ];
            foreach ($map as $from => $to) {
                $value = $endereco[$from] ?? null;
                if (! is_string($value) && ! is_numeric($value)) {
                    continue;
                }
                $value = trim((string) $value);
                if ($value === '') {
                    continue;
                }
                if (in_array($to, ['cep', 'codigo_municipio'], true)) {
                    $value = preg_replace('/\D/', '', $value) ?? $value;
                }
                $updates[$to] = $value;
            }
        }

        if ($updates === []) {
            return;
        }

        $empresa->fill($updates);
        $empresa->save();
    }

    private function mapStatus(null|NotaStatus|string $status): string
    {
        $value = $status instanceof NotaStatus ? $status->value : (string) $status;

        return match ($value) {
            'autorizada' => 'autorizada',
            'rejeitada', 'denegada' => 'rejeitada',
            'cancelada' => 'cancelada',
            'processando' => 'aguardando_emissao',
            default => 'rejeitada',
        };
    }

    private function xmlUrl(Empresa $empresa, ?Nota $nota): ?string
    {
        if (! $nota?->chave) {
            return null;
        }

        return url('/api/v1/empresas/'.$empresa->id.'/nfe/'.$nota->chave.'/xml');
    }

    private function danfeUrl(Empresa $empresa, ?Nota $nota): ?string
    {
        if (! $nota?->chave) {
            return null;
        }

        return url('/api/v1/empresas/'.$empresa->id.'/nfe/'.$nota->chave.'/danfe');
    }

    private function chave44(?string $chave): ?string
    {
        if ($chave === null || $chave === '') {
            return null;
        }

        $value = trim($chave);
        if (str_starts_with(strtoupper($value), 'NFE')) {
            $value = substr($value, 3);
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (strlen($digits) > 44) {
            $digits = substr($digits, -44);
        }

        return strlen($digits) === 44 ? $digits : ($digits !== '' ? $digits : null);
    }

    /**
     * Lê o token Sanctum gerado no PC (.agro_token.txt) para o admin web.
     * Sem autenticação — o endpoint só existe no Laravel local.
     */
    public function tokenLocal(): JsonResponse
    {
        $candidates = [
            base_path('.agro_token.txt'),
        ];

        $localApp = getenv('LOCALAPPDATA') ?: '';
        if ($localApp !== '') {
            $candidates[] = $localApp.DIRECTORY_SEPARATOR.'Agro Rural Zortea'
                .DIRECTORY_SEPARATOR.'emissor'.DIRECTORY_SEPARATOR.'config'
                .DIRECTORY_SEPARATOR.'.agro_token.txt';
        }

        foreach ($candidates as $path) {
            if (! is_file($path)) {
                continue;
            }
            $token = trim((string) file_get_contents($path));
            if ($token !== '' && preg_match('/^\d+\|[A-Za-z0-9]{20,}$/', $token)) {
                return response()->json([
                    'token' => $token,
                    'source' => $path,
                ]);
            }
        }

        return response()->json([
            'mensagem' => 'Token local não encontrado. Gere em Configurações → Integração ou rode ensure-agro-token.',
        ], 404);
    }
}
