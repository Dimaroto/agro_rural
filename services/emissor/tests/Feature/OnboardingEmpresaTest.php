<?php

namespace Tests\Feature;

use App\Enums\RegimeTributario;
use App\Models\Empresa;
use App\Models\User;
use App\Services\Empresa\OnboardingEtapas;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OnboardingEmpresaTest extends TestCase
{
    use RefreshDatabase;

    private function userComEmpresa(array $empresaExtra = []): array
    {
        $user = User::factory()->create();
        $empresa = Empresa::query()->create(array_merge([
            'cnpj' => '11222333000181',
            'ie' => 'ISENTO',
            'razao_social' => 'EMPRESA WIZARD LTDA',
            'logradouro' => 'RUA X',
            'numero' => '1',
            'bairro' => 'CENTRO',
            'municipio' => 'CHAPECO',
            'codigo_municipio' => '4204202',
            'uf' => 'SC',
            'cep' => '89801000',
            'crt' => 1,
            'regime_tributario' => RegimeTributario::SimplesNacional,
            'ambiente' => 'homologacao',
            'ativa' => true,
            'emite_nfe' => true,
            'emite_nfce' => false,
            'emite_nfse' => false,
            'onboarding_etapa' => OnboardingEtapas::REGIME,
            'onboarding_concluido' => false,
        ], $empresaExtra));

        $user->empresas()->attach($empresa->id);
        $empresa->garantirConfiguracaoFiscal();

        return [$user, $empresa];
    }

    public function test_configuracoes_redireciona_para_onboarding(): void
    {
        [$user] = $this->userComEmpresa();

        $this->actingAs($user)
            ->get('/configuracoes')
            ->assertRedirect(route('empresas.onboarding.index'));
    }

    public function test_salvar_regime_deriva_crt_e_avanca(): void
    {
        [$user, $empresa] = $this->userComEmpresa();

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'regime'), [
                'regime_tributario' => 'lucro_presumido',
            ])
            ->assertRedirect();

        $empresa->refresh();
        $this->assertSame(RegimeTributario::LucroPresumido, $empresa->regime_tributario);
        $this->assertSame(3, $empresa->crt);
        $this->assertSame('cumulativo', $empresa->configuracaoFiscal->regime_pis_cofins);
        $this->assertSame(0.65, (float) $empresa->configuracaoFiscal->p_pis);
    }

    public function test_etapas_condicionais_csc_e_st_difal(): void
    {
        [$user, $empresa] = $this->userComEmpresa([
            'emite_nfce' => true,
            'regime_tributario' => RegimeTributario::LucroReal,
            'crt' => 3,
        ]);

        $etapas = OnboardingEtapas::paraEmpresa($empresa);
        $this->assertContains(OnboardingEtapas::CSC, $etapas);
        $this->assertContains(OnboardingEtapas::ST_DIFAL, $etapas);
        $this->assertNotContains(OnboardingEtapas::SERVICOS, $etapas);

        $empresa->update(['emite_nfce' => false, 'emite_nfse' => true, 'regime_tributario' => RegimeTributario::SimplesNacional, 'crt' => 1]);
        $etapas2 = OnboardingEtapas::paraEmpresa($empresa->fresh());
        $this->assertNotContains(OnboardingEtapas::CSC, $etapas2);
        $this->assertNotContains(OnboardingEtapas::ST_DIFAL, $etapas2);
        $this->assertContains(OnboardingEtapas::SERVICOS, $etapas2);
    }

    public function test_identificacao_salva_parcialmente(): void
    {
        [$user, $empresa] = $this->userComEmpresa();

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'identificacao'), [
                'cnpj' => '04567126000156',
                'ie' => '258963147',
                'razao_social' => 'OFICINA TESTE LTDA',
                'nome_fantasia' => 'OFICINA',
                'cnae_fiscal' => '4520001',
                'iest' => '',
                'inscricao_municipal' => '99',
            ])
            ->assertRedirect();

        $empresa->refresh();
        $this->assertSame('04567126000156', $empresa->cnpj);
        $this->assertSame('OFICINA TESTE LTDA', $empresa->razao_social);
        $this->assertSame('4520001', $empresa->cnae_fiscal);
    }

    public function test_show_etapa_tributacao_simples(): void
    {
        [$user] = $this->userComEmpresa();

        $this->actingAs($user)
            ->get(route('empresas.onboarding.show', 'tributacao'))
            ->assertOk()
            ->assertSee('CSOSN padrão')
            ->assertSee('Venda de peças / mercadorias')
            ->assertSee('Anexo do Simples (mercadorias)');
    }

    public function test_anexos_mercadoria_e_servico_independentes(): void
    {
        [$user, $empresa] = $this->userComEmpresa([
            'emite_nfse' => true,
        ]);

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'tributacao'), [
                'nat_op' => 'VENDA DE PEÇAS',
                'cfop_interno' => '5102',
                'cfop_interestadual' => '6102',
                'ind_final' => 1,
                'ind_pres' => 1,
                'mod_frete' => 9,
                't_pag' => '01',
                'perc_aprox_tributos' => 13.45,
                'csosn_padrao' => '102',
                'anexo_simples_mercadoria' => 1,
            ])
            ->assertRedirect();

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'servicos'), [
                'item_lc116' => '14.01',
                'p_iss' => 3.5,
                'anexo_simples_servico' => 3,
                'nat_op_servico' => 'PRESTACAO DE SERVICO',
                'perc_aprox_tributos_servico' => 8.5,
            ])
            ->assertRedirect();

        $cfg = $empresa->fresh()->configuracaoFiscal;
        $this->assertSame(1, $cfg->anexo_simples_mercadoria);
        $this->assertSame(3, $cfg->anexo_simples_servico);
        $this->assertSame(8.5, (float) $cfg->perc_aprox_tributos_servico);
        $this->assertSame('14.01', $cfg->item_lc116);
    }

    public function test_servicos_salva_provedor_e_codigo_municipio(): void
    {
        [$user, $empresa] = $this->userComEmpresa([
            'emite_nfse' => true,
        ]);

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'servicos'), [
                'item_lc116' => '14.01',
                'p_iss' => 2.0,
                'codigo_tributacao_municipio' => '1401',
                'provedor_nfse' => 'municipal',
                'anexo_simples_servico' => 3,
            ])
            ->assertRedirect();

        $cfg = $empresa->fresh()->configuracaoFiscal;
        $this->assertSame('1401', $cfg->codigo_tributacao_municipio);
        $this->assertSame('municipal', $cfg->provedor_nfse);
    }

    public function test_ambiente_salva_perfil_sped(): void
    {
        [$user, $empresa] = $this->userComEmpresa();

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'ambiente'), [
                'ambiente' => 'homologacao',
                'perfil_efd' => 'B',
                'ind_atividade' => 0,
                'versao_efd_layout' => '019',
            ])
            ->assertRedirect();

        $cfg = $empresa->fresh()->configuracaoFiscal;
        $this->assertSame('B', $cfg->perfil_efd);
        $this->assertSame(0, (int) $cfg->ind_atividade);
        $this->assertSame('019', $cfg->versao_efd_layout);
        $this->assertSame('homologacao', $empresa->fresh()->ambiente);
    }

    public function test_numeracao_nfse_modelo_zero(): void
    {
        [$user, $empresa] = $this->userComEmpresa([
            'emite_nfse' => true,
        ]);

        $this->actingAs($user)
            ->post(route('empresas.onboarding.store', 'numeracao'), [
                'serie_55' => 1,
                'proximo_55' => 1,
                'serie_0' => 3,
                'proximo_0' => 7,
            ])
            ->assertRedirect();

        $num0 = $empresa->fresh()->numeracoes()->where('modelo', 0)->first();
        $this->assertNotNull($num0);
        $this->assertSame(3, (int) $num0->serie);
        $this->assertSame(7, (int) $num0->proximo_numero);
        $this->assertSame(3, (int) $empresa->fresh()->configuracaoFiscal->serie_nfse);
    }

    public function test_show_etapa_tributacao_presumido(): void
    {
        [$user] = $this->userComEmpresa([
            'regime_tributario' => RegimeTributario::LucroPresumido,
            'crt' => 3,
        ]);

        $this->actingAs($user)
            ->get(route('empresas.onboarding.show', 'tributacao'))
            ->assertOk()
            ->assertSee('CST ICMS padrão')
            ->assertSee('PIS / COFINS');
    }
}
