<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Numeracao extends Model
{
    protected $table = 'numeracoes';

    protected $fillable = [
        'empresa_id',
        'modelo',
        'serie',
        'proximo_numero',
    ];

    protected function casts(): array
    {
        return [
            'modelo' => 'integer',
            'serie' => 'integer',
            'proximo_numero' => 'integer',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }
}
