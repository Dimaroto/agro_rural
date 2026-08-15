<?php

namespace App\Services\Nfe;

use App\Models\Empresa;
use App\Support\WritableTemp;
use NFePHP\Common\Certificate;
use NFePHP\Common\Soap\SoapCurl;
use NFePHP\NFe\Tools;
use RuntimeException;

class ToolsFactory
{
    /**
     * @param  int  $modelo  55 = NF-e, 65 = NFC-e (QR Code exige CSC/CSCid no config)
     */
    public function make(Empresa $empresa, int $modelo = 55): Tools
    {
        $empresa->loadMissing('certificado');

        if (! $empresa->certificado) {
            throw new RuntimeException('Empresa sem certificado A1 cadastrado.');
        }

        $cert = $empresa->certificado;

        if ($cert->valido_ate && $cert->valido_ate->isPast()) {
            throw new RuntimeException('Certificado A1 expirado.');
        }

        // TMP gravavel ANTES do NFePHP criar pasta sped-* / certs
        WritableTemp::applyEnvironment();

        $certificate = Certificate::readPfx($cert->getPfxContent(), $cert->getSenha());

        $cscId = trim((string) ($empresa->csc_id ?? ''));
        $cscToken = trim((string) ($empresa->csc_token ?? ''));
        if ($cscId !== '' && ctype_digit($cscId)) {
            $cscId = str_pad($cscId, 6, '0', STR_PAD_LEFT);
        }

        $config = [
            'atualizacao' => now()->format('Y-m-d H:i:s'),
            'tpAmb' => $empresa->tpAmb(),
            'razaosocial' => $empresa->razao_social,
            'cnpj' => $empresa->cnpjDigits(),
            'siglaUF' => strtoupper($empresa->uf),
            'schemes' => 'PL_009_V4',
            'versao' => '4.00',
            'tokenIBPT' => '',
            'CSC' => $cscToken,
            'CSCid' => $cscId,
            'proxyConf' => [
                'proxyIp' => '',
                'proxyPort' => '',
                'proxyUser' => '',
                'proxyPass' => '',
            ],
        ];

        $tools = new Tools(json_encode($config), $certificate);
        $tools->model(in_array($modelo, [55, 65], true) ? $modelo : 55);

        // Força pasta temp do SOAP (certs PEM). Evita sys_get_temp_dir()/sped-...
        // e o bug pathwsfiles="/" quando realpath falha.
        $tempFolder = WritableTemp::forNfephp($empresa->cnpjDigits());
        try {
            $soap = new SoapCurl($certificate);
            $soap->setTemporaryFolder($tempFolder);
            $tools->loadSoapClass($soap);
        } catch (\Throwable $e) {
            throw new RuntimeException(
                'Falha ao preparar pasta temporária do certificado ('
                .$tempFolder.'): '.$e->getMessage(),
                0,
                $e
            );
        }

        // Garante path de webservice XMLs (se realpath falhou no vendor)
        if (empty($tools->pathwsfiles) || $tools->pathwsfiles === '/' || $tools->pathwsfiles === '\\') {
            $ws = base_path('vendor/nfephp-org/sped-nfe/storage');
            if (is_dir($ws)) {
                $tools->pathwsfiles = rtrim(str_replace('\\', '/', realpath($ws) ?: $ws), '/').'/';
            }
        }

        return $tools;
    }
}
