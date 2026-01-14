# CLAUDE.md - Claude Terminal

This file provides guidance to Claude Code when working with this repository.

## IMPORTANT - Arcane Container Management

- **Arcane manages this container** - Always use Arcane's compose file
- **Arcane compose:** `/srv/containers/arcane-data/projects/claude-console/compose.yaml`
- **Port:** 3550 (internal and external)
- **Image:** `claude-terminal:local` (built locally)
- **Public folder mounted** - Frontend edits don't need rebuild

## Server Infrastructure

This project runs on a Proxmox LXC homelab (CT 100, Ubuntu 22.04, IP: 192.168.0.61) managing 80+ Docker containers via Arcane orchestration.

**This Project (claude-console):**
- Arcane project folder: `/srv/containers/arcane-data/projects/claude-console/`
- Dev/source folder: `/srv/containers/claude-terminal/`
- Docker image: `claude-terminal:local` (built locally)
- Port: 3550
- Network: `homelab-net` (external)
- Deployment: Managed by Arcane (port 3552)

**Key Commands:**
- Rebuild after backend changes: `docker build -t claude-terminal:local . && cd /srv/containers/arcane-data/projects/claude-console && docker compose up -d --force-recreate`
- Frontend changes: Edit `/srv/containers/claude-terminal/public/` (mounted, no rebuild needed)
- Validate JS: `docker exec claude-terminal node -c "require('./public/app.js')"`

**Full homelab docs:** `/srv/containers/homelab-v2/CLAUDE.md` (read if you need infrastructure details)

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
┌─────────────┐    ┌──────────┐         ┌──────────────────────────────┐
│   Browser   │    │  Claude  │   SSH   │  Remote Server               │
│ Android App │───►│ Terminal │────────►│  tmux ──► Claude Code        │
└─────────────┘    │ (Docker) │         └──────────────────────────────┘
                   └──────────┘
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
| `SESSION_SECRET` | random | Signs login cookies (`openssl rand -hex 32`) |
| `DEFAULT_USER` | `admin` | Initial username |
| `DEFAULT_PASS` | `admin` | Initial password |

## Volume Mounts (Arcane compose)

| Mount | Purpose |
|-------|---------|
| `/srv/containers/claude-terminal/data:/app/data` | Persistent credentials/sessions |
| `/srv/containers/claude-terminal/public:/app/public` | Frontend dev without rebuild |

## Requirements

tmux must be installed on **target SSH servers** (`apt install tmux`). All connections use SSH, so tmux runs on the remote servers, not in the Docker container.

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

## Sudo Configuration (for non-root users)

When running as a non-root user on remote servers, sudo password prompts can interrupt workflow. Configure passwordless sudo on your target servers:

**Option 1: Passwordless sudo for all commands (easiest)**
```bash
echo 'username ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/username
sudo chmod 0440 /etc/sudoers.d/username
```

**Option 2: Passwordless sudo for specific commands (more secure)**
```bash
# Example: docker, systemctl, apt only
echo 'username ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/systemctl, /usr/bin/apt' | sudo tee /etc/sudoers.d/username
sudo chmod 0440 /etc/sudoers.d/username
```

**Option 3: Extend sudo timeout (middle ground)**
```bash
echo 'Defaults timestamp_timeout=60' | sudo tee -a /etc/sudoers.d/timeout
sudo chmod 0440 /etc/sudoers.d/timeout
```

Replace `username` with your actual SSH username on the target server.

## Controls

### Desktop
- **Mouse wheel** - Scroll (native xterm.js)
- **Shift+Select** - Auto-copies to clipboard (with Brave/strict browser fallback)
- **Ctrl+V** - Paste from clipboard (works in Chrome, Firefox, and Brave)
- **Commands** - Quick access to Claude Code slash commands
- **Zoom +/-** - Font size

### Mobile
- **ESC** - Stop Claude thinking
- **Commands** - Claude Code slash commands dropdown
- **Scroll** - tmux copy mode
- **Copy/Paste** - Clipboard buttons
- **Zoom +/-** - Font size

### Browser Compatibility
- **Chrome/Firefox** - Full clipboard API support
- **Brave** - Auto-copy and paste use fallback methods (execCommand for copy, paste event for Ctrl+V)
- All clipboard operations include fallbacks for strict security policies

## Development

See "Development Workflow" at top of this file.

## Recent Changes

### UI/UX Improvements
- **Current working directory display** - Shows the active pane's working directory below the session badge (📁 /path/to/dir). Updates when switching sessions. Discrete monospace styling with ellipsis for long paths
- **Resume button** - Green "Resume" button to bring back suspended processes (Ctrl+Z recovery)
- **Window close confirmation** - Confirmation dialog when closing tmux windows (Win1, Win2, etc.)
- **Improved working directory UI** - Saved paths now displayed as clickable buttons below input field (more intuitive than dropdown)
- **Path selector label** - Discrete "Saved paths:" label to indicate server-specific quick paths
- Commands dropdown menu with quick access to Claude Code slash commands
- Scrollable commands menu (max-height 350px) with organized categories
- Drag-and-drop session reordering (order persists in localStorage)

### Clipboard & Browser Compatibility
- **Brave browser support** - Auto-copy and paste now work in Brave
- **Clipboard fallback** - Uses execCommand fallback when Clipboard API fails (strict security policies)
- **Paste event handling** - Ctrl+V uses native paste event for better Brave compatibility
- **Copy whitespace trimming** - Auto-copy now trims trailing whitespace from each line
- Auto-copy on Shift+select (bypasses tmux mouse)

### Technical
- **CWD API endpoint** - New GET /api/servers/:id/sessions/:session/cwd endpoint queries tmux with `list-panes -F "#{pane_current_path}"` and returns active pane's working directory
- **SSH connection optimization** - Keepalive (10s interval), TCP_NODELAY, and faster ciphers to reduce input lag
- **Consistent tmux mouse mode** - Explicitly enables mouse mode for all sessions (local and remote) to ensure consistent scrolling behavior across all servers
- **Window close timing** - Server waits 200ms after tmux kill-window before responding to ensure UI refresh works
- Multiple saved paths per server (displayed as buttons when creating sessions)
- Removed "Local" server type - all servers now use SSH
- Session deduplication to prevent duplicates in menu
- Desktop scrolling via native xterm.js (mouse wheel)
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
