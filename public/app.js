function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.href) node.href = options.href;
  return node;
}

function renderMessage(frame, text) {
  frame.replaceChildren(element("p", { className: "frame-message", text }));
}

function renderVideo(video) {
  const frame = document.querySelector("#video-frame");
  const caption = document.querySelector("#video-caption");
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`;
  iframe.title = video.title;
  iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.loading = "lazy";
  frame.replaceChildren(iframe);

  const title = element("a", { className: "primary-link", text: video.title, href: video.url });
  const channel = element("span", { className: "detail", text: video.channel });
  const added = element("span", { className: "detail" });
  added.append(document.createTextNode(`Added ${video.added}, from `));
  added.append(element("a", { text: "playlist", href: video.playlistUrl }));
  caption.replaceChildren(title, channel, added);
}

function renderSong(song) {
  const frame = document.querySelector("#song-frame");
  const caption = document.querySelector("#song-caption");
  frame.replaceChildren();
  if (song.artwork) {
    const artworkLink = element("a", { href: song.url });
    const image = document.createElement("img");
    image.src = song.artwork;
    image.alt = `${song.title} artwork`;
    image.loading = "lazy";
    artworkLink.append(image);
    frame.append(artworkLink);
  } else {
    renderMessage(frame, song.title);
  }

  if (song.preview) {
    const audio = new Audio(song.preview);
    audio.preload = "none";
    const button = element("button", { className: "play-button", text: "Play preview" });
    button.type = "button";
    const syncLabel = () => { button.textContent = audio.paused ? "Play preview" : "Pause"; };
    audio.addEventListener("play", syncLabel);
    audio.addEventListener("pause", syncLabel);
    audio.addEventListener("ended", syncLabel);
    button.addEventListener("click", () => {
      if (audio.paused) audio.play().catch(syncLabel);
      else audio.pause();
    });
    frame.append(button);
  }

  const title = element("a", { className: "primary-link", text: song.title, href: song.url });
  const details = [song.artist, song.album].filter(Boolean).join(", ");
  const playlist = element("span", { className: "detail" });
  playlist.append(document.createTextNode("From "));
  playlist.append(element("a", { text: "playlist", href: song.playlistUrl }));
  caption.replaceChildren(title, element("span", { className: "detail", text: details }), playlist);
}

function renderCurrentRead(currentRead) {
  const frame = document.querySelector("#read-frame");
  const caption = document.querySelector("#read-caption");
  if (!currentRead?.title) {
    renderMessage(frame, "No current read selected.");
    caption.replaceChildren();
    return;
  }

  if (currentRead.cover) {
    const image = document.createElement("img");
    image.src = currentRead.cover;
    image.alt = `${currentRead.title} cover`;
    image.loading = "lazy";
    image.addEventListener("error", () => renderMessage(frame, "Cover unavailable."), { once: true });
    frame.replaceChildren(image);
  } else {
    renderMessage(frame, "Cover unavailable.");
  }
  caption.replaceChildren(
    element("span", { className: "primary-link", text: currentRead.title }),
    element("span", { className: "detail", text: currentRead.author }),
  );
}

function renderFailure(source, frame, caption, status) {
  const messages = {
    video: { empty: "The YouTube playlist is empty.", error: "YouTube isn't responding right now." },
    song: { empty: "This playlist is empty.", error: "Apple Music isn't responding right now." },
  };
  renderMessage(frame, messages[source][status === "error" ? "error" : "empty"]);
  caption.replaceChildren();
}

async function loadNow(forceRefresh = false) {
  const refreshButton = document.querySelector("#refresh-button");
  if (refreshButton.disabled) return;
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";

  let data;
  try {
    const url = forceRefresh ? `/api/now?refresh=1&_=${Date.now()}` : "/api/now";
    const response = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    data = await response.json();
  } catch {
    data = { video: { status: "error" }, song: { status: "error" } };
  }

  const videoFrame = document.querySelector("#video-frame");
  const videoCaption = document.querySelector("#video-caption");
  const songFrame = document.querySelector("#song-frame");
  const songCaption = document.querySelector("#song-caption");
  if (data.video?.status === "ok") renderVideo(data.video.item);
  else renderFailure("video", videoFrame, videoCaption, data.video?.status);
  if (data.song?.status === "ok") renderSong(data.song.item);
  else renderFailure("song", songFrame, songCaption, data.song?.status);
  renderCurrentRead(data.currentRead);

  document.querySelector("#updated-at").textContent = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  refreshButton.disabled = false;
  refreshButton.textContent = "Refresh";
}

loadNow(true);
setInterval(() => loadNow(true), 5 * 60 * 1000);
document.querySelector("#refresh-button").addEventListener("click", () => loadNow(true));