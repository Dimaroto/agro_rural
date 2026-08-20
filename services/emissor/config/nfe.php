<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Responsável técnico (infRespTec) — obrigatório em SC e outras UFs
    |--------------------------------------------------------------------------
    |
    | Preferência: dados cadastrados na empresa (wizard).
    | Fallback: variáveis de ambiente abaixo.
    | Sem dados pessoais chumbados no código.
    |
    */
    'resp_tec' => [
        'cnpj' => env('NFE_RESP_TEC_CNPJ'),
        'contato' => env('NFE_RESP_TEC_CONTATO'),
        'email' => env('NFE_RESP_TEC_EMAIL'),
        'fone' => env('NFE_RESP_TEC_FONE'),
        'csrt' => env('NFE_RESP_TEC_CSRT'),
        'id_csrt' => env('NFE_RESP_TEC_ID_CSRT'),
    ],
];
