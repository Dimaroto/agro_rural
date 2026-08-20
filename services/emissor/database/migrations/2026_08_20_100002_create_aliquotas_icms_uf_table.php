<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aliquotas_icms_uf', function (Blueprint $table) {
            $table->id();
            $table->char('uf', 2)->unique();
            $table->decimal('aliquota_interna', 5, 2);
            $table->decimal('aliquota_fcp', 5, 2)->default(0);
            $table->timestamps();
        });

        $now = now();
        // Alíquotas internas padrão (mercadorias gerais) + FCP onde aplicável.
        $rows = [
            ['AC', 17.00, 0.00], ['AL', 18.00, 1.00], ['AP', 18.00, 0.00],
            ['AM', 18.00, 0.00], ['BA', 19.00, 0.00], ['CE', 18.00, 0.00],
            ['DF', 18.00, 0.00], ['ES', 17.00, 0.00], ['GO', 17.00, 0.00],
            ['MA', 20.00, 0.00], ['MT', 17.00, 0.00], ['MS', 17.00, 0.00],
            ['MG', 18.00, 0.00], ['PA', 17.00, 0.00], ['PB', 18.00, 0.00],
            ['PR', 19.00, 0.00], ['PE', 18.00, 0.00], ['PI', 18.00, 0.00],
            ['RJ', 20.00, 2.00], ['RN', 18.00, 0.00], ['RS', 17.00, 0.00],
            ['RO', 17.50, 0.00], ['RR', 17.00, 0.00], ['SC', 17.00, 0.00],
            ['SP', 18.00, 0.00], ['SE', 18.00, 0.00], ['TO', 18.00, 0.00],
        ];

        DB::table('aliquotas_icms_uf')->insert(array_map(
            fn (array $r) => [
                'uf' => $r[0],
                'aliquota_interna' => $r[1],
                'aliquota_fcp' => $r[2],
                'created_at' => $now,
                'updated_at' => $now,
            ],
            $rows
        ));
    }

    public function down(): void
    {
        Schema::dropIfExists('aliquotas_icms_uf');
    }
};
