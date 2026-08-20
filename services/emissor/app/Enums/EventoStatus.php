<?php

namespace App\Enums;

enum EventoStatus: string
{
    case Processando = 'processando';
    case Autorizado = 'autorizado';
    case Rejeitado = 'rejeitado';
}
