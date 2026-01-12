// Claude Terminal - Main Application with Multi-Server Support (Sidebar Layout)
(function() {
    let term = null;
    let fitAddon = null;
    let socket = null;
    let currentSession = null;
    let currentServerId = null;
    let sessions = [];
    let servers = [];
    let currentFontSize = 14;
    let isScrollMode = false;

    // Toast notification system
    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type] || 'Notice'}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        container.appendChild(toast);

        const closeToast = () => {
            toast.classList.add('toast-leaving');
            setTimeout(() => toast.remove(), 200);
        };

        toast.querySelector('.toast-close').addEventListener('click', closeToast);

        if (duration > 0) {
            setTimeout(closeToast, duration);
        }

        return toast;
    }

    // Custom confirmation dialog
    function showConfirm(options) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');
            const iconEl = document.getElementById('confirmIcon');
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');

            titleEl.textContent = options.title || 'Confirm';
            messageEl.textContent = options.message || 'Are you sure?';
            iconEl.textContent = options.icon || '⚠️';
            okBtn.textContent = options.confirmText || 'Confirm';
            cancelBtn.textContent = options.cancelText || 'Cancel';

            // Update button style based on type
            okBtn.className = 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary');

            modal.classList.remove('hidden');

            function cleanup() {
                modal.classList.add('hidden');
                okBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onBackdrop);
            }

            function onConfirm() {
                cleanup();
                resolve(true);
            }

            function onCancel() {
                cleanup();
                resolve(false);
            }

            function onBackdrop(e) {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            }

            okBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onBackdrop);
        });
    }

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
        await loadServers();
        initTerminal();
        initMobileLayout();
        initControls();
        await loadSessions();
    });

    // ===== SERVER MANAGEMENT =====

    async function loadServers() {
        try {
            const response = await fetch('/api/servers');
            servers = await response.json();

            // Set default server
            const defaultServer = servers.find(s => s.isDefault) || servers[0];
            if (defaultServer) {
                currentServerId = defaultServer.id;
            }

            updateServerDropdowns();
        } catch (error) {
            console.error('Failed to load servers:', error);
            servers = [];
        }
    }

    function updateServerDropdowns() {
        // Modal server dropdown (New Session modal)
        const modalSelect = document.getElementById('sessionServer');
        if (modalSelect) {
            modalSelect.innerHTML = servers.map(s =>
                `<option value="${s.id}" ${s.id === currentServerId ? 'selected' : ''}>${s.name}${s.authType !== 'local' ? ' (' + s.host + ')' : ''}</option>`
            ).join('');
        }

        updateServerInfo();
    }

    function updateServerInfo() {
        const infoEl = document.getElementById('currentServerInfo');
        if (infoEl) {
            // Only show server info when a session is selected
            if (currentSession && currentServerId) {
                const server = servers.find(s => s.id === currentServerId);
                if (server) {
                    infoEl.textContent = server.authType === 'local' ? 'Local' : server.name;
                }
            } else {
                infoEl.textContent = '';
            }
        }
    }

    // ===== SESSION MANAGEMENT =====

    async function loadSessions() {
        sessions = [];

        // Load sessions from all servers
        for (const server of servers) {
            try {
                const response = await fetch(`/api/servers/${server.id}/sessions`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        // Add server info to each session
                        data.forEach(s => {
                            s.serverId = server.id;
                            s.serverName = server.name;
                            s.serverType = server.authType;
                        });
                        sessions.push(...data);
                    }
                }
            } catch (error) {
                console.error(`Failed to load sessions from ${server.name}:`, error);
            }
        }

        updateSessionList();
    }

    function updateSessionList() {
        const list = document.getElementById('sessionList');
        if (!list) return;

        if (!sessions || sessions.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">No sessions. Create one to get started.</div>';
            return;
        }

        list.innerHTML = sessions.map((s, i) => {
            const isActive = s.name === currentSession && s.serverId === currentServerId;
            return `
            <div class="session-item stagger-item ${isActive ? 'active' : ''}" data-session="${s.name}" data-server="${s.serverId}" style="animation-delay: ${i * 0.05}s">
                <div class="session-item-header">
                    <span class="session-name">${s.name}</span>
                    <div class="session-item-right">
                        <span class="session-status" style="background: ${isActive ? 'var(--success)' : 'var(--accent-primary)'}"></span>
                        <span class="session-close" data-session="${s.name}" data-server="${s.serverId}" title="End session">&times;</span>
                    </div>
                </div>
                <div class="session-meta">${s.serverType === 'local' ? '● Local' : '○ ' + s.serverName} · ${s.windows} win</div>
            </div>
        `;
        }).join('');

        // Click handlers for session items
        list.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't connect if clicking the close button
                if (e.target.classList.contains('session-close')) return;
                const sessionName = item.dataset.session;
                const serverId = item.dataset.server;
                connectToSession(sessionName, serverId);
            });
        });

        // Click handlers for close buttons
        list.querySelectorAll('.session-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionName = closeBtn.dataset.session;
                const serverId = closeBtn.dataset.server;
                const sessionElement = closeBtn.closest('.session-item');
                const confirmed = await showConfirm({
                    title: 'End Session',
                    message: `Are you sure you want to end "${sessionName}"? This will terminate all processes in this session.`,
                    icon: '⏹️',
                    confirmText: 'End Session',
                    danger: true
                });
                if (confirmed) {
                    killSessionOnServer(sessionName, serverId, sessionElement);
                }
            });
        });
    }

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
                    cols: term.cols,
                    rows: term.rows
                });
            }
        });

        // Send input to server
        term.onData((data) => {
            if (socket && socket.connected && currentSession) {
                socket.emit('terminal_input', { data });
            }
        });

        // Auto-copy on selection (desktop) - track selection during drag
        let lastSelection = '';

        // Continuously track selection while mouse is down
        container.addEventListener('mousemove', (e) => {
            if (e.buttons === 1 && term.hasSelection()) { // Left mouse button held
                lastSelection = term.getSelection();
            }
        });

        // Copy on mouse release if we captured a selection
        container.addEventListener('mouseup', () => {
            if (lastSelection) {
                navigator.clipboard.writeText(lastSelection).then(() => {
                    showToast('Copied to clipboard', 'success', 1500);
                }).catch((err) => {
                    console.error('Copy failed:', err);
                });
                lastSelection = '';
            }
        });

        // Handle Ctrl+V for paste using xterm's custom key handler
        // This intercepts before xterm processes the key
        term.attachCustomKeyEventHandler((e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.type === 'keydown') {
                navigator.clipboard.readText().then((text) => {
                    if (text && socket && socket.connected && currentSession) {
                        socket.emit('terminal_input', { data: text });
                    }
                }).catch((err) => {
                    console.error('Paste failed:', err);
                });
                return false; // Prevent xterm from processing this key
            }
            return true; // Let xterm handle all other keys
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

        // Show welcome message
        const location = isMobile ? 'above' : 'on the left';
        term.writeln('');
        term.writeln('  \x1b[1;38;5;214m⚡ CLAUDE TERMINAL\x1b[0m');
        term.writeln('');
        term.writeln(`  \x1b[90mSelect a session ${location} or create a new one\x1b[0m`);
        term.writeln('');
    }

    // Initialize button controls
    function initControls() {
        // Force scroll mode OFF on page load (can't preserve state across reloads)
        isScrollMode = false;
        const scrollBtn = document.getElementById('btnTmuxScroll');
        const scrollOverlay = document.getElementById('scrollOverlay');
        if (scrollBtn) {
            scrollBtn.classList.remove('active');
            const span = scrollBtn.querySelector('span');
            if (span) span.textContent = 'Scroll';
        }
        if (scrollOverlay) {
            scrollOverlay.classList.remove('visible');
        }

        // ESC button
        document.getElementById('btnEsc')?.addEventListener('click', () => {
            if (currentSession && socket) {
                socket.emit('terminal_input', { data: '\x1b' });
            }
        });


        // New window
        document.getElementById('btnNewWindow')?.addEventListener('click', () => {
            sendTmuxCommand('c');
            setTimeout(loadWindows, 500);
        });

        // Next window
        document.getElementById('btnNextWindow')?.addEventListener('click', () => {
            sendTmuxCommand('n');
            setTimeout(loadWindows, 600);
        });

        // Scroll mode (scrollBtn and scrollOverlay already declared at top of function)
        scrollBtn?.addEventListener('click', () => {
            if (!currentSession || !socket) return;

            if (isScrollMode) {
                socket.emit('terminal_input', { data: '\x1b' }); // ESC to exit copy mode
                scrollBtn.classList.remove('active');
                scrollBtn.querySelector('span').textContent = 'Scroll';
                scrollOverlay?.classList.remove('visible');
            } else {
                sendTmuxCommand('[');
                scrollBtn.classList.add('active');
                scrollBtn.querySelector('span').textContent = 'Exit Scroll';
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
                socket.emit('terminal_input', { data: key });
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
                    socket.emit('terminal_input', { data: text });
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
                setTimeout(() => {
                    fitAddon.fit();
                    socket?.emit('terminal_resize', { cols: term.cols, rows: term.rows });
                }, 50);
            }
        });

        document.getElementById('btnZoomIn')?.addEventListener('click', () => {
            if (currentFontSize < 24) {
                currentFontSize++;
                term.options.fontSize = currentFontSize;
                setTimeout(() => {
                    fitAddon.fit();
                    socket?.emit('terminal_resize', { cols: term.cols, rows: term.rows });
                }, 50);
            }
        });

        // End session
        document.getElementById('btnEndSession')?.addEventListener('click', async () => {
            if (!currentSession) return;
            const confirmed = await showConfirm({
                title: 'End Session',
                message: `Are you sure you want to end "${currentSession}"? This will terminate all processes in this session.`,
                icon: '⏹️',
                confirmText: 'End Session',
                danger: true
            });
            if (confirmed) {
                killSession(currentSession);
            }
        });


        // Sidebar toggle
        document.getElementById('toggleSessions')?.addEventListener('click', () => {
            const sidebar = document.querySelector('.session-manager');
            const toggle = document.getElementById('toggleSessions');
            sidebar.classList.toggle('collapsed');
            toggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
            setTimeout(() => fitAddon?.fit(), 300);
        });

        // Create session - open modal
        document.getElementById('createSession')?.addEventListener('click', openNewSessionModal);

        // User menu dropdown
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        const userMenu = document.querySelector('.user-menu');

        userMenuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('hidden');
            userMenu.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            userMenuDropdown?.classList.add('hidden');
            userMenu?.classList.remove('open');
        });

        // Manage servers button (in dropdown)
        document.getElementById('manageServersBtn')?.addEventListener('click', () => {
            userMenuDropdown?.classList.add('hidden');
            userMenu?.classList.remove('open');
            openServersModal();
        });

        // Change password button (in dropdown)
        document.getElementById('changePasswordBtn')?.addEventListener('click', () => {
            userMenuDropdown?.classList.add('hidden');
            userMenu?.classList.remove('open');
            openChangePasswordModal();
        });

        // Add new server button in modal - opens the full server modal
        document.getElementById('addNewServerBtn')?.addEventListener('click', () => {
            closeNewSessionModal();
            openEditServerModal(null, true); // true = return to new session modal after save
        });

        // Edit server auth type change
        document.getElementById('editServerAuthType')?.addEventListener('change', (e) => {
            const passwordGroup = document.getElementById('editPasswordGroup');
            const keyGroup = document.getElementById('editKeyGroup');
            if (e.target.value === 'password') {
                passwordGroup?.classList.remove('hidden');
                keyGroup?.classList.add('hidden');
            } else {
                passwordGroup?.classList.add('hidden');
                keyGroup?.classList.remove('hidden');
            }
        });

        // Add server from servers modal
        document.getElementById('addServerModalBtn')?.addEventListener('click', () => {
            closeServersModal();
            openEditServerModal();
        });

        // Update working directory when server selection changes
        document.getElementById('sessionServer')?.addEventListener('change', () => {
            updateSessionDirFromServer();
        });

        // Regenerate session name button
        document.getElementById('regenerateNameBtn')?.addEventListener('click', () => {
            document.getElementById('newSessionName').value = generateSessionName();
        });
    }

    // Send tmux command (Ctrl+B prefix)
    function sendTmuxCommand(cmd) {
        if (currentSession && socket) {
            socket.emit('terminal_input', { data: '\x02' + cmd });
        }
    }

    // Load windows for current session
    async function loadWindows() {
        const tabsContainer = document.getElementById('windowTabs');
        if (!tabsContainer || !currentSession || !currentServerId) {
            if (tabsContainer) tabsContainer.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/api/servers/${currentServerId}/sessions/${currentSession}/windows`);
            if (!response.ok) {
                tabsContainer.innerHTML = '';
                return;
            }

            const windows = await response.json();

            // Only show tabs if more than 1 window
            if (windows.length <= 1) {
                tabsContainer.innerHTML = '';
                return;
            }

            tabsContainer.innerHTML = windows.map((w, i) => `
                <button class="window-tab stagger-item ${w.active ? 'active' : ''}" data-index="${w.index}" title="Window ${i + 1} (${w.name})" style="animation-delay: ${i * 0.05}s">
                    <span class="window-tab-name">Win ${i + 1}</span>
                    <span class="window-tab-close" data-index="${w.index}" title="Close window">&times;</span>
                </button>
            `).join('');

            // Click handlers for window tabs
            tabsContainer.querySelectorAll('.window-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    // Don't switch if clicking the close button
                    if (e.target.classList.contains('window-tab-close')) return;
                    const index = tab.dataset.index;
                    switchWindow(index);
                });
            });

            // Click handlers for close buttons
            tabsContainer.querySelectorAll('.window-tab-close').forEach(closeBtn => {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = closeBtn.dataset.index;
                    closeWindow(index);
                });
            });
        } catch (error) {
            console.error('Failed to load windows:', error);
            tabsContainer.innerHTML = '';
        }
    }

    // Switch to a specific window
    function switchWindow(index) {
        if (currentSession && socket) {
            // Send tmux command to select window: Ctrl+B then window number
            socket.emit('terminal_input', { data: `\x02${index}` });
            // Refresh window tabs after a short delay
            setTimeout(loadWindows, 300);
        }
    }

    // Close a specific window
    async function closeWindow(index) {
        if (!currentSession || !currentServerId) return;

        try {
            const response = await fetch(`/api/servers/${currentServerId}/sessions/${currentSession}/windows/${index}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Refresh window tabs
                setTimeout(loadWindows, 300);
            } else {
                const error = await response.json();
                console.error('Failed to close window:', error);
            }
        } catch (error) {
            console.error('Failed to close window:', error);
        }
    }

    // Connect to session
    function connectToSession(sessionName, serverId) {
        currentSession = sessionName;
        if (serverId) currentServerId = serverId;
        updateSessionList();
        updateServerInfo();
        loadWindows();
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
        if (!socket || !currentSession || !currentServerId) return;

        // Reset scroll mode UI state (important for reconnections after container restart)
        isScrollMode = false;
        const scrollBtn = document.getElementById('btnTmuxScroll');
        const scrollOverlay = document.getElementById('scrollOverlay');
        if (scrollBtn) {
            scrollBtn.classList.remove('active');
            const span = scrollBtn.querySelector('span');
            if (span) span.textContent = 'Scroll';
        }
        if (scrollOverlay) {
            scrollOverlay.classList.remove('visible');
        }

        term.clear();
        socket.emit('tmux_attach', {
            session: currentSession,
            serverId: currentServerId,
            cols: term.cols,
            rows: term.rows
        });

        // Auto-focus terminal so user can start typing immediately
        term.focus();
    }

    // Kill session
    async function killSession(name) {
        if (!currentServerId) return;
        await killSessionOnServer(name, currentServerId);
    }

    async function killSessionOnServer(name, serverId, sessionElement = null) {
        if (!serverId) return;

        const isCurrentSession = currentSession === name && currentServerId === serverId;

        // FIRST: If this is current session, disconnect socket immediately to stop receiving data
        if (isCurrentSession) {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            // Clear terminal and show ending message immediately
            if (term) {
                term.clear();
                term.writeln('');
                term.writeln('  \x1b[1;38;5;214m⚡ CLAUDE TERMINAL\x1b[0m');
                term.writeln('  \x1b[38;5;245mEnding session...\x1b[0m');
            }
            currentSession = null;
            document.getElementById('currentSessionName').textContent = 'No session selected';
            document.getElementById('windowTabs').innerHTML = '';
            updateServerInfo();
        }

        // Fade out session element
        if (sessionElement) {
            sessionElement.style.opacity = '0.4';
            sessionElement.style.pointerEvents = 'none';
        }

        // NOW kill the session on server (socket already disconnected, won't receive exit message)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            await fetch(`/api/servers/${serverId}/sessions/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
        } catch (error) {
            console.error('Failed to kill session:', error);
        }

        // Update terminal with final message
        if (isCurrentSession && term) {
            term.clear();
            term.writeln('');
            term.writeln('  \x1b[1;38;5;214m⚡ CLAUDE TERMINAL\x1b[0m');
            term.writeln('  \x1b[38;5;244mSession ended\x1b[0m');
            term.writeln('');
            term.writeln('  \x1b[90mSelect a session or create a new one\x1b[0m');
            term.writeln('');
        }

        await loadSessions();
    }

    // ===== NEW SESSION MODAL =====

    window.openNewSessionModal = function() {
        const modal = document.getElementById('newSessionModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('newSessionName').value = generateSessionName();
            document.getElementById('startClaudeCode').checked = true;
            updateServerDropdowns();

            // Set working directory based on selected server's default path
            updateSessionDirFromServer();
        }
    };

    function updateSessionDirFromServer() {
        const serverSelect = document.getElementById('sessionServer');
        const dirInput = document.getElementById('newSessionDir');
        if (serverSelect && dirInput) {
            const server = servers.find(s => s.id === serverSelect.value);
            dirInput.value = server?.defaultPath || '/root';
        }
    }

    window.closeNewSessionModal = function() {
        const modal = document.getElementById('newSessionModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    window.setSessionDir = function(dir) {
        document.getElementById('newSessionDir').value = dir;
    };

    // Fun session name generator
    const sessionAdjectives = ['swift', 'cosmic', 'quantum', 'hyper', 'turbo', 'mega', 'ultra', 'super', 'epic', 'mighty'];
    const sessionNouns = ['falcon', 'phoenix', 'dragon', 'wolf', 'raven', 'tiger', 'hawk', 'viper', 'spark', 'bolt',
        'r2d2', 'c3po', 'bb8', 'k2so', 'ig11', 'grogu', 'yoda', 'chewie', 'solo', 'leia'];

    function generateSessionName() {
        const adj = sessionAdjectives[Math.floor(Math.random() * sessionAdjectives.length)];
        const noun = sessionNouns[Math.floor(Math.random() * sessionNouns.length)];
        return `claude-${adj}-${noun}`;
    }

    window.submitNewSession = async function() {
        const serverSelect = document.getElementById('sessionServer');
        const nameInput = document.getElementById('newSessionName');
        const dirInput = document.getElementById('newSessionDir');
        const claudeCheckbox = document.getElementById('startClaudeCode');
        const loadingOverlay = document.getElementById('newSessionLoading');

        const serverId = serverSelect.value;
        const sessionName = nameInput.value.trim() || generateSessionName();
        const directory = dirInput.value.trim() || '/root';
        const startClaude = claudeCheckbox.checked;

        // Show loading overlay
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }

        // Build command
        let command = `cd ${directory} && clear`;
        if (startClaude) {
            // Try claude from PATH first, then user's local bin, then show error
            command += ' && (command -v claude >/dev/null 2>&1 && exec claude || [ -x "$HOME/.local/bin/claude" ] && exec "$HOME/.local/bin/claude" || echo "Error: Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code")';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(`/api/servers/${serverId}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName, command }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                closeNewSessionModal();

                // Switch to the server if different
                if (serverId !== currentServerId) {
                    currentServerId = serverId;
                    updateServerDropdowns();
                    updateServerInfo();
                }

                await loadSessions();
                connectToSession(sessionName);
            } else {
                const error = await response.json();
                showToast('Failed to create session: ' + (error.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            console.error('Error type:', typeof error, 'Name:', error?.name, 'Message:', error?.message);
            if (error.name === 'AbortError') {
                showToast('Request timed out. The session may still have been created - try refreshing.', 'warning');
            } else {
                showToast('Failed to create session: ' + (error?.message || error?.toString() || 'Network error'), 'error');
            }
        } finally {
            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }
    };

    // ===== SERVERS MODAL =====

    window.openServersModal = function() {
        const modal = document.getElementById('serversModal');
        if (modal) {
            modal.classList.remove('hidden');
            renderServerList();
        }
    };

    window.closeServersModal = function() {
        const modal = document.getElementById('serversModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    // ===== CHANGE PASSWORD MODAL =====

    function openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('passwordError').classList.add('hidden');
        }
    }

    window.closeChangePasswordModal = function() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    window.submitChangePassword = async function() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorEl = document.getElementById('passwordError');

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            errorEl.textContent = 'All fields are required';
            errorEl.classList.remove('hidden');
            return;
        }

        if (newPassword !== confirmPassword) {
            errorEl.textContent = 'New passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }

        if (newPassword.length < 4) {
            errorEl.textContent = 'Password must be at least 4 characters';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (response.ok) {
                closeChangePasswordModal();
                showToast('Password changed successfully', 'success');
            } else {
                const data = await response.json();
                errorEl.textContent = data.error || 'Failed to change password';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            errorEl.textContent = 'Error changing password';
            errorEl.classList.remove('hidden');
        }
    };

    function renderServerList() {
        const list = document.getElementById('serverList');
        if (!list) return;

        if (!servers || servers.length === 0) {
            list.innerHTML = '<div class="empty-list">No servers configured</div>';
            return;
        }

        list.innerHTML = servers.map(s => `
            <div class="server-item ${s.id === currentServerId ? 'active' : ''}" data-server="${s.id}">
                <div class="server-item-main">
                    <div class="server-item-icon" style="color: ${s.authType === 'local' ? 'var(--success)' : 'var(--accent-primary)'}">●</div>
                    <div class="server-item-info">
                        <div class="server-item-name">${s.name}</div>
                        <div class="server-item-details">${s.authType === 'local' ? 'Local tmux' : s.username + '@' + s.host + ':' + s.port}</div>
                    </div>
                </div>
                <div class="server-item-actions">
                    ${s.isDefault ? '<span class="default-badge">Default</span>' : `<button class="btn btn-sm" onclick="setDefaultServer('${s.id}')">Set Default</button>`}
                    ${s.authType !== 'local' ? `
                        <button class="btn btn-sm" onclick="editServer('${s.id}')">Edit</button>
                        <button class="btn btn-sm danger" onclick="deleteServer('${s.id}')">Delete</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Click to select server
        list.querySelectorAll('.server-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const serverId = item.dataset.server;
                    selectServer(serverId);
                }
            });
        });
    }

    function selectServer(serverId) {
        const server = servers.find(s => s.id === serverId);
        if (server) {
            currentServerId = serverId;
            updateServerDropdowns();
            updateServerInfo();
            renderServerList();
            loadSessions();
            closeServersModal();
        }
    }

    window.setDefaultServer = async function(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/default`, {
                method: 'POST'
            });

            if (response.ok) {
                await loadServers();
                renderServerList();
            }
        } catch (error) {
            console.error('Failed to set default server:', error);
        }
    };

    window.deleteServer = async function(serverId) {
        if (!confirm('Are you sure you want to delete this server?')) return;

        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadServers();
                renderServerList();

                // If deleted current server, switch to default
                if (serverId === currentServerId) {
                    const defaultServer = servers.find(s => s.isDefault) || servers[0];
                    if (defaultServer) {
                        currentServerId = defaultServer.id;
                        updateServerDropdowns();
                        updateServerInfo();
                        loadSessions();
                    }
                }
            } else {
                const error = await response.json();
                showToast('Failed to delete server: ' + (error.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to delete server:', error);
            showToast('Failed to delete server', 'error');
        }
    };

    // ===== EDIT SERVER MODAL =====

    let returnToNewSessionModal = false;

    window.openEditServerModal = function(server = null, returnToSession = false) {
        returnToNewSessionModal = returnToSession;
        const modal = document.getElementById('editServerModal');
        const title = document.getElementById('editServerTitle');

        if (modal) {
            modal.classList.remove('hidden');

            if (server) {
                title.textContent = 'Edit Server';
                document.getElementById('editServerId').value = server.id;
                document.getElementById('editServerName').value = server.name;
                document.getElementById('editServerHost').value = server.host;
                document.getElementById('editServerPort').value = server.port;
                document.getElementById('editServerUser').value = server.username;
                document.getElementById('editServerAuthType').value = server.authType;
                document.getElementById('editServerPassword').value = '';
                document.getElementById('editServerKey').value = '';
                document.getElementById('editServerPath').value = server.defaultPath || '/root';

                // Disable host/port/user for local server
                const isLocal = server.authType === 'local';
                document.getElementById('editServerHost').disabled = isLocal;
                document.getElementById('editServerPort').disabled = isLocal;
                document.getElementById('editServerUser').disabled = isLocal;
                document.getElementById('editServerAuthType').disabled = isLocal;
            } else {
                title.textContent = 'Add Server';
                document.getElementById('editServerId').value = '';
                document.getElementById('editServerName').value = '';
                document.getElementById('editServerHost').value = '';
                document.getElementById('editServerPort').value = '22';
                document.getElementById('editServerUser').value = 'root';
                document.getElementById('editServerAuthType').value = 'password';
                document.getElementById('editServerPassword').value = '';
                document.getElementById('editServerKey').value = '';
                document.getElementById('editServerPath').value = '/root';

                document.getElementById('editServerHost').disabled = false;
                document.getElementById('editServerPort').disabled = false;
                document.getElementById('editServerUser').disabled = false;
                document.getElementById('editServerAuthType').disabled = false;
            }

            // Update auth type visibility
            const authType = document.getElementById('editServerAuthType').value;
            if (authType === 'password') {
                document.getElementById('editPasswordGroup').classList.remove('hidden');
                document.getElementById('editKeyGroup').classList.add('hidden');
            } else {
                document.getElementById('editPasswordGroup').classList.add('hidden');
                document.getElementById('editKeyGroup').classList.remove('hidden');
            }
        }
    };

    window.closeEditServerModal = function() {
        const modal = document.getElementById('editServerModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // If we came from New Session modal, go back there
        if (returnToNewSessionModal) {
            returnToNewSessionModal = false;
            openNewSessionModal();
        }
    };

    window.editServer = function(serverId) {
        const server = servers.find(s => s.id === serverId);
        if (server) {
            closeServersModal();
            openEditServerModal(server);
        }
    };

    window.testServerConnection = async function() {
        const serverId = document.getElementById('editServerId').value;
        const btn = document.getElementById('testServerBtn');
        const originalText = btn.textContent;

        btn.textContent = 'Testing...';
        btn.disabled = true;

        try {
            if (serverId) {
                const response = await fetch(`/api/servers/${serverId}/test`, {
                    method: 'POST'
                });
                const data = await response.json();

                if (response.ok) {
                    showToast(data.message || 'Connection successful', 'success');
                } else {
                    showToast('Connection failed: ' + data.error, 'error');
                }
            } else {
                showToast('Please save the server first, then test the connection', 'warning');
            }
        } catch (error) {
            showToast('Connection test failed: ' + error.message, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    window.saveServer = async function() {
        const serverId = document.getElementById('editServerId').value;
        const name = document.getElementById('editServerName').value.trim();
        const host = document.getElementById('editServerHost').value.trim();
        const port = parseInt(document.getElementById('editServerPort').value) || 22;
        const username = document.getElementById('editServerUser').value.trim();
        const authType = document.getElementById('editServerAuthType').value;
        const password = document.getElementById('editServerPassword').value;
        const privateKey = document.getElementById('editServerKey').value;
        const defaultPath = document.getElementById('editServerPath').value.trim() || '/root';

        if (!name) {
            showToast('Please enter a server name', 'warning');
            return;
        }

        if (!serverId && (!host || !username)) {
            showToast('Please fill in host and username', 'warning');
            return;
        }

        if (!serverId && authType === 'password' && !password) {
            showToast('Please enter a password', 'warning');
            return;
        }

        if (!serverId && authType === 'key' && !privateKey) {
            showToast('Please enter a private key', 'warning');
            return;
        }

        try {
            let response;
            if (serverId) {
                response = await fetch(`/api/servers/${serverId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, host, port, username, authType, password, privateKey, defaultPath })
                });
            } else {
                response = await fetch('/api/servers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, host, port, username, authType, password, privateKey, defaultPath })
                });
            }

            if (response.ok) {
                const wasNewServer = !serverId;
                const data = await response.json();

                await loadServers();

                if (wasNewServer && data.server && data.server.id) {
                    // For new servers: update the form with the new ID so they can test
                    document.getElementById('editServerId').value = data.server.id;
                    document.getElementById('editServerTitle').textContent = 'Edit Server';

                    // Show success and prompt to test
                    const btn = document.querySelector('#editServerModal .btn-primary');
                    const originalText = btn.textContent;
                    btn.textContent = 'Saved!';
                    btn.style.background = 'var(--success)';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                    }, 2000);
                } else {
                    // For existing servers: close and return
                    const shouldReturnToNewSession = returnToNewSessionModal;
                    returnToNewSessionModal = false;

                    const modal = document.getElementById('editServerModal');
                    if (modal) modal.classList.add('hidden');

                    if (shouldReturnToNewSession) {
                        openNewSessionModal();
                        setTimeout(() => {
                            const serverSelect = document.getElementById('sessionServer');
                            if (serverSelect && servers.length > 0) {
                                serverSelect.value = servers[servers.length - 1].id;
                                updateSessionDirFromServer();
                            }
                        }, 100);
                    } else {
                        openServersModal();
                    }
                }
            } else {
                const error = await response.json();
                showToast('Failed to save server: ' + (error.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to save server:', error);
            showToast('Failed to save server: ' + error.message, 'error');
        }
    };
})();
