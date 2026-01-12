# CLAUDE.md - Claude Terminal

This file provides guidance to Claude Code when working with this repository.

## Project Overview

A multi-server SSH tmux session manager optimized for Claude Code CLI. Web-based terminal that manages persistent sessions across multiple servers.

**GitHub:** https://github.com/emptywill/claude-terminal
**Docker Image:** `ghcr.io/emptywill/claude-terminal:latest`

## Quick Start

```bash
docker compose up -d
# Access at http://localhost:3000
# Default: admin/admin
```

## Architecture

```
Browser → Claude Terminal (Docker) → tmux socket → Host tmux → Claude Code CLI
                                  → SSH → Remote servers
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
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | random | Session encryption |
| `DEFAULT_USER` | `admin` | Initial username |
| `DEFAULT_PASS` | `admin` | Initial password |

## Volume Mounts

| Mount | Purpose |
|-------|---------|
| `/tmp/tmux-0:/tmp/tmux-0` | Host tmux socket (required) |
| `./data:/app/data` | Persistent credentials/sessions |

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

```bash
# Edit frontend (no rebuild needed)
vim public/app.js
# Refresh browser

# Edit backend (rebuild needed)
vim server.js
docker build -t claude-terminal:local .
docker compose up -d --force-recreate
```

## Recent Fixes (2026-01-12)

- Desktop scrolling via native xterm.js (mouse wheel)
- Auto-copy on Shift+select (bypasses tmux mouse)
- Ctrl+V paste (xterm custom key handler)
- SIGKILL for PTY cleanup (prevents Claude interruption on restart)
- Cache-busting headers for JS/CSS

## Android App

Located in `android/` directory. WebView wrapper with:
- Server URL configuration
- Fullscreen immersive mode
- Hardware keyboard shortcuts

Build via GitHub Actions → Artifacts → `claude-terminal-debug`
