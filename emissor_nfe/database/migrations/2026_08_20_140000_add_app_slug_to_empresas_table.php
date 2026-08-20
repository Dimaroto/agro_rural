<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SLUG_AGRO = 'agro-rural';

    private const SLUG_BEDENDO = 'mecanica-bedendo';

    private const CNPJ_DEMO = '00000000000000';

    public function up(): void
    {
        if (! Schema::hasColumn('empresas', 'app_slug')) {
            Schema::table('empresas', function (Blueprint $table) {
                $table->string('app_slug', 64)->default(self::SLUG_AGRO)->after('ativa');
                $table->index('app_slug');
            });
        }

        $this->backfillAppSlugs();
        $this->detachCrossAppPivots();
    }

    public function down(): void
    {
        if (Schema::hasColumn('empresas', 'app_slug')) {
            Schema::table('empresas', function (Blueprint $table) {
                $table->dropIndex(['app_slug']);
                $table->dropColumn('app_slug');
            });
        }
    }

    private function backfillAppSlugs(): void
    {
        $rows = DB::table('empresas')->select(['id', 'cnpj', 'razao_social', 'nome_fantasia', 'municipio'])->get();

        foreach ($rows as $row) {
            $slug = $this->detectSlug(
                (string) $row->cnpj,
                (string) $row->razao_social,
                (string) ($row->nome_fantasia ?? ''),
                (string) ($row->municipio ?? '')
            );
            DB::table('empresas')->where('id', $row->id)->update(['app_slug' => $slug]);
        }
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

        // Empresa real sem marca Bedendo: fica no app que roda esta migration (Agro).
        return self::SLUG_AGRO;
    }

    /**
     * Remove vínculos user↔empresa de outro produto (ex.: admin Agro com Bedendo).
     */
    private function detachCrossAppPivots(): void
    {
        if (! Schema::hasTable('empresa_user')) {
            return;
        }

        $bedendoIds = DB::table('empresas')
            ->where('app_slug', self::SLUG_BEDENDO)
            ->pluck('id');

        $agroIds = DB::table('empresas')
            ->where('app_slug', self::SLUG_AGRO)
            ->pluck('id');

        if ($bedendoIds->isEmpty()) {
            return;
        }

        $agroEmails = [
            'admin@emissor.local',
            'admin@agrorural.local',
            'fiscal@emissor.local',
        ];

        $seedEmail = env('SEED_ADMIN_EMAIL');
        if (is_string($seedEmail) && $seedEmail !== '') {
            $agroEmails[] = $seedEmail;
        }

        $agroUserIds = DB::table('users')
            ->where(function ($q) use ($agroEmails) {
                $q->whereIn('email', array_unique($agroEmails))
                    ->orWhere('email', 'like', '%agro%')
                    ->orWhere('email', 'like', '%zortea%');
            })
            ->pluck('id');

        // Quem já tem empresa Agro no pivot também não deve ver Bedendo neste app.
        if ($agroIds->isNotEmpty()) {
            $linkedToAgro = DB::table('empresa_user')
                ->whereIn('empresa_id', $agroIds)
                ->pluck('user_id');
            $agroUserIds = $agroUserIds->merge($linkedToAgro)->unique();
        }

        if ($agroUserIds->isEmpty()) {
            return;
        }

        DB::table('empresa_user')
            ->whereIn('user_id', $agroUserIds)
            ->whereIn('empresa_id', $bedendoIds)
            ->delete();
    }
};
