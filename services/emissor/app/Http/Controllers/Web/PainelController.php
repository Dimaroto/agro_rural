<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\ResolvesCurrentEmpresa;
use App\Models\Empresa;
use App\Models\Nota;
use App\Models\User;
use App\Services\Nfe\DanfeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PainelController extends Controller
{
    use ResolvesCurrentEmpresa;

    public function index(Request $request): View
    {
        $empresa = $this->empresaDoUsuario($request->user());
        $notas = Nota::query()
            ->where('empresa_id', $empresa->id)
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        $cert = $empresa->certificado;
        $certOk = $cert && $cert->valido_ate && ! $cert->valido_ate->isPast();

        return view('painel.index', [
            'empresa' => $empresa,
            'notas' => $notas,
            'certOk' => $certOk,
            'certMeta' => $cert?->toMetaArray(),
        ]);
    }

    public function xml(Request $request, string $chave): Response
    {
        $empresa = $this->empresaDoUsuario($request->user());
        $nota = $this->notaDaEmpresa($empresa, $chave);
        $xml = $nota->xml_autorizado ?: $nota->xml_assinado;
        abort_unless(is_string($xml) && $xml !== '', 404, 'XML não disponível.');

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="'.$chave.'.xml"',
        ]);
    }

    public function danfe(
        Request $request,
        string $chave,
        DanfeService $danfe
    ): StreamedResponse|Response {
        $empresa = $this->empresaDoUsuario($request->user());
        $nota = $this->notaDaEmpresa($empresa, $chave);

        try {
            $pdf = $danfe->gerar($nota);
        } catch (\Throwable $e) {
            abort(422, $e->getMessage());
        }

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf;
        }, $chave.'-danfe.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }

    private function notaDaEmpresa(Empresa $empresa, string $chave): Nota
    {
        $digits = preg_replace('/\D/', '', $chave) ?? '';
        $nota = $empresa->notas()->where('chave', $digits)->first()
            ?? $empresa->notas()->where('chave', $chave)->first();
        abort_unless($nota, 404, 'Nota não encontrada.');

        return $nota;
    }
}
