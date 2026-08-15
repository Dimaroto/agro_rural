@extends('layouts.emissor')

@section('title', 'Configurações · '.config('app.name'))

@section('body')
<div class="wrap">
    <header class="topbar">
        <div class="brand">
            <h1>Configurações</h1>
            <div class="sub">{{ $empresa->razao_social }}</div>
        </div>
        <div class="actions">
            <a class="btn" href="{{ route('painel') }}">← Painel</a>
            <form method="post" action="{{ route('logout') }}" style="display:inline;">
                @csrf
                <button class="btn btn-ghost" type="submit">Sair</button>
            </form>
        </div>
    </header>

    @if (session('success'))
        <div class="flash ok">{{ session('success') }}</div>
    @endif
    @if ($errors->any())
        <div class="flash err">{{ $errors->first() }}</div>
    @endif

    @if (isset($empresas) && $empresas->count() > 0)
        <form method="post" action="/configuracoes/empresa-ativa" class="card" style="margin-bottom:1rem;padding:0.85rem 1rem;">
            @csrf
            <div class="field" style="margin:0;">
                <label for="empresa_id">Empresa ativa (edição / certificado / emissão)</label>
                <div style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;">
                    <select id="empresa_id" name="empresa_id" style="flex:1;min-width:220px;">
                        @foreach ($empresas as $opt)
                            <option value="{{ $opt->id }}" @selected($opt->id === $empresa->id)>
                                #{{ $opt->id }} — {{ $opt->razao_social }} ({{ $opt->cnpj }})
                            </option>
                        @endforeach
                    </select>
                    <button class="btn btn-primary" type="submit">Usar esta</button>
                </div>
                <p class="muted" style="margin:0.45rem 0 0;font-size:0.8rem;">
                    A ID 2 costuma ser só demonstração. A Agro Rural Zortea é a ID 1 — selecione-a aqui.
                    No app Flutter, use o mesmo <span class="mono">empresaId</span>.
                </p>
            </div>
        </form>
    @endif

    <nav class="tabs">
        @foreach ($abas as $key => $label)
            <a class="tab {{ $tab === $key ? 'active' : '' }}" href="/configuracoes?tab={{ $key }}">{{ $label }}</a>
        @endforeach
    </nav>

    <section class="card">
        @if ($tab === 'empresa')
            <div class="help">
                <strong>Onde conseguir:</strong> CNPJ, razão social e endereço no
                <em>Cartão CNPJ</em> (Receita Federal). IE no portal da SEFAZ-SC.
                Código do município no site do IBGE (Zortéa-SC = <span class="mono">4219853</span>).
            </div>
            <form method="post" action="/configuracoes/empresa">
                @csrf
                <div class="grid">
                    <div class="field">
                        <label for="cnpj">CNPJ</label>
                        <input id="cnpj" name="cnpj" value="{{ old('cnpj', $empresa->cnpj) }}" required>
                    </div>
                    <div class="field">
                        <label for="ie">Inscrição estadual</label>
                        <input id="ie" name="ie" value="{{ old('ie', $empresa->ie) }}">
                    </div>
                    <div class="field">
                        <label for="razao_social">Razão social</label>
                        <input id="razao_social" name="razao_social" value="{{ old('razao_social', $empresa->razao_social) }}" required>
                    </div>
                    <div class="field">
                        <label for="nome_fantasia">Nome fantasia</label>
                        <input id="nome_fantasia" name="nome_fantasia" value="{{ old('nome_fantasia', $empresa->nome_fantasia) }}">
                    </div>
                    <div class="field">
                        <label for="email">E-mail</label>
                        <input id="email" type="email" name="email" value="{{ old('email', $empresa->email) }}">
                    </div>
                    <div class="field">
                        <label for="telefone">Telefone</label>
                        <input id="telefone" name="telefone" value="{{ old('telefone', $empresa->telefone) }}">
                    </div>
                    <div class="field">
                        <label for="logradouro">Logradouro</label>
                        <input id="logradouro" name="logradouro" value="{{ old('logradouro', $empresa->logradouro) }}" required>
                    </div>
                    <div class="field">
                        <label for="numero">Número</label>
                        <input id="numero" name="numero" value="{{ old('numero', $empresa->numero) }}" required>
                    </div>
                    <div class="field">
                        <label for="complemento">Complemento</label>
                        <input id="complemento" name="complemento" value="{{ old('complemento', $empresa->complemento) }}">
                    </div>
                    <div class="field">
                        <label for="bairro">Bairro</label>
                        <input id="bairro" name="bairro" value="{{ old('bairro', $empresa->bairro) }}" required>
                    </div>
                    <div class="field">
                        <label for="municipio">Município</label>
                        <input id="municipio" name="municipio" value="{{ old('municipio', $empresa->municipio) }}" required>
                    </div>
                    <div class="field">
                        <label for="codigo_municipio">Código IBGE (7 dígitos)</label>
                        <input id="codigo_municipio" name="codigo_municipio" maxlength="7" value="{{ old('codigo_municipio', $empresa->codigo_municipio) }}" required>
                    </div>
                    <div class="field">
                        <label for="uf">UF</label>
                        <input id="uf" name="uf" maxlength="2" value="{{ old('uf', $empresa->uf) }}" required>
                    </div>
                    <div class="field">
                        <label for="cep">CEP (8 dígitos)</label>
                        <input id="cep" name="cep" maxlength="8" value="{{ old('cep', $empresa->cep) }}" required>
                    </div>
                    <div class="field">
                        <label for="crt">CRT (regime tributário)</label>
                        <select id="crt" name="crt" required>
                            @foreach ([1 => '1 — Simples Nacional', 2 => '2 — Simples excesso sublimite', 3 => '3 — Regime normal'] as $v => $lab)
                                <option value="{{ $v }}" @selected((int) old('crt', $empresa->crt) === $v)>{{ $lab }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="field">
                        <label for="ambiente">Ambiente SEFAZ</label>
                        <select id="ambiente" name="ambiente" required>
                            <option value="homologacao" @selected(old('ambiente', $empresa->ambiente) === 'homologacao')>Homologação</option>
                            <option value="producao" @selected(old('ambiente', $empresa->ambiente) === 'producao')>Produção</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="inscricao_municipal">Inscrição municipal</label>
                        <input id="inscricao_municipal" name="inscricao_municipal" value="{{ old('inscricao_municipal', $empresa->inscricao_municipal) }}">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Salvar empresa</button>
                </div>
            </form>

        @elseif ($tab === 'certificado')
            <div class="help">
                <strong>Onde conseguir:</strong> certificado digital e-CNPJ A1 (.pfx) em Serasa, Certisign, Soluti, etc.
                A senha é a definida na emissão do certificado. O arquivo fica só nesta máquina.
                O CNPJ do certificado precisa ser o mesmo da empresa
                (<span class="mono">{{ $empresa->cnpj }}</span>).
            </div>
            @if ($empresa->certificado)
                <p class="muted" style="margin-top:0;">
                    Atual:
                    CNPJ <span class="mono">{{ $empresa->certificado->cnpj_certificado ?? '—' }}</span>
                    · válido até
                    <span class="mono">{{ optional($empresa->certificado->valido_ate)->format('d/m/Y H:i') ?? '—' }}</span>
                </p>
            @else
                <p class="muted">Nenhum certificado cadastrado.</p>
            @endif
            <form method="post" action="/configuracoes/certificado" enctype="multipart/form-data">
                @csrf
                <div class="grid">
                    <div class="field">
                        <label for="pfx">Arquivo .pfx / .p12</label>
                        <input id="pfx" type="file" name="pfx" accept=".pfx,.p12,application/x-pkcs12" required>
                    </div>
                    <div class="field">
                        <label for="senha">Senha do certificado</label>
                        <input id="senha" type="password" name="senha" required autocomplete="off">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Enviar certificado</button>
                </div>
            </form>

        @elseif ($tab === 'numeracao')
            <div class="help">
                <strong>Onde conseguir:</strong> continuidade da numeração já usada na SEFAZ
                (próximo número livre). Alinhe com inutilizações se houver gaps.
            </div>
            <form method="post" action="/configuracoes/numeracao">
                @csrf
                <h3 style="margin:0 0 0.65rem;font-size:0.95rem;">Modelo 55 (NF-e)</h3>
                <div class="grid">
                    <div class="field">
                        <label for="serie_55">Série</label>
                        <input id="serie_55" type="number" name="serie_55" min="1" max="999" value="{{ old('serie_55', $num55->serie ?? 1) }}" required>
                    </div>
                    <div class="field">
                        <label for="proximo_55">Próximo número</label>
                        <input id="proximo_55" type="number" name="proximo_55" min="1" value="{{ old('proximo_55', $num55->proximo_numero ?? 1) }}" required>
                    </div>
                </div>
                <h3 style="margin:1.1rem 0 0.65rem;font-size:0.95rem;">Modelo 65 (NFC-e)</h3>
                <div class="grid">
                    <div class="field">
                        <label for="serie_65">Série</label>
                        <input id="serie_65" type="number" name="serie_65" min="1" max="999" value="{{ old('serie_65', $num65->serie ?? 1) }}" required>
                    </div>
                    <div class="field">
                        <label for="proximo_65">Próximo número</label>
                        <input id="proximo_65" type="number" name="proximo_65" min="1" value="{{ old('proximo_65', $num65->proximo_numero ?? 1) }}" required>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Salvar numeração</button>
                </div>
            </form>

        @elseif ($tab === 'csc')
            <div class="help">
                <strong>Onde conseguir:</strong> Portal Nacional da NFC-e (código de segurança do contribuinte).
                Só é necessário se emitir modelo 65. NF-e 55 não usa CSC.
            </div>
            <form method="post" action="/configuracoes/csc">
                @csrf
                <div class="grid">
                    <div class="field">
                        <label for="csc_id">CSC ID</label>
                        <input id="csc_id" name="csc_id" value="{{ old('csc_id', $empresa->csc_id) }}">
                    </div>
                    <div class="field">
                        <label for="csc_token">CSC Token</label>
                        <input id="csc_token" name="csc_token" value="{{ old('csc_token', $empresa->csc_token) }}">
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit">Salvar CSC</button>
                </div>
            </form>

        @elseif ($tab === 'nfse')
            <div class="help">
                <strong>Onde conseguir:</strong> credenciais no Portal NFS-e Nacional / ADN (SEFIN).
                O mock serve só para testes locais sem SEFIN. Edição destas chaves é pelo arquivo
                <span class="mono">.env</span> (não gravamos secrets na UI).
            </div>
            <div class="grid">
                <div class="field">
                    <label>NFSE_MOCK</label>
                    <input value="{{ ($nfse['mock'] ?? false) ? 'true' : 'false' }}" readonly>
                </div>
                <div class="field">
                    <label>Ambiente NFS-e</label>
                    <input value="{{ $nfse['ambiente'] ?? '—' }}" readonly>
                </div>
                <div class="field">
                    <label>Client ID</label>
                    <input value="{{ $nfse['nacional']['client_id'] ? '•••• configurado' : '(vazio)' }}" readonly>
                </div>
                <div class="field">
                    <label>Client secret</label>
                    <input value="{{ $nfse['nacional']['client_secret'] ? '•••• configurado' : '(vazio)' }}" readonly>
                </div>
            </div>
            <p class="muted" style="margin:1rem 0 0;font-size:0.88rem;line-height:1.5;">
                Variáveis: <span class="mono">NFSE_MOCK</span>,
                <span class="mono">NFSE_AMBIENTE</span>,
                <span class="mono">NFSE_NACIONAL_CLIENT_ID</span>,
                <span class="mono">NFSE_NACIONAL_CLIENT_SECRET</span>.
                Após editar o <span class="mono">.env</span>, reinicie o <span class="mono">php artisan serve</span>.
            </p>

        @elseif ($tab === 'integracao')
            <div class="help">
                <strong>No Flutter:</strong> Configurações → Fiscal → cole URL, token e empresaId.
                URL local típica: <span class="mono">http://127.0.0.1:8000</span>.
                Use o <span class="mono">empresaId</span> da empresa ativa
                (<strong>#{{ $empresa->id }}</strong> (não a demo, se houver).
            </div>
            <div class="grid">
                <div class="field">
                    <label>URL base do emissor</label>
                    <input value="{{ $appUrl }}" readonly class="mono">
                </div>
                <div class="field">
                    <label>empresaId (cole no Flutter)</label>
                    <input value="{{ $empresa->id }}" readonly class="mono">
                </div>
            </div>
            <form method="post" action="/configuracoes/token" style="margin-top:1rem;">
                @csrf
                <button class="btn btn-primary" type="submit">Gerar novo token Sanctum</button>
            </form>
            @if ($tokenCriado)
                <div class="token-box">{{ $tokenCriado }}</div>
                <p class="muted" style="font-size:0.85rem;">Copie agora — este valor não será mostrado de novo.</p>
            @endif

        @elseif ($tab === 'resp_tec')
            <div class="help">
                <strong>Onde conseguir:</strong> dados do responsável técnico credenciado na SEFAZ
                (obrigatório em SC). CSRT/idCSRT só se a SEFAZ já tiver emitido o código.
                Configure via <span class="mono">.env</span>.
            </div>
            <div class="grid">
                <div class="field">
                    <label>NFE_RESP_TEC_CNPJ</label>
                    <input value="{{ $respTec['cnpj'] ?: '(vazio — use o CNPJ do emitente ou da software house)' }}" readonly>
                </div>
                <div class="field">
                    <label>Contato</label>
                    <input value="{{ $respTec['contato'] ?? '—' }}" readonly>
                </div>
                <div class="field">
                    <label>E-mail</label>
                    <input value="{{ $respTec['email'] ?? '—' }}" readonly>
                </div>
                <div class="field">
                    <label>Telefone</label>
                    <input value="{{ $respTec['fone'] ?: '(vazio)' }}" readonly>
                </div>
                <div class="field">
                    <label>CSRT</label>
                    <input value="{{ $respTec['csrt'] ? '•••• configurado' : '(vazio)' }}" readonly>
                </div>
                <div class="field">
                    <label>idCSRT</label>
                    <input value="{{ $respTec['id_csrt'] ?: '(vazio)' }}" readonly>
                </div>
            </div>
            <p class="muted" style="margin:1rem 0 0;font-size:0.88rem;line-height:1.5;">
                Variáveis: <span class="mono">NFE_RESP_TEC_CNPJ</span>,
                <span class="mono">NFE_RESP_TEC_CONTATO</span>,
                <span class="mono">NFE_RESP_TEC_EMAIL</span>,
                <span class="mono">NFE_RESP_TEC_FONE</span>,
                <span class="mono">NFE_RESP_TEC_CSRT</span>,
                <span class="mono">NFE_RESP_TEC_ID_CSRT</span>.
            </p>
        @endif
    </section>
</div>
@endsection
