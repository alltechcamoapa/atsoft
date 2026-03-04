/**
 * ALLTECH - Notification Service
 * Sistema de notificaciones dinámicas, alertas y Push Notifications
 */

const NotificationService = (() => {
    // ========== STATE ==========
    let notifications = [];
    let unreadCount = 0;
    let pushPermission = 'default';
    let serviceWorkerRegistration = null;

    // ========== INITIALIZATION ==========
    const init = async () => {
        console.log('🔔 NotificationService: Inicializando...');

        // Initialize push notifications
        await initPushNotifications();

        // Generate app notifications
        refresh();

        // Real-time updates: refresh manually every 60 seconds
        setInterval(() => {
            refresh();
            checkAndNotifyImportantEvents();
        }, 60000);
    };

    // ========== PUSH NOTIFICATIONS SETUP ==========
    const initPushNotifications = async () => {
        // Check if push notifications are supported
        if (!('Notification' in window)) {
            console.log('🔔 Push notifications not supported');
            return false;
        }

        // Check if service worker is available
        if (!('serviceWorker' in navigator)) {
            console.log('🔔 Service Worker not supported');
            return false;
        }

        // Get current permission state
        pushPermission = Notification.permission;
        console.log(`🔔 Push permission: ${pushPermission}`);

        // If permission not decided, request it after a delay (better UX)
        if (pushPermission === 'default') {
            // Wait a bit before asking for permission (don't overwhelm user on first load)
            setTimeout(() => {
                requestPushPermission();
            }, 5000);
        }

        // Get service worker registration
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
                serviceWorkerRegistration = registrations[0];
                console.log('🔔 Service Worker registration obtained');
            }
        } catch (error) {
            console.error('🔔 Error getting Service Worker registration:', error);
        }

        return true;
    };

    // ========== REQUEST PUSH PERMISSION ==========
    const requestPushPermission = async () => {
        if (!('Notification' in window)) {
            console.log('🔔 Notifications not supported');
            return false;
        }

        // If already granted or denied, don't ask again
        if (pushPermission !== 'default') {
            return pushPermission === 'granted';
        }

        try {
            const permission = await Notification.requestPermission();
            pushPermission = permission;
            console.log(`🔔 Push permission result: ${permission}`);

            if (permission === 'granted') {
                // Show a welcome notification
                showPushNotification(
                    '¡Notificaciones activadas!',
                    'Recibirás alertas importantes de ALLTECH.',
                    { tag: 'welcome', icon: '/assets/icons/icon-192x192.png' }
                );
            }

            return permission === 'granted';
        } catch (error) {
            console.error('🔔 Error requesting permission:', error);
            return false;
        }
    };

    // ========== SHOW PUSH NOTIFICATION ==========
    const showPushNotification = (title, body, options = {}) => {
        if (pushPermission !== 'granted') {
            console.log('🔔 Push permission not granted, cannot show notification');
            return false;
        }

        const defaultOptions = {
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            requireInteraction: false,
            silent: false,
            ...options
        };

        try {
            // Use Service Worker notification for better reliability
            if (serviceWorkerRegistration) {
                serviceWorkerRegistration.showNotification(title, {
                    body,
                    ...defaultOptions
                });
            } else {
                // Fallback to regular notification
                new Notification(title, {
                    body,
                    ...defaultOptions
                });
            }
            return true;
        } catch (error) {
            console.error('🔔 Error showing push notification:', error);
            return false;
        }
    };

    // ========== SEND IMPORTANT ALERT ==========
    const sendImportantAlert = (type, data) => {
        if (pushPermission !== 'granted') return;

        switch (type) {
            case 'contract_expiring':
                showPushNotification(
                    '⚠️ Contrato por vencer',
                    `El contrato de ${data.cliente} vence en ${data.dias} días`,
                    { tag: `contract-${data.id}`, requireInteraction: true }
                );
                break;

            case 'visit_today':
                showPushNotification(
                    '📅 Visita programada HOY',
                    `${data.cliente} - ${data.tipo} a las ${data.hora}`,
                    { tag: `visit-${data.id}`, requireInteraction: true }
                );
                break;

            case 'new_order':
                showPushNotification(
                    '🛒 Nuevo pedido',
                    `Se ha registrado un nuevo pedido de ${data.cliente}`,
                    { tag: `order-${data.id}` }
                );
                break;

            case 'data_sync':
                showPushNotification(
                    '🔄 Datos actualizados',
                    'Los datos se han sincronizado correctamente',
                    { tag: 'sync', silent: true }
                );
                break;
        }
    };

    // ========== CHECK AND NOTIFY IMPORTANT EVENTS ==========
    const checkAndNotifyImportantEvents = () => {
        if (pushPermission !== 'granted') return;

        const now = new Date();

        // Check contracts expiring in 3 days or less
        const contratos = DataService.getContratosSync();
        contratos.forEach(contrato => {
            if (contrato.fechaFin) {
                const fechaFin = new Date(contrato.fechaFin);
                const diasRestantes = Math.ceil((fechaFin - now) / (1000 * 60 * 60 * 24));

                if (diasRestantes > 0 && diasRestantes <= 3) {
                    const cliente = DataService.getClienteById(contrato.clienteId);
                    sendImportantAlert('contract_expiring', {
                        id: contrato.contratoId || contrato.id,
                        cliente: cliente?.empresa || 'Cliente',
                        dias: diasRestantes
                    });
                }
            }
        });

        // Check visits for today
        const visitas = DataService.getVisitasSync();
        visitas.forEach(visita => {
            if (visita.fechaInicio && !visita.trabajoRealizado) {
                const fechaVisita = new Date(visita.fechaInicio);
                const isToday = fechaVisita.toDateString() === now.toDateString();

                if (isToday) {
                    const cliente = DataService.getClienteById(visita.clienteId);
                    sendImportantAlert('visit_today', {
                        id: visita.visitaId || visita.id,
                        cliente: cliente?.empresa || 'Cliente',
                        tipo: visita.tipoVisita || 'Mantenimiento',
                        hora: fechaVisita.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })
                    });
                }
            }
        });
    };

    // ========== GENERATE DYNAMIC NOTIFICATIONS ==========
    const generateNotifications = () => {
        notifications = [];
        const now = new Date();

        // 1. Contratos por vencer (próximos 15 días)
        const contratos = DataService.getContratosSync();
        contratos.forEach(contrato => {
            if (contrato.fechaFin) {
                const fechaFin = new Date(contrato.fechaFin);
                const diasRestantes = Math.ceil((fechaFin - now) / (1000 * 60 * 60 * 24));

                if (diasRestantes > 0 && diasRestantes <= 15) {
                    const cliente = DataService.getClienteById(contrato.clienteId);
                    notifications.push({
                        id: `contract-${contrato.contratoId || contrato.id}`,
                        type: diasRestantes <= 5 ? 'danger' : 'warning',
                        icon: 'alertCircle',
                        title: `Contrato por vencer`,
                        message: `${cliente?.empresa || 'Cliente'} - ${diasRestantes} días restantes`,
                        time: 'Vence ' + fechaFin.toLocaleDateString('es-NI'),
                        action: () => App.navigate('contratos'),
                        unread: true
                    });
                }
            }
        });

        // 2. Visitas programadas para hoy o mañana
        const visitas = DataService.getVisitasSync();
        visitas.forEach(visita => {
            if (visita.fechaInicio && !visita.trabajoRealizado) {
                const fechaVisita = new Date(visita.fechaInicio);
                const diasHastaVisita = Math.ceil((fechaVisita - now) / (1000 * 60 * 60 * 24));

                if (diasHastaVisita >= 0 && diasHastaVisita <= 1) {
                    const cliente = DataService.getClienteById(visita.clienteId);
                    notifications.push({
                        id: `visit-${visita.visitaId || visita.id}`,
                        type: diasHastaVisita === 0 ? 'danger' : 'info',
                        icon: 'calendar',
                        title: diasHastaVisita === 0 ? 'Visita HOY' : 'Visita mañana',
                        message: `${cliente?.empresa || 'Cliente'} - ${visita.tipoVisita || 'Mantenimiento'}`,
                        time: fechaVisita.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }),
                        action: () => App.navigate('visitas'),
                        unread: true
                    });
                }
            }
        });

        // 3. Proformas activas pendientes de aprobación
        const proformas = DataService.getProformasSync();
        const proformasActivas = proformas.filter(p => p.estado === 'Activa');
        if (proformasActivas.length > 0) {
            notifications.push({
                id: 'proformas-pending',
                type: 'info',
                icon: 'fileText',
                title: 'Proformas pendientes',
                message: `${proformasActivas.length} proforma(s) esperando aprobación`,
                time: 'Revisar',
                action: () => App.navigate('proformas'),
                unread: false
            });
        }

        // 4. Equipos en estado de reparación
        const equipos = DataService.getEquiposSync();
        const equiposReparacion = equipos.filter(e => e.estado === 'En Reparación' || e.estado === 'Mantenimiento');
        if (equiposReparacion.length > 0) {
            notifications.push({
                id: 'equipos-repair',
                type: 'warning',
                icon: 'monitor',
                title: 'Equipos en reparación',
                message: `${equiposReparacion.length} equipo(s) requieren atención`,
                time: 'Ver lista',
                action: () => App.navigate('equipos'),
                unread: false
            });
        }

        // Calcular no leídas
        unreadCount = notifications.filter(n => n.unread).length;

        // Ordenar por prioridad (danger > warning > info)
        const priority = { danger: 0, warning: 1, info: 2 };
        notifications.sort((a, b) => priority[a.type] - priority[b.type]);

        console.log(`🔔 NotificationService: ${notifications.length} notificaciones generadas (${unreadCount} no leídas)`);
    };

    // ========== UPDATE BADGE ==========
    const updateBadge = () => {
        const badge = document.querySelector('#notificationsBtn .badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    };

    // ========== RENDER NOTIFICATIONS LIST ==========
    const renderList = () => {
        if (notifications.length === 0) {
            return `
                <div class="notification-empty" style="padding: var(--spacing-lg); text-align: center; color: var(--text-muted);">
                    <div style="font-size: 24px; margin-bottom: var(--spacing-sm);">🎉</div>
                    <div>¡Todo al día!</div>
                    <div style="font-size: var(--font-size-xs);">No hay notificaciones pendientes</div>
                </div>
            `;
        }

        return notifications.map((n, index) => `
            <div class="notification-item ${n.unread ? 'unread' : ''} animate-fadeInRight stagger-${Math.min(index + 1, 8)}" 
                 onclick="NotificationService.handleClick('${n.id}')" 
                 style="cursor: pointer;">
                <div class="notification-icon ${n.type}">${Icons[n.icon] || Icons.bell}</div>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-message" style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px;">${n.message}</div>
                    <div class="notification-time">${n.time}</div>
                </div>
            </div>
        `).join('');
    };

    // ========== HANDLE NOTIFICATION CLICK ==========
    const handleClick = (id) => {
        const notification = notifications.find(n => n.id === id);
        if (notification) {
            // Marcar como leída
            notification.unread = false;
            unreadCount = notifications.filter(n => n.unread).length;
            updateBadge();

            // Cerrar dropdown
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.classList.remove('show');

            // Ejecutar acción
            if (notification.action) {
                notification.action();
            }
        }
    };

    // ========== MARK ALL AS READ ==========
    const markAllAsRead = () => {
        notifications.forEach(n => n.unread = false);
        unreadCount = 0;
        updateBadge();

        // Re-render list
        const list = document.querySelector('.notification-list');
        if (list) {
            list.innerHTML = renderList();
        }
    };

    // ========== REFRESH NOTIFICATIONS ==========
    const refresh = () => {
        generateNotifications();
        updateBadge();

        const list = document.querySelector('.notification-list');
        if (list) {
            list.innerHTML = renderList();
        }
    };

    // ========== SHOW TOAST NOTIFICATION ==========
    const showToast = (message, type = 'info', duration = 4000) => {
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <div class="toast__icon">${getToastIcon(type)}</div>
            <div class="toast__content">
                <div class="toast__message">${message}</div>
            </div>
            <button class="toast__close" onclick="this.parentElement.remove()">×</button>
        `;

        toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast--exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    const createToastContainer = () => {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    };

    const getToastIcon = (type) => {
        const icons = {
            success: Icons.checkCircle || '✓',
            warning: Icons.alertCircle || '⚠',
            danger: Icons.xCircle || '✕',
            info: Icons.info || 'ℹ'
        };
        return icons[type] || icons.info;
    };

    // ========== GETTERS ==========
    const getNotifications = () => notifications;
    const getUnreadCount = () => unreadCount;
    const getPushPermission = () => pushPermission;

    // ========== PUBLIC API ==========
    return {
        init,
        refresh,
        add: showToast,
        show: showToast, // Alias for backward compatibility
        renderList,
        handleClick,
        markAllAsRead,
        updateBadge,
        showToast,
        getNotifications,
        getUnreadCount,
        // Push Notifications
        requestPushPermission,
        showPushNotification,
        sendImportantAlert,
        checkAndNotifyImportantEvents,
        getPushPermission
    };
})();

// Make globally available
if (typeof window !== 'undefined') {
    window.NotificationService = NotificationService;
}
