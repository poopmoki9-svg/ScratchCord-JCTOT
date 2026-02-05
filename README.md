# ScratchCord: JCTOT

ScratchCord: JCTOT is a fully client-side, Scratch-inspired social platform for a small group of friends roleplaying as JCTOT characters. It uses **only** browser-native tech plus public JSON storage to share chat and WebRTC signaling data.

## File Structure

```
.
└── index.html
```

## Key Features

- Discord-style UI shell with server, channels, and member panels.
- Character profiles with bios, traits, projects, and roles.
- Global feed, projects, and series sections.
- **Real-time chat** via cloud-hosted JSON polling.
- **WebRTC audio calls** with cloud JSON signaling and public STUN servers.
- Login and profile creation forms stored locally per device.

## How Chat Works (Cloud JSON)

- Every room has a `chats/<roomId>` JSON node with a `messages` object.
- Each message includes:
  - `characterId`
  - `timestamp`
  - `text`
- The UI polls every 3 seconds to update messages.

## WebRTC Signaling Flow (No Backend)

1. **Caller** clicks **Create Call**, generates a Call ID, and writes the offer to:
   `calls/<callId>/offer`.
2. **Callee** clicks **Join Call**, reads the offer, creates an answer, and writes to:
   `calls/<callId>/answer`.
3. Both peers exchange ICE candidates by writing to:
   - `calls/<callId>/callerCandidates`
   - `calls/<callId>/calleeCandidates`
4. Each peer polls the JSON nodes and applies new candidates until connected.

## Sample Chat + Call Flow

1. Both users set the **same cloud JSON base URL** in the settings panel.
2. Choose a character and room.
3. Send a chat message (polling updates it for everyone).
4. Share a Call ID with a friend.
5. Caller clicks **Create Call**.
6. Callee clicks **Join Call**.
7. Audio connects peer-to-peer.

## Hosting Instructions (Static)

You can host this on any static host:

### GitHub Pages

1. Push the repo to GitHub.
2. In **Settings → Pages**, select the main branch and root folder.
3. Save, then open the generated URL.

### Local Dev Server

```
python -m http.server 8080
```

Open `http://localhost:8080`.

## Public API Setup (No Private Keys)

ScratchCord ships with a public JSON API prefilled (jsonblob.com) so the preview
works automatically with no copy/paste. The app creates a blob per data path and
stores the mapping in `localStorage` on each device.

1. Keep the default API base to share data automatically.
2. If you want a different public API host, paste it into **Public API Base URL**
   and make sure it supports `GET`, `PUT`, and `PATCH`.

> This uses only public endpoints and no private API keys.

## Notes

- Everything is original content.
- No Scratch assets, code, or branding are used.
- WebRTC uses public STUN servers only.
- LocalStorage fallback is available for offline demos.
