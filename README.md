# Song — Frontend

A private, ad-free music player PWA built with React. Streams audio via JioSaavn and syncs your library through a custom backend + Supabase.

## Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Framework        | React 19 + Vite 7                             |
| Styling          | Tailwind CSS 4 (via `@tailwindcss/vite`)      |
| State Management | Zustand 5                                     |
| Routing          | React Router 7                                |
| HTTP Client      | Axios (with auto token refresh interceptor)   |
| Auth             | JWT (access + refresh tokens via Supabase)    |
| Music Source     | JioSaavn (unofficial API via Cloudflare Worker) |
| PWA              | Service Worker + Web App Manifest             |

## Features

### 🎵 Playback
- Stream songs in up to **320 kbps** from JioSaavn
- Persistent playback — session (song, queue, progress) survives page reload
- **Media Session API** — lock-screen / notification controls on Android & iOS
- Background audio via **Web Audio API** silent-buffer keep-alive
- Shuffle, repeat (none / all / one), volume control
- Seek via progress bar with real-time position updates

### 🔍 Search
- Search across **songs**, **artists**, and **playlists** with tabbed results
- Debounced live search (500 ms) with explicit submit support
- Artist drill-down — tap an artist to browse their top songs
- Playlist expansion — preview and play full JioSaavn playlists inline
- **Import JioSaavn playlists** directly into your library
- Persistent **search history** with clear / remove

### 📚 Library
- **Liked Songs** — heart any song; optimistic UI with server sync
- **Custom Playlists** — create, delete, add / remove songs
- **Play All** — queue an entire playlist with one tap
- Library data cached in `localStorage` for instant load, synced with backend

### 🎨 Theming
- **Dark**, **Light**, and **Device** (system preference) themes
- CSS custom properties for seamless runtime switching
- Theme persists across sessions

### 🔐 Auth
- Email / password sign-up and login
- JWT access + refresh token flow with **silent auto-refresh**
- Concurrent 401 handling — queues failed requests and retries after refresh
- Logout clears tokens + library cache

### 📲 PWA
- Installable on Android (TWA-ready) and iOS (Add to Home Screen)
- Offline-capable via Service Worker with cache-first strategy
- iOS splash screens for all device sizes
- App shortcuts for Search and Library
- `standalone` display mode — no browser chrome

### 📦 Spotify Import
- Paste a public Spotify playlist URL on the Settings page
- Backend fetches the track list; frontend matches each track on JioSaavn
- Preview matched songs, then save the playlist to your library in one click

### 🧠 Smart Queue
- **Auto-Queue** — when the queue runs low, fetches related songs via JioSaavn suggestions (uses `stationId` for non-repeating radio pagination)
- **Play Next / Add to Queue** — per-song controls from any song card
- Queue is persisted in `localStorage` alongside the current session

## Project Structure

```
frontend/
├── index.html              # HTML shell — PWA meta tags, fonts, iOS splash
├── vite.config.js           # Vite + React + Tailwind plugins
├── package.json
├── .env.example             # Required environment variables
├── public/
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service Worker
│   ├── registerSW.js        # SW registration helper
│   ├── icons/               # App icons (72–512px)
│   ├── splash/              # iOS splash screens
│   └── .well-known/         # Android asset links (TWA)
└── src/
    ├── main.jsx             # Entry point — renders <App />
    ├── index.css            # Global styles
    ├── App.jsx              # Router + auth gate + audio session init
    ├── components/
    │   ├── AppLayout.jsx    # Shell: sidebar + routes + player
    │   ├── Sidebar.jsx      # Desktop sidebar / mobile bottom nav
    │   ├── Player.jsx       # Full player UI (mini + fullscreen)
    │   ├── SongCard.jsx     # Reusable song row with context menu
    │   └── LikeButton.jsx   # Heart toggle with optimistic updates
    ├── pages/
    │   ├── HomePage.jsx     # Greeting, now playing, recommendations
    │   ├── SearchPage.jsx   # Tabbed search (songs/artists/playlists)
    │   ├── LibraryPage.jsx  # Playlists CRUD + song management
    │   ├── LikedPage.jsx    # All liked songs
    │   ├── SettingsPage.jsx # Theme, auto-queue, Spotify import, logout
    │   └── AuthPage.jsx     # Login / signup form
    ├── store/
    │   ├── playerStore.js   # Playback, queue, session, suggestions
    │   ├── authStore.js     # Auth state, JWT decode, login/logout
    │   └── libraryStore.js  # Liked songs, playlists, server sync
    └── utils/
        ├── api.js           # Axios instance + token refresh interceptor
        ├── saavn.js         # JioSaavn URL + song model mapper
        └── audioSession.js  # Web Audio keep-alive + volume nudge
```
## Responsive Design

- **Desktop** (> 768px) — sidebar navigation on the left
- **Mobile** (≤ 768px) — bottom tab bar navigation, fullscreen player, touch-optimized controls

## Key Architecture Decisions

- **Single `<audio>` element** — avoids MediaSession conflicts from multiple audio sources
- **Zustand over Redux** — minimal boilerplate for a small app; stores are self-contained
- **Optimistic UI** — likes and playlist mutations update locally first, then sync with the server
- **Token refresh queue** — prevents race conditions when multiple API calls hit 401 simultaneously
- **Web Audio keep-alive** — a silent `AudioContext` buffer prevents iOS/Android from suspending the PWA in the background
- **Volume nudge heartbeat** — periodic micro volume adjustments prevent OS audio ducking

## ⚠️ Disclaimer

This project is built **strictly for educational purposes**. It is a personal learning exercise in full-stack web development, PWA architecture, and media streaming. It is **not** intended for commercial use or wide-scale distribution. All music content is streamed via third-party APIs and belongs to the respective copyright holders. Use responsibly and in accordance with applicable laws.
