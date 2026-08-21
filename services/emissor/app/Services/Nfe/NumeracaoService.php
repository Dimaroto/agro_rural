<?php

namespace App\Services\Nfe;

use App\Models\Empresa;
use App\Models\Numeracao;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class NumeracaoService
{
    /**
     * Reserva atomicamente o próximo número da série.
     *
     * Postgres: UPDATE … RETURNING (sem SELECT FOR UPDATE — pooler Neon).
     * SQLite: Eloquent (não tem NOW(); RETURNING pode variar).
     */
    public function reservar(Empresa $empresa, int $serie = 1, int $modelo = 55): array
    {
        $this->ensureRow($empresa->id, $modelo, $serie);

        $driver = DB::connection()->getDriverName();

        try {
            if ($driver === 'sqlite') {
                return $this->reservarSqlite($empresa->id, $modelo, $serie);
            }

            return $this->reservarPostgres($empresa->id, $modelo, $serie);
        } catch (RuntimeException $e) {
            throw $e;
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, '25P02') || str_contains($msg, 'transaction is aborted')) {
                throw new RuntimeException(
                    'Banco Neon com transação abortada ao reservar numeração. '
                    .'Reinicie o emissor (start-local) e tente de novo. '
                    .'Se persistir, use o endpoint DIRECT do Neon (sem "-pooler" na URL). '
                    .'Detalhe original: '.$msg,
                    0,
                    $e
                );
            }

            throw new RuntimeException(
                'Falha ao reservar numeração NF-e: '.$msg,
                0,
                $e
            );
        }
    }

    private function reservarSqlite(int $empresaId, int $modelo, int $serie): array
    {
        return DB::transaction(function () use ($empresaId, $modelo, $serie) {
            $row = Numeracao::query()
                ->where('empresa_id', $empresaId)
                ->where('modelo', $modelo)
                ->where('serie', $serie)
                ->first();

            if (! $row) {
                throw new RuntimeException(
                    "Numeração não encontrada para empresa {$empresaId}, modelo {$modelo}, série {$serie}."
                );
            }

            $numero = (int) $row->proximo_numero;
            $row->proximo_numero = $numero + 1;
            $row->save();

            return [
                'numero' => $numero,
                'serie' => (int) $row->serie,
                'modelo' => (int) $row->modelo,
            ];
        });
    }

    private function reservarPostgres(int $empresaId, int $modelo, int $serie): array
    {
        $row = DB::selectOne(
            'UPDATE numeracoes
             SET proximo_numero = proximo_numero + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE empresa_id = ?
               AND modelo = ?
               AND serie = ?
             RETURNING (proximo_numero - 1) AS numero, serie, modelo',
            [$empresaId, $modelo, $serie]
        );

        if (! $row) {
            throw new RuntimeException(
                "Numeração não encontrada para empresa {$empresaId}, modelo {$modelo}, série {$serie}."
            );
        }

        return [
            'numero' => (int) $row->numero,
            'serie' => (int) $row->serie,
            'modelo' => (int) $row->modelo,
        ];
    }

    private function ensureRow(int $empresaId, int $modelo, int $serie): void
    {
        $exists = Numeracao::query()
            ->where('empresa_id', $empresaId)
            ->where('modelo', $modelo)
            ->where('serie', $serie)
            ->exists();

        if ($exists) {
            return;
        }

        try {
            Numeracao::query()->create([
                'empresa_id' => $empresaId,
                'modelo' => $modelo,
                'serie' => $serie,
                'proximo_numero' => 1,
            ]);
        } catch (Throwable) {
            // Corrida com outro request: unique (empresa_id, modelo, serie)
        }
    }
}
