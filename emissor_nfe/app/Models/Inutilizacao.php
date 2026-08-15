<?php

namespace App\Models;

use App\Enums\EventoStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inutilizacao extends Model
{
    protected $table = 'inutilizacoes';

    protected $fillable = [
        'empresa_id',
        'evento_id',
        'modelo',
        'serie',
        'numero_inicial',
        'numero_final',
        'ano',
        'justificativa',
        'status',
        'protocolo',
        'c_stat',
        'x_motivo',
    ];

    protected function casts(): array
    {
        return [
            'status' => EventoStatus::class,
            'modelo' => 'integer',
            'serie' => 'integer',
            'numero_inicial' => 'integer',
            'numero_final' => 'integer',
            'ano' => 'integer',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function evento(): BelongsTo
    {
        return $this->belongsTo(Evento::class);
    }
}
