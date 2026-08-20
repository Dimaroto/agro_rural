<?php

namespace Database\Seeders;

use App\Models\Empresa;
use App\Models\Numeracao;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) env('SEED_ADMIN_EMAIL', 'admin@emissor.local');
        $name = (string) env('SEED_ADMIN_NAME', 'Administrador');
        $passwordFromEnv = env('SEED_ADMIN_PASSWORD');

        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            $password = filled($passwordFromEnv)
                ? (string) $passwordFromEnv
                : Str::password(20);

            $user = User::query()->create([
                'email' => $email,
                'name' => $name,
                'password' => Hash::make($password),
            ]);

            if (! filled($passwordFromEnv)) {
                $this->command?->warn(
                    "SEED_ADMIN_PASSWORD nao definida. Senha gerada (grave agora): {$password}"
                );
            }
        } elseif (filled($passwordFromEnv)) {
            // So redefine senha se SEED_ADMIN_PASSWORD estiver explicita no .env
            $user->forceFill([
                'name' => $name,
                'password' => Hash::make((string) $passwordFromEnv),
            ])->save();
        }

        // Remove conta demo legada se existir e nao for a atual
        User::query()
            ->where('email', 'admin@emissor.local')
            ->where('id', '!=', $user->id)
            ->delete();

        // Prefere empresa real ja existente; so cria demo se o banco estiver vazio.
        $empresaReal = Empresa::query()
            ->where('cnpj', '!=', '00000000000000')
            ->orderBy('id')
            ->first();

        if ($empresaReal) {
            $user->empresas()->syncWithoutDetaching([$empresaReal->id]);
            $this->command?->info(
                "Usuario vinculado a empresa real #{$empresaReal->id} ({$empresaReal->razao_social})."
            );

            return;
        }

        $empresa = Empresa::query()->updateOrCreate(
            ['cnpj' => '00000000000000'],
            [
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
            ]
        );

        Numeracao::query()->updateOrCreate(
            [
                'empresa_id' => $empresa->id,
                'modelo' => 55,
                'serie' => 1,
            ],
            ['proximo_numero' => 1]
        );

        Numeracao::query()->updateOrCreate(
            [
                'empresa_id' => $empresa->id,
                'modelo' => 65,
                'serie' => 1,
            ],
            ['proximo_numero' => 1]
        );

        $user->empresas()->syncWithoutDetaching([$empresa->id]);
    }
}
