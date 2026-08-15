<?php

namespace App\Services\Nfe;

use App\Models\Certificado;
use App\Models\Empresa;
use Illuminate\Http\UploadedFile;
use InvalidArgumentException;
use NFePHP\Common\Certificate;
use NFePHP\Common\Exception\CertificateException;
use Throwable;

class CertificadoService
{
    public function store(Empresa $empresa, UploadedFile $pfx, string $senha): Certificado
    {
        $this->ensureOpenSslLegacy();

        $content = file_get_contents($pfx->getRealPath());

        if ($content === false || $content === '') {
            throw new InvalidArgumentException('Arquivo PFX inválido ou vazio.');
        }

        try {
            $certificate = Certificate::readPfx($content, (string) $senha);
        } catch (CertificateException $e) {
            throw new InvalidArgumentException(
                'Não foi possível ler o certificado A1. Verifique o arquivo e a senha. '.$e->getMessage()
            );
        } catch (Throwable $e) {
            throw new InvalidArgumentException(
                'Falha ao processar o certificado A1: '.$e->getMessage()
            );
        }

        if ($certificate->isExpired()) {
            throw new InvalidArgumentException('O certificado A1 informado está expirado.');
        }

        $cnpjCert = preg_replace('/\D/', '', (string) $certificate->getCnpj()) ?? '';
        $cnpjEmpresa = $empresa->cnpjDigits();

        if ($cnpjCert !== '' && $cnpjCert !== $cnpjEmpresa) {
            throw new InvalidArgumentException(
                "CNPJ do certificado ({$cnpjCert}) difere do CNPJ da empresa ({$cnpjEmpresa})."
            );
        }

        $certificado = $empresa->certificado ?? new Certificado(['empresa_id' => $empresa->id]);
        $certificado->setPfxContent($content);
        $certificado->setSenha($senha);
        $certificado->cnpj_certificado = $cnpjCert ?: $cnpjEmpresa;
        $certificado->razao_social_certificado = $certificate->getCompanyName();
        $certificado->valido_de = $certificate->getValidFrom();
        $certificado->valido_ate = $certificate->getValidTo();
        $certificado->save();

        return $certificado->fresh();
    }

    private function ensureOpenSslLegacy(): void
    {
        $cnf = base_path('openssl-legacy.cnf');
        if (is_file($cnf)) {
            putenv('OPENSSL_CONF='.$cnf);
            $_ENV['OPENSSL_CONF'] = $cnf;
            $_SERVER['OPENSSL_CONF'] = $cnf;
        }

        $modules = dirname(PHP_BINARY).DIRECTORY_SEPARATOR.'extras'.DIRECTORY_SEPARATOR.'ssl';
        if (is_dir($modules)) {
            putenv('OPENSSL_MODULES='.$modules);
            $_ENV['OPENSSL_MODULES'] = $modules;
            $_SERVER['OPENSSL_MODULES'] = $modules;
        }
    }
}
