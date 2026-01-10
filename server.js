const express = require('express');
const { exec } = require('child_process');
const http = require('http');
const socketIO = require('socket.io');
const pty = require('node-pty');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const TMUX_SOCKET = process.env.TMUX_SOCKET || '/tmp/tmux-0';

// Ensure data directories exist
const dataPath = '/app/data';
const sessionsPath = '/app/data/sessions';
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}
if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath, { recursive: true });
}

// Session configuration with file-based storage
const sessionMiddleware = session({
    store: new FileStore({
        path: sessionsPath,
        ttl: 7 * 24 * 60 * 60, // 7 days in seconds
        retries: 0,
        reapInterval: 3600 // Clean up expired sessions every hour
    }),
    secret: process.env.SESSION_SECRET || 'claude-terminal-change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
});

app.use(sessionMiddleware);
app.use(express.json());

// User credentials file
const USERS_FILE = '/app/data/users.json';

// Initialize default users if file doesn't exist
function initializeUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUser = process.env.DEFAULT_USER || 'admin';
        const defaultPass = process.env.DEFAULT_PASS || 'admin';

        const defaultUsers = {
            [defaultUser]: {
                password: bcrypt.hashSync(defaultPass, 10),
                createdAt: new Date().toISOString()
            }
        };
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        console.log(`Created default user: ${defaultUser}`);
    }
}

function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

initializeUsers();

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// Public routes
const publicPaths = ['/login.html', '/api/login', '/api/check-auth', '/styles.css'];

app.use((req, res, next) => {
    if (publicPaths.some(p => req.path === p || req.path.startsWith('/fonts'))) {
        return next();
    }
    if (req.path === '/' || req.path === '/index.html') {
        if (!req.session || !req.session.authenticated) {
            return res.redirect('/login.html');
        }
    }
    next();
});

app.use(express.static('public'));

// Auth endpoints
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const users = getUsers();
    const user = users[username];

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.authenticated = true;
    req.session.username = username;
    req.session.loginTime = new Date().toISOString();

    res.json({ success: true, username });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/api/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const username = req.session.username;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const users = getUsers();
    const user = users[username];

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    users[username].password = bcrypt.hashSync(newPassword, 10);
    users[username].updatedAt = new Date().toISOString();
    saveUsers(users);

    res.json({ success: true });
});

// Protect API routes
app.use('/api', (req, res, next) => {
    if (req.path === '/login' || req.path === '/check-auth' || req.path === '/logout') {
        return next();
    }
    return requireAuth(req, res, next);
});

// Tmux session management
app.get('/api/tmux/sessions', (req, res) => {
    exec('tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}" 2>/dev/null', (error, stdout) => {
        if (error) {
            res.json([]);
            return;
        }

        const sessions = stdout.trim().split('\n').filter(line => line).map(line => {
            const [name, windows, created, attached] = line.split('|');
            return {
                name,
                windows: parseInt(windows) || 0,
                created: parseInt(created) || 0,
                attached: attached === '1',
                createdDate: new Date(parseInt(created) * 1000).toISOString()
            };
        });

        res.json(sessions);
    });
});

app.post('/api/tmux/create', (req, res) => {
    const { sessionName, command } = req.body;
    const name = sessionName || `claude-${Date.now()}`;

    // If command contains shell operators, wrap in bash -c
    let tmuxCmd;
    if (command && (command.includes('&&') || command.includes('||') || command.includes(';'))) {
        // Escape single quotes in command and wrap with bash -c
        const escapedCmd = command.replace(/'/g, "'\\''");
        tmuxCmd = `tmux new-session -d -s "${name}" bash -c '${escapedCmd}; exec bash'`;
    } else {
        const cmd = command || 'bash';
        tmuxCmd = `tmux new-session -d -s "${name}" "${cmd}"`;
    }

    exec(tmuxCmd, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ success: true, session: name });
    });
});

app.post('/api/tmux/kill', (req, res) => {
    const { sessionName } = req.body;

    exec(`tmux kill-session -t "${sessionName}"`, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ success: true });
    });
});

// HTTP server
const server = http.createServer(app);

// Socket.IO server
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Socket.IO authentication middleware
function socketAuthMiddleware(socket, next) {
    const session = socket.request.session;
    if (session && session.authenticated) {
        socket.username = session.username;
        next();
    } else {
        next(new Error('Unauthorized'));
    }
}

io.use(socketAuthMiddleware);

// Store active PTY sessions
const ptySessions = new Map();

io.on('connection', (socket) => {
    console.log(`Client connected (user: ${socket.username})`);

    socket.on('tmux_attach', (data) => {
        const { session, cols, rows } = data;

        try {
            exec(`tmux has-session -t "${session}" 2>/dev/null`, (error) => {
                if (error) {
                    socket.emit('terminal_error', { message: `Tmux session "${session}" not found` });
                    return;
                }

                const term = pty.spawn('tmux', ['attach-session', '-t', session], {
                    name: 'xterm-256color',
                    cols: cols || 80,
                    rows: rows || 24,
                    cwd: process.env.HOME || '/root',
                    env: process.env
                });

                ptySessions.set(socket.id, term);

                term.onData((data) => {
                    socket.emit('terminal_output', { data });
                });

                term.onExit(({ exitCode, signal }) => {
                    console.log(`Terminal exited: ${exitCode}, signal: ${signal}`);
                    ptySessions.delete(socket.id);
                    socket.emit('terminal_error', { message: 'Terminal session ended' });
                });

                console.log(`Attached to tmux session: ${session}`);
            });
        } catch (error) {
            console.error('Error attaching to tmux:', error);
            socket.emit('terminal_error', { message: error.message });
        }
    });

    socket.on('terminal_input', (data) => {
        const term = ptySessions.get(socket.id);
        if (term) {
            term.write(data.data);
        }
    });

    socket.on('terminal_resize', (data) => {
        const term = ptySessions.get(socket.id);
        if (term) {
            term.resize(data.cols, data.rows);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        const term = ptySessions.get(socket.id);
        if (term) {
            term.kill();
            ptySessions.delete(socket.id);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Claude Terminal listening on port ${PORT}`);
    console.log(`Tmux socket path: ${TMUX_SOCKET}`);
    console.log('Sessions persist across container restarts');
});
