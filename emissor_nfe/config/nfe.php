<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Responsável técnico (infRespTec) — obrigatório em SC e outras UFs
    |--------------------------------------------------------------------------
    |
    | Use o CNPJ da empresa desenvolvedora do sistema. Enquanto não houver
    | software house separada, pode ser o próprio CNPJ do emitente.
    |
    | CSRT/idCSRT: só preencha se a SEFAZ/SC já tiver emitido o código
    | (credenciamento do responsável técnico). Sem isso, rejeição 975.
    |
    */
    'resp_tec' => [
        'cnpj' => env('NFE_RESP_TEC_CNPJ'),
        'contato' => env('NFE_RESP_TEC_CONTATO') ?: 'Diogo Pieri',
        'email' => env('NFE_RESP_TEC_EMAIL') ?: 'diogo.pieri53@gmail.com',
        'fone' => env('NFE_RESP_TEC_FONE'),
        'csrt' => env('NFE_RESP_TEC_CSRT'),
        'id_csrt' => env('NFE_RESP_TEC_ID_CSRT'),
    ],
];
