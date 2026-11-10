export const DEFAULT_YOUTUBE_PLAYLIST_ID = "PL4fGSI1pDJn6c4mZ3EJ7H8vK9L0aBcDeF";

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
  const entry = xml.match(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) return null;

  const id = tagText(entry, "yt:videoId");
  if (!/^[\w-]{11}$/.test(id)) return null;

  const title = tagText(entry, "title");
  const author = entry.match(/<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/i)?.[1] ?? "";
  const published = tagText(entry, "published");
  const date = new Date(published);
  const added = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });

  return {
    id,
    title,
    channel: tagText(author, "name"),
    added,
    url: `https://www.youtube.com/watch?v=${id}`,
    playlistUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
  };
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