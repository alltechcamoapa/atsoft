/**
 * ALLTECH - Gestión de Técnicos
 * Módulo para gestionar pagos, reportes y estadísticas de técnicos
 */

const GestionTecnicosModule = (() => {
    let currentTab = 'tecnicos';
    let technicians = [];
    let payments = [];
    let selectedTechnician = null;
    let technicianVisits = [];

    const init = async () => {
        await loadData();
    };

    const loadData = async () => {
        try {
            // Obtener todos los usuarios con rol 'Tecnico'
            const allUsers = await DataService.getUsersSync();
            technicians = allUsers.filter(u => u.role === 'Tecnico');

            payments = await DataService.getPagosTecnicos();
        } catch (error) {
            console.error('Error loading technician data:', error);
        }
    };

    const render = () => {
        // Cargar datos sincronamente desde el caché de DataService
        technicians = DataService.getUsersSync().filter(u => u.role === 'Tecnico');
        payments = DataService.getPagosTecnicos();

        if (currentTab === 'tecnicos') {
            // Recalcular estadísticas rápidas para los técnicos
            const allVisitas = DataService.getVisitasSync();
            technicians.forEach(t => {
                const techVisits = allVisitas.filter(v => (v.tecnicoId || v.tecnico_id) === t.id);
                t.stats = {
                    total: techVisits.length,
                    pendientes: techVisits.filter(v => v.trabajoRealizado && !v.pago_id).length
                };
            });
        }

        return `
            <div class="module-header" style="margin-bottom: var(--spacing-lg);">
                <div class="module-header__main">
                    <h2 class="module-header__title">Gestión de Técnicos</h2>
                    <p class="module-header__subtitle">Pagos, historial y reportes de desempeño</p>
                </div>
                <div class="module-header__actions">
                    <button class="btn btn--primary" onclick="console.log('Click en Nuevo Pago'); openTechPaymentModal()">
                        ${Icons.dollarSign} Nuevo Pago
                    </button>
                    <button class="btn btn--secondary" onclick="GestionTecnicosModule.refresh()">
                        ${Icons.refreshCw}
                    </button>
                </div>
            </div>

            <div class="tabs-container" style="margin-bottom: var(--spacing-md);">
                <button class="tab-btn ${currentTab === 'tecnicos' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('tecnicos')">
                    ${Icons.users} Técnicos
                </button>
                <button class="tab-btn ${currentTab === 'pagos' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('pagos')">
                    ${Icons.dollarSign} Historial de Pagos
                </button>
                <button class="tab-btn ${currentTab === 'reportes' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('reportes')">
                    ${Icons.barChart} Reportes de Trabajo
                </button>
            </div>
            <div class="tabs__content">
                ${renderTabContent()}
            </div>
        `;
    };

    const switchTab = (tab) => {
        currentTab = tab;
        if (typeof App !== 'undefined' && App.render) {
            App.render();
        } else {
            render();
        }
    };

    const renderTabContent = () => {
        switch (currentTab) {
            case 'tecnicos':
                return renderTecnicosTab();
            case 'pagos':
                return renderPagosTab();
            case 'reportes':
                return renderReportesTab();
            default:
                return '';
        }
    };

    const renderTecnicosTab = () => {
        if (technicians.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state__icon">${Icons.users}</div>
                    <h3 class="empty-state__title">No hay técnicos registrados</h3>
                    <p class="empty-state__description">Cree usuarios con el rol de 'Tecnico' en la sección de Configuración.</p>
                </div>
            `;
        }

        return `
            <div class="grid grid--cols-1 grid--md-cols-2 grid--lg-cols-3 gap-md">
                ${technicians.map(t => renderTechnicianCard(t)).join('')}
            </div>
        `;
    };

    const renderTechnicianCard = (tech) => {
        // En un escenario real, calcularíamos estadísticas aquí
        return `
            <div class="card tech-card" style="position: relative; overflow: hidden; height: 100%;">
                <div class="card__body">
                    <div style="display: flex; gap: var(--spacing-md); align-items: center; margin-bottom: var(--spacing-md);">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name)}&background=1a73e8&color=fff&size=60" 
                             alt="${tech.name}" 
                             style="width: 60px; height: 60px; border-radius: 50%;">
                        <div>
                            <h3 style="margin: 0; font-size: var(--font-size-lg);">${tech.name}</h3>
                            <span class="badge badge--primary" style="font-size: 10px;">${tech.role}</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
                        <div style="padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm); text-align: center;">
                            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Servicios Totales</div>
                            <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-lg);">${tech.stats?.total || 0}</div>
                        </div>
                        <div style="padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm); text-align: center;">
                            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Pendientes Pago</div>
                            <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-lg); color: var(--color-warning);">${tech.stats?.pendientes || 0}</div>
                        </div>
                    </div>

                    <p style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--spacing-md);">
                        ${Icons.mail} ${tech.email}
                    </p>

                    <div style="display: flex; gap: var(--spacing-sm);">
                        <button class="btn btn--secondary btn--sm btn--block" onclick="GestionTecnicosModule.viewTechReport('${tech.id}')">
                            ${Icons.barChart} Ver Reporte
                        </button>
                        <button class="btn btn--primary btn--sm btn--block" onclick="GestionTecnicosModule.renderPaymentModal('${tech.id}')">
                            ${Icons.dollarSign} Pagar
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    const renderPagosTab = () => {
        if (payments.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state__icon">${Icons.dollarSign}</div>
                    <h3 class="empty-state__title">No hay historial de pagos</h3>
                    <p class="empty-state__description">Los pagos generados a técnicos aparecerán aquí.</p>
                </div>
            `;
        }

        return `
            <div class="card card--no-padding">
                <table class="data-table">
                    <thead class="data-table__head">
                        <tr>
                            <th>Recibo</th>
                            <th>Técnico</th>
                            <th>Periodo</th>
                            <th>Total Servicios</th>
                            <th>Monto Pagado (50%)</th>
                            <th>Fecha Pago</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="data-table__body">
                        ${payments.map(p => `
                            <tr>
                                <td><span class="font-bold">${p.numero_recibo || 'N/A'}</span></td>
                                <td>${p.tecnico?.full_name || 'Desconocido'}</td>
                                <td>${formatDate(p.periodo_inicio)} - ${formatDate(p.periodo_fin)}</td>
                                <td>$${parseFloat(p.total_servicios).toFixed(2)}</td>
                                <td><span class="text-success font-bold">$${parseFloat(p.monto_pago).toFixed(2)}</span></td>
                                <td>${formatDateTime(p.fecha_pago)}</td>
                                <td style="text-align: right;">
                                    <button class="btn btn--ghost btn--icon btn--sm" onclick="GestionTecnicosModule.printReceipt('${p.id}')" title="Imprimir Recibo">
                                        ${Icons.printer}
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    const renderReportesTab = () => {
        return `
            <div class="card">
                <div class="card__header">
                    <h3 class="card__title">Filtros de Reporte</h3>
                </div>
                <div class="card__body">
                    <div class="grid grid--cols-1 grid--md-cols-3 gap-md">
                        <div class="form-group">
                            <label class="form-label">Técnico</label>
                            <select class="form-input" id="reportTechId">
                                <option value="">Seleccione Técnico...</option>
                                ${technicians.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Desde</label>
                            <input type="date" class="form-input" id="reportStartDate">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hasta</label>
                            <input type="date" class="form-input" id="reportEndDate">
                        </div>
                    </div>
                    <div style="margin-top: var(--spacing-md); display: flex; justify-content: flex-end;">
                        <button class="btn btn--primary" onclick="GestionTecnicosModule.generateReport()">
                            ${Icons.search} Generar Reporte
                        </button>
                    </div>
                </div>
            </div>
            <div id="reportResults" style="margin-top: var(--spacing-lg);"></div>
        `;
    };

    const renderPaymentModal = (techId = null) => {
        console.log('Ejecutando renderPaymentModal v3 (CSS Fix)', techId);

        try {
            const modalId = 'paymentModal';

            // 1. Limpiar modal previo
            const existing = document.getElementById(modalId);
            if (existing) existing.remove();

            // 2. Crear HTML del modal con estructura CORRECTA según modal.css
            // Wrapper: .modal-overlay (controla visibilidad y backdrop)
            // Card: .modal (contenido, fondo blanco, sombra)
            const modalHtml = `
                <div class="modal-overlay" id="${modalId}" style="z-index: 10000;" onclick="if(event.target === this) GestionTecnicosModule.closeModal('${modalId}')">
                    <div class="modal modal--lg">
                        <div class="modal__header">
                            <h3 class="modal__title">Generar Pago a Técnico</h3>
                            <button class="modal__close" onclick="GestionTecnicosModule.closeModal('${modalId}')">&times;</button>
                        </div>
                        <div class="modal__body">
                            <form id="paymentForm" onsubmit="event.preventDefault();">
                                <div class="grid grid--cols-1 grid--md-cols-2 gap-md">
                                    <div class="form-group">
                                        <label class="form-label">Seleccionar Técnico</label>
                                        <select class="form-input" id="pagoTechId" required onchange="GestionTecnicosModule.updatePaymentCalculation(this.value)">
                                            <option value="">Seleccione...</option>
                                            ${technicians.map(t => `<option value="${t.id}" ${t.id === techId ? 'selected' : ''}>${t.name}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Número de Recibo</label>
                                        <input type="text" class="form-input" id="pagoRecibo" placeholder="Auto-generado">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Fecha Inicio Periodo</label>
                                        <input type="date" class="form-input" id="pagoInicio" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Fecha Fin Periodo</label>
                                        <input type="date" class="form-input" id="pagoFin" required value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                </div>

                                <div id="paymentSummary" style="margin-top: var(--spacing-lg); padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                                    <div style="text-align: center; padding: 20px;">
                                        ${Icons.info} Seleccione un técnico para calcular.
                                    </div>
                                </div>

                                <div class="form-group" style="margin-top: var(--spacing-md);">
                                    <label class="form-label">Notas / Observaciones</label>
                                    <textarea class="form-input" id="pagoNotas" rows="2"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal__footer">
                            <button class="btn btn--secondary" type="button" onclick="GestionTecnicosModule.closeModal('${modalId}')">Cancelar</button>
                            <button class="btn btn--primary" type="button" onclick="GestionTecnicosModule.savePayment()" disabled id="btnSavePayment">
                                ${Icons.dollarSign} Confirmar Pago
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 3. Insertar en el DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // 4. Mostrar (Forzar reflow y agregar clase 'open' definida en modal.css)
            requestAnimationFrame(() => {
                const modal = document.getElementById(modalId);
                if (modal) {
                    console.log('Adding open class to modal overlay');
                    modal.classList.add('open');
                }
            });

            // 5. Cargar datos si es necesario (Asíncrono)
            if (techId) {
                setTimeout(async () => {
                    try {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                        const inputInicio = document.getElementById('pagoInicio');
                        if (inputInicio) inputInicio.value = firstDay.toISOString().split('T')[0];

                        // Mostrar loading en el summary
                        const summary = document.getElementById('paymentSummary');
                        if (summary) summary.innerHTML = `<div style="text-align: center; padding: 20px;">${Icons.refreshCw} Calculando...</div>`;

                        await updatePaymentCalculation(techId);
                    } catch (err) {
                        console.error('Error loading data:', err);
                    }
                }, 100);
            }

        } catch (error) {
            console.error('Error al abrir modal:', error);
            alert('Error: ' + error.message);
        }
    };

    const renderPaymentSummary = (visits, total) => {
        const pagoMonto = total * 0.5;

        if (visits.length === 0) {
            return `
                <div style="text-align: center; color: var(--text-muted); padding: var(--spacing-md);">
                    ${Icons.info} Seleccione un técnico con servicios pendientes de pago para calcular.
                </div>
            `;
        }

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                <span class="font-semibold">Servicios Pendientes:</span>
                <span class="badge badge--info">${visits.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                <span class="font-semibold">Total Bruto Servicios:</span>
                <span class="font-bold">$${total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--spacing-sm); border-top: 1px solid var(--border-color);">
                <span class="font-bold" style="font-size: var(--font-size-lg);">Monto a Pagar (50%):</span>
                <span class="font-bold text-success" style="font-size: var(--font-size-2xl);">$${pagoMonto.toFixed(2)}</span>
            </div>
            <div style="margin-top: var(--spacing-md); max-height: 150px; overflow-y: auto;">
                <table class="data-table data-table--compact">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Servicio</th>
                            <th style="text-align: right;">Costo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visits.map(v => `
                            <tr>
                                <td>${formatDate(v.fecha_inicio)}</td>
                                <td style="font-size: 11px;">${v.tipo_visita}</td>
                                <td style="text-align: right;">$${(parseFloat(v.costo_servicio) || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <input type="hidden" id="hiddenTotalServicios" value="${total}">
            <input type="hidden" id="hiddenPagoMonto" value="${pagoMonto}">
            <input type="hidden" id="hiddenVisitaIds" value="${visits.map(v => v.id).join(',')}">
        `;
    };

    const updatePaymentCalculation = async (techId) => {
        const summaryDiv = document.getElementById('paymentSummary');
        const btnSave = document.getElementById('btnSavePayment');

        if (!techId) {
            summaryDiv.innerHTML = renderPaymentSummary([], 0);
            btnSave.disabled = true;
            return;
        }

        summaryDiv.innerHTML = `<div style="text-align: center; padding: 20px;">${Icons.refreshCw} Calculando...</div>`;

        console.warn('🔍 updatePaymentCalculation - Tech ID:', techId);
        const visits = await DataService.getVisitasPorTecnico(techId, { pendientesPago: true });
        console.warn('🔍 updatePaymentCalculation - Visits found:', visits.length, visits);

        // Debug: Check if there are ANY visits for this tech ignoring filters
        if (visits.length === 0) {
            const allVisits = await DataService.getVisitasPorTecnico(techId);
            console.warn('🔍 Debug: Total visits for tech (ignoring payment status):', allVisits.length);
        }

        const total = visits.reduce((sum, v) => sum + (parseFloat(v.costo_servicio) || 0), 0);

        summaryDiv.innerHTML = renderPaymentSummary(visits, total);
        btnSave.disabled = (visits.length === 0);
    };

    const savePayment = async () => {
        const techId = document.getElementById('pagoTechId').value;
        const totalServicios = parseFloat(document.getElementById('hiddenTotalServicios').value);
        const montoPago = parseFloat(document.getElementById('hiddenPagoMonto').value);
        const visitaIds = document.getElementById('hiddenVisitaIds').value.split(',');
        const pInicio = document.getElementById('pagoInicio').value;
        const pFin = document.getElementById('pagoFin').value;
        const pRecibo = document.getElementById('pagoRecibo').value;
        const pNotas = document.getElementById('pagoNotas').value;

        if (!techId || !pInicio || !pFin) {
            alert('Por favor complete los campos requeridos');
            return;
        }

        try {
            const pagoData = {
                tecnico_id: techId,
                periodo_inicio: pInicio,
                periodo_fin: pFin,
                total_servicios: totalServicios,
                monto_pago: montoPago,
                numero_recibo: pRecibo || null,
                notas: pNotas
            };

            const result = await DataService.createPagoTecnico(pagoData, visitaIds);

            if (result) {
                alert('Pago registrado correctamente');
                closeModal('paymentModal');
                render();
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('Error al guardar el pago: ' + error.message);
        }
    };

    const generateReport = async () => {
        const techId = document.getElementById('reportTechId').value;
        const start = document.getElementById('reportStartDate').value;
        const end = document.getElementById('reportEndDate').value;
        const resultsDiv = document.getElementById('reportResults');

        if (!techId) {
            alert('Seleccione un técnico');
            return;
        }

        resultsDiv.innerHTML = `<div style="text-align: center; padding: 40px;">${Icons.refreshCw} Cargando reporte...</div>`;

        const visits = await DataService.getVisitasPorTecnico(techId, {
            fechaInicio: start,
            fechaFin: end
        });

        const totalCosto = visits.reduce((sum, v) => sum + (parseFloat(v.costo_servicio) || 0), 0);
        const completadas = visits.filter(v => v.trabajo_realizado).length;
        const antiguedad = await DataService.getAntiguedadTecnico(techId);

        resultsDiv.innerHTML = `
            <div class="card">
                <div class="card__header" style="justify-content: space-between;">
                    <h3 class="card__title">Resultados del Reporte</h3>
                    <div>
                        <button class="btn btn--secondary btn--sm" onclick="GestionTecnicosModule.printReport()">
                            ${Icons.printer} Imprimir PDF
                        </button>
                    </div>
                </div>
                <div class="card__body">
                    <div class="grid grid--cols-1 grid--md-cols-4 gap-md" style="margin-bottom: var(--spacing-lg);">
                        <div style="padding: var(--spacing-md); background: var(--color-primary-50); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Total Servicios</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">${visits.length}</div>
                        </div>
                        <div style="padding: var(--spacing-md); background: var(--color-success-light); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Completados</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">${completadas}</div>
                        </div>
                        <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Monto Generado</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">$${totalCosto.toFixed(2)}</div>
                        </div>
                        <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Fecha Alta</div>
                            <div class="font-bold" style="font-size: var(--font-size-lg);">${formatDate(antiguedad)}</div>
                        </div>
                    </div>

                    <table class="data-table">
                        <thead class="data-table__head">
                            <tr>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Servicio</th>
                                <th>Estado</th>
                                <th style="text-align: right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody class="data-table__body">
                            ${visits.map(v => `
                                <tr>
                                    <td>${formatDate(v.fecha_inicio)}</td>
                                    <td>${v.cliente?.empresa || 'N/A'}</td>
                                    <td>${v.tipo_visita}</td>
                                    <td><span class="badge ${v.trabajo_realizado ? 'badge--success' : 'badge--warning'}">${v.trabajo_realizado ? 'Realizado' : 'Pendiente'}</span></td>
                                    <td style="text-align: right;">$${(parseFloat(v.costo_servicio) || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    const printReceipt = (pagoId) => {
        const pago = payments.find(p => p.id === pagoId);
        if (!pago) return;

        const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };

        const renderReceiptCopy = (title) => `
            <div class="receipt-copy">
                <!-- Header -->
                <div class="header">
                    <div class="logo-section">
                        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo">` : ''}
                    </div>
                    <div class="company-details">
                        <h1>${companyConfig.name}</h1>
                        <p>Servicios Técnicos Profesionales</p>
                    </div>
                    <div class="receipt-meta">
                        <div class="meta-item">
                            <span class="label">RECIBO N°</span>
                            <span class="value highlight">${pago.numero_recibo || '---'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">FECHA</span>
                            <span class="value">${formatDate(pago.fecha_pago)}</span>
                        </div>
                    </div>
                </div>

                <!-- Recipient Info -->
                <div class="recipient-section">
                    <div class="recipient-row">
                        <span class="label">TÉCNICO:</span>
                        <span class="value">${pago.tecnico?.full_name || 'N/A'}</span>
                    </div>
                </div>

                <!-- Payment Details Table -->
                 <table class="details-table">
                    <thead>
                        <tr>
                            <th>DESCRIPCIÓN</th>
                            <th class="text-right">MONTO</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div class="concept-title">Pago de Comisiones por Servicios</div>
                                <div class="concept-period">Periodo: ${formatDate(pago.periodo_inicio)} al ${formatDate(pago.periodo_fin)}</div>
                            </td>
                            <td class="text-right amount-cell">
                                C$${parseFloat(pago.monto_pago).toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class="total-label">TOTAL A PAGAR</td>
                            <td class="total-amount">C$${parseFloat(pago.monto_pago).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <!-- Notes -->
                 <div class="notes-section">
                    <span class="label">NOTAS:</span>
                    <p>${pago.notas || 'Sin observaciones.'}</p>
                </div>

                <!-- Signatures -->
                 <div class="signatures">
                    <div class="signature-box">
                        <div class="line"></div>
                        <div class="role">Entregado por</div>
                        <div class="name">${companyConfig.name}</div>
                    </div>
                    <div class="signature-box">
                        <div class="line"></div>
                        <div class="role">Recibí Conforme</div>
                        <div class="name">${pago.tecnico?.full_name || ''}</div>
                    </div>
                </div>
                
                <div class="copy-label">${title}</div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Recibo de Pago - ${pago.numero_recibo}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                        
                        * { box-sizing: border-box; }
                        body { 
                            font-family: 'Inter', sans-serif; 
                            background: #ccc; 
                            margin: 0; 
                            padding: 0; /* Remove body padding to let page-container handle it */
                            -webkit-print-color-adjust: exact; 
                        }
                        
                        .page-container {
                            background: white;
                            width: 210mm; 
                            height: 297mm; 
                            margin: 0 auto;
                            padding: 8mm 10mm; /* Adjusted padding */
                            position: relative;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }

                        .receipt-copy {
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 15px 20px; /* Reduced internal padding */
                            height: 48%; 
                            position: relative;
                            background: white;
                            display: flex;
                            flex-direction: column;
                        }

                        /* Header Styles */
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #1a73e8;
                            padding-bottom: 10px; /* Reduced */
                            margin-bottom: 15px; /* Reduced */
                        }
                        .logo-section img { max-height: 45px; background: transparent; mix-blend-mode: multiply; } /* Slightly smaller logo */
                        .company-details { flex: 1; margin-left: 15px; }
                        .company-details h1 { margin: 0; font-size: 18px; color: #1e293b; text-transform: uppercase; letter-spacing: -0.5px; }
                        .company-details p { margin: 2px 0; font-size: 10px; color: #64748b; font-weight: 500; }
                        
                        .receipt-meta { text-align: right; }
                        .meta-item { margin-bottom: 3px; }
                        .meta-item .label { font-size: 8px; color: #64748b; display: block; letter-spacing: 0.5px; font-weight: 700; text-transform: uppercase; }
                        .meta-item .value { font-size: 12px; font-weight: 600; color: #0f172a; }
                        .meta-item .value.highlight { color: #dc2626; font-size: 14px; font-weight: 700; }

                        /* Recipient */
                        .recipient-section {
                            background: #f8fafc;
                            padding: 10px 15px; /* Reduced */
                            border-radius: 6px;
                            margin-bottom: 15px; /* Reduced */
                            border: 1px solid #f1f5f9;
                        }
                        .recipient-row { display: flex; flex-direction: column; }
                        .recipient-row .label { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 2px; font-weight: 700; }
                        .recipient-row .value { font-size: 13px; font-weight: 600; color: #334155; }

                        /* Table */
                        .details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; flex-grow: 1; }
                        .details-table th { 
                            background: #f1f5f9; 
                            color: #475569; 
                            padding: 8px 10px; 
                            text-align: left; 
                            font-size: 9px; 
                            text-transform: uppercase; 
                            letter-spacing: 0.5px;
                            font-weight: 700;
                            border-bottom: 2px solid #e2e8f0;
                        }
                        .details-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                        .details-table .text-right { text-align: right; }
                        
                        .concept-title { font-weight: 600; color: #1e293b; font-size: 11px; margin-bottom: 3px; }
                        .concept-period { font-size: 10px; color: #64748b; margin-bottom: 2px; }
                        .concept-meta { font-size: 9px; color: #94a3b8; font-style: italic; }
                        
                        .amount-cell { font-weight: 700; color: #1e293b; font-size: 12px; }

                        .details-table tfoot td { border-top: 2px solid #1a73e8; border-bottom: none; padding-top: 10px; }
                        .total-label { text-align: right; font-weight: 700; font-size: 11px; color: #64748b; text-transform: uppercase; }
                        .total-amount { text-align: right; font-weight: 800; font-size: 16px; color: #1a73e8; letter-spacing: -0.5px; }

                        /* Notes */
                        .notes-section { 
                            font-size: 10px; 
                            color: #64748b; 
                            margin-bottom: 15px; 
                            border: 1px dashed #cbd5e1; 
                            padding: 8px 12px; 
                            border-radius: 4px;
                            background: #fcfcfc;
                        }
                        .notes-section .label { font-weight: 700; margin-right: 5px; color: #475569; font-size: 9px; }
                        .notes-section p { display: inline; margin: 0; font-style: italic; }

                        /* Signatures - Fixed at bottom */
                        .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-top: 5px;}
                        .signature-box { width: 40%; text-align: center; }
                        .signature-box .line { border-top: 1px solid #94a3b8; margin-bottom: 6px; }
                        .signature-box .role { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
                        .signature-box .name { font-size: 11px; color: #1e293b; margin-top: 3px; font-weight: 500; }

                        /* Cut Line */
                        .cut-line {
                            width: 100%;
                            height: 0;
                            border-top: 2px dashed #94a3b8;
                            margin: 4mm 0; /* Reduced margin */
                            position: relative;
                            opacity: 0.5;
                        }
                        .cut-line::after {
                            content: '✂ CORTAR AQUÍ';
                            position: absolute;
                            left: 50%;
                            top: -9px;
                            transform: translateX(-50%);
                            background: white;
                            padding: 0 8px;
                            color: #64748b;
                            font-size: 9px;
                            font-weight: 600;
                            letter-spacing: 1px;
                        }

                        .copy-label {
                            position: absolute;
                            top: 10px;
                            right: 15px;
                            font-size: 7px;
                            color: #94a3b8;
                            text-transform: uppercase;
                            border: 1px solid #e2e8f0;
                            padding: 2px 6px;
                            border-radius: 10px;
                            font-weight: 600;
                            background: #f8fafc;
                        }

                        @media print {
                            body { background: white; margin: 0; padding: 0; }
                            .page-container { width: 100%; padding: 5mm; margin: 0; box-shadow: none; height: 100%; box-sizing: border-box; }
                            /* Force height slightly less than 50% to ensure fit */
                            .receipt-copy { height: 47%; border-color: #cbd5e1; }
                            .cut-line { margin: 2mm 0; border-top: 1px dashed #000; opacity: 1; }
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        ${renderReceiptCopy('ORIGINAL - TÉCNICO')}
                        
                        <div class="cut-line"></div>
                        
                        ${renderReceiptCopy('COPIA - EMPRESA')}
                    </div>
                    <script>
                        window.onload = () => { setTimeout(() => { window.print(); }, 800); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const printReport = () => {
        window.print();
    };

    // Helpres
    const closeModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-NI');
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('es-NI');
    };

    const refresh = () => App.render();

    return {
        init,
        render,
        switchTab,
        renderPaymentModal,
        closeModal,
        updatePaymentCalculation,
        savePayment,
        generateReport,
        viewTechReport: (id) => {
            currentTab = 'reportes';
            if (typeof App !== 'undefined' && App.render) {
                App.render();
                setTimeout(() => {
                    const select = document.getElementById('reportTechId');
                    if (select) {
                        select.value = id;
                        GestionTecnicosModule.generateReport();
                    }
                }, 100);
            }
        },
        printReceipt,
        printReport,
        refresh
    };
})();

// Asegurar que sea globalmente accesible
const openTechPaymentModal = (techId = null) => {
    console.log('Global openTechPaymentModal called', techId);
    if (typeof GestionTecnicosModule !== 'undefined') {
        GestionTecnicosModule.renderPaymentModal(techId);
    } else {
        alert('Error: Módulo no cargado');
    }
};

window.openTechPaymentModal = openTechPaymentModal;
window.GestionTecnicosModule = GestionTecnicosModule;
console.log('✅ Módulo de Gestión de Técnicos cargado correctamente v2.0');
