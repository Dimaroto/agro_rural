<?php

namespace App\Http\Controllers\Web;

use App\Enums\RegimeTributario;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\Concerns\ResolvesCurrentEmpresa;
use App\Models\Empresa;
use App\Models\Numeracao;
use App\Models\User;
use App\Services\Empresa\OnboardingEtapas;
use App\Services\Nfe\CertificadoService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use InvalidArgumentException;

class OnboardingEmpresaController extends Controller
{
    use ResolvesCurrentEmpresa;

    public function index(Request $request): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());
        $etapa = $empresa->onboarding_etapa ?: OnboardingEtapas::REGIME;
        if (! OnboardingEtapas::isValida($empresa, $etapa)) {
            $etapa = OnboardingEtapas::paraEmpresa($empresa)[0];
        }

        return redirect()->route('empresas.onboarding.show', ['etapa' => $etapa]);
    }

    public function show(Request $request, string $etapa): View|RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $empresa = $this->empresaDoUsuario($user);
        $empresa->load(['certificado', 'numeracoes', 'configuracaoFiscal']);
        $empresa->garantirConfiguracaoFiscal();
        $empresa->load('configuracaoFiscal');

        if (! OnboardingEtapas::isValida($empresa, $etapa)) {
            return redirect()->route('empresas.onboarding.show', [
                'etapa' => OnboardingEtapas::paraEmpresa($empresa)[0],
            ]);
        }

        return view('empresas.onboarding.'.$etapa, [
            'empresa' => $empresa,
            'empresas' => $this->empresasDoUsuario($user),
            'cfg' => $empresa->configuracaoFiscal,
            'etapa' => $etapa,
            'etapas' => OnboardingEtapas::paraEmpresa($empresa),
            'labels' => collect(OnboardingEtapas::paraEmpresa($empresa))
                ->mapWithKeys(fn ($e) => [$e => OnboardingEtapas::label($e)])
                ->all(),
            'anterior' => OnboardingEtapas::anterior($empresa, $etapa),
            'proxima' => OnboardingEtapas::proxima($empresa, $etapa),
            'num55' => $empresa->numeracoes->firstWhere('modelo', 55),
            'num65' => $empresa->numeracoes->firstWhere('modelo', 65),
            'num0' => $empresa->numeracoes->firstWhere('modelo', 0),
            'pendencias' => $this->checklistPendencias($empresa),
            'regimes' => RegimeTributario::opcoesCadastro(),
        ]);
    }

    public function store(Request $request, string $etapa, CertificadoService $certificadoService): RedirectResponse
    {
        $empresa = $this->empresaDoUsuario($request->user());
        $empresa->load('configuracaoFiscal');
        $empresa->garantirConfiguracaoFiscal();

        if (! OnboardingEtapas::isValida($empresa, $etapa)) {
            return redirect()->route('empresas.onboarding.index');
        }

        match ($etapa) {
            OnboardingEtapas::REGIME => $this->salvarRegime($request, $empresa),
            OnboardingEtapas::IDENTIFICACAO => $this->salvarIdentificacao($request, $empresa),
            OnboardingEtapas::ENDERECO => $this->salvarEndereco($request, $empresa),
            OnboardingEtapas::DOCUMENTOS => $this->salvarDocumentos($request, $empresa),
            OnboardingEtapas::NUMERACAO => $this->salvarNumeracao($request, $empresa),
            OnboardingEtapas::CERTIFICADO => $this->salvarCertificado($request, $empresa, $certificadoService),
            OnboardingEtapas::CSC => $this->salvarCsc($request, $empresa),
            OnboardingEtapas::TRIBUTACAO => $this->salvarTributacao($request, $empresa),
            OnboardingEtapas::ST_DIFAL => $this->salvarStDifal($request, $empresa),
            OnboardingEtapas::SERVICOS => $this->salvarServicos($request, $empresa),
            OnboardingEtapas::AMBIENTE => $this->salvarAmbiente($request, $empresa),
            OnboardingEtapas::REVISAO => $this->concluir($empresa),
            default => null,
        };

        $empresa->refresh();
        $proxima = OnboardingEtapas::proxima($empresa, $etapa);

        if ($etapa === OnboardingEtapas::REVISAO) {
            return redirect()->route('empresas.onboarding.show', ['etapa' => OnboardingEtapas::REVISAO])
                ->with('success', 'Cadastro fiscal concluído. A empresa está pronta para emitir.');
        }

        $empresa->update(['onboarding_etapa' => $proxima ?? $etapa]);

        return redirect()->route('empresas.onboarding.show', ['etapa' => $proxima ?? $etapa])
            ->with('success', 'Etapa salva.');
    }

    public function selectEmpresa(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate(['empresa_id' => ['required', 'integer']]);
        $id = (int) $data['empresa_id'];
        $user->empresas()->syncWithoutDetaching([$id]);
        abort_unless($user->temAcessoEmpresa($id), 403);
        session(['empresa_id' => $id]);

        return redirect()->route('empresas.onboarding.index')
            ->with('success', 'Empresa ativa alterada.');
    }

    public function createEmpresa(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        // CNPJ temporário único até a etapa de identificação.
        $cnpjTemp = str_pad((string) (time() % 10000000000000), 14, '9', STR_PAD_LEFT);

        $empresa = Empresa::query()->create([
            'cnpj' => $cnpjTemp,
            'razao_social' => 'NOVA EMPRESA',
            'logradouro' => 'A DEFINIR',
            'numero' => 'S/N',
            'bairro' => 'CENTRO',
            'municipio' => 'A DEFINIR',
            'codigo_municipio' => '0000000',
            'uf' => 'SC',
            'cep' => '00000000',
            'crt' => 1,
            'regime_tributario' => RegimeTributario::SimplesNacional,
            'ambiente' => 'homologacao',
            'ativa' => true,
            'emite_nfe' => true,
            'emite_nfce' => false,
            'emite_nfse' => false,
            'onboarding_etapa' => OnboardingEtapas::REGIME,
            'onboarding_concluido' => false,
        ]);

        Numeracao::query()->create([
            'empresa_id' => $empresa->id,
            'modelo' => 55,
            'serie' => 1,
            'proximo_numero' => 1,
        ]);

        $empresa->garantirConfiguracaoFiscal();
        $user->empresas()->syncWithoutDetaching([$empresa->id]);
        session(['empresa_id' => $empresa->id]);

        return redirect()->route('empresas.onboarding.show', ['etapa' => OnboardingEtapas::REGIME])
            ->with('success', 'Nova empresa criada. Preencha o cadastro fiscal.');
    }

    private function salvarRegime(Request $request, Empresa $empresa): void
    {
        $data = $request->validate([
            'regime_tributario' => ['required', Rule::in(array_column(RegimeTributario::cases(), 'value'))],
            'simples_excesso_sublimite' => ['nullable', 'boolean'],
        ]);

        $regime = RegimeTributario::from($data['regime_tributario']);
        $excesso = $regime === RegimeTributario::SimplesNacional
            && $request->boolean('simples_excesso_sublimite');

        $empresa->regime_tributario = $regime;
        $empresa->simples_excesso_sublimite = $excesso;
        $empresa->sincronizarCrt();
        $empresa->save();

        $cfg = $empresa->garantirConfiguracaoFiscal();
        $pis = $regime->defaultsPisCofins();
        $cfg->update(array_merge([
            'regime_pis_cofins' => $regime->regimePisCofins(),
            'csosn_padrao' => $regime->isSimples() ? ($cfg->csosn_padrao ?: '102') : null,
            'cst_icms_padrao' => $regime->isRegimeNormal() ? ($cfg->cst_icms_padrao ?: '00') : null,
            'p_icms_interno' => $regime->isRegimeNormal() ? ($cfg->p_icms_interno ?: 17) : null,
            'aplica_difal' => $regime->isRegimeNormal(),
        ], $pis));
    }

    private function salvarIdentificacao(Request $request, Empresa $empresa): void
    {
        $data = Validator::make($request->all(), [
            'cnpj' => ['required', 'string', Rule::unique('empresas', 'cnpj')->ignore($empresa->id)],
            'ie' => ['nullable', 'string', 'max:20'],
            'iest' => ['nullable', 'string', 'max:20'],
            'inscricao_municipal' => ['nullable', 'string', 'max:30'],
            'cnae_fiscal' => ['nullable', 'string', 'max:7'],
            'razao_social' => ['required', 'string', 'max:255'],
            'nome_fantasia' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email'],
            'telefone' => ['nullable', 'string', 'max:20'],
        ])->validate();

        $data['cnpj'] = preg_replace('/\D/', '', $data['cnpj']) ?? '';
        $data['cnae_fiscal'] = preg_replace('/\D/', '', (string) ($data['cnae_fiscal'] ?? '')) ?: null;
        $data['telefone'] = preg_replace('/\D/', '', (string) ($data['telefone'] ?? '')) ?: null;

        $empresa->update($data);
    }

    private function salvarEndereco(Request $request, Empresa $empresa): void
    {
        $data = $request->validate([
            'logradouro' => ['required', 'string', 'max:255'],
            'numero' => ['required', 'string', 'max:20'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro' => ['required', 'string', 'max:255'],
            'municipio' => ['required', 'string', 'max:255'],
            'codigo_municipio' => ['required', 'string', 'size:7'],
            'uf' => ['required', 'string', 'size:2'],
            'cep' => ['required', 'string', 'size:8'],
        ]);

        $data['cep'] = preg_replace('/\D/', '', $data['cep']) ?? '';
        $data['codigo_municipio'] = preg_replace('/\D/', '', $data['codigo_municipio']) ?? '';
        $data['uf'] = strtoupper($data['uf']);

        $empresa->update($data);
    }

    private function salvarDocumentos(Request $request, Empresa $empresa): void
    {
        $empresa->update([
            'emite_nfe' => $request->boolean('emite_nfe'),
            'emite_nfce' => $request->boolean('emite_nfce'),
            'emite_nfse' => $request->boolean('emite_nfse'),
        ]);

        if (! $empresa->emite_nfe && ! $empresa->emite_nfce && ! $empresa->emite_nfse) {
            $empresa->update(['emite_nfe' => true]);
        }
    }

    private function salvarNumeracao(Request $request, Empresa $empresa): void
    {
        $rules = [];
        if ($empresa->emite_nfe) {
            $rules['serie_55'] = ['required', 'integer', 'min:1', 'max:999'];
            $rules['proximo_55'] = ['required', 'integer', 'min:1'];
        }
        if ($empresa->emite_nfce) {
            $rules['serie_65'] = ['required', 'integer', 'min:1', 'max:999'];
            $rules['proximo_65'] = ['required', 'integer', 'min:1'];
        }
        if ($empresa->emite_nfse) {
            $rules['serie_0'] = ['required', 'integer', 'min:1', 'max:999'];
            $rules['proximo_0'] = ['required', 'integer', 'min:1'];
        }
        $data = $request->validate($rules);

        if ($empresa->emite_nfe) {
            Numeracao::query()->updateOrCreate(
                ['empresa_id' => $empresa->id, 'modelo' => 55],
                ['serie' => $data['serie_55'], 'proximo_numero' => $data['proximo_55']]
            );
        }
        if ($empresa->emite_nfce) {
            Numeracao::query()->updateOrCreate(
                ['empresa_id' => $empresa->id, 'modelo' => 65],
                ['serie' => $data['serie_65'], 'proximo_numero' => $data['proximo_65']]
            );
        }
        if ($empresa->emite_nfse) {
            Numeracao::query()->updateOrCreate(
                ['empresa_id' => $empresa->id, 'modelo' => 0],
                ['serie' => $data['serie_0'], 'proximo_numero' => $data['proximo_0']]
            );
            $empresa->garantirConfiguracaoFiscal()->update([
                'serie_nfse' => (int) $data['serie_0'],
            ]);
        }
    }

    private function salvarCertificado(Request $request, Empresa $empresa, CertificadoService $service): void
    {
        if (! $request->hasFile('pfx')) {
            if ($empresa->certificado) {
                return;
            }
            $request->validate([
                'pfx' => ['required', 'file', 'max:5120'],
                'senha' => ['required', 'string', 'max:255'],
            ]);
        }

        $request->validate([
            'pfx' => ['required', 'file', 'max:5120'],
            'senha' => ['required', 'string', 'max:255'],
        ]);

        try {
            $service->store($empresa, $request->file('pfx'), $request->string('senha')->toString());
        } catch (InvalidArgumentException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages(['pfx' => $e->getMessage()]);
        }
    }

    private function salvarCsc(Request $request, Empresa $empresa): void
    {
        $data = $request->validate([
            'csc_id' => ['required', 'string', 'max:10'],
            'csc_token' => ['required', 'string', 'max:60'],
        ]);
        $empresa->update([
            'csc_id' => $data['csc_id'],
            'csc_token' => $data['csc_token'],
        ]);
    }

    private function salvarTributacao(Request $request, Empresa $empresa): void
    {
        $regime = $empresa->regime_tributario ?? RegimeTributario::SimplesNacional;
        $cfg = $empresa->garantirConfiguracaoFiscal();

        $common = $request->validate([
            'nat_op' => ['required', 'string', 'max:60'],
            'cfop_interno' => ['required', 'string', 'size:4'],
            'cfop_interestadual' => ['required', 'string', 'size:4'],
            'ind_final' => ['required', 'integer', Rule::in([0, 1])],
            'ind_pres' => ['required', 'integer', 'min:0', 'max:9'],
            'mod_frete' => ['required', 'integer', 'min:0', 'max:9'],
            't_pag' => ['required', 'string', 'size:2'],
            'perc_aprox_tributos' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        if ($regime->isSimples()) {
            $extra = $request->validate([
                'csosn_padrao' => ['required', 'string', 'size:3'],
                'p_cred_sn' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'anexo_simples_mercadoria' => ['nullable', 'integer', Rule::in([1, 2])],
            ]);
        } else {
            $extra = $request->validate([
                'cst_icms_padrao' => ['required', 'string', 'size:2'],
                'p_icms_interno' => ['required', 'numeric', 'min:0', 'max:100'],
                'p_red_bc' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'p_fcp' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'cst_ipi' => ['nullable', 'string', 'size:2'],
                'p_ipi' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'cod_enq_ipi' => ['nullable', 'string', 'size:3'],
                'cst_pis' => ['required', 'string', 'size:2'],
                'p_pis' => ['required', 'numeric', 'min:0', 'max:100'],
                'cst_cofins' => ['required', 'string', 'size:2'],
                'p_cofins' => ['required', 'numeric', 'min:0', 'max:100'],
            ]);
        }

        $cfg->update(array_merge($common, $extra, [
            'regime_pis_cofins' => $regime->regimePisCofins(),
        ]));
    }

    private function salvarStDifal(Request $request, Empresa $empresa): void
    {
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $data = $request->validate([
            'usa_icms_st' => ['nullable', 'boolean'],
            'cest_padrao' => ['nullable', 'string', 'max:7'],
            'p_mva_st' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'p_red_bc_st' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_icms_st' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'aplica_difal' => ['nullable', 'boolean'],
        ]);

        $cfg->update([
            'usa_icms_st' => $request->boolean('usa_icms_st'),
            'cest_padrao' => preg_replace('/\D/', '', (string) ($data['cest_padrao'] ?? '')) ?: null,
            'p_mva_st' => $data['p_mva_st'] ?? null,
            'p_red_bc_st' => $data['p_red_bc_st'] ?? null,
            'p_icms_st' => $data['p_icms_st'] ?? null,
            'aplica_difal' => $request->boolean('aplica_difal'),
        ]);
    }

    private function salvarServicos(Request $request, Empresa $empresa): void
    {
        $cfg = $empresa->garantirConfiguracaoFiscal();
        $regime = $empresa->regime_tributario ?? RegimeTributario::SimplesNacional;

        $rules = [
            'inscricao_municipal' => ['nullable', 'string', 'max:30'],
            'item_lc116' => ['nullable', 'string', 'max:10'],
            'codigo_tributacao_municipio' => ['nullable', 'string', 'max:20'],
            'provedor_nfse' => ['nullable', Rule::in(['nacional', 'municipal'])],
            'p_iss' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'iss_retido' => ['nullable', 'boolean'],
            'nat_op_servico' => ['nullable', 'string', 'max:60'],
            'perc_aprox_tributos_servico' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_irrf' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_csll' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_pis_ret' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_cofins_ret' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'p_inss_ret' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];

        if ($regime->isSimples()) {
            $rules['anexo_simples_servico'] = ['nullable', 'integer', Rule::in([3, 4, 5])];
        }

        $data = $request->validate($rules);

        $empresa->update(['inscricao_municipal' => $data['inscricao_municipal'] ?? null]);
        unset($data['inscricao_municipal']);
        $data['iss_retido'] = $request->boolean('iss_retido');
        if (! isset($data['nat_op_servico']) || trim((string) $data['nat_op_servico']) === '') {
            $data['nat_op_servico'] = 'PRESTACAO DE SERVICO';
        }
        if (empty($data['provedor_nfse'])) {
            $data['provedor_nfse'] = 'nacional';
        }
        $cfg->update($data);
    }

    private function salvarAmbiente(Request $request, Empresa $empresa): void
    {
        $data = $request->validate([
            'ambiente' => ['required', Rule::in(['homologacao', 'producao'])],
            'resp_tec_cnpj' => ['nullable', 'string', 'max:14'],
            'resp_tec_contato' => ['nullable', 'string', 'max:60'],
            'resp_tec_email' => ['nullable', 'email', 'max:60'],
            'resp_tec_fone' => ['nullable', 'string', 'max:20'],
            'resp_tec_csrt' => ['nullable', 'string', 'max:60'],
            'resp_tec_id_csrt' => ['nullable', 'string', 'max:2'],
            'perfil_efd' => ['nullable', Rule::in(['A', 'B'])],
            'ind_atividade' => ['nullable', 'integer', Rule::in([0, 1])],
            'versao_efd_layout' => ['nullable', 'string', 'max:10'],
        ]);

        $data['resp_tec_cnpj'] = preg_replace('/\D/', '', (string) ($data['resp_tec_cnpj'] ?? '')) ?: null;
        $data['resp_tec_fone'] = preg_replace('/\D/', '', (string) ($data['resp_tec_fone'] ?? '')) ?: null;

        $sped = [
            'perfil_efd' => $data['perfil_efd'] ?? 'A',
            'ind_atividade' => (int) ($data['ind_atividade'] ?? 1),
            'versao_efd_layout' => $data['versao_efd_layout'] ?? '019',
        ];
        unset($data['perfil_efd'], $data['ind_atividade'], $data['versao_efd_layout']);

        $empresa->update($data);
        $empresa->garantirConfiguracaoFiscal()->update($sped);
    }

    private function concluir(Empresa $empresa): void
    {
        $empresa->update([
            'onboarding_concluido' => true,
            'onboarding_etapa' => OnboardingEtapas::REVISAO,
        ]);
    }

    /** @return list<array{etapa: string, mensagem: string}> */
    private function checklistPendencias(Empresa $empresa): array
    {
        $pendencias = [];
        if (! $empresa->regime_tributario) {
            $pendencias[] = ['etapa' => OnboardingEtapas::REGIME, 'mensagem' => 'Defina o regime tributário.'];
        }
        if ($empresa->cnpj === '00000000000000' || $empresa->razao_social === 'NOVA EMPRESA') {
            $pendencias[] = ['etapa' => OnboardingEtapas::IDENTIFICACAO, 'mensagem' => 'Complete a identificação da empresa.'];
        }
        if ($empresa->codigo_municipio === '0000000' || $empresa->logradouro === 'A DEFINIR') {
            $pendencias[] = ['etapa' => OnboardingEtapas::ENDERECO, 'mensagem' => 'Complete o endereço.'];
        }
        if (! $empresa->certificado) {
            $pendencias[] = ['etapa' => OnboardingEtapas::CERTIFICADO, 'mensagem' => 'Envie o certificado A1.'];
        }
        if ($empresa->emite_nfce && (empty($empresa->csc_id) || empty($empresa->csc_token))) {
            $pendencias[] = ['etapa' => OnboardingEtapas::CSC, 'mensagem' => 'Informe o CSC para NFC-e.'];
        }

        return $pendencias;
    }
}
