<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', config('app.name', 'Emissor NFe'))</title>
    <style>
        :root {
            --bg: #0f1419;
            --panel: #1a2332;
            --panel-2: #121a26;
            --text: #e8eef7;
            --muted: #8b9bb4;
            --ok: #3dd68c;
            --warn: #e6b84d;
            --danger: #f07178;
            --accent: #5b9fd4;
            --accent-soft: rgba(91, 159, 212, 0.16);
            --border: #2a3a4f;
            --input: #0d131c;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", system-ui, sans-serif;
            background:
                radial-gradient(ellipse 80% 50% at 20% 0%, #1a3050 0%, transparent 55%),
                radial-gradient(ellipse 60% 40% at 90% 100%, #152838 0%, transparent 50%),
                var(--bg);
            color: var(--text);
        }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .wrap { width: min(1100px, 100%); margin: 0 auto; padding: 1.25rem 1.25rem 2.5rem; }
        .topbar {
            display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
            justify-content: space-between; margin-bottom: 1.25rem;
        }
        .brand h1 { margin: 0; font-size: 1.35rem; font-weight: 650; letter-spacing: -0.02em; }
        .brand .sub { color: var(--muted); font-size: 0.85rem; margin-top: 0.2rem; }
        .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
        .pill {
            display: inline-flex; align-items: center; gap: 0.4rem;
            padding: 0.35rem 0.7rem; border-radius: 999px;
            border: 1px solid var(--border); background: rgba(0,0,0,0.22);
            font-size: 0.8rem; color: var(--muted);
        }
        .pill.ok { color: var(--ok); border-color: rgba(61,214,140,0.35); }
        .pill.warn { color: var(--warn); border-color: rgba(230,184,77,0.35); }
        .pill.danger { color: var(--danger); border-color: rgba(240,113,120,0.35); }
        .pill::before {
            content: ""; width: 0.45rem; height: 0.45rem; border-radius: 50%;
            background: currentColor;
        }
        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
            border: 1px solid var(--border); background: var(--panel);
            color: var(--text); border-radius: 8px; padding: 0.55rem 0.95rem;
            font-size: 0.9rem; font-weight: 600; cursor: pointer; text-decoration: none;
        }
        .btn:hover { border-color: var(--accent); text-decoration: none; }
        .btn-primary { background: var(--accent); border-color: var(--accent); color: #061018; }
        .btn-primary:hover { filter: brightness(1.05); }
        .btn-ghost { background: transparent; }
        .card {
            background: var(--panel); border: 1px solid var(--border);
            border-radius: 12px; padding: 1.15rem 1.25rem;
        }
        .flash {
            margin-bottom: 1rem; padding: 0.75rem 0.9rem; border-radius: 8px;
            border: 1px solid var(--border); font-size: 0.9rem;
        }
        .flash.ok { background: rgba(61,214,140,0.12); border-color: rgba(61,214,140,0.35); color: var(--ok); }
        .flash.err { background: rgba(240,113,120,0.12); border-color: rgba(240,113,120,0.35); color: var(--danger); }
        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        th, td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
        th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; }
        .mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.82rem; }
        .muted { color: var(--muted); }
        .empty { padding: 2rem 1rem; text-align: center; color: var(--muted); }
        .tabs {
            display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1rem;
            border-bottom: 1px solid var(--border); padding-bottom: 0.65rem;
        }
        .tab {
            padding: 0.45rem 0.75rem; border-radius: 8px; color: var(--muted);
            font-size: 0.85rem; font-weight: 600; text-decoration: none;
        }
        .tab:hover { color: var(--text); text-decoration: none; background: rgba(255,255,255,0.04); }
        .tab.active { background: var(--accent-soft); color: var(--accent); }
        .help {
            background: var(--panel-2); border: 1px solid var(--border);
            border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1rem;
            color: var(--muted); font-size: 0.9rem; line-height: 1.5;
        }
        .help strong { color: var(--text); }
        .grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
        label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.3rem; }
        input, select {
            width: 100%; background: var(--input); border: 1px solid var(--border);
            color: var(--text); border-radius: 8px; padding: 0.55rem 0.7rem; font-size: 0.92rem;
        }
        input:focus, select:focus { outline: 2px solid rgba(91,159,212,0.35); border-color: var(--accent); }
        .field { margin-bottom: 0.15rem; }
        .form-actions { margin-top: 1.1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .token-box {
            margin-top: 0.75rem; padding: 0.75rem; border-radius: 8px;
            background: #0a1018; border: 1px dashed var(--accent);
            font-family: ui-monospace, Consolas, monospace; word-break: break-all; font-size: 0.85rem;
        }
        .pagination { margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
        .pagination a, .pagination span {
            padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid var(--border);
            font-size: 0.82rem; color: var(--muted);
        }
        .pagination .current { color: var(--text); border-color: var(--accent); }
        .badge {
            display: inline-block; padding: 0.15rem 0.45rem; border-radius: 999px;
            font-size: 0.75rem; font-weight: 700; border: 1px solid var(--border);
        }
        .badge.ok { color: var(--ok); }
        .badge.warn { color: var(--warn); }
        .badge.danger { color: var(--danger); }
        .login-wrap {
            min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        }
        .login-card { width: min(420px, 100%); }
        .row-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; }
        .row-actions .btn { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
    </style>
</head>
<body>
@yield('body')
</body>
</html>
