<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Empresa extends Model
{
    protected $fillable = [
        'cnpj',
        'ie',
        'razao_social',
        'nome_fantasia',
        'email',
        'telefone',
        'logradouro',
        'numero',
        'complemento',
        'bairro',
        'municipio',
        'codigo_municipio',
        'uf',
        'cep',
        'crt',
        'ambiente',
        'csc_id',
        'csc_token',
        'inscricao_municipal',
        'ativa',
    ];

    protected function casts(): array
    {
        return [
            'ativa' => 'boolean',
            'crt' => 'integer',
        ];
    }

    public function certificado(): HasOne
    {
        return $this->hasOne(Certificado::class);
    }

    public function numeracoes(): HasMany
    {
        return $this->hasMany(Numeracao::class);
    }

    public function notas(): HasMany
    {
        return $this->hasMany(Nota::class);
    }

    public function eventos(): HasMany
    {
        return $this->hasMany(Evento::class);
    }

    public function inutilizacoes(): HasMany
    {
        return $this->hasMany(Inutilizacao::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function cnpjDigits(): string
    {
        return preg_replace('/\D/', '', $this->cnpj) ?? '';
    }

    public function isProducao(): bool
    {
        return $this->ambiente === 'producao';
    }

    public function tpAmb(): int
    {
        return $this->isProducao() ? 1 : 2;
    }
}
