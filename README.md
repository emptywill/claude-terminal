# Claude Terminal

**A multi-server SSH tmux session manager optimized for Claude Code CLI.**

Manage persistent terminal sessions across multiple servers from one web dashboard. Run Claude Code on your VPS from your phone, access locked-down servers through your homelab, and keep sessions alive 24/7.

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-18-green.svg?style=flat&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## What It Does

**TL;DR:** Web UI for tmux that works across multiple servers via SSH. Built for Claude Code but works with any terminal application.

## How It Works

Claude Terminal provides a web-based dashboard for managing tmux sessions. It supports two modes:

### Local Mode
Run the container directly on a server to manage tmux sessions on that machine:

```
Browser ──(3000)──► Claude Terminal ──► Local tmux socket
```

### Multi-Server Mode
Run the container on one machine (e.g., homelab) and manage tmux sessions on multiple remote servers via SSH:

```
Browser ──(3000)──► Claude Terminal ──(SSH:22)──► Remote Server 1
                                    ──(SSH:22)──► Remote Server 2
                                    ──(SSH:22)──► VPS
```

### Why Multi-Server Mode?

This is particularly useful when your remote servers have strict firewall rules. For example:

**Scenario:** You have a VPS that only allows SSH (port 22) from your home IP for security. You want to run Claude Code on the VPS from work or a hotel.

**Solution:**
1. Run Claude Terminal on your homelab (which has your home IP)
2. Add the VPS as a remote server in Claude Terminal
3. Access your homelab's Claude Terminal from anywhere (via VPN, Tailscale, etc.)
4. Your homelab SSHs into the VPS on your behalf

```
Work/Hotel ──(VPN)──► Homelab:3000 ──(SSH)──► VPS:22
   (you)            (claude-terminal)     (only allows home IP)
```

This gives you a single dashboard to manage Claude sessions across all your servers, with your homelab acting as a secure gateway.

## Features

- **Multi-server SSH management** - Single dashboard for local tmux + multiple remote servers via SSH
- **Persistent sessions** - tmux keeps sessions alive 24/7, reconnect anytime from anywhere
- **Claude Code optimized** - Auto-start Claude, custom paths per server, mobile-friendly controls
- **Mobile-ready** - Touch controls for ESC (stop Claude thinking), scroll, copy/paste, zoom
- **Toast notifications** - All feedback via themed notifications (success, error, warning, info)
- **Instant operations** - Session deletion <200ms, real-time terminal via Socket.IO
- **Secure** - Session-based auth with bcrypt, SSH key support, file-based persistence
- **Lightweight** - Minimal Docker image with only essential dependencies

## Quick Start

### Docker Compose

```yaml
services:
  claude-terminal:
    image: ghcr.io/emptywill/claude-terminal:latest
    container_name: claude-terminal
    environment:
      - SESSION_SECRET=your-random-secret-here
      - DEFAULT_USER=admin
      - DEFAULT_PASS=your-secure-password
    ports:
      - "3000:3000"
    volumes:
      - /tmp/tmux-0:/tmp/tmux-0
      - ./data:/app/data
    restart: unless-stopped
```

```bash
docker compose up -d
```

Then open `http://your-server:3000` in your browser.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | random | Session encryption key (change in production!) |
| `DEFAULT_USER` | `admin` | Initial admin username |
| `DEFAULT_PASS` | `admin` | Initial admin password |
| `TMUX_SOCKET` | `/tmp/tmux-0` | Path to host tmux socket |

## Volume Mounts

| Path | Description |
|------|-------------|
| `/tmp/tmux-0:/tmp/tmux-0` | **Required** - Host tmux socket for session management |
| `./data:/app/data` | User credentials persistence |

### Tmux Socket Path

The container needs access to the host's tmux socket. By default, tmux creates sockets at `/tmp/tmux-{UID}/`.

- **Root user (UID 0):** `/tmp/tmux-0`
- **Regular user (UID 1000):** `/tmp/tmux-1000`

Adjust the volume mount accordingly.

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
- **Desktop scrolling** - Native xterm.js scrolling (mouse wheel, Shift+PageUp/Down), scroll button hidden on desktop
- **Auto-copy on Shift+select** - Text is automatically copied to clipboard when you Shift+select (bypasses tmux mouse)
- **Ctrl+V paste** - Paste from clipboard with Ctrl+V (intercepted before terminal)
- **Mobile scroll button** - Scroll button now mobile-only, uses tmux copy mode for touch scrolling
- **Auto-focus terminal** - Terminal automatically focuses when selecting a session
- **SIGKILL for PTY cleanup** - Prevents Claude from being interrupted during container restarts
- **Cache-busting headers** - Server sends no-cache headers for JS/CSS files

**2026-01-10:**
- **Custom toast notifications** - Replaced browser alerts with themed toast notifications (success, error, warning, info)
- **Improved session management** - Session deletion now instant (<200ms) with better visual feedback
- **Flexible Claude CLI detection** - Auto-detects Claude from PATH or `$HOME/.local/bin/` (works with any username)
- **Better server workflow** - Add Server modal stays open after saving so you can test connection immediately
- **Intuitive status indicators** - Session dots now show green for active (in use) and orange for idle
- **Consistent UI** - Admin dropdown hover effect matches button styling

## License

MIT
