import test from "node:test";
import assert from "node:assert/strict";
import {
  getAppleSong,
  mapAppleLookupResult,
  parseApplePlaylistSongUrl,
} from "../lib/apple.js";
import { parseYouTubeFeed } from "../lib/youtube.js";

const videoId = "abcdefghijk";

test("parses the last YouTube playlist entry and decodes title entities", () => {
  const xml = `<feed>
    <entry><yt:videoId>zzzzzzzzzzz</yt:videoId><title>Published more recently</title><published>2026-11-09T12:00:00Z</published></entry>
    <entry><yt:videoId>${videoId}</yt:videoId><title><![CDATA[Rock &amp; Roll]]> &lt;Live&gt; &quot;Now&quot; &apos;!</title>
      <author><name>Channel &#x26; Co &#38; Friends</name></author><published>2026-11-03T23:30:00-05:00</published></entry>
  </feed>`;
  const item = parseYouTubeFeed(xml, "PL_test");
  assert.equal(item.id, videoId);
  assert.equal(item.title, "Rock & Roll <Live> \"Now\" '!");
  assert.equal(item.channel, "Channel & Co & Friends");
  assert.equal(item.added, "Nov 4, 2026");
  assert.equal(item.playlistUrl, "https://www.youtube.com/playlist?list=PL_test");
});

test("returns null for an empty feed and an invalid first video ID", () => {
  assert.equal(parseYouTubeFeed("<feed></feed>", "playlist"), null);
  assert.equal(parseYouTubeFeed("<entry><yt:videoId>short</yt:videoId></entry>", "playlist"), null);
});

test("selects the last valid trackLockup item and ignores other sections", () => {
  const html = `<script id="serialized-server-data" type="application/json">${JSON.stringify([
    { data: { sections: [
      { itemKind: "artistLockup", items: [{ contentDescriptor: { url: "https://music.apple.com/us/song/no/1" } }] },
      { itemKind: "trackLockup", items: [
        { contentDescriptor: { url: "https://music.apple.com/us/song/first-track/111" } },
        { contentDescriptor: { url: "https://music.apple.com/us/song/last-track/222" } },
      ] },
    ] } },
  ])}</script>`;
  assert.equal(parseApplePlaylistSongUrl(html), "https://music.apple.com/us/song/last-track/222");
});

test("falls back from serialized data to schema JSON and then meta tags", () => {
  const schema = `<script id="serialized-server-data">not json</script>
    <script id="schema:music-playlist">${JSON.stringify({ track: [
      { url: "https://music.apple.com/us/song/old/10" },
      { url: "https://music.apple.com/us/song/schema-last/20" },
    ] })}</script>`;
  assert.equal(parseApplePlaylistSongUrl(schema), "https://music.apple.com/us/song/schema-last/20");

  const meta = `<script id="schema:music-playlist">{bad json</script>
    <meta property="music:song" content="https://music.apple.com/us/song/first/30">
    <meta content="https://music.apple.com/us/song/meta-last/40" property="music:song">`;
  assert.equal(parseApplePlaylistSongUrl(meta), "https://music.apple.com/us/song/meta-last/40");
});

test("maps iTunes metadata and expands artwork size", () => {
  const song = mapAppleLookupResult({
    trackName: "Rooster",
    artistName: "Alice in Chains",
    collectionName: "Dirt",
    artworkUrl100: "https://example.test/100x100bb.jpg",
    previewUrl: "https://example.test/preview.m4a",
  }, "https://music.apple.com/us/song/rooster/123");
  assert.deepEqual(song, {
    title: "Rooster",
    artist: "Alice in Chains",
    album: "Dirt",
    artwork: "https://example.test/800x800bb.jpg",
    preview: "https://example.test/preview.m4a",
    url: "https://music.apple.com/us/song/rooster/123",
  });
});

test("uses the URL slug when the iTunes lookup has no result", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === "https://playlist.example/" ) {
      return { ok: true, text: async () => '<meta property="music:song" content="https://music.apple.com/us/song/rooster/123">' };
    }
    return { ok: true, json: async () => ({ results: [] }) };
  };
  const song = await getAppleSong({ playlistUrl: "https://playlist.example/", fetchImpl });
  assert.deepEqual(song, {
    title: "Rooster",
    artist: null,
    album: null,
    artwork: null,
    preview: null,
    url: "https://music.apple.com/us/song/rooster/123",
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.ok(call.options.signal);
    assert.match(call.options.headers["User-Agent"], /Mozilla/);
  }
});