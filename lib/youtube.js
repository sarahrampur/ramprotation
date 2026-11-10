export const DEFAULT_YOUTUBE_PLAYLIST_ID = "PLKcPCbW_zBkU";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function tagText(source, tag) {
  const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

export function parseYouTubeFeed(xml, playlistId) {
  const entries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
  let newest = null;
  let fallback = null;
  for (const [entry] of entries) {
    const id = tagText(entry, "yt:videoId");
    if (!/^[\w-]{11}$/.test(id)) continue;

    const title = tagText(entry, "title");
    const author = entry.match(/<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/i)?.[1] ?? "";
    const published = tagText(entry, "published");
    const date = new Date(published);
    const timestamp = date.getTime();
    const added = Number.isNaN(timestamp)
      ? ""
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });

    const item = {
      id,
      title,
      channel: tagText(author, "name"),
      added,
      url: `https://www.youtube.com/watch?v=${id}`,
      playlistUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    };
    fallback = item;
    if (!Number.isNaN(timestamp) && (!newest || timestamp > newest.timestamp)) {
      newest = { timestamp, item };
    }
  }
  return newest?.item ?? fallback;
}

export async function getYouTubeVideo({
  playlistId = process.env.YOUTUBE_PLAYLIST_ID || DEFAULT_YOUTUBE_PLAYLIST_ID,
  fetchImpl = fetch,
} = {}) {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`);
  return parseYouTubeFeed(await response.text(), playlistId);
}