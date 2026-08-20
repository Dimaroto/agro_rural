<?php

namespace App\Http\Controllers\Web\Concerns;

use App\Models\Empresa;
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
        abort_unless($empresas->isNotEmpty(), 404, 'Nenhuma empresa vinculada ao usuário.');

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
     * Se o usuário só tem a demo (ou nenhuma), vincula também as empresas reais do banco.
     */
    protected function ensureUserHasEmpresas(User $user): void
    {
        $linked = $user->empresas()->pluck('empresas.id');
        $reais = Empresa::query()
            ->where('cnpj', '!=', self::CNPJ_DEMO)
            ->orderBy('id')
            ->pluck('id');

        if ($reais->isEmpty()) {
            if ($linked->isEmpty()) {
                $demo = Empresa::query()->orderBy('id')->first();
                if ($demo) {
                    $user->empresas()->syncWithoutDetaching([$demo->id]);
                }
            }

            return;
        }

        // Sempre garante vínculo com empresas reais (local / um usuário admin).
        $missing = $reais->diff($linked);
        if ($missing->isNotEmpty()) {
            $user->empresas()->syncWithoutDetaching($missing->all());
        }

        // Se só estava na demo e agora tem real, troca a sessão para a real.
        $sessionId = (int) session('empresa_id', 0);
        if ($sessionId <= 0 || $linked->count() === 1) {
            $onlyDemo = $linked->count() === 1
                && Empresa::query()->whereKey($linked->first())->where('cnpj', self::CNPJ_DEMO)->exists();
            if ($sessionId <= 0 || $onlyDemo) {
                session(['empresa_id' => (int) $reais->first()]);
            }
        }
    }

    /** @param  Collection<int, Empresa>  $empresas */
    protected function preferEmpresa(Collection $empresas): Empresa
    {
        return $empresas->first(fn (Empresa $e) => $e->cnpj !== self::CNPJ_DEMO)
            ?? $empresas->first();
    }
}
