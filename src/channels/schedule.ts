const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/mattiapergola/RobaFiga/main/daddyliveSchedule.json";

let scheduleCache: { at: number; data: unknown } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika cache

export async function fetchSchedule(): Promise<unknown> {
  if (scheduleCache && Date.now() - scheduleCache.at < CACHE_TTL_MS) {
    return scheduleCache.data;
  }

  const res = await fetch(GITHUB_RAW_URL, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Schedule çekilemedi: HTTP ${res.status}`);
  }

  const data = await res.json();
  scheduleCache = { at: Date.now(), data };
  return data;
}
