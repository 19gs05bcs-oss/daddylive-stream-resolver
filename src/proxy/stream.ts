import { proxyHeaders } from "../http.js";
import { buildProxyUrl } from "./links.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export type ProxyResult = {
  status: number;
  body: string | Buffer;
  type: string;
  headers?: Record<string, string>;
};

async function fetchUpstream(url: string, referer: string) {
  const res = await fetch(url, { headers: proxyHeaders(referer), redirect: "follow" });
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    body: Buffer.from(await res.arrayBuffer()),
  };
}

function isPlaylist(body: Buffer, targetUrl: string): boolean {
  if (targetUrl.includes(".pdf") || targetUrl.includes(".zst")) {
    return false;
  }
  const head = body.subarray(0, Math.min(body.length, 256)).toString("utf8");
  return head.includes("#EXTM3U") || targetUrl.includes(".m3u8");
}

function proxiedLine(path: string, baseDir: string, referer: string, origin: string): string {
  return buildProxyUrl(new URL(path, baseDir).href, referer, origin);
}

function rewritePlaylist(playlist: string, playlistUrl: URL, referer: string, origin: string): string {
  const baseDir = playlistUrl.href.slice(0, playlistUrl.href.lastIndexOf("/") + 1);
  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) =>
          `URI="${proxiedLine(uri, baseDir, referer, origin)}"`,
        );
      }
      return proxiedLine(trimmed, baseDir, referer, origin);
    })
    .join("\n");
}

export async function proxyStream(query: URLSearchParams, origin: string): Promise<ProxyResult> {
  const target = query.get("url");
  const referer = query.get("referer");
  if (!target || !referer) {
    return { status: 400, body: "url and referer required", type: "text/plain", headers: CORS };
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(target);
  } catch {
    return { status: 400, body: "invalid url", type: "text/plain", headers: CORS };
  }

  if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
    return { status: 400, body: "unsupported protocol", type: "text/plain", headers: CORS };
  }

  try {
    const upstream = await fetchUpstream(target, referer);

    if (upstream.status >= 400) {
      return {
        status: upstream.status,
        body: upstream.body.toString("utf8") || `Upstream error ${upstream.status}`,
        type: "text/plain",
        headers: CORS,
      };
    }

    // Playlist dosyaları
    if (isPlaylist(upstream.body, target)) {
      const text = upstream.body.toString("utf8");
      const body = text.startsWith("#EXTM3U")
        ? rewritePlaylist(text, upstreamUrl, referer, origin)
        : text;
      return {
        status: 200,
        body,
        type: "application/vnd.apple.mpegurl",
        headers: { ...CORS, "Cache-Control": "no-cache" },
      };
    }

    // Video Segmentleri (.pdf, .zst veya .ts):
    // Tarayıcı Hls.js demuxer'ının segmenti kabul etmesi için video/mp2t şarttır
    return {
      status: 200,
      body: upstream.body,
      type: "video/mp2t",
      headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
    };
  } catch (err) {
    return {
      status: 502,
      body: err instanceof Error ? err.message : "proxy failed",
      type: "text/plain",
      headers: CORS,
    };
  }
}
