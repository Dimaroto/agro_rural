<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AliquotaIcmsUf extends Model
{
    protected $table = 'aliquotas_icms_uf';

    protected $fillable = [
        'uf',
        'aliquota_interna',
        'aliquota_fcp',
    ];

    protected function casts(): array
    {
        return [
            'aliquota_interna' => 'float',
            'aliquota_fcp' => 'float',
        ];
    }

    public static function porUf(string $uf): ?self
    {
        return static::query()->where('uf', strtoupper($uf))->first();
    }
}
