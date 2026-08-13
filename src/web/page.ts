import { DLHD_BASE } from "../config.js";
import { PLAYERS } from "../players/types.js";

const SITE_TITLE = "DLHD Stream Resolver";
const SITE_DESC =
  "Resolve DaddyLive (DLHD) streams to direct URLs, proxy with embed referer, play in-browser, and copy VLC or MPV commands.";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPage(): string {
  const config = JSON.stringify({ players: PLAYERS }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(SITE_DESC)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(SITE_TITLE)}">
<meta property="og:description" content="${esc(SITE_DESC)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(SITE_TITLE)}">
<meta name="twitter:description" content="${esc(SITE_DESC)}">
<title>${esc(SITE_TITLE)}</title>
<link rel="stylesheet" href="/style.css">
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
</head>
<body>
<main class="app">
<header class="top">
<h1 class="top__title">${esc(SITE_TITLE)}</h1>
<p class="top__desc">Search by channel name or enter an ID from <a href="${esc(DLHD_BASE)}/" target="_blank" rel="noopener noreferrer">DaddyLive</a>. All seven players resolve in site order with per-player timing.</p>
</header>

<section class="card" aria-labelledby="resolve-heading">
<h2 id="resolve-heading" class="visually-hidden">Resolve channel</h2>
<form id="watch-form">
<div class="resolve__row resolve__row--form">
<label class="resolve__field resolve__field--grow">
<span class="resolve__label">Channel</span>
<input id="channel" type="text" list="channel-list" inputmode="numeric" autocomplete="off" value="44" required aria-describedby="resolve-hint">
<datalist id="channel-list"></datalist>
</label>
<button type="button" id="resolve-btn">Resolve</button>
</div>
<p id="resolve-hint" class="resolve__hint">PLAYER 1–7 match the DLHD watch page. Click a badge to switch stream or copy export links below.</p>
</form>
<p id="error" class="msg--err" hidden role="alert"></p>
</section>

<section id="result" class="stack" hidden aria-live="polite">
<article class="card">
<h2 id="stream-title" class="stream-title">Stream</h2>
<div class="player">
<video id="video" controls playsinline></video>
</div>
</article>

<article class="card" id="servers-card" hidden>
<h2 class="section-title">Players</h2>
<div id="servers" class="servers" role="group" aria-label="Available players"></div>
</article>

<article class="card">
<h2 class="section-title">Export</h2>
<ul class="exports">
<li>
<div class="export__meta">
<span class="export__name">Direct URL</span>
<span class="export__hint">Upstream stream URL from embed page</span>
</div>
<div class="export__row">
<input id="direct" readonly aria-label="Direct stream URL">
<button type="button" data-copy="direct">Copy</button>
</div>
</li>
<li>
<div class="export__meta">
<span class="export__name">Proxied URL</span>
<span class="export__hint">Through this server with embed referer headers</span>
</div>
<div class="export__row">
<input id="proxy" readonly aria-label="Proxied stream URL">
<button type="button" data-copy="proxy">Copy</button>
</div>
</li>
<li>
<div class="export__meta">
<span class="export__name">VLC</span>
<span class="export__hint">Direct URL with embed --http-referrer</span>
</div>
<div class="export__row">
<input id="vlc" readonly aria-label="VLC command">
<button type="button" data-copy="vlc">Copy</button>
</div>
</li>
<li>
<div class="export__meta">
<span class="export__name">MPV</span>
<span class="export__hint">Direct URL with embed --referrer</span>
</div>
<div class="export__row">
<input id="mpv" readonly aria-label="MPV command">
<button type="button" data-copy="mpv">Copy</button>
</div>
</li>
</ul>
</article>
</section>
</main>
<script type="application/json" id="app-config">${config}</script>
<script type="module" src="/app.js"></script>
</body>
</html>`;
}
