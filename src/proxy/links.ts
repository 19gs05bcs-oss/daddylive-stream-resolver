export function buildProxyUrl(targetUrl: string, referer: string, origin: string): string {
  const p = new URL("/api/proxy", origin);
  p.searchParams.set("url", targetUrl);
  p.searchParams.set("referer", referer);
  return `${p.toString()}&ext=.ts`;
}

export function buildVlcCommand(url: string, referer: string): string {
  return `vlc --http-referrer '${referer}' '${url}'`;
}

export function buildMpvCommand(url: string, referer: string, title?: string): string {
  const titleArg = title ? ` --force-media-title='${title.replace(/'/g, "'\\''")}'` : "";
  return `mpv${titleArg} --referrer='${referer}' '${url}'`;
}
