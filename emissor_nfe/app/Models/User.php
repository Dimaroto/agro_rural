<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function empresas(): BelongsToMany
    {
        return $this->belongsToMany(Empresa::class)->withTimestamps();
    }

    public function temAcessoEmpresa(int|Empresa $empresa): bool
    {
        $empresaId = $empresa instanceof Empresa ? $empresa->id : $empresa;

        return $this->empresas()->where('empresas.id', $empresaId)->exists();
    }
}
