import { getAppleSong } from "../lib/apple.js";
import { getCurrentRead } from "../lib/current-read.js";
import { getYouTubeVideo } from "../lib/youtube.js";

async function readSource(name, load) {
  try {
    const item = await load();
    return item ? { status: "ok", item } : { status: "empty" };
  } catch (error) {
    console.error(`${name} source failed`, error);
    return { status: "error" };
  }
}

export default async function handler(request, response) {
  const forceRefresh = request.query?.refresh === "1";
  const [video, song] = await Promise.all([
    readSource("YouTube", getYouTubeVideo),
    readSource("Apple Music", getAppleSong),
  ]);
  const hasError = video.status === "error" || song.status === "error";

  response.setHeader(
    "Cache-Control",
    forceRefresh
      ? "no-store"
      : hasError
        ? "public, s-maxage=60"
        : "public, s-maxage=900, stale-while-revalidate=86400",
  );
  response.status(200).json({ video, song, currentRead: getCurrentRead() });
}
