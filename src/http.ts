export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function htmlHeaders(referer: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Referer: referer,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

export function proxyHeaders(referer: string): Record<string, string> {
  let origin = "";
  try {
    origin = new URL(referer).origin;
  } catch {
    origin = referer;
  }

  return {
    "User-Agent": UA,
    Referer: referer,
    Origin: origin,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    Connection: "keep-alive",
  };
}

export async function fetchHtml(url: string, referer: string): Promise<string> {
  const res = await fetch(url, { headers: htmlHeaders(referer) });
  if (!res.ok) {
    throw new Error(`fetch failed (HTTP ${res.status}): ${url}`);
  }
  return res.text();
}
