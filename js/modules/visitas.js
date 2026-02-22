/**
 * ALLTECH - Visitas/Servicios Module
 * Service visits with equipment linking and PDF reports
 */

const VisitasModule = (() => {
  let filterState = { search: '', tipo: 'all', hasContrato: 'all', clienteId: 'all' };

  const render = () => {
    const visitas = DataService.getVisitasFiltered(filterState);
    const clientes = DataService.getClientesSync();
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'visitas', 'create');

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Visitas y Servicios</h2>
            <p class="module-subtitle">${visitas.length} servicios registrados</p>
          </div>
          <div class="module-header__right">
            <button class="btn btn--secondary" onclick="VisitasModule.openReportModal()">
              ${Icons.fileText} Generar Reporte
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="VisitasModule.openCreateModal()">
              ${Icons.plus} Nueva Visita
            </button>
            ` : ''}
          </div>
        </div>

        <!-- Stats -->
        <div class="module-stats">
          ${renderStats()}
        </div>

        <!-- Filters -->
        <div class="module-filters card">
          <div class="card__body">
            <div class="filters-row">
              <div class="search-input" style="flex: 1; max-width: 300px;">
                <span class="search-input__icon">${Icons.search}</span>
                <input type="text" class="form-input" placeholder="Buscar..." 
                       value="${filterState.search}"
                       onkeyup="VisitasModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 180px;" 
                      onchange="VisitasModule.handleClienteFilter(this.value)">
                <option value="all">Todos los clientes</option>
                ${clientes.map(c => `
                  <option value="${c.id}" ${filterState.clienteId === c.id ? 'selected' : ''}>
                    ${c.empresa}
                  </option>
                `).join('')}
              </select>
              <select class="form-select" style="width: 140px;" 
                      onchange="VisitasModule.handleTipoFilter(this.value)">
                <option value="all">Todos los tipos</option>
                <option value="Física" ${filterState.tipo === 'Física' ? 'selected' : ''}>Física</option>
                <option value="Remota" ${filterState.tipo === 'Remota' ? 'selected' : ''}>Remota</option>
              </select>
              <select class="form-select" style="width: 160px;" 
                      onchange="VisitasModule.handleContratoFilter(this.value)">
                <option value="all">Con/Sin Contrato</option>
                <option value="with" ${filterState.hasContrato === 'with' ? 'selected' : ''}>Con Contrato</option>
                <option value="without" ${filterState.hasContrato === 'without' ? 'selected' : ''}>Eventual</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Visits Table -->
        <div class="card">
          <div class="card__body" style="padding: 0;">
            ${visitas.length > 0 ? renderTable(visitas) : renderEmptyState()}
          </div>
        </div>
      </div>
      <div id="visitaModal"></div>
    `;
  };

  const renderStats = () => {
    const stats = DataService.getVisitasStats();
    return `
      <div class="stat-card stat-card--primary">
        <div class="stat-card__icon">${Icons.wrench}</div>
        <span class="stat-card__label">Este Mes</span>
        <span class="stat-card__value">${stats.esteMes}</span>
      </div>
      <div class="stat-card stat-card--success">
        <div class="stat-card__icon">${Icons.checkCircle}</div>
        <span class="stat-card__label">Completadas</span>
        <span class="stat-card__value">${stats.completadas}</span>
      </div>
      <div class="stat-card stat-card--warning">
        <div class="stat-card__icon">${Icons.wallet}</div>
        <span class="stat-card__label">Ingresos Eventuales</span>
        <span class="stat-card__value">$${stats.ingresosEventuales.toFixed(2)}</span>
      </div>
    `;
  };

  const renderTable = (visitas) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'visitas', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'visitas', 'delete');

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Equipo</th>
            <th>Trabajo</th>
            <th>Contrato</th>
            <th>Costo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${visitas.map(visita => {
      const cliente = DataService.getClienteById(visita.clienteId);
      const equipo = visita.equipoId ? DataService.getEquipoById(visita.equipoId) : null;
      return `
              <tr>
                <td><span class="font-medium">${visita.visitaId}</span></td>
                <td>
                  <div class="font-medium">${cliente?.empresa || 'N/A'}</div>
                  <div class="text-xs text-muted">${cliente?.nombreCliente || ''}</div>
                </td>
                <td>
                  <div>${new Date(visita.fechaInicio).toLocaleDateString('es-NI')}</div>
                  <div class="text-xs text-muted">${new Date(visita.fechaInicio).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td>
                  <span class="badge ${visita.tipoVisita === 'Física' ? 'badge--primary' : 'badge--info'}">
                    ${visita.tipoVisita}
                  </span>
                </td>
                <td>
                  ${equipo ? `
                    <div class="text-sm font-medium">${equipo.nombreEquipo}</div>
                    <div class="text-xs text-muted">${equipo.marca}</div>
                  ` : '<span class="text-muted">-</span>'}
                </td>
                <td style="max-width: 180px;">
                  <div class="text-sm" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${visita.descripcionTrabajo}
                  </div>
                </td>
                <td>
                  ${(() => {
          if (!visita.contratoId) return `<span class="badge badge--warning">Eventual</span>`;
          const contrato = DataService.getContratoById(visita.contratoId);
          return `<span class="badge badge--success">${contrato?.contratoId || 'Sin N°'}</span>`;
        })()}
                </td>
                <td>
                  ${visita.costoServicio > 0 ?
          `<span class="font-medium">${visita.moneda === 'USD' ? '$' : 'C$'}${visita.costoServicio.toFixed(2)}</span>` :
          '<span class="text-muted">Incluido</span>'}
                </td>
                <td>
                  <span class="badge ${visita.trabajoRealizado ? 'badge--success' : 'badge--warning'}">
                    ${visita.trabajoRealizado ? 'Completado' : 'Pendiente'}
                  </span>
                </td>
                <td>
                  <div class="flex gap-xs">
                    <button class="btn btn--ghost btn--icon btn--sm" onclick="VisitasModule.viewDetail('${visita.visitaId}')" title="Ver">
                      ${Icons.eye}
                    </button>
                    ${canUpdate ? `
                    <button class="btn btn--ghost btn--icon btn--sm" onclick="VisitasModule.openEditModal('${visita.visitaId}')" title="Editar">
                      ${Icons.edit}
                    </button>
                    ` : ''}
                    ${(!visita.trabajoRealizado && canUpdate) ? `
                      <button class="btn btn--ghost btn--icon btn--sm text-success" onclick="VisitasModule.completarVisita('${visita.visitaId}')" title="Marcar Completo">
                        ${Icons.checkCircle}
                      </button>
                    ` : ''}
                    ${canDelete ? `
                      <button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="VisitasModule.deleteVisita('${visita.visitaId}')" title="Eliminar">
                        ${Icons.trash}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  };

  const renderEmptyState = () => {
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'visitas', 'create');

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.wrench}</div>
        <h3 class="empty-state__title">No hay visitas</h3>
        <p class="empty-state__description">Registra una nueva visita de servicio.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="VisitasModule.openCreateModal()">
          ${Icons.plus} Nueva Visita
        </button>
        ` : ''}
      </div>
    `;
  };

  const renderFormModal = (visita = null) => {
    const isEdit = visita !== null;
    const clientes = DataService.getClientesSync();

    // Obtener técnicos dinámicamente
    const allUsers = DataService.getUsersSync() || [];
    const tecnicos = allUsers
      .filter(u => u.role === 'Tecnico' || u.role === 'Técnico' || u.role === 'Instalador')
      .map(u => ({ id: u.id, name: u.name || u.username }));

    // Fallback si no hay técnicos creados
    if (tecnicos.length === 0) {
      // No podemos empujar un string aquí si esperamos objetos
    }

    const selectedClienteId = visita?.clienteId || '';
    const equiposCliente = selectedClienteId ? DataService.getEquiposByCliente(selectedClienteId) : [];
    const contratosCliente = selectedClienteId ? DataService.getContratosByCliente(selectedClienteId).filter(c => c.estadoContrato === 'Activo') : [];

    return `
      <div class="modal-overlay open" onclick="VisitasModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Visita' : 'Nueva Visita'}</h3>
            <button class="modal__close" onclick="VisitasModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="VisitasModule.handleSubmit(event)">
            <input type="hidden" name="visitaId" value="${visita?.visitaId || ''}">
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Cliente</label>
                <select name="clienteId" class="form-select" required onchange="VisitasModule.onClienteChange(this.value)">
                  <option value="">Seleccionar cliente...</option>
                  ${clientes.map(c => `
                    <option value="${c.id}" ${visita?.clienteId === c.id || visita?.clienteId === c.clienteId ? 'selected' : ''}>
                      ${c.empresa} - ${c.nombreCliente}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Contrato (Opcional)</label>
                <select name="contratoId" class="form-select" id="contratoSelect">
                  <option value="">Sin contrato (Eventual)</option>
                  ${contratosCliente.map(c => `
                    <option value="${c.id}" ${visita?.contratoId === c.id || visita?.contratoId === c.contratoId ? 'selected' : ''}>
                      ${c.codigoContrato || c.contratoId || 'CON-???'} - ${c.tipoContrato}
                    </option>
                  `).join('')}
                </select>
                <span class="form-hint">Deja vacío para servicios eventuales</span>
              </div>
            </div>

            <!-- Equipment Selection -->
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Equipo a Reparar</label>
                <select name="equipoId" class="form-select" id="equipoSelect">
                  <option value="">Ningún equipo específico</option>
                  ${equiposCliente.map(e => `
                    <option value="${e.id}" ${visita?.equipoId === e.id || visita?.equipoId === e.equipoId ? 'selected' : ''}>
                      ${e.nombreEquipo} - ${e.marca} ${e.modelo}
                    </option>
                  `).join('')}
                </select>
                <span class="form-hint">Selecciona el equipo a reparar o deja vacío si no aplica</span>
              </div>
              <div class="form-group" style="flex: 1; align-self: flex-end;">
                <button type="button" class="btn btn--secondary" onclick="VisitasModule.openCreateEquipoModal()">
                  ${Icons.plus} Nuevo Equipo
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Tipo de Visita</label>
                <select name="tipoVisita" class="form-select" required>
                  <option value="Física" ${visita?.tipoVisita === 'Física' ? 'selected' : ''}>Física</option>
                  <option value="Remota" ${visita?.tipoVisita === 'Remota' ? 'selected' : ''}>Remota</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Técnico Asignado</label>
                <select name="usuarioSoporte" class="form-select" required>
                  <option value="">Seleccionar técnico...</option>
                  ${tecnicos.map(t => `
                    <option value="${t.id}" ${visita?.usuarioSoporte === t.id ? 'selected' : ''}>${t.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
                <label class="form-label form-label--required">Fecha/Hora Inicio</label>
                <input type="datetime-local" name="fechaInicio" class="form-input" 
                        value="${visita?.fechaInicio ? visita.fechaInicio.slice(0, 16) : ''}" required>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Descripción del Trabajo</label>
              <textarea name="descripcionTrabajo" class="form-textarea" rows="3" required
                        placeholder="Describe el trabajo a realizar...">${visita?.descripcionTrabajo || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Costo del Servicio (para eventuales)</label>
                <div class="input-group">
                  <input type="number" name="costoServicio" class="form-input" 
                         value="${visita?.costoServicio || 0}" step="0.01" min="0">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Moneda</label>
                <select name="moneda" class="form-select">
                  <option value="USD" ${visita?.moneda === 'USD' ? 'selected' : ''}>USD ($)</option>
                  <option value="NIO" ${visita?.moneda === 'NIO' ? 'selected' : ''}>NIO (C$)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="toggle">
                <input type="checkbox" name="trabajoRealizado" class="toggle__input" 
                       ${visita?.trabajoRealizado ? 'checked' : ''}>
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
                <span class="toggle__label">Trabajo Completado</span>
              </label>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="VisitasModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar' : 'Crear Visita'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (visita) => {
    const cliente = DataService.getClienteById(visita.clienteId);
    const contrato = visita.contratoId ? DataService.getContratoById(visita.contratoId) : null;
    const equipo = visita.equipoId ? DataService.getEquipoById(visita.equipoId) : null;

    return `
      <div class="modal-overlay open" onclick="VisitasModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">Visita ${visita.visitaId}</h3>
              <p class="text-sm text-muted">${cliente?.empresa || 'Cliente'}</p>
            </div>
            <button class="modal__close" onclick="VisitasModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-item__label">Cliente</div>
                <div class="detail-item__value">${cliente?.nombreCliente || 'N/A'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Empresa</div>
                <div class="detail-item__value">${cliente?.empresa || 'N/A'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Tipo de Visita</div>
                <div class="detail-item__value"><span class="badge ${visita.tipoVisita === 'Física' ? 'badge--primary' : 'badge--info'}">${visita.tipoVisita}</span></div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Contrato</div>
                <div class="detail-item__value">${contrato ? contrato.contratoId : '<span class="badge badge--warning">Eventual</span>'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Fecha Inicio</div>
                <div class="detail-item__value">${new Date(visita.fechaInicio).toLocaleString('es-NI')}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Fecha Fin</div>
                <div class="detail-item__value">${new Date(visita.fechaFin).toLocaleString('es-NI')}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Técnico</div>
                <div class="detail-item__value">
                  ${(() => {
        const tech = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === visita.usuarioSoporte) : null;
        return tech ? (tech.name || tech.username) : (visita.usuarioSoporte || 'N/A');
      })()}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Costo</div>
                <div class="detail-item__value">${visita.costoServicio > 0 ? `${visita.moneda === 'USD' ? '$' : 'C$'}${visita.costoServicio.toFixed(2)}` : 'Incluido en contrato'}</div>
              </div>
            </div>
            
            ${equipo ? `
              <div class="equipo-linked-card">
                <div class="equipo-linked-card__header">Equipo Reparado</div>
                <div class="equipo-linked-card__body">
                  <div class="equipo-linked-card__icon">${Icons.monitor}</div>
                  <div class="equipo-linked-card__info">
                    <div class="equipo-linked-card__name">${equipo.nombreEquipo}</div>
                    <div class="equipo-linked-card__model">${equipo.marca} ${equipo.modelo}</div>
                    <div class="equipo-linked-card__serie">Serie: ${equipo.serie}</div>
                  </div>
                  <span class="badge ${equipo.estado === 'Operativo' ? 'badge--success' : 'badge--warning'}">${equipo.estado}</span>
                </div>
              </div>
            ` : ''}
            
            <div class="detail-item detail-item--full" style="margin-top: var(--spacing-md);">
              <div class="detail-item__label">Descripción del Trabajo</div>
              <div class="detail-item__value">${visita.descripcionTrabajo}</div>
            </div>
            <div class="detail-item detail-item--full">
              <div class="detail-item__label">Estado</div>
              <div class="detail-item__value">
                <span class="badge ${visita.trabajoRealizado ? 'badge--success' : 'badge--warning'}">${visita.trabajoRealizado ? 'Completado' : 'Pendiente'}</span>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="VisitasModule.closeModal()">Cerrar</button>
            <button class="btn btn--primary" onclick="VisitasModule.openEditModal('${visita.visitaId}')">${Icons.edit} Editar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ========== REPORT MODAL ==========
  const renderReportModal = () => {
    const clientes = DataService.getClientesSync();
    return `
      <div class="modal-overlay open" onclick="VisitasModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${Icons.fileText} Generar Reporte de Visitas</h3>
            <button class="modal__close" onclick="VisitasModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="VisitasModule.generateReport(event)">
            <div class="form-group">
              <label class="form-label">Filtrar por Cliente</label>
              <select name="clienteId" class="form-select" id="reportClienteSelect">
                <option value="all">Todos los clientes</option>
                ${clientes.map(c => `
                  <option value="${c.id}">${c.empresa} - ${c.nombreCliente}</option>
                `).join('')}
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha Inicio</label>
                <input type="date" name="fechaInicio" class="form-input" id="reportFechaInicio">
              </div>
              <div class="form-group">
                <label class="form-label">Fecha Fin</label>
                <input type="date" name="fechaFin" class="form-input" id="reportFechaFin">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Tipo de Visita</label>
              <select name="tipoVisita" class="form-select">
                <option value="all">Todos</option>
                <option value="Física">Física</option>
                <option value="Remota">Remota</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="toggle">
                <input type="checkbox" name="incluirEquipos" class="toggle__input" checked>
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
                <span class="toggle__label">Incluir equipos reparados</span>
              </label>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="VisitasModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${Icons.fileText} Generar PDF</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  // ========== PDF GENERATION ==========
  const generateReport = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const filterParams = Object.fromEntries(formData.entries());

    // Usar la función de filtrado existente del DataService para consistencia
    const filters = {
      search: '',
      tipo: filterParams.tipoVisita,
      hasContrato: 'all',
      clienteId: filterParams.clienteId
    };

    let visitas = DataService.getVisitasFiltered(filters);

    // Filtros de fecha adicionales
    if (filterParams.fechaInicio) {
      visitas = visitas.filter(v => new Date(v.fechaInicio) >= new Date(filterParams.fechaInicio));
    }
    if (filterParams.fechaFin) {
      visitas = visitas.filter(v => new Date(v.fechaInicio) <= new Date(filterParams.fechaFin + 'T23:59:59'));
    }

    const clienteObj = filterParams.clienteId !== 'all' ? DataService.getClienteById(filterParams.clienteId) : null;

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
        <h1>${companyConfig.name} - Reporte de Servicios</h1>
        <p>${clienteObj ? `${clienteObj.empresa} - ${clienteObj.nombreCliente}` : 'Todos los clientes'}</p>
        ${filterParams.fechaInicio || filterParams.fechaFin ? `<p>Período: ${filterParams.fechaInicio || 'Inicio'} - ${filterParams.fechaFin || 'Actual'}</p>` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">Resumen</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Total Visitas</div>
            <div class="info-value">${visitas.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Completadas</div>
            <div class="info-value">${visitas.filter(v => v.trabajoRealizado).length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Pendientes</div>
            <div class="info-value">${visitas.filter(v => !v.trabajoRealizado).length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ingresos Eventuales</div>
            <div class="info-value">$${visitas.filter(v => v.costoServicio > 0).reduce((s, v) => s + v.costoServicio, 0).toFixed(2)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Detalle de Visitas</div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Tipo</th>
              ${filters.incluirEquipos ? '<th>Equipo</th>' : ''}
              <th>Trabajo</th>
              <th>Técnico</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${visitas.map(v => {
      const cl = DataService.getClienteById(v.clienteId);
      const eq = v.equipoId ? DataService.getEquipoById(v.equipoId) : null;
      return `
                <tr>
                  <td>${v.visitaId}</td>
                  <td>${new Date(v.fechaInicio).toLocaleDateString('es-NI')}</td>
                  <td>${cl?.empresa || 'N/A'}</td>
                  <td>${v.tipoVisita}</td>
                  ${filters.incluirEquipos ? `<td>${eq ? eq.nombreEquipo : '-'}</td>` : ''}
                  <td>${v.descripcionTrabajo}</td>
                  <td>${(() => {
          const tech = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === v.usuarioSoporte) : null;
          return tech ? (tech.name || tech.username) : (v.usuarioSoporte || 'N/A');
        })()}</td>
                  <td><span class="badge badge-${v.trabajoRealizado ? 'success' : 'warning'}">${v.trabajoRealizado ? 'Completado' : 'Pendiente'}</span></td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
      
      ${filters.incluirEquipos ? `
        <div class="section">
          <div class="section-title">Equipos Reparados</div>
          ${(() => {
          const equiposReparados = [...new Set(visitas.filter(v => v.equipoId).map(v => v.equipoId))];
          if (equiposReparados.length === 0) return '<p>No se registraron equipos en las visitas.</p>';
          return `
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Marca/Modelo</th>
                    <th>Serie</th>
                    <th>Cliente</th>
                    <th>Visitas</th>
                  </tr>
                </thead>
                <tbody>
                  ${equiposReparados.map(eqId => {
            const eq = DataService.getEquipoById(eqId);
            const cl = DataService.getClienteById(eq?.clienteId);
            const visitasEquipo = visitas.filter(v => v.equipoId === eqId).length;
            return `
                      <tr>
                        <td>${eq?.nombreEquipo || 'N/A'}</td>
                        <td>${eq?.marca} ${eq?.modelo}</td>
                        <td>${eq?.serie}</td>
                        <td>${cl?.empresa || 'N/A'}</td>
                        <td>${visitasEquipo}</td>
                      </tr>
                    `;
          }).join('')}
                </tbody>
              </table>
            `;
        })()}
        </div>
      ` : ''}
    `;

    const htmlContent = generatePDFContent('Reporte de Visitas', content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    closeModal();
  };

  const generatePDFContent = (title, content) => {
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH' };
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a73e8; padding-bottom: 20px; }
          .header h1 { color: #1a73e8; font-size: 24px; }
          .header p { color: #666; margin-top: 5px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 16px; font-weight: bold; color: #1a73e8; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
          .info-item { padding: 8px; background: #f8f9fa; border-radius: 4px; }
          .info-label { font-size: 11px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 14px; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; font-size: 11px; }
          th { background: #1a73e8; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content}
        <div class="footer">
          <p>${companyConfig.name || 'ALLTECH'} - Sistema de Gestión Empresarial</p>
          <p>Generado el: ${new Date().toLocaleString('es-NI')}</p>
        </div>
      </body>
      </html>
    `;
  };

  // ========== CREATE EQUIPO INLINE ==========
  const openCreateEquipoModal = () => {
    const clienteSelect = document.querySelector('select[name="clienteId"]');
    const clienteId = clienteSelect?.value;
    if (!clienteId) {
      alert('Por favor, selecciona primero un cliente.');
      return;
    }

    const equipoModal = `
      <div class="modal-overlay open" style="z-index: 1001;" onclick="VisitasModule.closeEquipoModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Crear Nuevo Equipo</h3>
            <button class="modal__close" onclick="VisitasModule.closeEquipoModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="VisitasModule.handleCreateEquipo(event, '${clienteId}')">
            <div class="form-group">
              <label class="form-label form-label--required">Nombre del Equipo</label>
              <input type="text" name="nombreEquipo" class="form-input" placeholder="Ej: Servidor Principal" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Marca</label>
                <input type="text" name="marca" class="form-input" placeholder="Ej: Dell" required>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Modelo</label>
                <input type="text" name="modelo" class="form-input" placeholder="Ej: PowerEdge R740" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Número de Serie</label>
                <input type="text" name="serie" class="form-input" placeholder="Ej: SRV-2024-001" required>
              </div>
              <div class="form-group">
                <label class="form-label">Ubicación</label>
                <input type="text" name="ubicacion" class="form-input" placeholder="Ej: Oficina Central">
              </div>
            </div>
            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="VisitasModule.closeEquipoModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">Crear Equipo</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', `<div id="inlineEquipoModal">${equipoModal}</div>`);
  };

  const handleCreateEquipo = (event, clienteId) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    data.equipoId = 'EQU' + String(Date.now()).slice(-6);
    data.clienteId = clienteId;
    data.estado = 'Operativo';
    DataService.createEquipo(data);

    // Update equipment select
    const equipoSelect = document.getElementById('equipoSelect');
    if (equipoSelect) {
      const option = document.createElement('option');
      option.value = data.equipoId;
      option.textContent = `${data.nombreEquipo} - ${data.marca} ${data.modelo}`;
      option.selected = true;
      equipoSelect.appendChild(option);
    }
    closeEquipoModal();
  };

  const closeEquipoModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('inlineEquipoModal');
    if (modal) modal.remove();
  };

  // ========== EVENT HANDLERS ==========
  const handleSearch = (value) => { filterState.search = value; App.refreshCurrentModule(); };
  const handleTipoFilter = (value) => { filterState.tipo = value; App.refreshCurrentModule(); };
  const handleContratoFilter = (value) => { filterState.hasContrato = value; App.refreshCurrentModule(); };
  const handleClienteFilter = (value) => { filterState.clienteId = value; App.refreshCurrentModule(); };

  /* ========== CLIENTE CHANGE HANDLER ========== */
  const onClienteChange = async (clienteId) => {
    console.log('🔄 Cambio de cliente en Visita Modal:', clienteId);
    if (!clienteId) {
      // Limpiar selects si no hay cliente
      document.getElementById('contratoSelect').innerHTML = '<option value="">Sin contrato (Eventual)</option>';
      document.getElementById('equipoSelect').innerHTML = '<option value="">Ningún equipo específico</option>';
      return;
    }

    try {
      const cliente = DataService.getClienteById(clienteId);
      // Usar UUID para buscar relaciones
      const uuid = cliente?.id || clienteId;

      const contratos = DataService.getContratosByCliente(uuid);
      const equipos = DataService.getEquiposByCliente(uuid);

      console.log(`📋 Encontrados ${contratos.length} contratos y ${equipos.length} equipos para cliente ${uuid}`);

      // Update Contratos Select
      const contratoSelect = document.querySelector('select[name="contratoId"]');
      if (contratoSelect) {
        contratoSelect.innerHTML = '<option value="">Sin contrato (Eventual)</option>' +
          contratos.filter(c => c.estadoContrato === 'Activo').map(c =>
            `<option value="${c.id}">${c.codigoContrato || c.contratoId || 'CON-???'} - ${c.tipoContrato || 'General'}</option>`
          ).join('');
      }

      // Update Equipos Select
      const equipoSelect = document.querySelector('select[name="equipoId"]');
      if (equipoSelect) {
        equipoSelect.innerHTML = '<option value="">Ningún equipo específico</option>' +
          equipos.map(e =>
            `<option value="${e.id}">${e.nombreEquipo} - ${e.marca} ${e.modelo}</option>`
          ).join('');
      }

    } catch (error) {
      console.error('❌ Error al cargar datos del cliente:', error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    // Normalizar datos
    data.costoServicio = parseFloat(data.costoServicio) || 0;
    data.trabajoRealizado = formData.has('trabajoRealizado');

    // Si es edición, obtener la visita actual para comparar
    const currentVisita = data.visitaId ? DataService.getVisitaById(data.visitaId) : null;

    // Si se marca como completado al crear/editar y no tiene fecha fin, poner la actual
    if (data.trabajoRealizado && !(currentVisita?.fechaFin)) {
      data.fechaFin = new Date().toISOString();
    } else if (!data.trabajoRealizado) {
      data.fechaFin = null;
    }

    // Convertir strings vacíos a null para UUIDs
    data.contratoId = data.contratoId && data.contratoId.trim() !== '' ? data.contratoId : null;
    data.equipoId = data.equipoId && data.equipoId.trim() !== '' ? data.equipoId : null;

    // Obtener UUID del cliente real si es necesario
    const cliente = DataService.getClienteById(data.clienteId);
    if (cliente) data.clienteId = cliente.id || data.clienteId;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Guardar';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Guardando...';
    }

    try {
      if (data.visitaId && data.visitaId.toString().trim() !== '' && data.visitaId !== 'undefined') {
        await DataService.updateVisita(data.visitaId, data);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Visita actualizada', 'success');
        }
      } else {
        // Eliminar ID temporal si existe, dejar que DB genere
        delete data.visitaId;
        console.log('📝 Creando nueva visita:', data);
        const result = await DataService.createVisita(data);
        if (result && result.error) throw new Error(result.error);

        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Visita creada exitosamente', 'success');
        }
      }
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('Error saving visita:', error);
      alert('Error al guardar: ' + (error.message || 'Error desconocido'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  const completarVisita = async (id) => {
    if (!confirm('¿Estás seguro de marcar esta visita como completada? Se registrará la hora actual como finalización.')) return;

    try {
      const now = new Date().toISOString();
      await DataService.updateVisita(id, {
        trabajoRealizado: true,
        fechaFin: now
      });

      if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
        NotificationService.showToast('Visita finalizada correctamente', 'success');
      }
      App.refreshCurrentModule();
    } catch (error) {
      console.error('Error al completar visita:', error);
      alert('Error: ' + error.message);
    }
  };

  const deleteVisita = (id) => {
    if (confirm('¿Estás seguro de eliminar esta visita?')) {
      DataService.deleteVisita(id).then(success => {
        if (success) {
          if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
            NotificationService.showToast('Visita eliminada', 'success');
          }
          App.refreshCurrentModule();
        } else {
          alert('No se pudo eliminar la visita');
        }
      }).catch(err => {
        console.error('Error al eliminar visita:', err);
        alert('Error: ' + err.message);
      });
    }
  };

  const openCreateModal = () => { document.getElementById('visitaModal').innerHTML = renderFormModal(); };
  const openEditModal = (id) => {
    const visita = DataService.getVisitaById(id);
    if (visita) document.getElementById('visitaModal').innerHTML = renderFormModal(visita);
  };
  const viewDetail = (id) => {
    const visita = DataService.getVisitaById(id);
    if (visita) document.getElementById('visitaModal').innerHTML = renderDetailModal(visita);
  };
  const openReportModal = () => { document.getElementById('visitaModal').innerHTML = renderReportModal(); };
  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('visitaModal').innerHTML = '';
  };

  return {
    render, openCreateModal, openEditModal, viewDetail, completarVisita,
    closeModal, handleSearch, handleTipoFilter, handleContratoFilter, handleClienteFilter,
    handleSubmit, onClienteChange, openReportModal, generateReport,
    openCreateEquipoModal, handleCreateEquipo, closeEquipoModal, deleteVisita
  };
})();
