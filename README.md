# ScratchCord: JCTOT

ScratchCord: JCTOT is a fully client-side, Scratch-inspired social platform for a small group of friends roleplaying as JCTOT characters. It uses **only** browser-native tech plus public JSON storage to share chat and WebRTC signaling data.

## File Structure

```
.
├── index.html
├── styles.css
├── app.js
└── data
    ├── sample-data.json
    └── example-cloud-layout.json
```

## Key Features

- Scratch-like UI with rounded cards and bright, friendly colors.
- Character profiles with bios, traits, projects, and roles.
- Global feed, projects, and series sections.
- **Real-time chat** via cloud-hosted JSON polling.
- **WebRTC audio calls** with cloud JSON signaling and public STUN servers.

## How Chat Works (Cloud JSON)

- Every room has a `chats/<roomId>` JSON node with a `messages` object.
- Each message includes:
  - `characterId`
  - `timestamp`
  - `text`
  - `ooc` (out-of-character toggle)
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

## Example Cloud JSON Layout

See `data/example-cloud-layout.json` for a full example payload.

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

## Cloud JSON Provider Setup (No Private Keys)

ScratchCord expects a public JSON base URL (Firebase Realtime Database works well).

### Firebase Realtime Database (Public Rules)

1. Create a Firebase project (no auth required for this use case).
2. Enable Realtime Database in test mode.
3. In the Rules tab, set:

```
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

4. Copy the database URL, e.g.:
   `https://your-project.firebaseio.com`
5. Paste it into **Cloud JSON Base URL**.

> This uses only public endpoints and no private API keys.

## Notes

- Everything is original content.
- No Scratch assets, code, or branding are used.
- WebRTC uses public STUN servers only.
- LocalStorage fallback is available for offline demos.
