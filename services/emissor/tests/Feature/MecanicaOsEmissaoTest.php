<?php

namespace Tests\Feature;

use App\Enums\NotaStatus;
use App\Enums\RegimeTributario;
use App\Models\Certificado;
use App\Models\Empresa;
use App\Models\Nota;
use App\Models\User;
use App\Services\Nfe\AutorizacaoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class MecanicaOsEmissaoTest extends TestCase
{
    use RefreshDatabase;

    private function empresaPronta(): array
    {
        $user = User::factory()->create();
        $empresa = Empresa::query()->create([
            'cnpj' => '04567126000156',
            'ie' => '258963147',
            'razao_social' => 'MECANICA BEDENDO LTDA',
            'logradouro' => 'RUA A',
            'numero' => '100',
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
            'onboarding_concluido' => true,
        ]);
        $user->empresas()->attach($empresa->id);

        $cfg = $empresa->garantirConfiguracaoFiscal();
        $cfg->update([
            'anexo_simples_mercadoria' => 1,
            'anexo_simples_servico' => 3,
            'item_lc116' => '14.01',
            'p_iss' => 3.0,
            'csosn_padrao' => '102',
            'perc_aprox_tributos' => 13.45,
            'perc_aprox_tributos_servico' => 8.0,
        ]);

        $cert = new Certificado([
            'empresa_id' => $empresa->id,
            'cnpj_certificado' => $empresa->cnpj,
            'razao_social_certificado' => $empresa->razao_social,
            'valido_de' => now()->subYear(),
            'valido_ate' => now()->addYear(),
        ]);
        $cert->setPfxContent('fake-pfx');
        $cert->setSenha('senha');
        $cert->save();

        return [$user, $empresa->fresh(['certificado', 'configuracaoFiscal'])];
    }

    private function mockAutorizacao(): void
    {
        $mock = Mockery::mock(AutorizacaoService::class);
        $mock->shouldReceive('criarEEnfileirar')
            ->andReturnUsing(function (Nota $nota, array $payload) {
                $nota->numero = 1;
                $nota->serie = (int) ($payload['serie'] ?? 1);
                $nota->modelo = 55;
                $nota->chave = str_repeat('1', 44);
                $nota->payload = $payload;
                $nota->status = NotaStatus::Processando;
                $nota->save();

                return $nota->fresh();
            });
        $mock->shouldReceive('autorizar')
            ->andReturnUsing(function (Nota $nota) {
                $nota->status = NotaStatus::Autorizada;
                $nota->protocolo = 'PROT-TEST';
                $nota->x_motivo = 'Autorizado (mock teste)';
                $nota->autorizada_em = now();
                $nota->save();

                return $nota->fresh();
            });

        $this->app->instance(AutorizacaoService::class, $mock);
    }

    private function payloadBase(array $itens): array
    {
        return [
            'referenciaId' => 'ref-os-1',
            'ordemId' => 'os-abc',
            'ordemNumero' => '42',
            'destinatario' => [
                'nome' => 'CLIENTE TESTE',
                'documento' => '52998224725',
                'endereco' => [
                    'logradouro' => 'RUA B',
                    'numero' => '50',
                    'bairro' => 'CENTRO',
                    'cidade' => 'CHAPECO',
                    'uf' => 'SC',
                    'cep' => '89801001',
                    'codigoMunicipio' => '4204202',
                ],
            ],
            'itens' => $itens,
        ];
    }

    public function test_os_mista_emite_nfe_pecas_e_nfse_servicos(): void
    {
        [$user, $empresa] = $this->empresaPronta();
        $this->mockAutorizacao();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/integracoes/mecanica/os/emitir', $this->payloadBase([
            [
                'tipo' => 'peca',
                'codigo' => 'P1',
                'nome' => 'Filtro de óleo',
                'quantidade' => 1,
                'precoUnitario' => 40,
                'ncm' => '87089990',
            ],
            [
                'tipo' => 'servico',
                'nome' => 'Mão de obra',
                'quantidade' => 1,
                'precoUnitario' => 120,
            ],
        ]) + ['empresaId' => $empresa->id]);

        $response->assertOk()
            ->assertJsonPath('referenciaId', 'ref-os-1')
            ->assertJsonPath('nfe.status', 'autorizada')
            ->assertJsonPath('nfse.status', 'autorizada')
            ->assertJsonPath('nfse.anexoSimples', 3);

        $notas = Nota::query()->where('empresa_id', $empresa->id)->get();
        $this->assertCount(2, $notas);

        $nfe = $notas->firstWhere('modelo', 55);
        $nfse = $notas->firstWhere('modelo', 0);
        $this->assertNotNull($nfe);
        $this->assertNotNull($nfse);

        $itensNfe = $nfe->payload['itens'] ?? [];
        $this->assertCount(1, $itensNfe);
        $this->assertSame('Filtro de óleo', $itensNfe[0]['xProd'] ?? null);

        $this->assertSame(120.0, (float) ($nfse->payload['servico']['valorServico'] ?? 0));
        $this->assertSame(3, $nfse->payload['anexoSimples'] ?? null);
    }

    public function test_os_somente_servico_nao_gera_nfe(): void
    {
        [$user, $empresa] = $this->empresaPronta();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/integracoes/mecanica/os/emitir', $this->payloadBase([
            [
                'tipo' => 'servico',
                'nome' => 'Alinhamento',
                'quantidade' => 1,
                'precoUnitario' => 80,
            ],
        ]) + ['empresaId' => $empresa->id]);

        $response->assertOk()
            ->assertJsonPath('nfe', null)
            ->assertJsonPath('nfse.status', 'autorizada');

        $this->assertSame(0, Nota::query()->where('modelo', 55)->count());
        $this->assertSame(1, Nota::query()->where('modelo', 0)->count());
    }
}
