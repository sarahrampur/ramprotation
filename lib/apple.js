export const DEFAULT_APPLE_PLAYLIST_URL = "https://music.apple.com/us/playlist/song-of-the-day/pl.u-BNA6ePVu1VmLWKZ";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SONG_URL_PATTERN = /https:\/\/music\.apple\.com\/[a-z]{2}\/song\/[^/"'?\s]+\/\d+/;

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function scriptContents(html, id) {
  const pattern = new RegExp(`<script\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/script\\s*>`, "i");
  return html.match(pattern)?.[1] ?? null;
}

function collectSections(value, sections = []) {
  if (!value || typeof value !== "object") return sections;
  if (Array.isArray(value)) {
    for (const child of value) collectSections(child, sections);
    return sections;
  }
  if (Array.isArray(value.sections)) sections.push(...value.sections);
  for (const child of Object.values(value)) collectSections(child, sections);
  return sections;
}

function urlFromCandidate(value) {
  return typeof value === "string" ? value.match(SONG_URL_PATTERN)?.[0] ?? null : null;
}

function serializedTrackUrl(json) {
  try {
    const data = JSON.parse(json);
    const sections = collectSections(data);
    for (const section of sections) {
      if (section?.itemKind !== "trackLockup" || !Array.isArray(section.items)) continue;
      for (let index = section.items.length - 1; index >= 0; index -= 1) {
        const url = urlFromCandidate(section.items[index]?.contentDescriptor?.url);
        if (url) return url;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function schemaTrackUrl(json) {
  try {
    const data = JSON.parse(json);
    const tracks = Array.isArray(data.track) ? data.track : [];
    for (let index = tracks.length - 1; index >= 0; index -= 1) {
      const url = urlFromCandidate(tracks[index]?.url);
      if (url) return url;
    }
  } catch {
    return null;
  }
  return null;
}

function metaTrackUrl(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const tag = tags[index];
    const property = tag.match(/\bproperty=["']([^"']+)["']/i)?.[1];
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (property === "music:song") {
      const url = urlFromCandidate(decodeHtml(content ?? ""));
      if (url) return url;
    }
  }
  return null;
}

export function parseApplePlaylistSongUrl(html) {
  const serialized = scriptContents(html, "serialized-server-data");
  if (serialized) {
    const url = serializedTrackUrl(serialized);
    if (url) return url;
  }

  const schema = scriptContents(html, "schema:music-playlist");
  if (schema) {
    const url = schemaTrackUrl(schema);
    if (url) return url;
  }

  return metaTrackUrl(html);
}

function songIdFromUrl(url) {
  return url.match(/\/(\d+)$/)?.[1] ?? null;
}

function titleFromSlug(url) {
  const slug = url.match(/\/song\/([^/]+)\/\d+$/)?.[1] ?? "Unknown song";
  return decodeURIComponent(slug.replace(/-/g, " "))
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function mapAppleLookupResult(result, url) {
  return {
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    artwork: result.artworkUrl100?.replace("100x100bb", "800x800bb") ?? null,
    preview: result.previewUrl ?? null,
    url,
  };
}

async function fetchWithBrowserHeaders(fetchImpl, url) {
  return fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
}

export async function getAppleSong({
  playlistUrl = process.env.APPLE_PLAYLIST_URL || DEFAULT_APPLE_PLAYLIST_URL,
  fetchImpl = fetch,
} = {}) {
  const page = await fetchWithBrowserHeaders(fetchImpl, playlistUrl);
  if (!page.ok) throw new Error(`Apple Music page returned ${page.status}`);
  const songUrl = parseApplePlaylistSongUrl(await page.text());
  if (!songUrl) return null;

  const songId = songIdFromUrl(songUrl);
  try {
    const lookup = await fetchWithBrowserHeaders(
      fetchImpl,
      `https://itunes.apple.com/lookup?id=${songId}&entity=song`,
    );
    if (!lookup.ok) throw new Error(`iTunes lookup returned ${lookup.status}`);
    const data = await lookup.json();
    const result = data.results?.[0];
    if (result) return mapAppleLookupResult(result, songUrl);
  } catch {
    // Keep the song link usable even when the optional metadata lookup fails.
  }

  return {
    title: titleFromSlug(songUrl),
    artist: null,
    album: null,
    artwork: null,
    preview: null,
    url: songUrl,
  };
}