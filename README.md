# Claude Terminal

A lightweight, mobile-friendly web interface for managing tmux sessions. Built specifically for running Claude Code CLI on remote servers.

![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-18-green.svg?style=flat&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Web-based tmux management** - Create, attach, and kill tmux sessions from your browser
- **Mobile-friendly** - Touch controls for ESC, scroll, copy/paste, and zoom
- **Session-based auth** - Secure login with bcrypt password hashing
- **Real-time terminal** - Full terminal emulation via xterm.js and Socket.IO
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

## Mobile Controls

| Button | Function |
|--------|----------|
| **ESC** | Send ESC key (stop Claude from thinking) |
| **⌨️** | Toggle mobile keyboard |
| **📜** | Enter/exit scroll mode |
| **📋** | Copy selected text |
| **📥** | Paste from clipboard |
| **A- / A+** | Decrease/increase font size |
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

## License

MIT
