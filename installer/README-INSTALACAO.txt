# Instalador Windows — Agro Rural (Edem Software)

Agro Rural — app Windows + emissor NF-e
=======================================

Este Setup instala no seu PC:
  - App Agro Rural (janela nativa, nao e so um link da internet)
  - Emissor NF-e local (Laravel + PHP) em 127.0.0.1:8000
  - Atalho do programa (como Mecanica Bedendo)

Pasta de instalacao (por usuario):
  %LOCALAPPDATA%\Agro Rural Zortea\Agro Rural\

Apos instalar:
  1. Abra o atalho Agro Rural
  2. F11 = tela cheia
  3. Barra superior: Iniciar emissor (vermelho) ou Configurar emissor (verde)
     — o painel do emissor abre em uma janela separada
  4. No admin, em Vendas, use Emitir NF-e / NFC-e

Requisitos: Windows 10/11 64-bit, conexao com a internet (admin na nuvem),
Neon (banco) e certificado A1 (.pfx).

Nao rode o Setup como administrador (instala em LocalAppData do seu usuario).
