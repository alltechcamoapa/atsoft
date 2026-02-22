/**
 * ALLTECH - Welcome & Pending Visits
 * Handles welcome animations and pending visits modal for technicians
 */

const WelcomeModule = (() => {
    'use strict';

    /**
     * Show welcome animation after login
     */
    const showWelcomeAnimation = (user) => {
        const welcomeHtml = `
            <div class="welcome-overlay" id="welcomeOverlay">
                <div class="welcome-content">
                    <div class="welcome-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                            <path d="M2 17L12 22L22 17"/>
                            <path d="M2 12L12 17L22 12"/>
                        </svg>
                    </div>
                    <h1 class="welcome-title">¡Bienvenido!</h1>
                    <p class="welcome-subtitle">Sistema de Gestión Empresarial</p>
                    <p class="welcome-user">${user.nombre}</p>
                    <div class="welcome-spinner"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', welcomeHtml);

        // Remove after 2 seconds and check for pending visits
        setTimeout(() => {
            const overlay = document.getElementById('welcomeOverlay');
            if (overlay) {
                overlay.classList.add('welcome-overlay--fadeout');
                setTimeout(() => {
                    overlay.remove();

                    // Show pending visits modal if user is technician
                    if (shouldShowPendingVisits(user)) {
                        showPendingVisitsModal(user);
                    }
                }, 800);
            }
        }, 2000);
    };

    /**
     * Check if pending visits modal should be shown
     */
    const shouldShowPendingVisits = (user) => {
        // Show for technicians and support roles
        return user.role === 'Técnico' || user.role === 'Soporte';
    };

    /**
     * Get pending visits for user
     */
    const getPendingVisitsForUser = (user) => {
        const allVisitas = DataService.getVisitasSync();
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59);

        // Filter pending visits assigned to this user for today and tomorrow
        return allVisitas.filter(visita => {
            const visitDate = new Date(visita.fechaInicio);
            const isAssigned = (visita.usuarioSoporte === user.id || visita.usuarioSoporte === user.nombre || visita.usuarioSoporte === user.username);
            const isPending = !visita.trabajoRealizado;
            const isUpcoming = visitDate <= tomorrow && visitDate >= now;

            return isAssigned && isPending && isUpcoming;
        }).sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
    };

    /**
     * Show pending visits modal
     */
    const showPendingVisitsModal = (user) => {
        const pendingVisits = getPendingVisitsForUser(user);

        const modalHtml = `
            <div class="pending-visits-modal" id="pendingVisitsModal" onclick="WelcomeModule.handleBackdropClick(event)">
                <div class="pending-visits-container" onclick="event.stopPropagation()">
                    ${renderPendingVisitsHeader(pendingVisits.length)}
                    ${renderPendingVisitsBody(pendingVisits)}
                    ${renderPendingVisitsFooter()}
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add keyboard listener
        document.addEventListener('keydown', handleEscapeKey);
    };

    /**
     * Render modal header
     */
    const renderPendingVisitsHeader = (count) => {
        return `
            <div class="pending-visits__header">
                <h2 class="pending-visits__title">
                    ${Icons.clipboard}
                    Visitas Pendientes
                </h2>
                <p class="pending-visits__subtitle">
                    ${count > 0
                ? `Tienes ${count} ${count === 1 ? 'visita pendiente' : 'visitas pendientes'} para hoy`
                : 'No tienes visitas pendientes para hoy'
            }
                </p>
                <button class="pending-visits__close" onclick="WelcomeModule.closePendingVisitsModal()">
                    ${Icons.x}
                </button>
            </div>
        `;
    };

    /**
     * Render modal body
     */
    const renderPendingVisitsBody = (visits) => {
        if (visits.length === 0) {
            return `
                <div class="pending-visits__body">
                    <div class="pending-visits__empty">
                        <div class="pending-visits__empty-icon">
                            ${Icons.checkCircle}
                        </div>
                        <h3 class="pending-visits__empty-title">¡Todo al día!</h3>
                        <p class="pending-visits__empty-text">
                            No tienes visitas pendientes programadas para hoy.
                        </p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="pending-visits__body">
                <div class="pending-visits__list">
                    ${visits.map((visita, index) => renderVisitCard(visita, index)).join('')}
                </div>
            </div>
        `;
    };

    /**
     * Render individual visit card
     */
    const renderVisitCard = (visita, index) => {
        const cliente = DataService.getClienteById(visita.clienteId);
        const equipo = visita.equipoId ? DataService.getEquipoById(visita.equipoId) : null;
        const visitDate = new Date(visita.fechaInicio);
        const now = new Date();
        const hoursUntilVisit = (visitDate - now) / (1000 * 60 * 60);
        const isUrgent = hoursUntilVisit <= 2;
        const isPriority = hoursUntilVisit <= 6;

        return `
            <div class="visit-card" onclick="WelcomeModule.selectVisit('${visita.visitaId}')">
                ${(isUrgent || isPriority) ? `
                    <div class="visit-card__priority ${isUrgent ? 'visit-card__priority--urgent' : ''}"></div>
                ` : ''}
                
                <div class="visit-card__header">
                    <div class="visit-card__icon">
                        ${visita.tipoVisita === 'Física' ? Icons.mapPin : Icons.monitor}
                    </div>
                    <div class="visit-card__info">
                        <div class="visit-card__id">${visita.visitaId}</div>
                        <div class="visit-card__client">${cliente?.nombreCliente || 'Cliente'}</div>
                        <div class="visit-card__company">${cliente?.empresa || ''}</div>
                    </div>
                </div>
                
                <div class="visit-card__body">
                    <div class="visit-card__work">
                        ${visita.descripcionTrabajo}
                    </div>
                    ${equipo ? `
                        <div class="visit-card__equipment">
                            ${Icons.cpu}
                            ${equipo.nombreEquipo} - ${equipo.marca}
                        </div>
                    ` : ''}
                </div>
                
                <div class="visit-card__footer">
                    <div class="visit-card__datetime">
                        <div class="visit-card__date">
                            ${Icons.calendar}
                            ${visitDate.toLocaleDateString('es-NI', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div class="visit-card__time">
                            ${Icons.clock}
                            ${visitDate.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div class="visit-card__type ${visita.tipoVisita === 'Remota' ? 'visit-card__type--remote' : ''}">
                        ${visita.tipoVisita === 'Física' ? Icons.mapPin : Icons.monitor}
                        ${visita.tipoVisita}
                    </div>
                </div>
            </div>
        `;
    };

    /**
     * Render modal footer
     */
    const renderPendingVisitsFooter = () => {
        return `
            <div class="pending-visits__footer">
                <p class="pending-visits__footer-text">
                    Puedes revisar todas tus visitas en el módulo de Visitas y Servicios
                </p>
                <button class="pending-visits__skip" onclick="WelcomeModule.closePendingVisitsModal()">
                    Continuar al Dashboard
                </button>
            </div>
        `;
    };

    /**
     * Select a visit and navigate to visits module
     */
    const selectVisit = (visitaId) => {
        closePendingVisitsModal();

        // Navigate to visits module
        State.set('currentModule', 'visitas');
        App.render();

        // After render, open the visit detail
        setTimeout(() => {
            if (typeof VisitasModule !== 'undefined' && VisitasModule.viewDetail) {
                VisitasModule.viewDetail(visitaId);
            }
        }, 100);
    };

    /**
     * Close pending visits modal
     */
    const closePendingVisitsModal = () => {
        const modal = document.getElementById('pendingVisitsModal');
        if (modal) {
            modal.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                modal.remove();
                document.removeEventListener('keydown', handleEscapeKey);
            }, 300);
        }
    };

    /**
     * Handle backdrop click
     */
    const handleBackdropClick = (event) => {
        if (event.target.classList.contains('pending-visits-modal')) {
            closePendingVisitsModal();
        }
    };

    /**
     * Handle escape key
     */
    const handleEscapeKey = (event) => {
        if (event.key === 'Escape') {
            closePendingVisitsModal();
        }
    };

    /**
     * Show both welcome animation and pending visits
     * Called after successful login
     */
    const showWelcomeFlow = (user) => {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            showWelcomeAnimation(user);
        }, 100);
    };

    /**
     * Manually show pending visits (can be called from anywhere)
     */
    const showPendingVisits = () => {
        const user = State.get('user');
        if (user && shouldShowPendingVisits(user)) {
            showPendingVisitsModal(user);
        } else {
            console.log('No pending visits to show for this user');
        }
    };

    // Public API
    return {
        showWelcomeFlow,
        showPendingVisits,
        selectVisit,
        closePendingVisitsModal,
        handleBackdropClick
    };
})();

// Make it globally available
if (typeof window !== 'undefined') {
    window.WelcomeModule = WelcomeModule;
}
