<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\ResolvesCurrentEmpresa;
use App\Models\Empresa;
use App\Models\Numeracao;
use App\Models\User;
use App\Services\Nfe\CertificadoService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use InvalidArgumentException;

class ConfiguracaoController extends Controller
{
    use ResolvesCurrentEmpresa;

    public function show(Request $request): View
    {
        /** @var User $user */
        $user = $request->user();
        $empresa = $this->empresaDoUsuario($user);
        $empresa->load(['certificado', 'numeracoes']);
        $tab = $request->query('tab', 'empresa');
        $abas = $this->abas();
        if (! array_key_exists($tab, $abas)) {
            $tab = 'empresa';
        }

        return view('configuracoes.index', [
            'empresa' => $empresa,
            'empresas' => $this->empresasDoUsuario($user),
            'tab' => $tab,
            'abas' => $abas,
            'num55' => $empresa->numeracoes->firstWhere('modelo', 55),
            'num65' => $empresa->numeracoes->firstWhere('modelo', 65),
            'nfse' => config('nfse'),
            'respTec' => config('nfe.resp_tec'),
            'appUrl' => rtrim((string) config('app.url'), '/') ?: url('/'),
            'tokenCriado' => session('token_criado'),
        ]);
    }

    public function selectEmpresa(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'empresa_id' => ['required', 'integer'],
        ]);
        $id = (int) $data['empresa_id'];
        $user->empresas()->syncWithoutDetaching([$id]);
        abort_unless($user->temAcessoEmpresa($id), 403);

        session(['empresa_id' => $id]);

        $empresa = Empresa::query()->findOrFail($id);

        return redirect('/configuracoes?tab=empresa')
            ->with('success', "Empresa ativa: #{$empresa->id} — {$empresa->razao_social}. Use este empresaId no Flutter.");
    }

    public function updateEmpresa(Request $request): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());

        $data = Validator::make($request->all(), [
            'cnpj' => ['required', 'string', Rule::unique('empresas', 'cnpj')->ignore($empresa->id)],
            'ie' => ['nullable', 'string', 'max:20'],
            'razao_social' => ['required', 'string', 'max:255'],
            'nome_fantasia' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
            'logradouro' => ['required', 'string', 'max:255'],
            'numero' => ['required', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['required', 'string', 'max:255'],
            'municipio' => ['required', 'string', 'max:255'],
            'codigo_municipio' => ['required', 'string', 'size:7'],
            'uf' => ['required', 'string', 'size:2'],
            'cep' => ['required', 'string', 'size:8'],
            'crt' => ['required', 'integer', Rule::in([1, 2, 3])],
            'ambiente' => ['required', Rule::in(['homologacao', 'producao'])],
            'inscricao_municipal' => ['nullable', 'string', 'max:30'],
        ], [
            'cnpj.unique' => 'Este CNPJ já está cadastrado em outra empresa (provavelmente a ID 1). '
                .'Troque a empresa ativa acima em vez de alterar o CNPJ da demo.',
        ])->validate();

        $data['cnpj'] = preg_replace('/\D/', '', $data['cnpj']) ?? '';
        $data['cep'] = preg_replace('/\D/', '', $data['cep']) ?? '';
        $data['codigo_municipio'] = preg_replace('/\D/', '', $data['codigo_municipio']) ?? '';
        $data['uf'] = strtoupper($data['uf']);
        $data['telefone'] = preg_replace('/\D/', '', (string) ($data['telefone'] ?? '')) ?: null;

        $empresa->update($data);

        return redirect('/configuracoes?tab=empresa')
            ->with('success', 'Dados da empresa salvos.');
    }

    public function uploadCertificado(Request $request, CertificadoService $service): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());

        $request->validate([
            'pfx' => ['required', 'file', 'max:5120'],
            'senha' => ['required', 'string', 'max:255'],
        ]);

        try {
            $service->store($empresa, $request->file('pfx'), $request->string('senha')->toString());
        } catch (InvalidArgumentException $e) {
            return redirect('/configuracoes?tab=certificado')
                ->withErrors(['pfx' => $e->getMessage()])
                ->withInput($request->except('pfx', 'senha'));
        }

        return redirect('/configuracoes?tab=certificado')
            ->with('success', 'Certificado A1 armazenado com sucesso.');
    }

    public function updateNumeracao(Request $request): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());

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

        return redirect('/configuracoes?tab=numeracao')
            ->with('success', 'Numeração atualizada.');
    }

    public function updateCsc(Request $request): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());

        $data = $request->validate([
            'csc_id' => ['nullable', 'string', 'max:10'],
            'csc_token' => ['nullable', 'string', 'max:60'],
        ]);

        $empresa->update([
            'csc_id' => $data['csc_id'] ?: null,
            'csc_token' => $data['csc_token'] ?: null,
        ]);

        return redirect('/configuracoes?tab=csc')
            ->with('success', 'CSC salvo (necessário apenas para NFC-e modelo 65).');
    }

    public function createToken(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->tokens()->where('name', 'mecanica-app')->delete();
        $token = $user->createToken('mecanica-app')->plainTextToken;

        $tokenFile = base_path('.mecanica_token.txt');
        @file_put_contents($tokenFile, $token);
        $configDir = (getenv('LOCALAPPDATA') ?: '').DIRECTORY_SEPARATOR.'Edem Software'.DIRECTORY_SEPARATOR.'Mecanica Bedendo'.DIRECTORY_SEPARATOR.'config';
        if ($configDir !== '' && str_contains($configDir, 'Edem Software')) {
            if (! is_dir($configDir)) {
                @mkdir($configDir, 0777, true);
            }
            @file_put_contents($configDir.DIRECTORY_SEPARATOR.'.mecanica_token.txt', $token);
        }

        return redirect('/configuracoes?tab=integracao')
            ->with('success', 'Token gerado. Cole em Configurações → Fiscal no app (ou reinicie o app — ele tenta ler o arquivo local).')
            ->with('token_criado', $token);
    }

    /** @return array<string, string> */
    private function abas(): array
    {
        return [
            'empresa' => 'Empresa',
            'certificado' => 'Certificado A1',
            'numeracao' => 'Numeração',
            'csc' => 'CSC',
            'nfse' => 'NFS-e',
            'integracao' => 'Integração app',
            'resp_tec' => 'Resp. técnico',
        ];
    }
}
