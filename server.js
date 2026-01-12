const express = require('express');
const { exec } = require('child_process');
const http = require('http');
const socketIO = require('socket.io');
const pty = require('node-pty');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');

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
const SERVERS_FILE = '/app/data/servers.json';

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

// Initialize servers file with localhost as default
function initializeServers() {
    if (!fs.existsSync(SERVERS_FILE)) {
        const defaultServers = [{
            id: 'local',
            name: 'Localhost',
            host: 'localhost',
            port: 22,
            username: 'root',
            authType: 'local', // 'local' means use local tmux socket, not SSH
            isDefault: true,
            createdAt: new Date().toISOString()
        }];
        fs.writeFileSync(SERVERS_FILE, JSON.stringify(defaultServers, null, 2));
        console.log('Created default servers configuration with localhost');
    }
}

function getServers() {
    try {
        return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveServers(servers) {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

initializeUsers();
initializeServers();

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

// Serve static files with cache control
app.use(express.static('public', {
    setHeaders: (res, path) => {
        // Disable cache for JS/CSS to ensure updates are seen
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Auth endpoints
app.post('/api/login', (req, res) => {
    const { username, password, rememberMe } = req.body;
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

    // Set longer session expiry if "Remember me" is checked (30 days vs 24 hours)
    if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    }

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

// ===== SERVER MANAGEMENT API =====

// Get all servers
app.get('/api/servers', (req, res) => {
    const servers = getServers();
    // Don't send passwords/keys to client
    const safeServers = servers.map(s => ({
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username,
        authType: s.authType,
        isDefault: s.isDefault,
        defaultPath: s.defaultPath || '/root',
        createdAt: s.createdAt
    }));
    res.json(safeServers);
});

// Add new server
app.post('/api/servers', (req, res) => {
    const { name, host, port, username, authType, password, privateKey, defaultPath } = req.body;

    if (!name || !host || !username) {
        return res.status(400).json({ error: 'Name, host, and username are required' });
    }

    if (authType === 'password' && !password) {
        return res.status(400).json({ error: 'Password is required for password authentication' });
    }

    if (authType === 'key' && !privateKey) {
        return res.status(400).json({ error: 'Private key is required for key authentication' });
    }

    const servers = getServers();
    const newServer = {
        id: uuidv4(),
        name,
        host,
        port: port || 22,
        username,
        authType: authType || 'password',
        password: authType === 'password' ? password : undefined,
        privateKey: authType === 'key' ? privateKey : undefined,
        defaultPath: defaultPath || '/root',
        isDefault: false,
        createdAt: new Date().toISOString()
    };

    servers.push(newServer);
    saveServers(servers);

    res.json({
        success: true,
        server: {
            id: newServer.id,
            name: newServer.name,
            host: newServer.host,
            port: newServer.port,
            username: newServer.username,
            authType: newServer.authType,
            defaultPath: newServer.defaultPath,
            isDefault: newServer.isDefault
        }
    });
});

// Update server
app.put('/api/servers/:id', (req, res) => {
    const { id } = req.params;
    const { name, host, port, username, authType, password, privateKey, defaultPath } = req.body;

    const servers = getServers();
    const serverIndex = servers.findIndex(s => s.id === id);

    if (serverIndex === -1) {
        return res.status(404).json({ error: 'Server not found' });
    }

    // Don't allow editing the local server's connection settings
    if (servers[serverIndex].authType === 'local') {
        servers[serverIndex].name = name || servers[serverIndex].name;
        servers[serverIndex].defaultPath = defaultPath || servers[serverIndex].defaultPath || '/srv/containers';
    } else {
        servers[serverIndex] = {
            ...servers[serverIndex],
            name: name || servers[serverIndex].name,
            host: host || servers[serverIndex].host,
            port: port || servers[serverIndex].port,
            username: username || servers[serverIndex].username,
            authType: authType || servers[serverIndex].authType,
            password: authType === 'password' ? (password || servers[serverIndex].password) : undefined,
            privateKey: authType === 'key' ? (privateKey || servers[serverIndex].privateKey) : undefined,
            defaultPath: defaultPath || servers[serverIndex].defaultPath || '/root',
            updatedAt: new Date().toISOString()
        };
    }

    saveServers(servers);
    res.json({ success: true });
});

// Delete server
app.delete('/api/servers/:id', (req, res) => {
    const { id } = req.params;

    const servers = getServers();
    const serverIndex = servers.findIndex(s => s.id === id);

    if (serverIndex === -1) {
        return res.status(404).json({ error: 'Server not found' });
    }

    // Don't allow deleting the local server
    if (servers[serverIndex].authType === 'local') {
        return res.status(400).json({ error: 'Cannot delete the localhost server' });
    }

    servers.splice(serverIndex, 1);
    saveServers(servers);

    res.json({ success: true });
});

// Set default server
app.post('/api/servers/:id/default', (req, res) => {
    const { id } = req.params;

    const servers = getServers();
    const serverIndex = servers.findIndex(s => s.id === id);

    if (serverIndex === -1) {
        return res.status(404).json({ error: 'Server not found' });
    }

    servers.forEach(s => s.isDefault = false);
    servers[serverIndex].isDefault = true;
    saveServers(servers);

    res.json({ success: true });
});

// Test server connection
app.post('/api/servers/:id/test', async (req, res) => {
    const { id } = req.params;

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    if (server.authType === 'local') {
        // Test local tmux
        exec('tmux list-sessions 2>/dev/null', (error, stdout) => {
            res.json({ success: true, message: 'Local tmux is accessible' });
        });
        return;
    }

    // Test SSH connection
    const conn = new Client();
    let responded = false;

    conn.on('ready', () => {
        if (!responded) {
            responded = true;
            conn.end();
            res.json({ success: true, message: 'SSH connection successful' });
        }
    });

    conn.on('error', (err) => {
        if (!responded) {
            responded = true;
            res.status(500).json({ error: `Connection failed: ${err.message}` });
        }
    });

    const connectConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        readyTimeout: 10000
    };

    if (server.authType === 'password') {
        connectConfig.password = server.password;
    } else if (server.authType === 'key') {
        connectConfig.privateKey = server.privateKey;
    }

    try {
        conn.connect(connectConfig);
    } catch (err) {
        if (!responded) {
            responded = true;
            res.status(500).json({ error: `Connection failed: ${err.message}` });
        }
    }
});

// ===== TMUX SESSION MANAGEMENT =====

// Get tmux sessions for a server
app.get('/api/servers/:id/sessions', (req, res) => {
    const { id } = req.params;

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    if (server.authType === 'local') {
        // Local tmux sessions
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
                    createdDate: new Date(parseInt(created) * 1000).toISOString(),
                    serverId: id
                };
            });

            res.json(sessions);
        });
    } else {
        // Remote tmux sessions via SSH
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec('tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}" 2>/dev/null', (err, stream) => {
                if (err) {
                    conn.end();
                    return res.json([]);
                }

                let data = '';
                stream.on('data', (chunk) => {
                    data += chunk.toString();
                });

                stream.on('close', () => {
                    conn.end();
                    const sessions = data.trim().split('\n').filter(line => line).map(line => {
                        const [name, windows, created, attached] = line.split('|');
                        return {
                            name,
                            windows: parseInt(windows) || 0,
                            created: parseInt(created) || 0,
                            attached: attached === '1',
                            createdDate: new Date(parseInt(created) * 1000).toISOString(),
                            serverId: id
                        };
                    });
                    res.json(sessions);
                });
            });
        });

        conn.on('error', (err) => {
            console.error('SSH error:', err.message);
            res.json([]);
        });

        const connectConfig = {
            host: server.host,
            port: server.port,
            username: server.username,
            readyTimeout: 10000
        };

        if (server.authType === 'password') {
            connectConfig.password = server.password;
        } else if (server.authType === 'key') {
            connectConfig.privateKey = server.privateKey;
        }

        conn.connect(connectConfig);
    }
});

// Create tmux session on a server
app.post('/api/servers/:id/sessions', (req, res) => {
    const { id } = req.params;
    const { sessionName, command } = req.body;

    console.log(`Creating session: ${sessionName} on server ${id}`);

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        console.log('Server not found:', id);
        return res.status(404).json({ error: 'Server not found' });
    }

    console.log(`Server found: ${server.name} (${server.host})`);
    const name = sessionName || `claude-${Date.now()}`;

    // Build tmux command
    let tmuxCmd;
    if (command && (command.includes('&&') || command.includes('||') || command.includes(';'))) {
        const escapedCmd = command.replace(/'/g, "'\\''");
        tmuxCmd = `tmux new-session -d -s "${name}" bash -c '${escapedCmd}; exec bash'`;
    } else {
        const cmd = command || 'bash';
        tmuxCmd = `tmux new-session -d -s "${name}" "${cmd}"`;
    }

    if (server.authType === 'local') {
        exec(tmuxCmd, (error) => {
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ success: true, session: name, serverId: id });
        });
    } else {
        const conn = new Client();

        conn.on('ready', () => {
            console.log(`SSH connected to ${server.host}, executing: ${tmuxCmd}`);
            conn.exec(tmuxCmd, (err, stream) => {
                if (err) {
                    console.error('SSH exec error:', err.message);
                    conn.end();
                    return res.status(500).json({ error: err.message });
                }

                let stderr = '';
                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                stream.on('close', (code) => {
                    console.log(`SSH command completed with code: ${code}`);
                    if (stderr) console.log('SSH stderr:', stderr);
                    conn.end();
                    if (code === 0 || code === null) {
                        res.json({ success: true, session: name, serverId: id });
                    } else {
                        res.status(500).json({ error: stderr || 'Failed to create session' });
                    }
                });

                // Timeout in case stream doesn't close - verify session exists
                setTimeout(() => {
                    if (res.headersSent) return;

                    console.log('SSH exec timeout - verifying session exists');
                    conn.exec(`tmux has-session -t "${name}" 2>/dev/null && echo EXISTS`, (err, verifyStream) => {
                        let output = '';
                        if (err) {
                            conn.end();
                            res.status(500).json({ error: 'Timeout verifying session' });
                            return;
                        }
                        verifyStream.on('data', (data) => { output += data.toString(); });
                        verifyStream.on('close', () => {
                            conn.end();
                            if (output.includes('EXISTS')) {
                                console.log('Session verified after timeout');
                                res.json({ success: true, session: name, serverId: id });
                            } else {
                                console.log('Session not found after timeout');
                                res.status(500).json({ error: 'Session creation timed out' });
                            }
                        });
                    });
                }, 10000);
            });
        });

        conn.on('error', (err) => {
            console.error('SSH connection error:', err.message);
            res.status(500).json({ error: `SSH error: ${err.message}` });
        });

        const connectConfig = {
            host: server.host,
            port: server.port,
            username: server.username,
            readyTimeout: 10000
        };

        if (server.authType === 'password') {
            connectConfig.password = server.password;
        } else if (server.authType === 'key') {
            connectConfig.privateKey = server.privateKey;
        }

        conn.connect(connectConfig);
    }
});

// Kill tmux session on a server
app.delete('/api/servers/:id/sessions/:session', (req, res) => {
    const { id, session } = req.params;

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    const tmuxCmd = `tmux kill-session -t "${session}"`;

    if (server.authType === 'local') {
        exec(tmuxCmd, (error) => {
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ success: true });
        });
    } else {
        const conn = new Client();
        let responded = false;

        const respond = (success, error = null) => {
            if (responded) return;
            responded = true;
            conn.end();
            if (error) {
                res.status(500).json({ error });
            } else {
                res.json({ success: true });
            }
        };

        conn.on('ready', () => {
            conn.exec(tmuxCmd, (err, stream) => {
                if (err) {
                    return respond(false, err.message);
                }

                // Kill command is instant - respond after small delay
                setTimeout(() => respond(true), 200);

                stream.on('close', () => respond(true));
                stream.on('data', () => {});
                stream.stderr.on('data', () => {});
            });
        });

        conn.on('error', (err) => {
            respond(false, `SSH error: ${err.message}`);
        });

        // Timeout for entire operation
        setTimeout(() => respond(true), 3000);

        const connectConfig = {
            host: server.host,
            port: server.port,
            username: server.username,
            readyTimeout: 3000
        };

        if (server.authType === 'password') {
            connectConfig.password = server.password;
        } else if (server.authType === 'key') {
            connectConfig.privateKey = server.privateKey;
        }

        conn.connect(connectConfig);
    }
});

// Get windows for a tmux session
app.get('/api/servers/:id/sessions/:session/windows', (req, res) => {
    const { id, session } = req.params;

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    const tmuxCmd = `tmux list-windows -t "${session}" -F "#{window_index}|#{window_name}|#{window_active}" 2>/dev/null`;

    if (server.authType === 'local') {
        exec(tmuxCmd, (error, stdout) => {
            if (error) {
                res.json([]);
                return;
            }

            const windows = stdout.trim().split('\n').filter(line => line).map(line => {
                const [index, name, active] = line.split('|');
                return {
                    index: parseInt(index),
                    name,
                    active: active === '1'
                };
            });

            res.json(windows);
        });
    } else {
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(tmuxCmd, (err, stream) => {
                if (err) {
                    conn.end();
                    return res.json([]);
                }

                let output = '';
                stream.on('data', (data) => { output += data.toString(); });
                stream.on('close', () => {
                    conn.end();
                    const windows = output.trim().split('\n').filter(line => line).map(line => {
                        const [index, name, active] = line.split('|');
                        return {
                            index: parseInt(index),
                            name,
                            active: active === '1'
                        };
                    });
                    res.json(windows);
                });
            });
        });

        conn.on('error', () => {
            res.json([]);
        });

        const connectConfig = {
            host: server.host,
            port: server.port,
            username: server.username,
            readyTimeout: 10000
        };

        if (server.authType === 'password') {
            connectConfig.password = server.password;
        } else if (server.authType === 'key') {
            connectConfig.privateKey = server.privateKey;
        }

        conn.connect(connectConfig);
    }
});

// Kill a specific window in a tmux session
app.delete('/api/servers/:id/sessions/:session/windows/:windowIndex', (req, res) => {
    const { id, session, windowIndex } = req.params;

    const servers = getServers();
    const server = servers.find(s => s.id === id);

    if (!server) {
        return res.status(404).json({ error: 'Server not found' });
    }

    const tmuxCmd = `tmux kill-window -t "${session}:${windowIndex}"`;

    if (server.authType === 'local') {
        exec(tmuxCmd, (error) => {
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ success: true });
        });
    } else {
        const conn = new Client();

        conn.on('ready', () => {
            conn.exec(tmuxCmd, (err, stream) => {
                if (err) {
                    conn.end();
                    return res.status(500).json({ error: err.message });
                }

                stream.on('close', () => {
                    conn.end();
                    res.json({ success: true });
                });
            });
        });

        conn.on('error', (err) => {
            res.status(500).json({ error: `SSH error: ${err.message}` });
        });

        const connectConfig = {
            host: server.host,
            port: server.port,
            username: server.username,
            readyTimeout: 10000
        };

        if (server.authType === 'password') {
            connectConfig.password = server.password;
        } else if (server.authType === 'key') {
            connectConfig.privateKey = server.privateKey;
        }

        conn.connect(connectConfig);
    }
});

// Legacy tmux endpoints (for backward compatibility)
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
                createdDate: new Date(parseInt(created) * 1000).toISOString(),
                serverId: 'local'
            };
        });

        res.json(sessions);
    });
});

app.post('/api/tmux/create', (req, res) => {
    const { sessionName, command } = req.body;
    const name = sessionName || `claude-${Date.now()}`;

    let tmuxCmd;
    if (command && (command.includes('&&') || command.includes('||') || command.includes(';'))) {
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
        res.json({ success: true, session: name, serverId: 'local' });
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

// Store active connections
const ptySessions = new Map(); // Local PTY sessions
const sshConnections = new Map(); // Remote SSH connections

io.on('connection', (socket) => {
    console.log(`Client connected (user: ${socket.username})`);

    // Attach to tmux session (works for both local and remote)
    socket.on('tmux_attach', (data) => {
        const { session, serverId, cols, rows } = data;

        const servers = getServers();
        const server = servers.find(s => s.id === serverId);

        if (!server) {
            socket.emit('terminal_error', { message: 'Server not found' });
            return;
        }

        // Cleanup any existing connection for this socket
        cleanupSocketConnection(socket.id);

        if (server.authType === 'local') {
            // Local tmux attachment
            attachLocalTmux(socket, session, cols, rows);
        } else {
            // Remote SSH tmux attachment
            attachRemoteTmux(socket, server, session, cols, rows);
        }
    });

    socket.on('terminal_input', (data) => {
        // Check for local PTY session first
        const ptySession = ptySessions.get(socket.id);
        if (ptySession) {
            ptySession.write(data.data);
            return;
        }

        // Check for SSH connection
        const sshSession = sshConnections.get(socket.id);
        if (sshSession && sshSession.stream) {
            sshSession.stream.write(data.data);
        }
    });

    socket.on('terminal_resize', (data) => {
        const { cols, rows } = data;

        const ptySession = ptySessions.get(socket.id);
        if (ptySession) {
            ptySession.resize(cols, rows);
            return;
        }

        const sshSession = sshConnections.get(socket.id);
        if (sshSession && sshSession.stream) {
            sshSession.stream.setWindow(rows, cols, 0, 0);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        cleanupSocketConnection(socket.id);
    });
});

// Helper function to attach to local tmux
function attachLocalTmux(socket, session, cols, rows) {
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

        console.log(`Attached to local tmux session: ${session}`);
    });
}

// Helper function to attach to remote tmux via SSH
function attachRemoteTmux(socket, server, session, cols, rows) {
    const conn = new Client();

    conn.on('ready', () => {
        // Start an interactive shell with tmux attach
        conn.shell({
            term: 'xterm-256color',
            cols: cols || 80,
            rows: rows || 24
        }, (err, stream) => {
            if (err) {
                conn.end();
                socket.emit('terminal_error', { message: `Failed to start shell: ${err.message}` });
                return;
            }

            sshConnections.set(socket.id, { conn, stream });

            stream.on('data', (data) => {
                socket.emit('terminal_output', { data: data.toString() });
            });

            stream.on('close', () => {
                console.log(`SSH stream closed for session: ${session}`);
                sshConnections.delete(socket.id);
                conn.end();
                socket.emit('terminal_error', { message: 'SSH connection closed' });
            });

            // Attach to tmux session
            stream.write(`tmux attach-session -t "${session}"\n`);
            console.log(`Attached to remote tmux session: ${session} on ${server.host}`);
        });
    });

    conn.on('error', (err) => {
        console.error('SSH connection error:', err.message);
        socket.emit('terminal_error', { message: `SSH error: ${err.message}` });
    });

    const connectConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        readyTimeout: 10000
    };

    if (server.authType === 'password') {
        connectConfig.password = server.password;
    } else if (server.authType === 'key') {
        connectConfig.privateKey = server.privateKey;
    }

    conn.connect(connectConfig);
}

// Cleanup function for socket disconnection
function cleanupSocketConnection(socketId) {
    const ptySession = ptySessions.get(socketId);
    if (ptySession) {
        // Use SIGKILL to prevent any signals being sent to tmux
        // Default kill() sends SIGHUP which can cause issues
        ptySession.kill('SIGKILL');
        ptySessions.delete(socketId);
    }

    const sshSession = sshConnections.get(socketId);
    if (sshSession) {
        if (sshSession.stream) {
            sshSession.stream.end();
        }
        if (sshSession.conn) {
            sshSession.conn.end();
        }
        sshConnections.delete(socketId);
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Claude Terminal listening on port ${PORT}`);
    console.log(`Tmux socket path: ${TMUX_SOCKET}`);
    console.log('Multi-server support enabled');
    console.log('Sessions persist across container restarts');
});
