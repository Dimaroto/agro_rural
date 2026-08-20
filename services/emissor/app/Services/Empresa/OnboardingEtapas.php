<?php

namespace App\Services\Empresa;

use App\Enums\RegimeTributario;
use App\Models\Empresa;

/**
 * Define as etapas do cadastro fiscal e quais são condicionais.
 */
class OnboardingEtapas
{
    public const REGIME = 'regime';

    public const IDENTIFICACAO = 'identificacao';

    public const ENDERECO = 'endereco';

    public const DOCUMENTOS = 'documentos';

    public const NUMERACAO = 'numeracao';

    public const CERTIFICADO = 'certificado';

    public const CSC = 'csc';

    public const TRIBUTACAO = 'tributacao';

    public const ST_DIFAL = 'st_difal';

    public const SERVICOS = 'servicos';

    public const AMBIENTE = 'ambiente';

    public const REVISAO = 'revisao';

    /** @return list<string> */
    public static function todas(): array
    {
        return [
            self::REGIME,
            self::IDENTIFICACAO,
            self::ENDERECO,
            self::DOCUMENTOS,
            self::NUMERACAO,
            self::CERTIFICADO,
            self::CSC,
            self::TRIBUTACAO,
            self::ST_DIFAL,
            self::SERVICOS,
            self::AMBIENTE,
            self::REVISAO,
        ];
    }

    public static function label(string $etapa): string
    {
        return match ($etapa) {
            self::REGIME => 'Regime tributário',
            self::IDENTIFICACAO => 'Identificação',
            self::ENDERECO => 'Endereço',
            self::DOCUMENTOS => 'Documentos emitidos',
            self::NUMERACAO => 'Numeração',
            self::CERTIFICADO => 'Certificado A1',
            self::CSC => 'CSC (NFC-e)',
            self::TRIBUTACAO => 'Tributação padrão',
            self::ST_DIFAL => 'ST e DIFAL',
            self::SERVICOS => 'Serviços e retenções',
            self::AMBIENTE => 'Ambiente e resp. técnico',
            self::REVISAO => 'Revisão',
            default => $etapa,
        };
    }

    /** @return list<string> */
    public static function paraEmpresa(Empresa $empresa): array
    {
        $etapas = [
            self::REGIME,
            self::IDENTIFICACAO,
            self::ENDERECO,
            self::DOCUMENTOS,
            self::NUMERACAO,
            self::CERTIFICADO,
        ];

        if ($empresa->emite_nfce) {
            $etapas[] = self::CSC;
        }

        $etapas[] = self::TRIBUTACAO;

        $regime = $empresa->regime_tributario;
        if ($regime instanceof RegimeTributario && $regime->isRegimeNormal()) {
            $etapas[] = self::ST_DIFAL;
        }

        if ($empresa->emite_nfse) {
            $etapas[] = self::SERVICOS;
        }

        $etapas[] = self::AMBIENTE;
        $etapas[] = self::REVISAO;

        return $etapas;
    }

    public static function proxima(Empresa $empresa, string $atual): ?string
    {
        $lista = self::paraEmpresa($empresa);
        $idx = array_search($atual, $lista, true);
        if ($idx === false) {
            return $lista[0] ?? null;
        }

        return $lista[$idx + 1] ?? null;
    }

    public static function anterior(Empresa $empresa, string $atual): ?string
    {
        $lista = self::paraEmpresa($empresa);
        $idx = array_search($atual, $lista, true);
        if ($idx === false || $idx === 0) {
            return null;
        }

        return $lista[$idx - 1] ?? null;
    }

    public static function isValida(Empresa $empresa, string $etapa): bool
    {
        return in_array($etapa, self::paraEmpresa($empresa), true);
    }
}
