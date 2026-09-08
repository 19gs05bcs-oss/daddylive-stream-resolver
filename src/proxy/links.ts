export function buildProxyUrl(targetUrl: string, referer: string, origin: string): string {
  // HTTPS sayfada Mixed Content yememek için origin'i daima https yap
  const secureOrigin = origin.replace(/^http:\/\//i, "https://");
  const p = new URL("/api/proxy", secureOrigin);
  p.searchParams.set("url", targetUrl);
  p.searchParams.set("referer", referer);

  // Eğer url m3u8 içermiyorsa (yani segment ise) ffplay için sahte uzantı ekle
  if (!targetUrl.toLowerCase().includes(".m3u8")) {
    return `${p.toString()}&ext=.ts`;
  }
  return p.toString();
}

export function buildVlcCommand(url: string, referer: string): string {
  return `vlc --http-referrer '${referer}' '${url}'`;
}

export function buildMpvCommand(url: string, referer: string, title?: string): string {
  const titleArg = title ? ` --force-media-title='${title.replace(/'/g, "'\\''")}'` : "";
  return `mpv${titleArg} --referrer='${referer}' '${url}'`;
}
