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
        $slug = (string) config('emissor.app_slug', 'agro-rural');

        return $this->empresas()
            ->where('empresas.id', $empresaId)
            ->where('empresas.app_slug', $slug)
            ->exists();
    }

    /** Remove vínculos com empresas de outro produto (Bedendo ↔ Agro). */
    public function detachEmpresasDeOutrosApps(): int
    {
        $slug = (string) config('emissor.app_slug', 'agro-rural');
        $foreignIds = \Illuminate\Support\Facades\DB::table('empresas')
            ->where('app_slug', '!=', $slug)
            ->pluck('id');

        if ($foreignIds->isEmpty()) {
            return 0;
        }

        return \Illuminate\Support\Facades\DB::table('empresa_user')
            ->where('user_id', $this->id)
            ->whereIn('empresa_id', $foreignIds)
            ->delete();
    }
}
