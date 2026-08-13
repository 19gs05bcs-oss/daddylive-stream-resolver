import { DLHD_BASE } from "../config.js";
import { fetchHtml } from "../http.js";
import { parseChannelList } from "./parse.js";
import type { Channel } from "./types.js";

let listCache: { at: number; channels: Channel[] } | null = null;
const LIST_TTL_MS = 5 * 60 * 1000;

export async function fetchChannelList(): Promise<Channel[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) {
    return listCache.channels;
  }
  const html = await fetchHtml(DLHD_BASE, DLHD_BASE);
  const channels = parseChannelList(html);
  listCache = { at: Date.now(), channels };
  return channels;
}

export async function fetchChannelInfo(channelId: number): Promise<Channel> {
  const channels = await fetchChannelList();
  return channels.find((channel) => channel.id === channelId) ?? { id: channelId, name: `Channel ${channelId}` };
}
