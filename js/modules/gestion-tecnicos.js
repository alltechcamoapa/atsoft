/**
 * ALLTECH - Gestión de Técnicos
 * Módulo para gestionar pagos, reportes y estadísticas de técnicos
 */

const GestionTecnicosModule = (() => {
    let currentTab = 'trabajos';
    let technicians = [];
    let payments = [];
    let selectedTechnician = null;
    let technicianVisits = [];
    let workFilters = {
        tecnicoId: '',
        fechaInicio: '',
        fechaFin: '',
        mes: '',
        tipo: 'todos' // 'todos', 'taller', 'visita'
    };

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
            // Recalcular estadísticas rápidas para los técnicos (Visitas + Recepciones)
            const allVisitas = DataService.getVisitasSync();
            const allRecepciones = DataService.getRecepcionesSync();

            technicians.forEach(t => {
                // 1. Visitas terminadas
                const techVisits = allVisitas.filter(v => (v.tecnicoId || v.tecnico_id || v.usuarioSoporte || v.usuario_soporte) === t.id);
                const visitsCompleted = techVisits.filter(v => v.trabajoRealizado || v.trabajo_realizado);
                const visitsPendingPayment = visitsCompleted.filter(v => !v.pago_id);

                // 2. Recepciones terminadas (evitando las que ya generaron visita para no duplicar en el historial de pagos)
                const techRecepciones = allRecepciones.filter(r =>
                    (r.tecnico_asignado === t.id || r.tecnico_asignado === t.name || r.tecnico_asignado === t.full_name) &&
                    (r.estado === 'Reparado' || r.estado === 'Entregado')
                );

                // Filtrar recepciones que no tienen una visita asociada (para no duplicar conteo)
                const recepcionesPendingPayment = techRecepciones.filter(r => {
                    const code = r.codigo_recepcion || r.numero_recepcion;
                    const hasVisit = visitsCompleted.some(v => (v.tipoVisita || v.tipo_visita || '').includes(code));
                    return !hasVisit && !r.pago_id;
                });

                t.stats = {
                    total: visitsCompleted.length + techRecepciones.length,
                    pendientes: visitsPendingPayment.length + recepcionesPendingPayment.length
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
                <button class="tab-btn ${currentTab === 'trabajos' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('trabajos')">
                    ${Icons.list} Trabajos Realizados
                </button>
                <button class="tab-btn ${currentTab === 'pagos' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('pagos')">
                    ${Icons.dollarSign} Historial de Pagos
                </button>
                <button class="tab-btn ${currentTab === 'tecnicos' ? 'active' : ''}" onclick="GestionTecnicosModule.switchTab('tecnicos')">
                    ${Icons.users} Técnicos
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
            case 'trabajos':
                return renderTrabajosTab();
            case 'pagos':
                return renderPagosTab();
            case 'tecnicos':
                return renderTecnicosTab();
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
        // Obtener los últimos 5 trabajos terminados para este técnico
        const allVisitas = DataService.getVisitasSync() || [];
        const allRecepciones = DataService.getRecepcionesSync() || [];

        const vJobs = allVisitas.filter(v => (v.tecnicoId || v.tecnico_id || v.usuarioSoporte || v.usuario_soporte) === tech.id && (v.trabajoRealizado || v.trabajo_realizado))
            .map(v => ({ fecha: v.fecha_inicio || v.fechaInicio, desc: v.tipo_visita || v.tipoVisita, cliente: v.cliente?.nombre_cliente || v.cliente?.empresa || 'Cliente' }));

        const rJobs = allRecepciones.filter(r => (r.tecnico_asignado === tech.id || r.tecnico_asignado === tech.name || r.tecnico_asignado === tech.full_name) && (r.estado === 'Reparado' || r.estado === 'Entregado'))
            .map(r => ({ fecha: r.fecha_recepcion || r.created_at, desc: 'Taller: ' + (r.codigo_recepcion || r.numero_recepcion), cliente: r.cliente?.nombre_cliente || r.cliente?.empresa || 'Cliente' }));

        const lastJobs = [...vJobs, ...rJobs]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 5);

        return `
            <div class="card tech-card" style="position: relative; overflow: hidden; display: flex; flex-direction: column; height: 100%;">
                <div class="card__body" style="flex: 1;">
                    <div style="display: flex; gap: var(--spacing-md); align-items: center; margin-bottom: var(--spacing-md);">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name)}&background=1a73e8&color=fff&size=60" 
                             alt="${tech.name}" 
                             style="width: 60px; height: 60px; border-radius: 50%;">
                        <div>
                            <h3 style="margin: 0; font-size: var(--font-size-lg); line-height: 1.2;">${tech.name}</h3>
                            <span class="badge badge--primary" style="font-size: 10px; margin-top: 4px;">${tech.role}</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
                        <div style="padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm); text-align: center;">
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Total</div>
                            <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-md);">${tech.stats?.total || 0}</div>
                        </div>
                        <div style="padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm); text-align: center;">
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Pendientes</div>
                            <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-md); color: var(--color-warning);">${tech.stats?.pendientes || 0}</div>
                        </div>
                    </div>

                    <div style="margin-bottom: var(--spacing-md);">
                        <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Últimos 5 Trabajos</h4>
                        ${lastJobs.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${lastJobs.map(j => `
                                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                                            <span class="font-semibold">${j.desc}</span><br>
                                            <span style="color: var(--text-muted); font-size: 10px;">${j.cliente}</span>
                                        </div>
                                        <span style="color: var(--text-muted); font-size: 10px; white-space: nowrap;">${new Date(j.fecha).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' })}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">Sin trabajos recientes</div>'}
                    </div>
                </div>
                <div class="card__footer" style="padding: var(--spacing-md); border-top: 1px solid var(--border-color); background: var(--bg-secondary);">
                    <button class="btn btn--primary btn--sm btn--block" onclick="GestionTecnicosModule.renderPaymentModal('${tech.id}')">
                        ${Icons.dollarSign} Gestionar Pago
                    </button>
                </div>
            </div>
        `;
    };

    const renderPagosTab = () => {
        const allUsers = DataService.getUsersSync() || [];
        const resolveTechName = (pago) => {
            if (pago.tecnico?.full_name) return pago.tecnico.full_name;
            if (pago.tecnico?.name) return pago.tecnico.name;
            if (pago.tecnicoNombre && pago.tecnicoNombre !== 'Desconocido') return pago.tecnicoNombre;
            if (pago.tecnico_id) {
                const user = allUsers.find(u => u.id === pago.tecnico_id);
                if (user) return user.name || user.full_name || user.username;
            }
            return 'Desconocido';
        };

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
                                <td>${resolveTechName(p)}</td>
                                <td>${formatDate(p.periodo_inicio)} - ${formatDate(p.periodo_fin)}</td>
                                <td>C$${parseFloat(p.total_servicios).toFixed(2)}</td>
                                <td><span class="text-success font-bold">C$${parseFloat(p.monto_pago).toFixed(2)}</span></td>
                                <td>${formatDateTime(p.fecha_pago)}</td>
                                <td style="text-align: right;">
                                    <div style="display: flex; justify-content: flex-end; gap: 4px;">
                                        <button class="btn btn--ghost btn--icon btn--sm" onclick="GestionTecnicosModule.printReceipt('${p.id}')" title="Imprimir Recibo">
                                            ${Icons.printer}
                                        </button>
                                        <button class="btn btn--ghost btn--icon btn--sm" onclick="GestionTecnicosModule.deletePago('${p.id}')" title="Eliminar Pago" style="color: var(--color-danger);">
                                            ${Icons.trash}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    const renderTrabajosTab = () => {
        const allVisitas = DataService.getVisitasSync() || [];
        const allRecepciones = DataService.getRecepcionesSync() || [];
        const allUsers = DataService.getUsersSync();

        const getTechName = (id) => {
            if (!id) return 'N/A';

            // Handle "UUID|Name" format from recepciones
            let searchId = id;
            if (typeof id === 'string' && id.includes('|')) {
                searchId = id.split('|')[0];
            }

            // Normalización simple: trim y case-insensitive si es necesario
            const u = allUsers.find(user =>
                user.id === searchId ||
                user.name === searchId ||
                user.full_name === searchId ||
                user.username === searchId ||
                (typeof id === 'string' && (id.includes(user.name) || user.name.includes(id)))
            );

            if (u) return u.name || u.full_name || u.username;

            // Búsqueda difusa si es el único técnico o si el nombre coincide parcialmente
            if (typeof searchId === 'string' && searchId.length < 30) {
                const fuzzy = allUsers.find(user =>
                    user.name.toLowerCase().includes(searchId.toLowerCase()) ||
                    searchId.toLowerCase().includes(user.name.toLowerCase())
                );
                if (fuzzy) return fuzzy.name || fuzzy.full_name;
            }

            // If it's a UUID and not found, return Desconocido
            if (typeof searchId === 'string' && searchId.length > 20) return 'Desconocido';

            // If it's the "ID|Name" format but not found in list, return the Name part if available
            if (typeof id === 'string' && id.includes('|')) {
                return id.split('|')[1];
            }

            return id;
        };

        // 1. Procesar Visitas (Servicios de campo/remotos)
        const completedVisits = allVisitas.filter(v => v.trabajoRealizado || v.trabajo_realizado).map(v => {
            const tipoRaw = v.tipoVisita || v.tipo_visita || 'Servicio';
            const codigoVisita = v.codigo_visita || v.visitaId || v.id.substring(0, 8);
            const tipoLabel = tipoRaw === 'Física' ? ('Física: ' + codigoVisita) : tipoRaw === 'Remota' ? ('Remota: ' + codigoVisita) : (tipoRaw + ': ' + codigoVisita);
            return {
                id: v.id,
                fecha: v.fechaInicio || v.fecha_inicio,
                tipo: tipoLabel,
                tecnicoId: v.usuarioSoporte || v.usuario_soporte || v.tecnicoId || v.tecnico_id,
                clienteId: v.clienteId || v.cliente_id,
                equipoId: v.equipo_id || v.equipoId,
                monto: parseFloat(v.costoServicio || v.costo_servicio || 0),
                moneda: v.moneda || 'NIO',
                pagoId: v.pago_id,
                descripcion: v.descripcionTrabajo || v.descripcion_trabajo || '',
                _original: v
            };
        });

        // 2. Procesar Recepciones (Reparaciones de taller) que estén en Reparado o Entregado
        const completedRecepciones = allRecepciones.filter(r =>
            (r.estado === 'Reparado' || r.estado === 'Entregado') && (r.tecnico_asignado || r.recibido_por)
        ).map(r => ({
            id: r.id,
            fecha: r.fecha_recepcion || r.created_at,
            tipo: 'Taller: ' + (r.codigo_recepcion || r.numero_recepcion),
            tecnicoId: r.tecnico_asignado || r.recibido_por,
            clienteId: r.cliente_id || r.clienteId,
            equipoId: r.equipo_id || r.equipoId,
            monto: parseFloat(r.mano_de_obra || 0),
            moneda: r.moneda || 'NIO',
            pagoId: r.pago_id,
            descripcion: 'Reparación en estado ' + r.estado,
            _original: r
        }));

        // 3. Mezclar evitando duplicados (si la recepción ya generó una visita, priorizar visita)
        let list = [...completedVisits];
        completedRecepciones.forEach(r => {
            const code = r.tipo.replace('Taller: ', '');
            const exists = completedVisits.some(v => v.tipo.includes(code));
            if (!exists) list.push(r);
        });

        // 4. Aplicar Filtros
        if (workFilters.tecnicoId) {
            list = list.filter(v => {
                const techId = v.tecnicoId;
                if (!techId) return false;
                if (typeof techId === 'string' && techId.includes('|')) {
                    return techId.split('|')[0] === workFilters.tecnicoId;
                }
                return techId === workFilters.tecnicoId;
            });
        }

        if (workFilters.tipo === 'taller') {
            list = list.filter(v => v.tipo.startsWith('Taller:'));
        } else if (workFilters.tipo === 'visita') {
            list = list.filter(v => !v.tipo.startsWith('Taller:'));
        }

        if (workFilters.fechaInicio) {
            list = list.filter(v => v.fecha >= workFilters.fechaInicio);
        }
        if (workFilters.fechaFin) {
            list = list.filter(v => v.fecha.split('T')[0] <= workFilters.fechaFin);
        }
        if (workFilters.mes) {
            const [year, month] = workFilters.mes.split('-');
            list = list.filter(v => {
                const date = new Date(v.fecha);
                return date.getFullYear() == year && (date.getMonth() + 1) == month;
            });
        }

        // Ordenar por fecha descendente
        list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (list.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state__icon">${Icons.list || Icons.fileText}</div>
                    <h3 class="empty-state__title">No hay trabajos realizados registrados</h3>
                    <p class="empty-state__description">Los servicios finalizados y reparaciones de taller aparecerán aquí.</p>
                </div>
            `;
        }

        return `
            <div class="card card--no-padding">
                    <div style="padding: var(--spacing-md); border-bottom: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                            <h3 style="margin: 0; font-size: var(--font-size-md);">${Icons.filter} Historial Unificado de Servicios</h3>
                            <span class="badge badge--success">${list.length} Trabajos Terminados</span>
                        </div>
                        
                        <!-- Barra de Filtros Compacta -->
                        <div style="background: var(--bg-secondary); padding: 8px; border-radius: var(--border-radius-sm); display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end;">
                            <div style="flex: 1; min-width: 150px;">
                                <label style="display: block; font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Técnico</label>
                                <select class="form-input form-input--sm" id="workFilterTech" onchange="GestionTecnicosModule.setWorkFilter('tecnicoId', this.value)" style="height: 32px;">
                                    <option value="">Todos los técnicos</option>
                                    ${technicians.map(t => `<option value="${t.id}" ${workFilters.tecnicoId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                                </select>
                            </div>
                            <div style="flex: 0.8; min-width: 130px;">
                                <label style="display: block; font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Origen</label>
                                <select class="form-input form-input--sm" id="workFilterTipo" onchange="GestionTecnicosModule.setWorkFilter('tipo', this.value)" style="height: 32px;">
                                    <option value="todos" ${workFilters.tipo === 'todos' ? 'selected' : ''}>Todos</option>
                                    <option value="taller" ${workFilters.tipo === 'taller' ? 'selected' : ''}>Taller</option>
                                    <option value="visita" ${workFilters.tipo === 'visita' ? 'selected' : ''}>Visitas</option>
                                </select>
                            </div>
                            <div style="width: 140px;">
                                <label style="display: block; font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Mes</label>
                                <input type="month" class="form-input form-input--sm" value="${workFilters.mes}" onchange="GestionTecnicosModule.setWorkFilter('mes', this.value)" style="height: 32px;">
                            </div>
                            <div style="width: 110px;">
                                <label style="display: block; font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Desde</label>
                                <input type="date" class="form-input form-input--sm" value="${workFilters.fechaInicio}" onchange="GestionTecnicosModule.setWorkFilter('fechaInicio', this.value)" style="height: 32px;">
                            </div>
                            <div style="width: 110px;">
                                <label style="display: block; font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Hasta</label>
                                <input type="date" class="form-input form-input--sm" value="${workFilters.fechaFin}" onchange="GestionTecnicosModule.setWorkFilter('fechaFin', this.value)" style="height: 32px;">
                            </div>
                            <button class="btn btn--ghost btn--sm" onclick="GestionTecnicosModule.resetWorkFilters()" title="Limpiar" style="height: 32px; padding: 0 10px;">
                                ${Icons.refreshCw}
                            </button>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="data-table">
                            <thead class="data-table__head">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Técnico</th>
                                    <th>Cliente / Equipo</th>
                                    <th>Detalles del Trabajo</th>
                                    <th>Monto</th>
                                    <th>Estado Pago</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody class="data-table__body">
                                ${list.map(v => {
            const techName = getTechName(v.tecnicoId);
            const cliente = DataService.getClienteById(v.clienteId);
            const equipo = v.equipoId ? DataService.getEquipoById(v.equipoId) : null;
            const isPaid = !!v.pagoId;
            const isTaller = v.tipo.startsWith('Taller:');

            return `
                                        <tr>
                                            <td>${formatDate(v.fecha)}</td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(techName)}&size=24&background=random" style="width: 24px; height: 24px; border-radius: 50%;">
                                                    <span>${techName}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600;">${cliente?.empresa || cliente?.nombreCliente || 'N/A'}</div>
                                                ${equipo ? `<div style="font-size: 11px; color: var(--text-muted);">${equipo.nombre_equipo || equipo.nombreEquipo || 'Equipo'} - ${equipo.serie || ''}</div>` : ''}
                                            </td>
                                            <td>
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <span style="color: ${isTaller ? 'var(--color-primary)' : 'var(--color-success)'}">${isTaller ? Icons.inbox : Icons.mapPin}</span>
                                                    <div style="font-weight: 600;">${v.tipo}</div>
                                                </div>
                                                <div style="font-size: 11px; color: var(--text-muted); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${v.descripcion}">
                                                    ${v.descripcion}
                                                </div>
                                            </td>
                                            <td>
                                                <span class="font-bold">${v.moneda === 'USD' ? '$' : 'C$'}${v.monto.toFixed(2)}</span>
                                            </td>
                                            <td>
                                                <span class="badge badge--${isPaid ? 'success' : 'warning'}" style="font-size: 10px;">
                                                    ${isPaid ? 'Pagado' : 'Pendiente'}
                                                </span>
                                            </td>
                                            <td style="text-align: right;">
                                                <button class="btn btn--ghost btn--icon btn--sm" onclick="GestionTecnicosModule.viewWorkDetail('${v.id}', '${isTaller ? 'recepcion' : 'visita'}')" title="Ver Detalles">
                                                    ${Icons.eye}
                                                </button>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
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
                <div class="modal-overlay" id="${modalId}" style="z-index: 10000;">
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

    const renderPaymentSummary = (items, total, tipoCambio = 36.6) => {
        const pagoMonto = total * 0.5;

        if (items.length === 0) {
            return `
                <div style="text-align: center; color: var(--text-muted); padding: var(--spacing-md);">
                    ${Icons.info} Seleccione un técnico con servicios o reparaciones pendientes de pago.
                </div>
            `;
        }

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                <span class="font-semibold">Trabajos Pendientes:</span>
                <span class="badge badge--info">${items.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                <span class="font-semibold">Total Bruto Servicios:</span>
                <span class="font-bold">C$${total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--spacing-sm); border-top: 1px solid var(--border-color);">
                <span class="font-bold" style="font-size: var(--font-size-lg);">Monto a Pagar (50%):</span>
                <span class="font-bold text-success" style="font-size: var(--font-size-2xl);">C$${pagoMonto.toFixed(2)}</span>
            </div>
            <div style="margin-top: var(--spacing-md); max-height: 150px; overflow-y: auto;">
                <table class="data-table data-table--compact">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Trabajando</th>
                            <th style="text-align: right;">Costo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(v => {
            const isNIO = v.moneda === 'NIO';
            const orig = (parseFloat(v.monto) || 0);
            const calc = isNIO ? orig : orig * tipoCambio;
            return `
                            <tr>
                                <td>${formatDate(v.fecha)}</td>
                                <td style="font-size: 11px;">
                                    <div style="font-weight: 600;">${v.tipo}</div>
                                    <div style="font-size: 9px; color: var(--text-muted);">${v.cliente || ''}</div>
                                </td>
                                <td style="text-align: right;">
                                    <div style="font-weight: bold;">C$${calc.toFixed(2)}</div>
                                    <div style="font-size: 9px; color: var(--text-muted); margin-top: 2px;">${!isNIO && orig > 0 ? `($${orig.toFixed(2)} x ${tipoCambio})` : ''}</div>
                                </td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
            <input type="hidden" id="hiddenTotalServicios" value="${total}">
            <input type="hidden" id="hiddenPagoMonto" value="${pagoMonto}">
            <input type="hidden" id="hiddenVisitaIds" value="${items.filter(i => i._type === 'visita').map(v => v.id).join(',')}">
            <input type="hidden" id="hiddenRecepcionIds" value="${items.filter(i => i._type === 'recepcion').map(r => r.id).join(',')}">
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

        // 1. Obtener Visitas pendientes
        const rawVisits = await DataService.getVisitasPorTecnico(techId, { pendientesPago: true });
        const visits = rawVisits.map(v => ({
            id: v.id,
            fecha: v.fecha_inicio || v.fechaInicio,
            tipo: v.tipo_visita || v.tipoVisita,
            monto: v.costo_servicio || v.costoServicio || 0,
            moneda: v.moneda || 'NIO',
            cliente: v.cliente?.empresa || v.cliente?.nombre_cliente || 'Cliente S/N',
            _type: 'visita'
        }));

        // 2. Obtener Recepciones pendientes
        const allRecepciones = DataService.getRecepcionesSync() || [];
        const tech = technicians.find(t => t.id === techId);

        const recepciones = allRecepciones.filter(r => {
            const assigned = r.tecnico_asignado || r.recibido_por;
            if (!assigned) return false;

            // Normalizar ID y Nombre para comparación
            let currentTechId = assigned;
            let currentTechName = assigned;

            if (typeof assigned === 'string' && assigned.includes('|')) {
                const parts = assigned.split('|');
                currentTechId = parts[0];
                currentTechName = parts[1];
            }

            // Comparar contra el técnico seleccionado
            const isMatch = (
                currentTechId === techId ||
                currentTechId === tech?.name ||
                currentTechId === tech?.full_name ||
                currentTechName === tech?.name ||
                currentTechName === tech?.full_name
            );

            // Estado debe ser Reparado o Entregado y NO tener pago_id
            const isCompleted = (r.estado === 'Reparado' || r.estado === 'Entregado');
            const isUnpaid = !r.pago_id && !r.pagoId;

            return isMatch && isCompleted && isUnpaid;
        }).map(r => ({
            id: r.id,
            fecha: r.fecha_recepcion || r.created_at,
            tipo: 'Taller: ' + (r.codigo_recepcion || r.numero_recepcion),
            monto: parseFloat(r.mano_de_obra || 0),
            moneda: r.moneda || 'NIO',
            cliente: r.cliente?.empresa || r.cliente?.nombre_cliente || 'Cliente S/N',
            _type: 'recepcion'
        }));

        // 3. Unificar evitando duplicados
        const items = [...visits];
        recepciones.forEach(r => {
            const code = r.tipo.replace('Taller: ', '');
            // Verificar si el código de recepción ya está contemplado en una visita de campo
            const alreadyInVisits = visits.some(v => (v.tipo || '').includes(code));
            if (!alreadyInVisits) items.push(r);
        });

        let tipoCambio = 36.6;
        try {
            const cacheConfig = typeof DataService.getConfig === 'function' ? DataService.getConfig() : null;
            if (cacheConfig && cacheConfig.tipoCambio) tipoCambio = parseFloat(cacheConfig.tipoCambio);
        } catch (error) { }

        const total = items.reduce((sum, item) => {
            const costo = parseFloat(item.monto) || 0;
            if (item.moneda === 'NIO') return sum + costo;
            return sum + (costo * tipoCambio);
        }, 0);

        summaryDiv.innerHTML = renderPaymentSummary(items, total, tipoCambio);
        btnSave.disabled = (items.length === 0);
    };

    const savePayment = async () => {
        const techId = document.getElementById('pagoTechId').value;
        const totalServicios = parseFloat(document.getElementById('hiddenTotalServicios').value);
        const montoPago = parseFloat(document.getElementById('hiddenPagoMonto').value);
        const visitaIds = document.getElementById('hiddenVisitaIds').value.split(',').filter(id => id);
        const recepcionIds = document.getElementById('hiddenRecepcionIds').value.split(',').filter(id => id);
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

            const result = await DataService.createPagoTecnico(pagoData, visitaIds, recepcionIds);

            if (result) {
                alert('Pago registrado correctamente');
                closeModal('paymentModal');
                // Refrescar caché completo para reflejar los pago_id actualizados en visitas y recepciones
                await DataService.refreshCache();
                await loadData();
                App.render();
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('Error al guardar el pago: ' + error.message);
        }
    };

    const generateReport = async () => {
        const techId = document.getElementById('reportTechId').value;
        const start = document.getElementById('reportStartDate').value;
        const resultsDiv = document.getElementById('reportResults');

        if (!techId) {
            alert('Seleccione un técnico');
            return;
        }

        resultsDiv.innerHTML = `<div style="text-align: center; padding: 40px;">${Icons.refreshCw} Cargando reporte...</div>`;

        // 1. Obtener Visitas
        const visits = await DataService.getVisitasPorTecnico(techId, {
            fechaInicio: start,
            fechaFin: end
        });

        // 2. Obtener Recepciones
        const allRecepciones = DataService.getRecepcionesSync() || [];
        const tech = technicians.find(t => t.id === techId);
        const techNameMatch = tech ? (tech.name || tech.full_name) : null;

        const recepciones = allRecepciones.filter(r => {
            const isTech = r.tecnico_asignado === techId || r.tecnico_asignado === techNameMatch;
            const date = r.fecha_recepcion || r.created_at;
            const inDateRange = (!start || date >= start) && (!end || date <= end);
            return isTech && inDateRange;
        });

        // 3. Unificar
        const unifiedItems = visits.map(v => ({
            fecha: v.fecha_inicio || v.fechaInicio,
            cliente: v.cliente?.empresa || v.cliente?.nombre_cliente || 'N/A',
            servicio: v.tipo_visita || v.tipoVisita || 'Servicio',
            completado: v.trabajo_realizado || v.trabajoRealizado,
            monto: parseFloat(v.costo_servicio || v.costoServicio || 0),
            moneda: v.moneda || 'NIO',
            tipo: 'visita'
        }));

        recepciones.forEach(r => {
            const code = r.codigo_recepcion || r.numero_recepcion;
            const alreadyInVisits = visits.some(v => (v.tipo_visita || v.tipoVisita || '').includes(code));
            if (!alreadyInVisits) {
                unifiedItems.push({
                    fecha: r.fecha_recepcion || r.created_at,
                    cliente: r.cliente?.empresa || r.cliente?.nombre_cliente || 'N/A',
                    servicio: 'Taller: ' + code,
                    completado: r.estado === 'Reparado' || r.estado === 'Entregado',
                    monto: parseFloat(r.mano_de_obra || 0),
                    moneda: r.moneda || 'NIO',
                    tipo: 'recepcion'
                });
            }
        });

        unifiedItems.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        let tipoCambio = 36.6;
        try {
            const cacheConfig = typeof DataService.getConfig === 'function' ? DataService.getConfig() : null;
            if (cacheConfig && cacheConfig.tipoCambio) tipoCambio = parseFloat(cacheConfig.tipoCambio);
        } catch (error) { }

        const totalCosto = unifiedItems.reduce((sum, v) => {
            const costo = v.monto || 0;
            if (v.moneda === 'NIO') return sum + costo;
            return sum + (costo * tipoCambio);
        }, 0);

        const completadas = unifiedItems.filter(v => v.completado).length;
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
                            <div class="text-xs text-muted">Total Trabajos</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">${unifiedItems.length}</div>
                        </div>
                        <div style="padding: var(--spacing-md); background: var(--color-success-light); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Completados</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">${completadas}</div>
                        </div>
                        <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md);">
                            <div class="text-xs text-muted">Monto Generado (Bruto)</div>
                            <div class="font-bold" style="font-size: var(--font-size-xl);">C$${totalCosto.toFixed(2)}</div>
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
                                <th>Servicio / Reparación</th>
                                <th>Estado</th>
                                <th style="text-align: right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody class="data-table__body">
                            ${unifiedItems.map(v => `
                                <tr>
                                    <td>${formatDate(v.fecha)}</td>
                                    <td>${v.cliente}</td>
                                    <td>${v.servicio}</td>
                                    <td><span class="badge ${v.completado ? 'badge--success' : 'badge--warning'}">${v.completado ? 'Realizado' : 'Pendiente'}</span></td>
                                    <td style="text-align: right;">${v.moneda === 'USD' ? '$' : 'C$'}${v.monto.toFixed(2)}</td>
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

    const printReport = () => alert('Generando PDF de Reporte...');

    const setWorkFilter = (key, value) => {
        workFilters[key] = value;
        // Si cambia el mes, limpiamos los rangos de fecha para evitar conflicto visual
        if (key === 'mes' && value) {
            workFilters.fechaInicio = '';
            workFilters.fechaFin = '';
        } else if ((key === 'fechaInicio' || key === 'fechaFin') && value) {
            workFilters.mes = '';
        }
        App.render();
    };

    const resetWorkFilters = () => {
        workFilters = {
            tecnicoId: '',
            fechaInicio: '',
            fechaFin: '',
            mes: '',
            tipo: 'todos'
        };
        App.render();
    };

    const viewWorkDetail = (id, type) => {
        let work = null;
        let originalSource = null;

        if (type === 'recepcion') {
            const allRecepciones = DataService.getRecepcionesSync() || [];
            originalSource = allRecepciones.find(r => r.id === id);
            if (originalSource) {
                work = {
                    id: originalSource.id,
                    fecha: originalSource.fecha_recepcion || originalSource.created_at,
                    tipo: 'Reparación de Taller: ' + (originalSource.codigo_recepcion || originalSource.numero_recepcion),
                    tecnico: originalSource.tecnico_asignado,
                    cliente: originalSource.cliente?.nombre_cliente || originalSource.cliente?.empresa || 'Cliente S/N',
                    equipo: originalSource.equipo?.nombre_equipo || 'Equipo',
                    detalle: originalSource.diagnostico_inicial || 'Sin diagnóstico',
                    monto: originalSource.mano_de_obra || 0,
                    moneda: originalSource.moneda || 'NIO',
                    isPaid: !!originalSource.pago_id
                };
            }
        } else {
            const allVisitas = DataService.getVisitasSync() || [];
            originalSource = allVisitas.find(v => v.id === id);
            if (originalSource) {
                work = {
                    id: originalSource.id,
                    fecha: originalSource.fecha_inicio || originalSource.fechaInicio,
                    tipo: originalSource.tipo_visita || originalSource.tipoVisita,
                    tecnico: originalSource.usuario_soporte || originalSource.usuarioSoporte,
                    cliente: originalSource.cliente?.empresa || originalSource.cliente?.nombre_cliente || 'Cliente S/N',
                    equipo: originalSource.equipo?.nombre_equipo || originalSource.equipo?.nombreEquipo || 'Varios',
                    detalle: originalSource.descripcion_trabajo || originalSource.descripcionTrabajo || 'Sin descripción',
                    monto: originalSource.costo_servicio || originalSource.costoServicio || 0,
                    moneda: originalSource.moneda || 'NIO',
                    isPaid: !!originalSource.pago_id
                };
            }
        }

        if (!work) {
            alert('No se pudieron encontrar los detalles del trabajo.');
            return;
        }

        const modalId = 'workDetailModal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const allUsers = DataService.getUsersSync();
        const getTName = (tid) => {
            if (!tid) return 'Desconocido';
            const searchId = typeof tid === 'string' && tid.includes('|') ? tid.split('|')[0] : tid;
            const u = allUsers.find(user => user.id === searchId || user.name === searchId || user.full_name === searchId);
            return u ? (u.name || u.full_name) : (typeof tid === 'string' && tid.includes('|') ? tid.split('|')[1] : tid);
        };

        const modalHtml = `
            <div class="modal-overlay open" id="${modalId}" style="z-index: 10001; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
                <div class="modal modal--md" style="margin: 0; max-height: 90vh; overflow-y: auto;">
                    <div class="modal__header">
                        <h3 class="modal__title">Detalle del Trabajo</h3>
                        <button class="modal__close" onclick="GestionTecnicosModule.closeModal('${modalId}')">&times;</button>
                    </div>
                    <div class="modal__body">
                        <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm);">
                                <span class="badge ${type === 'recepcion' ? 'badge--primary' : 'badge--success'}">${type === 'recepcion' ? 'Taller' : 'Visita/Servicio'}</span>
                                <span style="font-size: var(--font-size-sm); color: var(--text-muted);">${formatDateTime(work.fecha)}</span>
                            </div>
                            <h4 style="margin: 0; color: var(--color-primary);">${work.tipo}</h4>
                        </div>

                        <div class="grid grid--cols-1 grid--md-cols-2 gap-md">
                            <div>
                                <label class="text-xs text-muted" style="display: block; margin-bottom: 2px;">Técnico Responsable</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(getTName(work.tecnico))}&size=32&background=random" style="width: 32px; height: 32px; border-radius: 50%;">
                                    <span class="font-semibold">${getTName(work.tecnico)}</span>
                                </div>
                            </div>
                            <div>
                                <label class="text-xs text-muted" style="display: block; margin-bottom: 2px;">Estado de Pago</label>
                                <span class="badge badge--${work.isPaid ? 'success' : 'warning'}">
                                    ${work.isPaid ? 'Pagado al Técnico' : 'Pendiente de Pago'}
                                </span>
                            </div>
                            <div>
                                <label class="text-xs text-muted" style="display: block; margin-bottom: 2px;">Cliente</label>
                                <div class="font-medium">${work.cliente}</div>
                            </div>
                            <div>
                                <label class="text-xs text-muted" style="display: block; margin-bottom: 2px;">Equipo</label>
                                <div class="font-medium">${work.equipo}</div>
                            </div>
                        </div>

                        <div style="margin-top: var(--spacing-lg);">
                            <label class="text-xs text-muted" style="display: block; margin-bottom: 4px;">Descripción / Diagnóstico</label>
                            <div style="padding: var(--spacing-md); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); white-space: pre-wrap; font-size: var(--font-size-sm);">
                                ${work.detalle}
                            </div>
                        </div>

                        <div style="margin-top: var(--spacing-lg); padding: var(--spacing-md); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); display: flex; justify-content: space-between; align-items: center;">
                            <span class="font-bold">Monto Generado (Mano de Obra):</span>
                             <span class="font-bold" style="font-size: var(--font-size-xl); color: var(--color-primary);">${work.moneda === 'USD' ? '$' : 'C$'}${work.monto.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="modal__footer">
                        <button class="btn btn--secondary" onclick="GestionTecnicosModule.closeModal('${modalId}')">Cerrar</button>
                        <button class="btn btn--primary" onclick="GestionTecnicosModule.openOriginalModule('${id}', '${type}')">
                            ${Icons.chevronRight} Ver Registro Original
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    const openOriginalModule = (id, type) => {
        closeModal('workDetailModal');
        if (type === 'recepcion') {
            if (typeof App !== 'undefined' && App.switchModule) {
                App.switchModule('recepciones');
                // Intentar abrir el detalle después de un pequeño delay
                setTimeout(() => {
                    if (window.RecepcionesModule && window.RecepcionesModule.viewDetail) {
                        window.RecepcionesModule.viewDetail(id);
                    }
                }, 500);
            }
        } else {
            if (typeof App !== 'undefined' && App.switchModule) {
                App.switchModule('visitas');
                setTimeout(() => {
                    if (window.VisitasModule && window.VisitasModule.viewVisitDetails) {
                        window.VisitasModule.viewVisitDetails(id);
                    }
                }, 500);
            }
        }
    };

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

    return {
        init,
        render,
        refresh: () => {
            DataService.refreshCache().then(() => {
                loadData().then(() => App.render());
            });
        },
        switchTab,
        renderTabContent,
        renderTecnicosTab,
        renderPagosTab,
        renderReportesTab,
        renderTrabajosTab,
        viewTechReport: (id) => {
            currentTab = 'reportes';
            App.render();
            setTimeout(() => {
                const select = document.getElementById('reportTechId');
                if (select) {
                    select.value = id;
                    generateReport();
                }
            }, 100);
        },
        renderPaymentModal,
        updatePaymentCalculation,
        savePayment,
        generateReport,
        printReceipt,
        printReport: () => alert('Generando PDF de Reporte...'),
        closeModal,
        setWorkFilter,
        resetWorkFilters,
        viewWorkDetail,
        openOriginalModule,
        deletePago: async (pagoId) => {
            if (!confirm('¿Está seguro de eliminar este pago? Los servicios asociados volverán a estado pendiente de pago.')) return;
            try {
                await DataService.deletePagoTecnico(pagoId);
                alert('Pago eliminado correctamente.');
                App.render();
            } catch (error) {
                console.error('Error al eliminar pago:', error);
                alert('Error al eliminar: ' + error.message);
            }
        }
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
