# ramprotation

## Configure

The app is a dependency-free Vercel project. Set `YOUTUBE_PLAYLIST_ID` and
`APPLE_PLAYLIST_URL` in the Vercel project environment to choose the public
playlists to display. Both have fallback defaults in `lib/youtube.js` and
`lib/apple.js`.

Set the title and ISBN in `lib/current-read.js` to update the “Currently
reading” section. The ISBN is used to request the cover from Open Library; use
the ISBN-10 or ISBN-13 printed with your edition.

The `/api/now` function fetches both sources server-side. The static page is
served from `public/`.

Run the network-free tests with:

```sh
npm test
```