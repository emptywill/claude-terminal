# CLAUDE.md - Claude Terminal

This file provides guidance to Claude Code when working with this repository.

## IMPORTANT - Arcane Container Management

- **Arcane manages this container** - Always use Arcane's compose file
- **Arcane compose:** `/srv/containers/arcane-data/projects/claude-console/compose.yaml`
- **Port:** 3550 (internal and external)
- **Image:** `claude-terminal:local` (built locally)
- **Public folder mounted** - Frontend edits don't need rebuild

## Development Workflow

```bash
# Frontend changes (no rebuild needed)
# Edit files in /srv/containers/claude-terminal/public/
# Hard refresh browser

# Backend changes (rebuild needed)
docker build -t claude-terminal:local .
docker rm -f claude-terminal
cd /srv/containers/arcane-data/projects/claude-console && docker compose up -d
```

## Project Overview

A multi-server SSH tmux session manager optimized for Claude Code CLI. Web-based terminal that manages persistent sessions across multiple servers.

**GitHub:** https://github.com/emptywill/claude-terminal

## Architecture

```
Browser → Claude Terminal (Docker) → SSH → Host/Remote servers → tmux → Claude Code CLI
```

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express backend with Socket.IO, PTY management, SSH support |
| `public/app.js` | Frontend - terminal, sessions, servers, modals |
| `public/styles.css` | Dark theme with orange accents (#ff9100) |
| `public/index.html` | Main UI structure |
| `Dockerfile` | Node.js 18 + tmux + build tools |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3550` | Server port |
| `SESSION_SECRET` | (from .env) | Session encryption |
| `DEFAULT_USER` | `admin` | Initial username |
| `DEFAULT_PASS` | `admin` | Initial password |

## Volume Mounts (Arcane compose)

| Mount | Purpose |
|-------|---------|
| `/tmp/tmux-0:/tmp/tmux-0` | Host tmux socket |
| `/srv/containers/claude-terminal/data:/app/data` | Persistent credentials/sessions |
| `/srv/containers/claude-terminal/public:/app/public` | Frontend dev without rebuild |

## Server Types

All servers use SSH connections. Add servers via the UI with hostname, port, username, and password or SSH key.

### SSH to Localhost (for host access)
For full access to host directories and Claude CLI, configure SSH to your host machine:

1. Ensure SSH server is running on your host
2. Add a new server in claude-terminal:
   - **Name:** `localhost` (or any name)
   - **Host:** `172.17.0.1` (Docker's default host IP) or your host's IP
   - **Port:** `22`
   - **Auth:** SSH key or password
   - **Saved Paths:** Add your project directories (e.g., `/home/user/projects`)

### Remote SSH
For remote servers - sessions run on the remote machine with full access to its filesystem.

## Controls

### Desktop
- **Mouse wheel** - Scroll (native xterm.js)
- **Shift+Select** - Auto-copies to clipboard
- **Ctrl+V** - Paste from clipboard
- **Zoom +/-** - Font size

### Mobile
- **ESC** - Stop Claude thinking
- **Scroll** - tmux copy mode
- **Copy/Paste** - Clipboard buttons
- **Zoom +/-** - Font size

## Development

See "Development Workflow" at top of this file.

## Recent Changes

- Commands dropdown menu with quick access to Claude Code slash commands
- Scrollable commands menu (max-height 350px) with organized categories
- Multiple saved paths per server (dropdown selection when creating sessions)
- Drag-and-drop session reordering (order persists in localStorage)
- Removed "Local" server type - all servers now use SSH
- Session deduplication to prevent duplicates in menu
- Desktop scrolling via native xterm.js (mouse wheel)
- Auto-copy on Shift+select (bypasses tmux mouse)
- Ctrl+V paste (xterm custom key handler)
- SIGKILL for PTY cleanup (prevents Claude interruption on restart)

## Android App

Native Android WebView wrapper located in `android/` directory.

**Download:** GitHub Actions → "Build Android APK" → Artifacts → `claude-terminal-debug`

### Features
- In-app server URL configuration (no hardcoded URLs)
- Styled setup screen with icon, rounded inputs, preset buttons (Homelab/Localhost)
- Fullscreen immersive mode with double-tap to toggle
- Discrete hint overlay when entering fullscreen
- Keep screen on while active
- Hardware keyboard shortcuts: ESC, Ctrl+C, Ctrl+D, Ctrl+Z, Ctrl+L
- Settings button on connection error
- All programmatic UI (no XML layouts)

### App Flow
1. First launch → Setup screen to configure server URL
2. Enter URL (or use preset) → Tap Connect
3. WebView loads terminal in fullscreen
4. Double-tap anywhere → Toggle fullscreen on/off
5. Connection error → Shows settings button + error page

### Build System
| Property | Value |
|----------|-------|
| Workflow | `.github/workflows/build-android.yml` |
| Trigger | Push to `android/**` or manual |
| Outputs | `claude-terminal-debug` (4.6MB), `claude-terminal-release` (1.1MB) |
| Gradle | 8.2 |
| Kotlin | 1.9 |
| Target SDK | 34 |
| Min SDK | 26 |

### Technical Details
- Single `MainActivity` with programmatic UI (no XML layouts)
- `SharedPreferences` for storing server URL
- `GestureDetector` for double-tap fullscreen toggle
- WebView with JavaScript enabled, DOM storage, mixed content allowed
- Custom user agent: `ClaudeTerminalApp/1.0`
- Injects helper functions for ESC and Ctrl key handling

### Fixed Issues
- **App crash on startup**: Caused by XML layouts and ViewBinding issues
  - Solution: Switched to programmatic UI built entirely in Kotlin code
- **Theme crash**: Changed from `MaterialComponents.DayNight` to `AppCompat.NoActionBar`
