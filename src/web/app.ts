type Channel = { id: number; name: string };

type ServerKind =
  | "stream"
  | "cast"
  | "watch"
  | "plus"
  | "casting"
  | "player"
  | "hub";

type ServerExport = {
  server: ServerKind;
  label: string;
  title: string;
  direct: string;
  proxied: string;
  vlc: string;
  mpv: string;
  isHls: boolean;
  ms: number;
  duplicateOf?: ServerKind;
  duplicateLabel?: string;
};

type ServerFail = {
  server: ServerKind;
  label: string;
  error: string;
  ms: number;
};

type ServerPending = {
  server: ServerKind;
  label: string;
  ok: false;
  pending: true;
  running: boolean;
};

type ServerEntry = (ServerExport & { ok: true }) | (ServerFail & { ok: false }) | ServerPending;

const isPending = (entry: ServerEntry): entry is ServerPending => "pending" in entry && entry.pending;

type HlsPlayer = {
  loadSource(url: string): void;
  attachMedia(el: HTMLMediaElement): void;
  on(event: string, cb: (...args: unknown[]) => void): void;
  destroy(): void;
};

type HlsGlobal = {
  isSupported(): boolean;
  Events: { MANIFEST_PARSED: string; ERROR: string };
  new (): HlsPlayer;
};

declare global {
  interface Window {
    Hls?: HlsGlobal;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

const ui = {
  form: $<HTMLFormElement>("watch-form"),
  channel: $<HTMLInputElement>("channel"),
  btn: $<HTMLButtonElement>("resolve-btn"),
  result: $("result"),
  title: $("stream-title"),
  video: $<HTMLVideoElement>("video"),
  error: $("error"),
  serversCard: $("servers-card"),
  servers: $("servers"),
  exports: {
    direct: $<HTMLInputElement>("direct"),
    proxy: $<HTMLInputElement>("proxy"),
    vlc: $<HTMLInputElement>("vlc"),
    mpv: $<HTMLInputElement>("mpv"),
  },
};

const { players: PLAYER_CONFIG } = JSON.parse(
  document.getElementById("app-config")!.textContent!,
) as { players: { id: ServerKind; label: string }[] };

const PLAYER_IDS = PLAYER_CONFIG.map((player) => player.id);
const playerLabel = (server: ServerKind) =>
  PLAYER_CONFIG.find((player) => player.id === server)?.label ?? server;

const state = {
  hls: null as HlsPlayer | null,
  gen: 0,
  live: null as EventSource | null,
  label: "",
  channels: [] as Channel[],
  servers: [] as ServerEntry[],
  active: "" as ServerKind | "",
};

const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`);

const escAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const parseChannelInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  const direct = Number(trimmed);
  if (Number.isFinite(direct) && direct >= 1) return direct;
  const match = state.channels.find((channel) => channel.name.toLowerCase() === trimmed.toLowerCase());
  return match?.id ?? null;
};

const loadChannels = async () => {
  const res = await fetch("/api/channels");
  if (!res.ok) return;
  const channels = (await res.json()) as Channel[];
  state.channels = channels;
  const list = document.getElementById("channel-list");
  if (!list) return;
  list.innerHTML = channels
    .map((channel) => `<option value="${channel.id}" label="${escAttr(channel.name)}"></option>`)
    .join("");
};

void loadChannels();

const shortError = (message: string) => (message.length <= 40 ? message : `${message.slice(0, 37)}…`);

const showError = (message: string) => {
  if (!ui.error) return;
  ui.error.textContent = message;
  ui.error.hidden = false;
};

const hideError = () => {
  if (ui.error) ui.error.hidden = true;
};

const stopPlayback = () => {
  state.gen += 1;
  state.hls?.destroy();
  state.hls = null;
  if (!ui.video) return;
  ui.video.pause();
  ui.video.removeAttribute("src");
  ui.video.load();
};

const stopLive = () => {
  state.live?.close();
  state.live = null;
};

const playStream = async (src: string, isHls: boolean) => {
  if (!ui.video) throw new Error("video missing");
  stopPlayback();
  const id = state.gen;
  const live = () => id === state.gen;
  const Hls = window.Hls;
  if (isHls && Hls?.isSupported()) {
    state.hls = new Hls();
    state.hls.loadSource(src);
    state.hls.attachMedia(ui.video);
    await new Promise<void>((resolve, reject) => {
      state.hls!.on(Hls.Events.MANIFEST_PARSED, () => resolve());
      state.hls!.on(Hls.Events.ERROR, (_, detail) => {
        const err = detail as { fatal?: boolean };
        if (err.fatal) reject(new Error("playback failed"));
      });
    });
    if (!live()) return;
    await ui.video.play();
    return;
  }
  if (isHls && ui.video.canPlayType("application/vnd.apple.mpegurl")) {
    ui.video.src = src;
    if (!live()) return;
    await ui.video.play();
    return;
  }
  ui.video.src = src;
  await new Promise<void>((resolve, reject) => {
    const video = ui.video!;
    const done = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onErr);
    };
    const onReady = () => {
      done();
      resolve();
    };
    const onErr = () => {
      done();
      reject(new Error("playback failed"));
    };
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("error", onErr);
    if (video.readyState >= 1) onReady();
  });
  if (!live()) return;
  await ui.video.play();
};

const bindExports = (entry: ServerExport) => {
  ui.exports.direct!.value = entry.direct;
  ui.exports.proxy!.value = entry.proxied;
  ui.exports.vlc!.value = entry.vlc;
  ui.exports.mpv!.value = entry.mpv;
};

const paintServers = () => {
  if (!ui.servers || !ui.serversCard) return;
  const sorted = [...state.servers].sort(
    (a, b) => PLAYER_IDS.indexOf(a.server) - PLAYER_IDS.indexOf(b.server),
  );
  ui.servers.innerHTML = sorted
    .map((entry) => {
      const name = entry.label;
      if (isPending(entry)) {
        const active = entry.running ? " badge--running" : " badge--pending";
        const ms = entry.running ? "…" : "—";
        return `<button type="button" class="badge${active}" data-server="${entry.server}" disabled><span class="badge__name">${name}</span><span class="badge__ms">${ms}</span></button>`;
      }
      const active = entry.server === state.active ? " badge--active" : "";
      const fail = entry.ok ? "" : " badge--fail";
      const ms = `<span class="badge__ms">${fmtMs(entry.ms)}</span>`;
      const dup =
        entry.ok && entry.duplicateLabel
          ? `<span class="badge__tag">↔ ${entry.duplicateLabel}</span>`
          : "";
      const tag = entry.ok ? dup : `<span class="badge__tag">${shortError(entry.error)}</span>`;
      const title = entry.ok
        ? entry.duplicateLabel
          ? ` title="same stream as ${entry.duplicateLabel}"`
          : ""
        : ` title="${entry.error.replace(/"/g, "&quot;")}"`;
      return `<button type="button" class="badge${active}${fail}" data-server="${entry.server}"${title}><span class="badge__name">${name}</span>${tag}${ms}</button>`;
    })
    .join("");
  ui.serversCard.hidden = state.servers.length === 0;
};

const setActive = (server: ServerKind) => {
  state.active = server;
  if (ui.title) ui.title.textContent = `${state.label} · ${playerLabel(server)}`;
  paintServers();
};

const selectServer = async (server: ServerKind) => {
  const entry = state.servers.find((item) => item.server === server);
  if (!entry || isPending(entry)) return;
  if (!entry.ok) {
    showError(entry.error);
    setActive(server);
    return;
  }
  hideError();
  setActive(server);
  bindExports(entry);
  try {
    await playStream(entry.proxied, entry.isHls);
  } catch {
    showError("playback failed");
  }
};

const upsertServer = (entry: ServerEntry) => {
  const idx = state.servers.findIndex((item) => item.server === entry.server);
  if (idx >= 0) state.servers[idx] = entry;
  else state.servers.push(entry);
};

const markRunning = (server: ServerKind) => {
  state.servers = state.servers.map((entry) =>
    isPending(entry) ? { ...entry, running: entry.server === server } : entry,
  );
};

const onDone = () => {
  ui.btn!.disabled = false;
  stopLive();
  if (state.active) return;
  const first = state.servers.find((entry) => entry.ok);
  if (first?.server) void selectServer(first.server);
  else if (!state.servers.some((entry) => entry.ok)) showError("no players resolved");
};

const resolveChannel = (channelId: number) => {
  ui.btn!.disabled = true;
  hideError();
  stopLive();
  stopPlayback();
  state.label = "";
  if (ui.title) ui.title.textContent = "Stream";
  state.servers = PLAYER_IDS.map((server) => ({
    server,
    label: playerLabel(server),
    ok: false as const,
    pending: true as const,
    running: false,
  }));
  state.active = "";
  ui.result!.hidden = false;
  ui.serversCard!.hidden = false;
  paintServers();

  let finished = false;
  state.live = new EventSource(`/api/resolve/live?channel=${channelId}`);
  state.live.addEventListener("channel", (ev) => {
    const data = JSON.parse(ev.data) as Channel;
    state.label = data.name;
    if (ui.title) {
      ui.title.textContent = state.active ? `${data.name} · ${playerLabel(state.active)}` : data.name;
    }
  });
  state.live.addEventListener("start", (ev) => {
    markRunning((JSON.parse(ev.data) as { server: ServerKind }).server);
    paintServers();
  });
  state.live.addEventListener("found", (ev) => {
    const data = JSON.parse(ev.data) as ServerExport;
    upsertServer({ ...data, ok: true });
    paintServers();
    if (!state.active) void selectServer(data.server);
  });
  state.live.addEventListener("fail", (ev) => {
    const data = JSON.parse(ev.data) as ServerFail;
    upsertServer({ ...data, ok: false });
    paintServers();
  });
  state.live.addEventListener("done", () => {
    finished = true;
    onDone();
  });
  state.live.onerror = () => {
    if (finished) return;
    ui.btn!.disabled = false;
    stopLive();
    showError("connection lost");
  };
};

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const id = btn.dataset.copy;
    const input = id ? $<HTMLInputElement>(id) : null;
    if (!input?.value) return;
    await navigator.clipboard.writeText(input.value);
    const label = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.add("ok");
    setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove("ok");
    }, 1200);
  });
});

ui.servers?.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-server]");
  if (!btn?.dataset.server) return;
  const entry = state.servers.find((item) => item.server === btn.dataset.server);
  if (!entry || isPending(entry)) return;
  if (btn.dataset.server === state.active) return;
  void selectServer(btn.dataset.server as ServerKind);
});

const runResolve = () => {
  const channelId = parseChannelInput(ui.channel?.value ?? "");
  if (!channelId) {
    showError("enter a valid channel ID or name");
    return;
  }
  if (ui.channel) ui.channel.value = String(channelId);
  resolveChannel(channelId);
};

ui.btn?.addEventListener("click", runResolve);
ui.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  runResolve();
});
