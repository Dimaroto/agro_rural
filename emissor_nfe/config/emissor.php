<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Identificador do produto (isolamento multi-app no schema emissor)
    |--------------------------------------------------------------------------
    |
    | Empresas e vínculos user↔empresa deste instalador só enxergam o slug
    | abaixo. Mecânica Bedendo usa mecanica-bedendo; Agro Rural usa agro-rural.
    |
    */
    'app_slug' => env('EMISSOR_APP_SLUG', 'agro-rural'),

    'slugs' => [
        'agro' => 'agro-rural',
        'bedendo' => 'mecanica-bedendo',
    ],
];
