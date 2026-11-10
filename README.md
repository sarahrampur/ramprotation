# ramprotation

## Configure

The app is a dependency-free Vercel project. Set `YOUTUBE_PLAYLIST_ID` and
`APPLE_PLAYLIST_URL` in the Vercel project environment to choose the public
playlists to display. Both have fallback defaults in `lib/youtube.js` and
`lib/apple.js`.

The `/api/now` function fetches both sources server-side. The static page is
served from `public/`.

Run the network-free tests with:

```sh
npm test
```