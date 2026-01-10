# Claude Terminal

A web-based tmux terminal interface for managing Claude Code CLI sessions. Access your tmux sessions from any browser with a mobile-friendly UI.

## Features

- Web-based tmux session management
- Create, attach, and kill tmux sessions
- Mobile-friendly controls (ESC, scroll, copy/paste, zoom)
- Session-based authentication
- Real-time terminal via Socket.IO and node-pty

## Quick Start

### Using Docker Compose (Recommended)

```yaml
services:
  claude-terminal:
    image: ghcr.io/emptywill/claude-terminal:latest
    container_name: claude-terminal
    environment:
      - SESSION_SECRET=change-this-to-a-random-string
      - DEFAULT_USER=admin
      - DEFAULT_PASS=your-secure-password
    ports:
      - "3000:3000"
    volumes:
      - /tmp/tmux-0:/tmp/tmux-0  # Host tmux socket
      - ./data:/app/data         # Persist user credentials
    restart: unless-stopped
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | (random) | Session encryption key - **change in production!** |
| `DEFAULT_USER` | `admin` | Initial admin username |
| `DEFAULT_PASS` | `admin` | Initial admin password |
| `TMUX_SOCKET` | `/tmp/tmux-0` | Path to host tmux socket |

### Important: Tmux Socket

The container needs access to the host's tmux socket to manage sessions. By default, tmux creates its socket at `/tmp/tmux-{UID}/default`.

For the root user (UID 0), the socket is at `/tmp/tmux-0/default`.

Mount the socket directory:
```yaml
volumes:
  - /tmp/tmux-0:/tmp/tmux-0
```

If running as a non-root user, adjust the path:
```yaml
volumes:
  - /tmp/tmux-1000:/tmp/tmux-1000  # For UID 1000
```

## Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-terminal.git
cd claude-terminal

# Build the image
docker build -t claude-terminal .

# Run
docker run -d \
  -p 3000:3000 \
  -v /tmp/tmux-0:/tmp/tmux-0 \
  -v claude-data:/app/data \
  -e SESSION_SECRET=your-secret \
  -e DEFAULT_USER=admin \
  -e DEFAULT_PASS=secure-password \
  claude-terminal
```

## Mobile Controls

| Button | Function |
|--------|----------|
| **ESC** | Send ESC key (stop Claude thinking) |
| **⌨️** | Toggle mobile keyboard |
| **📜** | Toggle scroll mode |
| **📋** | Copy selected text |
| **📥** | Paste from clipboard |
| **A-/A+** | Zoom out/in |
| **+ Win** | New tmux window |
| **Next** | Next tmux window |
| **End** | Kill current session |

## Tmux Keyboard Shortcuts

While in the terminal, standard tmux shortcuts work:

| Shortcut | Action |
|----------|--------|
| `Ctrl+B C` | New window |
| `Ctrl+B N` | Next window |
| `Ctrl+B P` | Previous window |
| `Ctrl+B D` | Detach session |
| `Ctrl+B [` | Enter scroll/copy mode |
| `Ctrl+B %` | Split horizontally |
| `Ctrl+B "` | Split vertically |

## Security Considerations

1. **Change the default password** - The default `admin/admin` is for initial setup only
2. **Set a strong SESSION_SECRET** - Use a random string in production
3. **Use HTTPS** - Put behind a reverse proxy with SSL (nginx, traefik, caddy)
4. **Limit access** - Consider firewall rules or VPN for production use

## Reverse Proxy (Optional)

### Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name terminal.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## License

MIT
