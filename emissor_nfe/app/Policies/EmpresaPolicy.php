<?php

namespace App\Policies;

use App\Models\Empresa;
use App\Models\User;

class EmpresaPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Empresa $empresa): bool
    {
        return $user->temAcessoEmpresa($empresa);
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Empresa $empresa): bool
    {
        return $user->temAcessoEmpresa($empresa);
    }

    public function manageCertificado(User $user, Empresa $empresa): bool
    {
        return $user->temAcessoEmpresa($empresa);
    }

    public function manageNfe(User $user, Empresa $empresa): bool
    {
        return $user->temAcessoEmpresa($empresa);
    }
}
