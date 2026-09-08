export function buildProxyUrl(targetUrl: string, referer: string, origin: string): string {
  const p = new URL("/api/proxy", origin);
  p.searchParams.set("url", targetUrl);
  p.searchParams.set("referer", referer);
  return `${p.toString()}&dummy=.ts`;
}
