# Claude Terminal

**A multi-server SSH tmux session manager optimized for Claude Code CLI.**

Manage persistent terminal sessions across multiple servers from one web dashboard. Run Claude Code on your VPS from your phone, access locked-down servers through your homelab, and keep sessions alive 24/7.

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-18-green.svg?style=flat&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## What It Does

**TL;DR:** Web UI for tmux that works across multiple servers via SSH. Built for Claude Code but works with any terminal application.

## How It Works

```
                                         ┌──────────────────────────────┐
                                         │        VPS                   │
                                    SSH  │  tmux ──► Claude Code        │
                               ┌────────►│                              │
┌─────────────┐    ┌──────────┐│         └──────────────────────────────┘
│   Browser   │    │  Claude  ││         ┌──────────────────────────────┐
│   Phone     │───►│ Terminal ││    SSH  │        Homelab               │
│   Tablet    │    │ (Docker) │├────────►│  tmux ──► Claude Code        │
└─────────────┘    └──────────┘│         └──────────────────────────────┘
                               │         ┌──────────────────────────────┐
                               │    SSH  │        Dev Server            │
                               └────────►│  tmux ──► Claude Code        │
                                         └──────────────────────────────┘
```

1. Access Claude Terminal from any device
2. Connect to your servers via SSH
3. tmux keeps sessions alive 24/7
4. Reconnect anytime - pick up where you left off

### Use Cases

**Homelab Gateway** - Access servers that only allow SSH from your home IP:

```
You (Work/Hotel) ──► VPN ──► Homelab:3000 ──► SSH ──► VPS (Home IP only)
```

**Multi-Server Dashboard** - Single interface for all your servers.

## Requirements

- **Docker** - To run Claude Terminal
- **tmux on remote servers** - Must be installed on each server you SSH into (`apt install tmux`)
- **SSH access** - Password or key-based authentication to your servers

## Features

- **Multi-server SSH management** - Single dashboard for multiple remote servers via SSH
- **Persistent sessions** - tmux keeps sessions alive 24/7, reconnect anytime from anywhere
- **Commands menu** - Quick access to Claude Code slash commands (/init, /compact, /review, etc.)
- **Drag-and-drop session reordering** - Organize sessions your way, order persists across reloads
- **Multiple saved paths per server** - Quick-select working directories when creating sessions
- **Claude Code optimized** - Auto-start Claude, mobile-friendly controls
- **Mobile-ready** - Touch controls for ESC (stop Claude thinking), scroll, copy/paste, zoom
- **Toast notifications** - All feedback via themed notifications (success, error, warning, info)
- **Instant operations** - Session deletion <200ms, real-time terminal via Socket.IO
- **Secure** - Session-based auth with bcrypt, SSH key support, file-based persistence
- **Lightweight** - Minimal Docker image with only essential dependencies

## Quick Start

### 1. Install tmux on your remote servers

On each server you want to connect to:

```bash
# Debian/Ubuntu
sudo apt install tmux

# RHEL/CentOS/Fedora
sudo dnf install tmux

# macOS
brew install tmux
```

### 2. Generate a session secret

The session secret is used to sign login cookies. Without a consistent secret, you'll be logged out when the container restarts.

```bash
# Generate a random 64-character hex string
openssl rand -hex 32
```

Save this value - you'll need it in the next step.

### 3. Create docker-compose.yml

```yaml
services:
  claude-terminal:
    image: ghcr.io/emptywill/claude-terminal:latest
    container_name: claude-terminal
    environment:
      - SESSION_SECRET=your-generated-secret-here
      - DEFAULT_USER=admin
      - DEFAULT_PASS=change-this-password
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Replace:
- `your-generated-secret-here` with the secret from step 2
- `change-this-password` with a secure password

### 4. Start the container

```bash
docker compose up -d
```

### 5. Access the web UI

Open `http://your-server:3000` in your browser and log in with your credentials.

### 6. Add your first server

1. Click your username (top right) → **Manage Servers**
2. Click **Add Server**
3. Enter your server details:
   - **Name**: A friendly name (e.g., "My VPS")
   - **Host**: Server IP or hostname
   - **Port**: SSH port (usually 22)
   - **Username**: Your SSH username
   - **Password** or **SSH Key**: Your authentication method
   - **Saved Paths**: Working directories (e.g., `/home/user/projects`)
4. Click **Save**

### 7. Create a session

1. Click **+ New Session** in the sidebar
2. Select your server and choose a saved path
3. Optionally enable "Start Claude Code" to auto-launch Claude CLI
4. Click **Create**

You're now connected to a persistent tmux session on your remote server.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | random | Signs login cookies (generate with `openssl rand -hex 32`) |
| `DEFAULT_USER` | `admin` | Initial admin username |
| `DEFAULT_PASS` | `admin` | Initial admin password |

## Volume Mounts

| Path | Description |
|------|-------------|
| `./data:/app/data` | User credentials and server config persistence |

## Controls

### Desktop
- **Mouse wheel** - Scroll through terminal history (native xterm.js scrolling)
- **Shift+PageUp/PageDown** - Scroll larger amounts
- **Shift+Select text** - Auto-copies to clipboard on release (Shift bypasses tmux mouse mode)
- **Ctrl+V** - Paste from clipboard
- **Zoom +/-** buttons - Adjust font size

### Mobile
| Button | Function |
|--------|----------|
| **ESC** | Send ESC key (stop Claude from thinking) |
| **Commands** | Quick access to Claude Code slash commands |
| **Scroll** | Enter/exit tmux copy mode for scrolling |
| **Copy** | Copy selected text |
| **Paste** | Paste from clipboard |
| **Zoom -/+** | Decrease/increase font size |
| **+ Win** | Create new tmux window |
| **Next** | Switch to next window |
| **End** | Kill current session |

## Android App

A native Android wrapper app is included in the `android/` directory.

### Features
- Fullscreen immersive terminal experience
- Hardware keyboard support (ESC, Ctrl+C/D/Z/L)
- Auto-keeps screen on during sessions
- Offline error handling with retry

### Building
1. Open `android/` folder in Android Studio
2. Update `SERVER_URL` in `app/build.gradle`
3. Build > Generate Signed APK

See [android/README.md](android/README.md) for detailed instructions.

## Building from Source

```bash
git clone https://github.com/emptywill/claude-terminal.git
cd claude-terminal
docker build -t claude-terminal .
docker run -d -p 3000:3000 -v /tmp/tmux-0:/tmp/tmux-0 claude-terminal
```

## Security

1. **Change default credentials** before deploying
2. **Set a strong SESSION_SECRET** using a random string
3. **Use a reverse proxy** with HTTPS in production (nginx, traefik, caddy)
4. **Restrict access** via firewall or VPN for sensitive environments

### Nginx Reverse Proxy Example

```nginx
server {
    listen 443 ssl http2;
    server_name terminal.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## Recent Updates

**2026-01-12:**
- **Commands dropdown menu** - Quick access to Claude Code slash commands with scrollable menu
- **Organized command categories** - Project, Context Management, Settings, Account, Extensions, Help
- **Multiple saved paths per server** - Define multiple working directories per server, select from dropdown when creating sessions
- **Drag-and-drop session reordering** - Reorder sessions in sidebar, order persists in localStorage
- **Removed Local server type** - All servers now use SSH (cleaner, avoids duplicate sessions)
- **Session deduplication** - Prevents same session appearing twice in menu
- **Desktop scrolling** - Native xterm.js scrolling (mouse wheel, Shift+PageUp/Down)
- **Auto-copy on Shift+select** - Text copied to clipboard when Shift+selecting
- **Ctrl+V paste** - Paste from clipboard with Ctrl+V
- **Auto-focus terminal** - Terminal focuses when selecting a session

**2026-01-10:**
- **Custom toast notifications** - Themed notifications (success, error, warning, info)
- **Instant session deletion** - <200ms with visual feedback
- **Flexible Claude CLI detection** - Auto-detects from PATH or `$HOME/.local/bin/`

## License

MIT
