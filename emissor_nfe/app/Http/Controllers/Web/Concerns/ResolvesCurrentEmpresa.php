<?php

namespace App\Http\Controllers\Web\Concerns;

use App\Models\Empresa;
use App\Models\Numeracao;
use App\Models\User;
use Illuminate\Support\Collection;

trait ResolvesCurrentEmpresa
{
    /** CNPJ placeholder do seeder de demonstração. */
    private const CNPJ_DEMO = '00000000000000';

    /**
     * Empresa ativa do painel web (sessão + preferência pela não-demo).
     */
    protected function empresaDoUsuario(User $user): Empresa
    {
        $this->ensureUserHasEmpresas($user);

        $empresas = $user->empresas()->with('certificado')->orderBy('empresas.id')->get();
        abort_unless($empresas->isNotEmpty(), 404, 'Nenhuma empresa vinculada ao usuário neste aplicativo.');

        $selectedId = (int) session('empresa_id', 0);
        if ($selectedId > 0) {
            $selected = $empresas->firstWhere('id', $selectedId);
            if ($selected) {
                return $selected;
            }
        }

        $prefer = $this->preferEmpresa($empresas);
        session(['empresa_id' => $prefer->id]);

        return $prefer;
    }

    /** @return Collection<int, Empresa> */
    protected function empresasDoUsuario(User $user): Collection
    {
        $this->ensureUserHasEmpresas($user);

        return $user->empresas()
            ->orderBy('empresas.id')
            ->get(['empresas.id', 'empresas.cnpj', 'empresas.razao_social']);
    }

    /**
     * Garante ao menos uma empresa DESTE app (EMISSOR_APP_SLUG).
     * Nunca vincula empresas de outro produto (ex.: Mecânica Bedendo).
     */
    protected function ensureUserHasEmpresas(User $user): void
    {
        $slug = (string) config('emissor.app_slug', 'agro-rural');
        $user->detachEmpresasDeOutrosApps();

        if ($user->empresas()->exists()) {
            return;
        }

        $empresa = Empresa::query()
            ->where('cnpj', '!=', self::CNPJ_DEMO)
            ->orderBy('id')
            ->first()
            ?? Empresa::query()->orderBy('id')->first();

        if (! $empresa) {
            $empresa = $this->criarEmpresaDemoDoApp($slug);
        }

        $user->empresas()->syncWithoutDetaching([$empresa->id]);
        session(['empresa_id' => $empresa->id]);
    }

    private function criarEmpresaDemoDoApp(string $slug): Empresa
    {
        $empresa = Empresa::query()->create([
            'cnpj' => self::CNPJ_DEMO,
            'ie' => 'ISENTO',
            'razao_social' => 'EMPRESA DEMONSTRACAO LTDA',
            'nome_fantasia' => 'DEMO NFe',
            'email' => 'fiscal@emissor.local',
            'telefone' => '4935570634',
            'logradouro' => 'Rua Exemplo',
            'numero' => '100',
            'complemento' => null,
            'bairro' => 'Centro',
            'municipio' => 'Zortea',
            'codigo_municipio' => '4219853',
            'uf' => 'SC',
            'cep' => '89633000',
            'crt' => 1,
            'ambiente' => 'homologacao',
            'ativa' => true,
            'app_slug' => $slug,
        ]);

        Numeracao::query()->updateOrCreate(
            ['empresa_id' => $empresa->id, 'modelo' => 55, 'serie' => 1],
            ['proximo_numero' => 1]
        );
        Numeracao::query()->updateOrCreate(
            ['empresa_id' => $empresa->id, 'modelo' => 65, 'serie' => 1],
            ['proximo_numero' => 1]
        );

        return $empresa;
    }

    /** @param  Collection<int, Empresa>  $empresas */
    protected function preferEmpresa(Collection $empresas): Empresa
    {
        return $empresas->first(fn (Empresa $e) => $e->cnpj !== self::CNPJ_DEMO)
            ?? $empresas->first();
    }
}
