<?php

namespace App\Models;

use App\Enums\NotaStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Nota extends Model
{
    protected $fillable = [
        'empresa_id',
        'chave',
        'numero',
        'serie',
        'modelo',
        'status',
        'protocolo',
        'c_stat',
        'x_motivo',
        'xml_assinado',
        'xml_autorizado',
        'xml_retorno',
        'payload',
        'autorizada_em',
        'cancelada_em',
    ];

    protected function casts(): array
    {
        return [
            'status' => NotaStatus::class,
            'payload' => 'array',
            'numero' => 'integer',
            'serie' => 'integer',
            'modelo' => 'integer',
            'autorizada_em' => 'datetime',
            'cancelada_em' => 'datetime',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function eventos(): HasMany
    {
        return $this->hasMany(Evento::class);
    }
}
