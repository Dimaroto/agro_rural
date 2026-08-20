<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class Certificado extends Model
{
    protected $fillable = [
        'empresa_id',
        'pfx_encrypted',
        'senha_encrypted',
        'cnpj_certificado',
        'razao_social_certificado',
        'valido_de',
        'valido_ate',
    ];

    protected function casts(): array
    {
        return [
            'valido_de' => 'datetime',
            'valido_ate' => 'datetime',
        ];
    }

    protected $hidden = [
        'pfx_encrypted',
        'senha_encrypted',
    ];

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function setPfxContent(string $binary): void
    {
        $this->pfx_encrypted = Crypt::encryptString(base64_encode($binary));
    }

    public function getPfxContent(): string
    {
        return base64_decode(Crypt::decryptString($this->pfx_encrypted));
    }

    public function setSenha(string $senha): void
    {
        $this->senha_encrypted = Crypt::encryptString($senha);
    }

    public function getSenha(): string
    {
        return Crypt::decryptString($this->senha_encrypted);
    }

    public function diasParaExpirar(): ?int
    {
        if (! $this->valido_ate) {
            return null;
        }

        return (int) now()->diffInDays($this->valido_ate, false);
    }

    public function toMetaArray(): array
    {
        return [
            'cnpj_certificado' => $this->cnpj_certificado,
            'razao_social_certificado' => $this->razao_social_certificado,
            'valido_de' => $this->valido_de?->toIso8601String(),
            'valido_ate' => $this->valido_ate?->toIso8601String(),
            'dias_para_expirar' => $this->diasParaExpirar(),
            'expirado' => $this->valido_ate ? $this->valido_ate->isPast() : null,
            'alerta_vencimento' => ($this->diasParaExpirar() ?? 999) < 30,
        ];
    }
}
