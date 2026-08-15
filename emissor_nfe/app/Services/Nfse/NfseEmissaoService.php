<?php

namespace App\Services\Nfse;

use App\Models\Empresa;
use InvalidArgumentException;
use RuntimeException;

/**
 * Emissão de NFS-e (estrutura pronta para API Nacional / SEFIN).
 * Com NFSE_MOCK=true ou sem credenciais, retorna autorização simulada.
 */
class NfseEmissaoService
{
    /**
     * @return array{
     *   status: string,
     *   chaveAcesso: string|null,
     *   protocolo: string|null,
     *   mensagem: string,
     *   numero: int|null,
     *   serie: int|null,
     *   mock: bool
     * }
     */
    public function emitir(Empresa $empresa, array $payload): array
    {
        $this->validar($payload);

        if ($this->deveUsarMock()) {
            return $this->emitirMock($empresa, $payload);
        }

        // Hook para API Nacional — ainda não wired.
        throw new RuntimeException(
            'Emissão NFS-e real (SEFIN Nacional) ainda não configurada. '
            .'Defina NFSE_MOCK=true para homologação ou configure as credenciais em config/nfse.php.'
        );
    }

    public function validar(array $payload): void
    {
        $tomador = $payload['tomador'] ?? null;
        if (! is_array($tomador)) {
            throw new InvalidArgumentException('Informe o tomador da NFS-e.');
        }

        $nome = trim((string) ($tomador['nome'] ?? ''));
        $documento = preg_replace('/\D/', '', (string) ($tomador['documento'] ?? '')) ?? '';
        if ($nome === '') {
            throw new InvalidArgumentException('Nome do tomador é obrigatório.');
        }
        if (strlen($documento) !== 11 && strlen($documento) !== 14) {
            throw new InvalidArgumentException('CPF/CNPJ do tomador inválido.');
        }

        $servico = $payload['servico'] ?? null;
        if (! is_array($servico)) {
            throw new InvalidArgumentException('Informe o serviço da NFS-e.');
        }

        $codigo = trim((string) (
            $servico['codigoServicoLc116']
            ?? $servico['codigo_servico_lc116']
            ?? ''
        ));
        if ($codigo === '') {
            throw new InvalidArgumentException('codigoServicoLc116 é obrigatório.');
        }

        $aliquota = $servico['aliquotaIss'] ?? $servico['aliquota_iss'] ?? null;
        if ($aliquota === null || $aliquota === '' || ! is_numeric($aliquota)) {
            throw new InvalidArgumentException('aliquotaIss é obrigatória.');
        }

        $valor = $servico['valorServico'] ?? $servico['valor_servico'] ?? null;
        if ($valor === null || $valor === '' || ! is_numeric($valor) || (float) $valor <= 0) {
            throw new InvalidArgumentException('valorServico deve ser maior que zero.');
        }
    }

    private function deveUsarMock(): bool
    {
        if (config('nfse.mock', true)) {
            return true;
        }

        $clientId = config('nfse.nacional.client_id');
        $clientSecret = config('nfse.nacional.client_secret');

        return blank($clientId) || blank($clientSecret);
    }

    /**
     * @return array{
     *   status: string,
     *   chaveAcesso: string|null,
     *   protocolo: string|null,
     *   mensagem: string,
     *   numero: int|null,
     *   serie: int|null,
     *   mock: bool
     * }
     */
    private function emitirMock(Empresa $empresa, array $payload): array
    {
        $serie = (int) ($payload['serie'] ?? config('nfse.serie_padrao', 1));
        $numero = (int) now()->format('His') + random_int(1, 9);
        $codigoVerificacao = strtoupper(substr(bin2hex(random_bytes(8)), 0, 16));
        $protocolo = 'M'.now()->format('ymdHis').random_int(10, 99); // <= 20 chars

        return [
            'status' => 'autorizada',
            'chaveAcesso' => $codigoVerificacao,
            'protocolo' => $protocolo,
            'mensagem' => 'NFS-e autorizada (mock / homologação). Empresa '.$empresa->id.'.',
            'numero' => $numero,
            'serie' => $serie,
            'mock' => true,
        ];
    }
}
