# Instalador Windows — Agro Rural (emissor NF-e)
# Coloque este arquivo em installer\README-INSTALACAO.txt (embutido no Setup).

Agro Rural — instalacao do emissor NF-e
=======================================

O catalogo/admin fica na nuvem:
  https://agroruralzortea.com.br/admin

Este Setup instala no seu PC:
  - Emissor NF-e local (Laravel + PHP) em 127.0.0.1:8000
  - Protocolo agro-emissor:// (botao Iniciar emissor na engrenagem do admin)
  - Atalhos para admin e para iniciar o emissor

Pasta de instalacao (por usuario):
  %LOCALAPPDATA%\Agro Rural Zortea\Agro Rural\

Apos instalar:
  1. Abra o Admin no navegador
  2. Engrenagem → Iniciar emissor (aguarde ficar verde)
  3. Engrenagem → Configurar emissor / Fiscal: empresa, certificado A1, numeracao, token
  4. Em Vendas, use Emitir NF-e / NFC-e

Requisitos: Windows 10/11 64-bit, conexao com o Neon (banco) e certificado A1 (.pfx).

Nao rode o Setup como administrador (instala em LocalAppData do seu usuario).
