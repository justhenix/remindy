import { FAVICON_PNG_BASE64 } from './favicon.js';

/**
 * Dashboard UI template generator.
 *
 * A self-contained dark SPA that mirrors the landing design system (24px
 * architectural grid, twinkling margin fields, blueprint frames with corner
 * crosses, Host Grotesk, #0C0C0C surface / #FDFFF8 ink, green accent) but stays
 * direct and utilitarian. Talks to /api/{rules,stats,recall,health,config} and
 * ships a driver.js guided tour.
 */
export function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>remindy dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="data:image/png;base64,${FAVICON_PNG_BASE64}" sizes="96x96">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:ital,wght@0,300..700;1,300..700&family=Stack+Sans+Notch:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css">
  <style>
    :root {
      --surface: #0C0C0C;
      --panel: #0D0D0D;
      --ink: #FDFFF8;
      --muted: #a3a3a3;
      --faint: #6b6b6b;
      --line: rgba(128,128,128,0.15);
      --line-strong: rgba(128,128,128,0.35);
      --grid: rgba(128,128,128,0.07);
      --input: #151515;
      --accent: #4ADE80;
      --square: #2D4A22;
      --warn: #f87171;
      --tag-UI: #3d7a45;
      --tag-CODE: #6d5bd0;
      --tag-COMMIT: #2f6fb0;
      --tag-COPY: #b7791f;
      --tag-SEC: #c0453b;
      --tag-REQ: #148f82;
      --tag-PERF: #4f52c9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background-color: var(--surface); color: var(--ink);
      font-family: 'Host Grotesk', sans-serif; font-weight: 400;
      min-height: 100vh; line-height: 1.5; letter-spacing: -0.005em;
    }
    .canvas-grid {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image:
        linear-gradient(to right, var(--grid) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    /* Twinkling square margin fields (landing signature) */
    .margin-field { position: fixed; top: 0; bottom: 0; z-index: 0; width: 26vw; max-width: 420px; pointer-events: none; display: grid; grid-auto-flow: column; grid-template-rows: repeat(auto-fill, 24px); grid-auto-columns: 24px; align-content: center; }
    .margin-field.left { left: 0; justify-content: start; -webkit-mask-image: linear-gradient(to right, black 0%, black 18%, transparent 82%); mask-image: linear-gradient(to right, black 0%, black 18%, transparent 82%); }
    .margin-field.right { right: 0; justify-content: end; -webkit-mask-image: linear-gradient(to left, black 0%, black 18%, transparent 82%); mask-image: linear-gradient(to left, black 0%, black 18%, transparent 82%); }
    .cell { position: relative; }
    .sq { position: absolute; top: 9px; left: 9px; width: 6px; height: 6px; border-radius: 1px; background: var(--square); opacity: 0.3; animation: twinkle var(--dur,3s) ease-in-out var(--dl,0s) infinite; }
    .sq.glow { background: var(--accent); animation-name: glowpulse; }
    @keyframes twinkle { 0%,100% { opacity: 0.10; } 50% { opacity: 0.40; } }
    @keyframes glowpulse { 0%,100% { opacity: 0.12; } 50% { opacity: 0.6; } }
    @media (max-width: 1180px) { .margin-field { display: none; } }

    .wrap { position: relative; z-index: 1; max-width: 1024px; margin: 0 auto; padding: 40px 24px 96px; }

    /* Blueprint frame + corner crosses */
    .frame { position: relative; border: 1px solid var(--line); background: var(--panel); }
    .plus { position: absolute; width: 9px; height: 9px; z-index: 2; }
    .plus::before, .plus::after { content: ''; position: absolute; background: var(--line-strong); }
    .plus::before { top: 50%; left: 0; right: 0; height: 1px; transform: translateY(-0.5px); }
    .plus::after { left: 50%; top: 0; bottom: 0; width: 1px; transform: translateX(-0.5px); }
    .plus.tl { top: -5px; left: -5px; } .plus.tr { top: -5px; right: -5px; }
    .plus.bl { bottom: -5px; left: -5px; } .plus.br { bottom: -5px; right: -5px; }

    .eyebrow { display: inline-block; font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--faint); }
    .section-title { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; margin-top: 7px; }

    /* Header */
    header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 26px; margin-bottom: 36px; border-bottom: 1px solid var(--line); gap: 16px; flex-wrap: wrap; }
    .logo-group h1 { font-family: 'Stack Sans Notch', 'Host Grotesk', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: -0.045em; text-transform: lowercase; line-height: 1; }
    .logo-group p { font-size: 12.5px; color: var(--muted); margin-top: 6px; }
    .actions-group { display: flex; align-items: center; gap: 8px; }
    .backend-badge { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
    .backend-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .backend-badge.ok { background: rgba(74,222,128,0.10); color: var(--accent); border-color: transparent; }
    .backend-badge.warn { background: rgba(248,113,113,0.10); color: var(--warn); border-color: transparent; }
    .btn-ghost { background: none; border: 1px solid var(--line); color: var(--ink); cursor: pointer; padding: 7px 13px; font-family: inherit; font-size: 12px; font-weight: 600; border-radius: 4px; transition: border-color .15s, background .15s; }
    .btn-ghost:hover { border-color: var(--muted); background: var(--input); }

    /* Stats: one framed strip with dividers */
    .stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 36px; }
    .stat { padding: 20px 22px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
    .stat:last-child { border-right: none; }
    .stat-top { display: flex; align-items: center; gap: 8px; }
    .stat-mark { width: 7px; height: 7px; border-radius: 2px; background: var(--accent); }
    .stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--faint); }
    .stat-val { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }

    /* Panels */
    .panels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .panel { padding: 26px; display: flex; flex-direction: column; gap: 18px; }
    .panel-head { margin-bottom: 2px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-row { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
    label { font-size: 10.5px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: 0.08em; }
    input[type="text"], input[type="password"], select {
      background: var(--input); border: 1px solid var(--line); color: var(--ink);
      padding: 12px; font-family: inherit; font-size: 13px; border-radius: 4px; outline: none; width: 100%; transition: border-color .15s;
    }
    input::placeholder { color: var(--faint); }
    input:focus, select:focus { border-color: var(--accent); }
    input:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-action { background: var(--ink); color: var(--surface); border: none; cursor: pointer; padding: 12px 18px; font-family: inherit; font-size: 13px; font-weight: 700; border-radius: 4px; transition: opacity .15s; letter-spacing: -0.01em; }
    .btn-action:hover { opacity: 0.85; }
    .btn-action:disabled { opacity: 0.5; cursor: default; }

    .preview-box { border: 1px solid var(--line); background: var(--input); padding: 14px; border-radius: 4px; min-height: 78px; display: flex; flex-direction: column; gap: 8px; }
    .preview-placeholder { color: var(--faint); font-size: 12px; margin: auto; text-align: center; }
    .preview-rule { font-size: 12.5px; padding: 7px 10px; background: var(--surface); border-left: 2px solid var(--accent); border-radius: 2px; }
    .preview-stats { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 8px; }
    .hint { font-size: 11.5px; color: var(--faint); line-height: 1.5; }

    /* Rules table */
    .rules-section { padding: 26px; }
    .rules-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 6px; gap: 12px; flex-wrap: wrap; }
    .tag-filters { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-badge { padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 12px; cursor: pointer; border: 1px solid var(--line); background: transparent; color: var(--muted); transition: all .15s; }
    .filter-badge:hover { color: var(--ink); }
    .filter-badge.active { color: var(--surface); border-color: var(--accent); background: var(--accent); }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 12px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--faint); border-bottom: 1px solid var(--line); cursor: pointer; user-select: none; }
    th:hover { color: var(--ink); }
    td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid var(--line); }
    tr:last-child td { border-bottom: none; }
    tbody tr { transition: background .1s; }
    tbody tr:hover { background: rgba(255,255,255,0.015); }
    .tag-badge { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 700; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.04em; color: #FDFFF8; }
    .editable { cursor: text; padding: 3px 5px; border-radius: 3px; margin: -3px -5px; }
    .editable:hover { background: var(--input); }
    .cell-editor { width: 100%; background: var(--input); border: 1px solid var(--accent); color: var(--ink); font-family: inherit; font-size: 13px; padding: 3px 5px; outline: none; }
    .btn-delete { background: none; border: none; cursor: pointer; color: var(--faint); font-size: 14px; padding: 4px; transition: color .15s; }
    .btn-delete:hover { color: var(--warn); }
    .burn { width: 72px; min-width: 72px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
    .empty-state { text-align: center; padding: 40px; color: var(--faint); font-size: 13px; }

    #toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 1000; }
    .toast { background: var(--ink); color: var(--surface); padding: 12px 18px; font-size: 12.5px; font-weight: 600; border-radius: 4px; min-width: 200px; box-shadow: 0 6px 20px rgba(0,0,0,0.5); animation: slideIn .25s forwards; }
    @keyframes slideIn { from { transform: translateY(120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .driver-popover { font-family: 'Host Grotesk', sans-serif; }

    @media (max-width: 820px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .stat:nth-child(2) { border-right: none; }
      .panels-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="canvas-grid" aria-hidden="true"></div>
  <div id="field-left" class="margin-field left" aria-hidden="true"></div>
  <div id="field-right" class="margin-field right" aria-hidden="true"></div>

  <div class="wrap">
    <header id="tour-header">
      <div class="logo-group">
        <h1>remindy</h1>
        <p>the taste &amp; standards layer for AI coding agents</p>
      </div>
      <div class="actions-group">
        <span class="backend-badge" id="backend-badge" title="Active memory backend">checking&hellip;</span>
        <a class="btn-ghost" id="btn-docs" href="https://github.com/justhenix/remindy#readme" target="_blank" rel="noopener" style="text-decoration:none;">Docs</a>
        <button class="btn-ghost" id="btn-tour">Tour</button>
      </div>
    </header>

    <div class="stats-strip frame" id="tour-stats">
      <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
      <div class="stat"><div class="stat-top"><span class="stat-mark"></span><span class="stat-label">Rules</span></div><span class="stat-val" id="stat-total-rules">0</span></div>
      <div class="stat"><div class="stat-top"><span class="stat-mark"></span><span class="stat-label">Total Burns</span></div><span class="stat-val" id="stat-total-burns">0</span></div>
      <div class="stat"><div class="stat-top"><span class="stat-mark"></span><span class="stat-label">Tokens / Recall</span></div><span class="stat-val" id="stat-avg-tokens">0</span></div>
      <div class="stat"><div class="stat-top"><span class="stat-mark"></span><span class="stat-label">Top Tag</span></div><span class="stat-val" id="stat-top-tag">-</span></div>
    </div>

    <div class="panels-grid">
      <div class="panel frame" id="tour-capture">
        <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
        <div class="panel-head"><span class="eyebrow">capture</span><div class="section-title">Teach it a standard</div></div>
        <div class="form-group">
          <label for="capture-mistake">Correction</label>
          <input type="text" id="capture-mistake" placeholder="inline styles &rarr; use design tokens">
        </div>
        <div class="form-group">
          <label for="capture-tag">Tag</label>
          <select id="capture-tag">
            <option value="">auto-detect</option>
            <option value="UI">UI</option><option value="COPY">COPY</option>
            <option value="CODE">CODE</option><option value="COMMIT">COMMIT</option>
            <option value="SEC">SEC</option><option value="REQ">REQ</option><option value="PERF">PERF</option>
          </select>
        </div>
        <button class="btn-action" id="btn-capture">Capture to memory</button>
      </div>

      <div class="panel frame" id="tour-recall">
        <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
        <div class="panel-head"><span class="eyebrow">recall</span><div class="section-title">See what your agent gets</div></div>
        <div class="form-group">
          <label for="recall-context">Task context</label>
          <input type="text" id="recall-context" placeholder="building a button component in react">
        </div>
        <div class="form-group">
          <label>Injected rules</label>
          <div class="preview-box" id="preview-output"><div class="preview-placeholder">Enter a task to dry-run recall</div></div>
        </div>
        <button class="btn-action" id="btn-recall">Run recall</button>
      </div>
    </div>

    <div class="panel frame" id="tour-provider" style="margin-bottom:24px;">
      <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
      <div class="panel-head">
        <span class="eyebrow">provider &middot; BYOK</span>
        <div class="section-title">Bring your own model key</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="provider-select">Provider</label>
          <select id="provider-select">
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="bai">b.ai</option>
          </select>
        </div>
        <div class="form-group">
          <label for="provider-model">Model</label>
          <input type="text" id="provider-model" placeholder="model id">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="provider-key">API key</label>
          <input type="password" id="provider-key" placeholder="sk-…">
        </div>
        <div class="form-group">
          <label for="provider-url">Base URL</label>
          <input type="text" id="provider-url" placeholder="default">
        </div>
      </div>
      <button class="btn-action" id="btn-save-provider">Save to .env</button>
      <p class="hint">Written only to your gitignored .env, never logged, never leaves the machine. Restart the MCP server / editor to apply.</p>
    </div>

    <div class="rules-section frame" id="tour-rules">
      <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
      <div class="rules-header">
        <div><span class="eyebrow">taste pack</span><div class="section-title">Active standards</div></div>
        <div class="tag-filters" id="tag-filters">
          <button class="filter-badge active" data-tag="all">All</button>
          <button class="filter-badge" data-tag="UI">UI</button>
          <button class="filter-badge" data-tag="COPY">COPY</button>
          <button class="filter-badge" data-tag="CODE">CODE</button>
          <button class="filter-badge" data-tag="COMMIT">COMMIT</button>
          <button class="filter-badge" data-tag="SEC">SEC</button>
          <button class="filter-badge" data-tag="REQ">REQ</button>
          <button class="filter-badge" data-tag="PERF">PERF</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr>
            <th id="th-tag" style="width:90px;">Tag</th>
            <th id="th-antipattern">Anti-pattern</th>
            <th id="th-fix">Fix</th>
            <th id="th-burns" style="width:72px; text-align:center;">Burns</th>
            <th style="width:40px;"></th>
          </tr></thead>
          <tbody id="rules-tbody"></tbody>
        </table>
        <div class="empty-state" id="empty-state" style="display:none;">No rules yet. Capture one, or run <b>remindy seed</b>.</div>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script src="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js"></script>
  <script>
    var PROVIDERS = {
      ollama:    { model: 'qwen2.5-coder:3b', url: 'http://localhost:11434', keyPh: 'not required for local', needsKey: false },
      openai:    { model: 'gpt-5.6-luna', url: 'https://api.openai.com/v1', keyPh: 'sk-…', needsKey: true },
      anthropic: { model: 'claude-haiku-4-5', url: 'https://api.anthropic.com/v1/', keyPh: 'sk-ant-…', needsKey: true },
      bai:       { model: 'claude-sonnet-5', url: 'https://api.b.ai/v1', keyPh: 'your b.ai key', needsKey: true }
    };
    var state = { rules: [], filter: 'all', sortBy: 'burns', sortOrder: 'desc' };
    var el = function (id) { return document.getElementById(id); };

    function toast(msg) {
      var c = el('toast-container');
      var t = document.createElement('div');
      t.className = 'toast'; t.textContent = msg;
      c.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 2600);
    }

    // Twinkling square margin fields
    function fillField(elm) {
      if (!elm) return;
      var rows = Math.ceil(window.innerHeight / 24) + 1;
      var cols = Math.max(1, Math.ceil((elm.offsetWidth || 340) / 24));
      var n = rows * cols, html = '';
      for (var i = 0; i < n; i++) {
        var glow = Math.random() < 0.06;
        var dur = (2.5 + Math.random() * 3).toFixed(2);
        var dl = (Math.random() * 3.5).toFixed(2);
        html += '<div class="cell"><div class="sq' + (glow ? ' glow' : '') + '" style="--dur:' + dur + 's;--dl:' + dl + 's"></div></div>';
      }
      elm.innerHTML = html;
    }
    fillField(el('field-left')); fillField(el('field-right'));

    async function loadData() {
      try {
        var r = await fetch('/api/rules').then(function (x) { return x.json(); });
        var s = await fetch('/api/stats').then(function (x) { return x.json(); });
        state.rules = Array.isArray(r) ? r : [];
        el('stat-total-rules').textContent = s.totalRules || 0;
        el('stat-total-burns').textContent = s.totalBurns || 0;
        el('stat-avg-tokens').textContent = s.avgTokensPerRecall || 0;
        el('stat-top-tag').textContent = s.topTag || '-';
        renderRules();
      } catch (e) { toast('Error loading rules'); }
    }

    async function loadBackend() {
      try {
        var b = await fetch('/api/health').then(function (x) { return x.json(); });
        var badge = el('backend-badge');
        badge.textContent = b.supermemoryActive ? 'Supermemory Local' : 'in-memory (not shared)';
        badge.classList.add(b.supermemoryActive ? 'ok' : 'warn');
        badge.title = b.store;
      } catch (e) { el('backend-badge').textContent = 'backend unknown'; }
    }

    function applyProviderHints(preserve) {
      var p = el('provider-select').value;
      var meta = PROVIDERS[p] || PROVIDERS.ollama;
      el('provider-model').placeholder = meta.model;
      el('provider-url').placeholder = meta.url;
      el('provider-key').placeholder = meta.keyPh;
      el('provider-key').disabled = !meta.needsKey;
      if (!preserve) {
        // On a manual provider switch, suggest that provider's defaults.
        el('provider-model').value = meta.model;
        el('provider-url').value = '';
        el('provider-key').value = '';
      }
    }

    async function loadConfig() {
      try {
        var c = await fetch('/api/config').then(function (x) { return x.json(); });
        el('provider-select').value = c.provider || 'ollama';
        applyProviderHints(true);
        if (c.model) el('provider-model').value = c.model;
        if (c.baseURL) el('provider-url').value = c.baseURL;
      } catch (e) { toast('Could not load provider config'); }
    }
    el('provider-select').addEventListener('change', function () { applyProviderHints(false); });

    function renderRules() {
      var list = state.rules.slice();
      if (state.filter !== 'all') list = list.filter(function (r) { return r.tag === state.filter; });
      list.sort(function (a, b) {
        var va = a[state.sortBy], vb = b[state.sortBy];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return state.sortOrder === 'asc' ? -1 : 1;
        if (va > vb) return state.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      var tb = el('rules-tbody');
      tb.innerHTML = '';
      if (list.length === 0) { el('empty-state').style.display = 'block'; return; }
      el('empty-state').style.display = 'none';
      list.forEach(function (rule) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        var chip = document.createElement('span');
        chip.className = 'tag-badge'; chip.style.background = 'var(--tag-' + rule.tag + ')'; chip.textContent = rule.tag;
        td1.appendChild(chip);
        var td2 = document.createElement('td'); td2.className = 'editable'; td2.textContent = rule.antiPattern;
        td2.addEventListener('click', function () { editCell(rule.id, 'antiPattern', td2); });
        var td3 = document.createElement('td'); td3.className = 'editable'; td3.textContent = rule.fix;
        td3.addEventListener('click', function () { editCell(rule.id, 'fix', td3); });
        var td4 = document.createElement('td'); td4.style.textAlign = 'center'; td4.className = 'burn';
        td4.textContent = '\\u00d7' + rule.burns;
        var td5 = document.createElement('td'); td5.style.textAlign = 'right';
        var del = document.createElement('button'); del.className = 'btn-delete'; del.innerHTML = '\\u2715'; del.title = 'Delete';
        del.addEventListener('click', function () { deleteRule(rule.id); });
        td5.appendChild(del);
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);
        tb.appendChild(tr);
      });
    }

    function editCell(id, field, cell) {
      if (cell.querySelector('input')) return;
      var original = cell.textContent;
      var input = document.createElement('input');
      input.className = 'cell-editor'; input.value = original;
      cell.innerHTML = ''; cell.appendChild(input); input.focus();
      async function save() {
        var val = input.value.trim();
        if (!val || val === original) { cell.textContent = original; return; }
        var rule = state.rules.find(function (r) { return r.id === id; });
        if (!rule) return;
        var body = { tag: rule.tag, antiPattern: rule.antiPattern, fix: rule.fix };
        body[field] = val;
        try {
          var res = await fetch('/api/rules/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (res.ok) { toast('Rule updated'); loadData(); } else { toast('Save failed'); cell.textContent = original; }
        } catch (e) { toast('Network error'); cell.textContent = original; }
      }
      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') cell.textContent = original; });
    }

    async function deleteRule(id) {
      if (!confirm('Delete this rule?')) return;
      try {
        var res = await fetch('/api/rules/' + id, { method: 'DELETE' });
        if (res.ok) { toast('Rule deleted'); loadData(); } else { toast('Delete failed'); }
      } catch (e) { toast('Network error'); }
    }

    el('btn-capture').addEventListener('click', async function () {
      var mistake = el('capture-mistake').value.trim();
      var tag = el('capture-tag').value;
      if (!mistake) { toast('Enter a correction'); return; }
      this.disabled = true;
      try {
        var res = await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mistake: mistake, tag: tag || undefined }) });
        if (res.ok) { toast('Captured'); el('capture-mistake').value = ''; loadData(); } else { toast('Capture failed'); }
      } catch (e) { toast('Server down'); } finally { this.disabled = false; }
    });

    el('btn-recall').addEventListener('click', async function () {
      var ctx = el('recall-context').value.trim();
      if (!ctx) { toast('Enter a task context'); return; }
      this.disabled = true;
      el('preview-output').innerHTML = '<div class="preview-placeholder">Recalling&hellip;</div>';
      try {
        var res = await fetch('/api/recall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_context: ctx }) });
        var data = await res.json();
        var box = el('preview-output'); box.innerHTML = '';
        if (!data.rules || data.rules.length === 0) { box.innerHTML = '<div class="preview-placeholder">No matching rules. Memory is clean.</div>'; return; }
        data.rules.forEach(function (r) { var d = document.createElement('div'); d.className = 'preview-rule'; d.textContent = r; box.appendChild(d); });
        var bar = document.createElement('div'); bar.className = 'preview-stats';
        bar.innerHTML = '<span>' + data.rules.length + ' rules</span><span>~' + data.tokens + ' tokens injected</span>';
        box.appendChild(bar);
      } catch (e) { toast('Recall failed'); } finally { this.disabled = false; }
    });

    el('btn-save-provider').addEventListener('click', async function () {
      var provider = el('provider-select').value;
      var body = { provider: provider, model: el('provider-model').value.trim() || undefined, url: el('provider-url').value.trim() || undefined };
      var key = el('provider-key').value.trim();
      if (key) body.key = key;
      this.disabled = true;
      try {
        var res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { toast('Saved to .env \\u00b7 restart to apply'); el('provider-key').value = ''; loadConfig(); }
        else { var e = await res.json(); toast(e.error || 'Save failed'); }
      } catch (e) { toast('Network error'); } finally { this.disabled = false; }
    });

    function setSort(col) {
      if (state.sortBy === col) state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      else { state.sortBy = col; state.sortOrder = 'desc'; }
      renderRules();
    }
    el('th-tag').addEventListener('click', function () { setSort('tag'); });
    el('th-antipattern').addEventListener('click', function () { setSort('antiPattern'); });
    el('th-fix').addEventListener('click', function () { setSort('fix'); });
    el('th-burns').addEventListener('click', function () { setSort('burns'); });

    el('tag-filters').addEventListener('click', function (e) {
      var b = e.target.closest('.filter-badge');
      if (!b) return;
      document.querySelectorAll('.filter-badge').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      state.filter = b.getAttribute('data-tag');
      renderRules();
    });

    function startTour() {
      if (!window.driver || !window.driver.js) { toast('Tour unavailable offline'); return; }
      var d = window.driver.js.driver({
        showProgress: true,
        steps: [
          { element: '#tour-header', popover: { title: 'remindy', description: 'Your local standards memory.' } },
          { element: '#backend-badge', popover: { title: 'Backend', description: 'Green means shared and persistent.' } },
          { element: '#tour-stats', popover: { title: 'At a glance', description: 'Rules, corrections, token cost.' } },
          { element: '#tour-capture', popover: { title: 'Capture', description: 'Save one correction as a reusable rule.' } },
          { element: '#tour-recall', popover: { title: 'Recall', description: 'Preview rules sent before code is written.' } },
          { element: '#tour-provider', popover: { title: 'BYOK', description: 'Use OpenAI, Claude, b.ai, or Ollama. Saved in .env.' } },
          { element: '#tour-rules', popover: { title: 'Taste pack', description: 'Edit rules. Higher burns rank first.' } }
        ]
      });
      d.drive();
    }
    el('btn-tour').addEventListener('click', startTour);

    loadData();
    loadBackend();
    loadConfig();
  </script>
</body>
</html>
`;
}
