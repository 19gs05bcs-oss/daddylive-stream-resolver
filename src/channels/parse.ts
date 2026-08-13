import type { Channel } from "./types.js";

const LIST_ITEM_RE = /watch\.php\?id=(\d+)"[^>]*title="([^"]+)"/g;

export function parseChannelList(html: string): Channel[] {
  const seen = new Set<number>();
  const channels: Channel[] = [];
  for (const match of html.matchAll(LIST_ITEM_RE)) {
    const id = Number(match[1]);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    channels.push({ id, name: match[2].trim() });
  }
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}
