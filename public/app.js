// Claude Terminal - Main Application
(function() {
    let term = null;
    let fitAddon = null;
    let socket = null;
    let currentSession = null;
    let sessions = [];
    let isFullscreen = false;
    let currentFontSize = 14;

    // Check authentication
    async function checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            if (!data.authenticated) {
                window.location.href = '/login.html';
                return false;
            }
            document.getElementById('userName').textContent = data.username;
            return true;
        } catch (error) {
            window.location.href = '/login.html';
            return false;
        }
    }

    // Logout
    window.logout = async function() {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {}
        window.location.href = '/login.html';
    };

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', async () => {
        if (!await checkAuth()) return;
        initTerminal();
        initMobileLayout();
        loadSessions();
    });

    // Mobile layout adjustments
    function initMobileLayout() {
        if (window.innerWidth <= 968) {
            const sessionManager = document.querySelector('.session-manager');
            const sessionHeader = document.querySelector('.session-manager-header');

            if (sessionHeader && sessionManager) {
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'mobile-toggle-btn';
                toggleBtn.innerHTML = '▼';
                toggleBtn.style.cssText = 'background: var(--accent-primary); color: #000; border: none; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; margin-left: auto;';
                sessionHeader.appendChild(toggleBtn);

                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sessionManager.classList.toggle('collapsed');
                    toggleBtn.innerHTML = sessionManager.classList.contains('collapsed') ? '▶' : '▼';
                });
            }
        }
    }

    // Initialize terminal
    function initTerminal() {
        if (term) return;

        const isMobile = window.innerWidth <= 968;
        currentFontSize = isMobile ? 10 : 14;

        term = new Terminal({
            cursorBlink: true,
            fontSize: currentFontSize,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            theme: {
                background: '#0d0d0d',
                foreground: '#e4e4e7',
                cursor: '#ff9100',
                cursorAccent: '#0d0d0d',
                selectionBackground: 'rgba(255, 145, 0, 0.3)',
            },
            allowProposedApi: true,
            scrollback: 10000,
        });

        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        const container = document.getElementById('claudeTerminalContainer');
        term.open(container);

        setTimeout(() => fitAddon.fit(), 100);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (fitAddon) fitAddon.fit();
            if (socket && socket.connected && currentSession) {
                socket.emit('terminal_resize', {
                    session: currentSession,
                    cols: term.cols,
                    rows: term.rows
                });
            }
        });

        // Send input to server (attach once)
        term.onData((data) => {
            if (socket && socket.connected && currentSession) {
                socket.emit('terminal_input', {
                    session: currentSession,
                    data: data
                });
            }
        });

        // Disable mobile autocapitalize
        setTimeout(() => {
            const textarea = container.querySelector('.xterm-helper-textarea');
            if (textarea) {
                textarea.setAttribute('autocapitalize', 'off');
                textarea.setAttribute('autocomplete', 'off');
                textarea.setAttribute('autocorrect', 'off');
                textarea.setAttribute('spellcheck', 'false');
            }
        }, 500);

        // Initialize controls
        initControls();
    }

    // Initialize button controls
    function initControls() {
        // ESC button
        document.getElementById('btnEsc')?.addEventListener('click', () => {
            if (currentSession && socket) {
                socket.emit('terminal_input', { session: currentSession, data: '\x1b' });
            }
        });

        // Keyboard toggle
        document.getElementById('btnKeyboard')?.addEventListener('click', () => {
            const textarea = document.querySelector('#claudeTerminalContainer .xterm-helper-textarea');
            if (textarea) {
                if (document.activeElement === textarea) {
                    textarea.blur();
                } else {
                    textarea.focus();
                }
            }
        });

        // New window
        document.getElementById('btnNewWindow')?.addEventListener('click', () => {
            sendTmuxCommand('c');
        });

        // Next window
        document.getElementById('btnNextWindow')?.addEventListener('click', () => {
            sendTmuxCommand('n');
        });

        // Scroll mode
        let isScrollMode = false;
        const scrollBtn = document.getElementById('btnTmuxScroll');
        const scrollOverlay = document.getElementById('scrollOverlay');

        scrollBtn?.addEventListener('click', () => {
            if (!currentSession || !socket) return;

            if (isScrollMode) {
                socket.emit('terminal_input', { session: currentSession, data: 'q' });
                scrollBtn.classList.remove('active');
                scrollBtn.querySelector('span').textContent = '📜';
                scrollOverlay?.classList.remove('visible');
            } else {
                sendTmuxCommand('[');
                scrollBtn.classList.add('active');
                scrollBtn.querySelector('span').textContent = '📜 Exit';
                scrollOverlay?.classList.add('visible');
            }
            isScrollMode = !isScrollMode;
        });

        // Scroll buttons
        function sendScrollKeys(direction, count) {
            if (!currentSession || !socket || !isScrollMode) return;
            const key = direction === 'up' ? '\x1b[A' : '\x1b[B';
            let sent = 0;
            const interval = setInterval(() => {
                if (sent >= count || !isScrollMode) {
                    clearInterval(interval);
                    return;
                }
                socket.emit('terminal_input', { session: currentSession, data: key });
                sent++;
            }, 20);
        }

        document.getElementById('btnScrollUp')?.addEventListener('click', () => sendScrollKeys('up', 12));
        document.getElementById('btnScrollDown')?.addEventListener('click', () => sendScrollKeys('down', 12));

        // Copy
        document.getElementById('btnTmuxCopy')?.addEventListener('click', async () => {
            if (term && term.hasSelection()) {
                const text = term.getSelection();
                try {
                    await navigator.clipboard.writeText(text);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
            }
        });

        // Paste
        document.getElementById('btnPaste')?.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && currentSession && socket) {
                    socket.emit('terminal_input', { session: currentSession, data: text });
                }
            } catch (e) {
                console.error('Paste failed:', e);
            }
        });

        // Zoom
        document.getElementById('btnZoomOut')?.addEventListener('click', () => {
            if (currentFontSize > 6) {
                currentFontSize--;
                term.options.fontSize = currentFontSize;
                fitAddon.fit();
            }
        });

        document.getElementById('btnZoomIn')?.addEventListener('click', () => {
            if (currentFontSize < 24) {
                currentFontSize++;
                term.options.fontSize = currentFontSize;
                fitAddon.fit();
            }
        });

        // End session
        document.getElementById('btnEndSession')?.addEventListener('click', () => {
            if (currentSession && confirm(`End session "${currentSession}"?`)) {
                killSession(currentSession);
            }
        });

        // Fullscreen
        document.getElementById('btnFullscreen')?.addEventListener('click', () => {
            const layout = document.querySelector('.claude-code-layout');
            isFullscreen = !isFullscreen;
            layout.classList.toggle('fullscreen', isFullscreen);
            setTimeout(() => fitAddon?.fit(), 300);
        });

        // Sidebar toggle
        document.getElementById('toggleSessions')?.addEventListener('click', () => {
            const sidebar = document.querySelector('.session-manager');
            const toggle = document.getElementById('toggleSessions');
            sidebar.classList.toggle('collapsed');
            toggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
            setTimeout(() => fitAddon?.fit(), 300);
        });

        // Refresh sessions
        document.getElementById('refreshSessions')?.addEventListener('click', loadSessions);

        // Create session
        document.getElementById('createSession')?.addEventListener('click', createSession);
    }

    // Send tmux command (Ctrl+B prefix)
    function sendTmuxCommand(cmd) {
        if (currentSession && socket) {
            socket.emit('terminal_input', {
                session: currentSession,
                data: '\x02' + cmd
            });
        }
    }

    // Load sessions
    async function loadSessions() {
        try {
            const response = await fetch('/api/tmux/sessions');
            sessions = await response.json();
            updateSessionList();
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }

    // Update session list UI
    function updateSessionList() {
        const list = document.getElementById('sessionList');
        if (!list) return;

        if (sessions.length === 0) {
            list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">No sessions. Create one to get started.</div>';
            return;
        }

        list.innerHTML = sessions.map(s => `
            <div class="session-item ${s.name === currentSession ? 'active' : ''}" data-session="${s.name}">
                <div class="session-item-header">
                    <span class="session-name">${s.name}</span>
                    <span class="session-status" style="background: ${s.attached ? 'var(--accent-primary)' : 'var(--success)'}"></span>
                </div>
                <div class="session-meta">${s.windows} window(s)</div>
            </div>
        `).join('');

        // Click handlers
        list.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => {
                const sessionName = item.dataset.session;
                connectToSession(sessionName);
            });
        });
    }

    // Connect to session
    function connectToSession(sessionName) {
        currentSession = sessionName;
        updateSessionList();
        document.getElementById('currentSessionName').textContent = sessionName;

        // Collapse on mobile
        if (window.innerWidth <= 968) {
            const sessionManager = document.querySelector('.session-manager');
            const toggleBtn = sessionManager?.querySelector('.mobile-toggle-btn');
            if (sessionManager && !sessionManager.classList.contains('collapsed')) {
                sessionManager.classList.add('collapsed');
                if (toggleBtn) toggleBtn.innerHTML = '▶';
            }
        }

        // Connect socket
        if (!socket) {
            socket = io('/', { withCredentials: true });

            socket.on('connect', () => {
                console.log('Socket connected');
                attachToSession();
            });

            socket.on('terminal_output', (data) => {
                if (term) term.write(data.data);
            });

            socket.on('terminal_error', (data) => {
                console.error('Terminal error:', data.message);
                if (term) term.write(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
        } else {
            attachToSession();
        }
    }

    // Attach to tmux session
    function attachToSession() {
        if (!socket || !currentSession) return;

        term.clear();
        socket.emit('tmux_attach', {
            session: currentSession,
            cols: term.cols,
            rows: term.rows
        });
    }

    // Create new session
    async function createSession() {
        const name = prompt('Session name:', `claude-${Date.now()}`);
        if (!name) return;

        try {
            const response = await fetch('/api/tmux/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: name })
            });

            if (response.ok) {
                await loadSessions();
                connectToSession(name);
            }
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    }

    // Kill session
    async function killSession(name) {
        try {
            const response = await fetch('/api/tmux/kill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: name })
            });

            if (response.ok) {
                if (currentSession === name) {
                    currentSession = null;
                    document.getElementById('currentSessionName').textContent = 'No session selected';
                    if (term) term.clear();
                }
                await loadSessions();
            }
        } catch (error) {
            console.error('Failed to kill session:', error);
        }
    }
})();
