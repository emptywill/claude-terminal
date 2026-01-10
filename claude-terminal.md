# Claude Terminal

A standalone web-based terminal for running Claude Code CLI sessions via tmux.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ANDROID APP                                  │
│                    (WebView Wrapper)                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  • Server URL configuration (can save multiple servers)      │    │
│  │  • Fullscreen immersive mode                                 │    │
│  │  • Hardware keyboard support (ESC, Ctrl+C/D/Z/L)            │    │
│  │  • Keep screen on                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ WebView loads                         │
│                              ▼                                       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP/WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE TERMINAL STANDALONE                        │
│                      (Docker Container)                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Backend: Node.js/Express + Socket.IO                        │    │
│  │  • Authentication (session-based)                            │    │
│  │  • tmux session management via node-pty                      │    │
│  │  • WebSocket terminal I/O (/claude-terminal namespace)       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Frontend: Vanilla JS + xterm.js                             │    │
│  │  • Terminal emulator (xterm.js)                              │    │
│  │  • Session manager UI                                        │    │
│  │  • Mobile controls (ESC, keyboard, scroll, copy/paste)       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Mounts /tmp/tmux-0                    │
│                              ▼                                       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ tmux socket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           HOST SYSTEM                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  tmux sessions (persist across container restarts)           │    │
│  │  Claude Code CLI (runs inside tmux)                          │    │
│  │  Bitwarden Secrets CLI (bws)                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Homelab Console (Port 3555)

The full-featured web application with multiple tabs:
- Dashboard
- Scripts (execute custom scripts)
- Containers (Docker management)
- Schedules (cron jobs)
- Terminal (SSH)
- **Claude Code** (tmux terminal manager)
- Settings

**Location:** `/srv/containers/arcane-data/projects/utilities/homelab-console/`

### 2. Claude Terminal Standalone (Port 3550)

Extracted from Homelab Console - contains ONLY the Claude Code terminal functionality. Designed to run independently on any VPS.

**Location:** `/srv/containers/claude-terminal/`
**GitHub:** https://github.com/emptywill/claude-terminal (public)
**Docker:** `ghcr.io/emptywill/claude-terminal:latest`

**Key Files:**
```
claude-terminal/
├── server.js              # Backend: Express + Socket.IO + node-pty
├── package.json           # Dependencies
├── Dockerfile             # Node.js 18 + tmux + build tools
├── docker-compose.yml     # Container configuration
├── public/
│   ├── index.html         # Main HTML structure
│   ├── styles.css         # Styling (dark theme, orange accents)
│   ├── app.js             # Main frontend logic
│   ├── claude-code.js     # tmux session management
│   └── login.html         # Authentication page
└── android/               # Android WebView wrapper
    └── app/src/main/java/com/claudeterminal/
        ├── MainActivity.kt    # Main app (programmatic UI)
        └── SettingsActivity.kt
```

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3550 | Server port |
| `SESSION_SECRET` | random | Session encryption |
| `DEFAULT_USER` | admin | Default username |
| `DEFAULT_PASS` | admin | Default password |

**Volume Mounts:**
| Mount | Purpose |
|-------|---------|
| `/tmp/tmux-0:/tmp/tmux-0` | Host tmux socket (required) |
| `./data:/app/data` | Persistent sessions/credentials |
| `/usr/local/bin/bws:/usr/local/bin/bws:ro` | Bitwarden CLI (optional) |

### 3. Android App

Native Android WebView wrapper providing:
- Server URL configuration with presets
- Fullscreen immersive mode
- Hardware keyboard shortcuts (ESC, Ctrl+C/D/Z/L)
- Keep screen on while active
- Error handling with retry

**Build:** GitHub Actions auto-builds APK on push to `android/**`
**Download:** GitHub → Actions → "Build Android APK" → Artifacts

## Data Flow

```
User Input (Android/Browser)
         │
         ▼
    ┌─────────┐
    │ xterm.js │  Terminal emulator in browser
    └────┬────┘
         │ WebSocket (Socket.IO)
         ▼
    ┌─────────┐
    │ server.js│  Node.js backend
    └────┬────┘
         │ node-pty (PTY)
         ▼
    ┌─────────┐
    │  tmux   │  Host tmux session
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ claude  │  Claude Code CLI
    └─────────┘
```

## Current UI (Session Manager)

The session manager currently uses large buttons for tmux sessions:
- "+ New Session" button opens modal
- Session list with "Attach" buttons
- Mobile controls bar (ESC, keyboard, scroll, copy, paste, zoom)

## Planned Redesign

### Goals
- Cleaner, more minimal interface
- Browser-style tabs for sessions (thin, not chunky buttons)
- Better use of screen space

### New Design Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│ [session-1] [session-2] [+]                              [settings] │  ← Thin tab bar
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                         TERMINAL                                    │
│                       (fullscreen)                                  │
│                                                                     │
│                                                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ [ESC] [⌨] [↕] [A-] [A+]                                            │  ← Mobile controls
└─────────────────────────────────────────────────────────────────────┘
```

**Tab Bar Behavior:**
- Back arrow to go back to server selection
- Tabs show tmux session names
- Active tab highlighted (orange border/underline)
- "+" tab always visible at end
- Click "+" to create new session (inline name input or modal)
- Right-click/long-press tab for options (rename, kill)
- Empty state: just shows [+] tab
- Tabs scroll horizontally if many sessions

**Android Server Management:**
- After app opens, show server list (not URL input)
- Each saved server as a card
- Tap to connect, small pen icon to edit
- "+" FAB to add new server

## Running Locally

```bash
# Clone the repo
git clone https://github.com/emptywill/claude-terminal.git
cd claude-terminal

# Start with Docker Compose
docker compose up -d

# Access at http://localhost:3000
# Default login: admin/admin
```

## Running on Homelab

The standalone runs on Arcane as project "claude-console" (port 3550):

```bash
# Check status
docker ps --filter "name=claude-terminal"

# View logs
docker logs claude-terminal -f

# Restart
cd /srv/containers/arcane-data/projects/claude-console
docker compose up -d --force-recreate
```

## Development

**Web App Changes:**
1. Edit files in `/srv/containers/claude-terminal/public/`
2. Validate JS: `docker exec claude-terminal bash /app/validate.sh`
3. Refresh browser (no rebuild needed for frontend)

**Backend Changes:**
1. Edit `server.js`
2. Rebuild: `docker compose up -d --build`

**Android Changes:**
1. Edit files in `android/app/src/main/java/com/claudeterminal/`
2. Push to GitHub
3. GitHub Actions builds APK automatically
4. Download from Actions → Artifacts

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Main homelab documentation
- [BUILD_FROM_SCRATCH.md](/BUILD_FROM_SCRATCH.md) - Disaster recovery guide
- [README.md](/README.md) - Quick reference cheat sheet
