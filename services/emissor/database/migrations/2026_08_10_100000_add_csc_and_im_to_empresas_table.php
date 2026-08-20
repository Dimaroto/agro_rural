<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('csc_id')->nullable()->after('ambiente');
            $table->string('csc_token')->nullable()->after('csc_id');
            $table->string('inscricao_municipal')->nullable()->after('csc_token');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['csc_id', 'csc_token', 'inscricao_municipal']);
        });
    }
};
