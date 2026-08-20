<?php

namespace App\Console\Commands;

use App\Models\Empresa;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class IsolateAppsCommand extends Command
{
    protected $signature = 'emissor:isolate-apps
                            {--dry-run : Só mostra o que seria alterado}';

    protected $description = 'Re-marca empresas por app_slug e remove pivots cruzados (Agro ≠ Bedendo)';

    private const SLUG_AGRO = 'agro-rural';

    private const SLUG_BEDENDO = 'mecanica-bedendo';

    private const CNPJ_DEMO = '00000000000000';

    public function handle(): int
    {
        if (! Schema::hasColumn('empresas', 'app_slug')) {
            $this->error('Coluna app_slug ausente. Rode php artisan migrate.');

            return self::FAILURE;
        }

        $dry = (bool) $this->option('dry-run');
        $this->info('App atual: '.config('emissor.app_slug').($dry ? ' (dry-run)' : ''));

        $rows = DB::table('empresas')->select(['id', 'cnpj', 'razao_social', 'nome_fantasia', 'municipio', 'app_slug'])->get();
        $changed = 0;

        foreach ($rows as $row) {
            $slug = $this->detectSlug(
                (string) $row->cnpj,
                (string) $row->razao_social,
                (string) ($row->nome_fantasia ?? ''),
                (string) ($row->municipio ?? '')
            );
            if ($row->app_slug === $slug) {
                continue;
            }
            $this->line("  #{$row->id} {$row->razao_social}: {$row->app_slug} → {$slug}");
            if (! $dry) {
                DB::table('empresas')->where('id', $row->id)->update(['app_slug' => $slug]);
            }
            $changed++;
        }

        $this->info("Empresas re-marcadas: {$changed}");

        $detached = 0;
        if (! $dry) {
            foreach (User::query()->cursor() as $user) {
                $detached += $user->detachEmpresasDeOutrosApps();
            }
        } else {
            $slug = (string) config('emissor.app_slug', self::SLUG_AGRO);
            $foreign = DB::table('empresas')->where('app_slug', '!=', $slug)->pluck('id');
            $detached = (int) DB::table('empresa_user')->whereIn('empresa_id', $foreign)->count();
            $this->line("  Pivots cruzados que seriam removidos (aprox. todos os foreign): {$detached}");
        }

        $this->info("Pivots removidos: {$detached}");
        $this->info(
            'Empresas visíveis neste app: '.Empresa::query()->count()
        );

        return self::SUCCESS;
    }

    private function detectSlug(string $cnpj, string $razao, string $fantasia, string $municipio): string
    {
        $cnpjDigits = preg_replace('/\D/', '', $cnpj) ?? '';
        $hay = mb_strtolower($razao.' '.$fantasia);

        if (
            str_contains($hay, 'bedendo')
            || str_contains($hay, 'mecanica bedendo')
            || str_contains($hay, 'mecânica bedendo')
        ) {
            return self::SLUG_BEDENDO;
        }

        if ($cnpjDigits === self::CNPJ_DEMO) {
            return self::SLUG_AGRO;
        }

        if (
            str_contains($hay, 'agro rural')
            || str_contains($hay, 'agrorural')
            || str_contains($hay, 'zortea')
            || str_contains($hay, 'demonstracao')
            || str_contains($hay, 'demonstração')
            || str_contains($hay, 'demo nfe')
            || mb_strtolower($municipio) === 'zortea'
        ) {
            return self::SLUG_AGRO;
        }

        return self::SLUG_AGRO;
    }
}
