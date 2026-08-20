<?php

namespace App\Models;

use App\Enums\EventoStatus;
use App\Enums\EventoTipo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evento extends Model
{
    protected $fillable = [
        'empresa_id',
        'nota_id',
        'tipo',
        'chave',
        'sequencial',
        'status',
        'protocolo',
        'c_stat',
        'x_motivo',
        'xml_envio',
        'xml_retorno',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'tipo' => EventoTipo::class,
            'status' => EventoStatus::class,
            'payload' => 'array',
            'sequencial' => 'integer',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function nota(): BelongsTo
    {
        return $this->belongsTo(Nota::class);
    }
}
