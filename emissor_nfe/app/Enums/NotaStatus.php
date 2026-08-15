<?php

namespace App\Enums;

enum NotaStatus: string
{
    case Rascunho = 'rascunho';
    case Processando = 'processando';
    case Autorizada = 'autorizada';
    case Rejeitada = 'rejeitada';
    case Cancelada = 'cancelada';
    case Denegada = 'denegada';
}
