<?php

return [
    /*
    |--------------------------------------------------------------------------
    | NFS-e Nacional (SEFIN) — estrutura pronta para integração futura
    |--------------------------------------------------------------------------
    |
    | Enquanto NFSE_MOCK=true (ou sem credenciais), o serviço devolve
    | autorização simulada para homologação / testes do app.
    |
    */
    'mock' => filter_var(env('NFSE_MOCK', true), FILTER_VALIDATE_BOOLEAN),

    'ambiente' => env('NFSE_AMBIENTE', 'homologacao'), // homologacao|producao

    'nacional' => [
        'base_url' => env('NFSE_NACIONAL_BASE_URL', 'https://sefin.nfse.gov.br/sefinnacional'),
        'base_url_homologacao' => env(
            'NFSE_NACIONAL_BASE_URL_HOMOLOG',
            'https://sefin.nfse.gov.br/sefinnacional'
        ),
        'client_id' => env('NFSE_NACIONAL_CLIENT_ID'),
        'client_secret' => env('NFSE_NACIONAL_CLIENT_SECRET'),
        'timeout' => (int) env('NFSE_NACIONAL_TIMEOUT', 30),
    ],

    'serie_padrao' => (int) env('NFSE_SERIE_PADRAO', 1),
];
