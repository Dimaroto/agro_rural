<?php

namespace Tests\Feature;

use App\Enums\RegimeTributario;
use App\Models\Empresa;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmpresaApiSerializeTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_inclui_configuracao_fiscal_e_campos_novos(): void
    {
        $user = User::factory()->create();
        $empresa = Empresa::query()->create([
            'cnpj' => '04567126000156',
            'ie' => '258963147',
            'razao_social' => 'EMPRESA API LTDA',
            'logradouro' => 'RUA A',
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
            'emite_nfse' => true,
            'cnae_fiscal' => '4520001',
            'inscricao_municipal' => '123',
            'onboarding_concluido' => true,
            'csc_id' => '1',
            'csc_token' => 'secreto',
        ]);
        $user->empresas()->attach($empresa->id);

        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'cfop_interno' => '5102',
            'item_lc116' => '14.01',
            'p_iss' => 3.5,
            'codigo_tributacao_municipio' => '1401',
            'provedor_nfse' => 'nacional',
            'perfil_efd' => 'A',
            'ind_atividade' => 1,
            'versao_efd_layout' => '019',
            'anexo_simples_mercadoria' => 1,
            'anexo_simples_servico' => 3,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/empresas/'.$empresa->id);

        $response->assertOk()
            ->assertJsonPath('data.razao_social', 'EMPRESA API LTDA')
            ->assertJsonPath('data.regime_tributario', 'simples_nacional')
            ->assertJsonPath('data.onboarding_concluido', true)
            ->assertJsonPath('data.cnae_fiscal', '4520001')
            ->assertJsonPath('data.csc_id', '1')
            ->assertJsonPath('data.csc_configurado', true)
            ->assertJsonMissingPath('data.csc_token')
            ->assertJsonPath('data.configuracao_fiscal.cfop_interno', '5102')
            ->assertJsonPath('data.configuracao_fiscal.item_lc116', '14.01')
            ->assertJsonPath('data.configuracao_fiscal.codigo_tributacao_municipio', '1401')
            ->assertJsonPath('data.configuracao_fiscal.provedor_nfse', 'nacional')
            ->assertJsonPath('data.configuracao_fiscal.perfil_efd', 'A')
            ->assertJsonPath('data.configuracao_fiscal.anexo_simples_mercadoria', 1)
            ->assertJsonPath('data.configuracao_fiscal.anexo_simples_servico', 3);
    }
}
