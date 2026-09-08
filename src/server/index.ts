import { createServer, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proxyStream } from "../proxy/stream.js";
import { renderPage } from "../web/page.js";
import { handleChannelList } from "./channels.js";
import { handleResolveLive, resolveLive } from "./resolve.js";
import { fetchSchedule } from "../channels/schedule.js";
import { renderSchedulePage } from "../web/schedule-page.js";
import { PLAYER_IDS } from "../players/types.js";
import { buildProxyUrl } from "../proxy/links.js";

const PORT = Number(process.env.PORT ?? "3000");

const webRoot = [
  join(dirname(fileURLToPath(import.meta.url)), "../web"),
  join(process.cwd(), "src/web"),
].find((path) => existsSync(join(path, "style.css")))!;

const staticFiles: Record<string, [string, string]> = {
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "application/javascript; charset=utf-8"],
};

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  contentType: string,
  extra?: Record<string, string>,
) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { "Content-Type": contentType, "Content-Length": buf.byteLength, ...extra });
  res.end(buf);
}

createServer(async (req, res) => {
  try {
    if (req.method !== "GET") {
      send(res, 405, "method not allowed", "text/plain");
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // Canlı Stream Proxy
    if (url.pathname === "/api/proxy") {
      const result = await proxyStream(url.searchParams, url.origin);
      send(res, result.status, result.body, result.type, result.headers);
      return;
    }

    // SS IPTV ve Smart TV Canlı Çözüm Endpoint'i (/live/:id.m3u8)
    const liveMatch = url.pathname.match(/^\/live\/(\d+)\.m3u8$/);
    if (liveMatch) {
      const channelId = Number(liveMatch[1]);
      try {
        const session = { cache: new Map(), sourceByEmbed: new Map() };
        let activeResolved: any = null;

        // Çalışan ilk oynatıcıyı bul
        for (const server of PLAYER_IDS) {
          try {
            const { resolved } = await resolveLive(channelId, server, session);
            if (resolved && resolved.playableUrl) {
              activeResolved = resolved;
              break;
            }
          } catch {}
        }

        if (!activeResolved) {
          send(res, 404, "Kanal su anda yayinda degil", "text/plain");
          return;
        }

        // TV için taze token'lı proxied HLS adresine yönlendir
        const redirectUrl = buildProxyUrl(
          activeResolved.playableUrl,
          activeResolved.embedUrl,
          url.origin,
        );

        res.writeHead(302, {
          Location: redirectUrl,
          "Access-Control-Allow-Origin": "*",
        });
        res.end();
        return;
      } catch {
        send(res, 500, "Resolve hatasi", "text/plain");
        return;
      }
    }

    // Tüm Kanalların Listesi
    if (url.pathname === "/api/channels") {
      await handleChannelList(res);
      return;
    }

    // JSON Fikstür
    if (url.pathname === "/api/schedule") {
      const data = await fetchSchedule();
      send(res, 200, JSON.stringify(data), "application/json; charset=utf-8", {
        "Access-Control-Allow-Origin": "*",
      });
      return;
    }

    // Web Fikstür Tablosu
    if (url.pathname === "/schedule") {
      const data = await fetchSchedule();
      send(res, 200, renderSchedulePage(data), "text/html; charset=utf-8");
      return;
    }

    // Web Oynatıcı SSE
    if (url.pathname === "/api/resolve/live") {
      const channelId = Number(url.searchParams.get("channel"));
      if (!Number.isFinite(channelId) || channelId < 1) {
        send(res, 400, "channel required", "text/plain");
        return;
      }
      await handleResolveLive(res, channelId, url.origin);
      return;
    }

    const asset = staticFiles[url.pathname];
    if (asset) {
      send(res, 200, readFileSync(join(webRoot, asset[0])), asset[1]);
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      send(res, 200, renderPage(), "text/html; charset=utf-8");
      return;
    }

    send(res, 404, "not found", "text/plain");
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    send(res, 500, message, "text/plain");
  }
}).listen(PORT, () => {
  process.stdout.write(`listening on http://localhost:${PORT}\n`);
});
