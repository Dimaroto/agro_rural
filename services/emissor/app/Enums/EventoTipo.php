<?php

namespace App\Enums;

enum EventoTipo: string
{
    case Cancelamento = 'cancelamento';
    case Cce = 'cce';
    case Inutilizacao = 'inutilizacao';
}
