/**
 * ALLTECH - Equipos Module
 * Equipment inventory with repair history CRUD and PDF generation
 */

const EquiposModule = (() => {
  let filterState = { search: '', estado: 'all', clienteId: 'all', view: 'list' };

  const getTiposEquipo = () => {
    const defaultTipos = ["Laptop", "Computadora", "Servidor", "Impresora", "Router", "Switch", "Firewall", "UPS", "NAS", "Otro"];
    try {
      const stored = localStorage.getItem('tiposEquipo');
      if (stored) return JSON.parse(stored);
    } catch { }
    return defaultTipos;
  };

  const saveTiposEquipo = (tipos) => {
    localStorage.setItem('tiposEquipo', JSON.stringify(tipos));
  };

  const openTiposModal = () => {
    const equipoModal = document.getElementById('equipoModal');
    if (!equipoModal) return;

    const existing = document.getElementById('tiposModal');
    if (existing) existing.remove();

    equipoModal.insertAdjacentHTML('beforeend', `<div id="tiposModal">${renderTiposModal()}</div>`);
  };

  const closeTiposModal = () => {
    const modal = document.getElementById('tiposModal');
    if (modal) modal.remove();
    const datalist = document.getElementById('tipoEquipoList');
    if (datalist) {
      datalist.innerHTML = getTiposEquipo().map(t => `<option value="${t}">`).join('');
    }
  };

  const addTipoEquipo = () => {
    const input = document.getElementById('nuevoTipoInput');
    const val = input.value.trim();
    if (val) {
      const tipos = getTiposEquipo();
      if (!tipos.includes(val)) {
        tipos.push(val);
        saveTiposEquipo(tipos);
        document.getElementById('tiposModal').innerHTML = renderTiposModal();
      } else {
        alert('Este tipo de equipo ya existe.');
      }
    }
  };

  const deleteTipoEquipo = (index) => {
    if (confirm('¿Eliminar este tipo de equipo?')) {
      const tipos = getTiposEquipo();
      tipos.splice(index, 1);
      saveTiposEquipo(tipos);
      document.getElementById('tiposModal').innerHTML = renderTiposModal();
    }
  };

  const editTipoEquipo = (index) => {
    const tipos = getTiposEquipo();
    const current = tipos[index];
    const val = prompt('Editar tipo de equipo:', current);
    if (val !== null && val.trim() !== '' && val.trim() !== current) {
      if (!tipos.includes(val.trim())) {
        tipos[index] = val.trim();
        saveTiposEquipo(tipos);
        document.getElementById('tiposModal').innerHTML = renderTiposModal();
      } else {
        alert('Este tipo de equipo ya existe.');
      }
    }
  };

  const renderTiposModal = () => {
    const tipos = getTiposEquipo();
    return `
      <div class="modal-overlay open" style="z-index: 10001; background-color: rgba(0,0,0,0.6);" >
        <div class="modal modal--sm" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Tipos de Equipos</h3>
            <button class="modal__close" type="button" onclick="EquiposModule.closeTiposModal()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="form-group" style="display: flex; gap: 8px;">
              <input type="text" id="nuevoTipoInput" class="form-input" placeholder="Nuevo tipo..." onkeydown="if(event.key === 'Enter') { event.preventDefault(); EquiposModule.addTipoEquipo(); }">
              <button type="button" class="btn btn--primary" onclick="EquiposModule.addTipoEquipo()">Añadir</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
              ${tipos.map((t, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-color);">
                  <span>${t}</span>
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn btn--icon btn--ghost btn--sm" onclick="EquiposModule.editTipoEquipo(${idx})" title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5l4 4L7 21l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button type="button" class="btn btn--icon btn--ghost btn--sm text-danger" onclick="EquiposModule.deleteTipoEquipo(${idx})" title="Eliminar">
                      <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6V20a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
              ${tipos.length === 0 ? '<div style="padding: 12px; text-align:center; color: var(--text-muted)">Sin tipos</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  };


  const render = () => {
    const equipos = DataService.getEquiposFiltered(filterState);
    const clientes = DataService.getClientesSync();
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'equipos', 'create');

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Inventario de Equipos</h2>
            <p class="module-subtitle">${equipos.length} equipos registrados</p>
          </div>
          <div class="module-header__right">
            <button class="btn btn--secondary" onclick="EquiposModule.exportGeneralPDF()">
              ${Icons.fileText} Reporte General PDF
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="EquiposModule.openCreateModal()">
              ${Icons.plus} Nuevo Equipo
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
                <input type="text" class="form-input" placeholder="Buscar equipo..." 
                       id="searchInput"
                       value="${filterState.search}"
                       oninput="EquiposModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 200px;" 
                      onchange="EquiposModule.handleClienteFilter(this.value)">
                <option value="all">Todos los clientes</option>
                ${clientes.map(c => `
                  <option value="${c.clienteId}" ${filterState.clienteId === c.clienteId ? 'selected' : ''}>
                    ${c.empresa}
                  </option>
                `).join('')}
              </select>
              <select class="form-select" style="width: 160px;" 
                      onchange="EquiposModule.handleEstadoFilter(this.value)">
                <option value="all">Todos los estados</option>
                <option value="Operativo" ${filterState.estado === 'Operativo' ? 'selected' : ''}>Operativo</option>
                <option value="En Reparación" ${filterState.estado === 'En Reparación' ? 'selected' : ''}>En Reparación</option>
                <option value="Fuera de Servicio" ${filterState.estado === 'Fuera de Servicio' ? 'selected' : ''}>Fuera de Servicio</option>
              </select>
              <div class="view-toggle" style="display: flex; gap: 5px;">
                <button class="btn btn--icon ${filterState.view === 'list' ? 'btn--primary' : 'btn--ghost'}" onclick="EquiposModule.handleViewToggle('list')" title="Vista de Lista">
                  ${Icons.list || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>'}
                </button>
                <button class="btn btn--icon ${filterState.view === 'grid' ? 'btn--primary' : 'btn--ghost'}" onclick="EquiposModule.handleViewToggle('grid')" title="Vista de Cuadrícula">
                  ${Icons.grid || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Equipment Grid -->
        <div class="${filterState.view === 'list' ? 'equipment-list' : 'equipment-grid'}" style="${filterState.view === 'list' ? 'display: block;' : ''}">
          ${equipos.length > 0 ? renderEquipmentCards(equipos) : renderEmptyState()}
        </div>
      </div>
      <div id="equipoModal"></div>
    `;
  };

  const renderStats = () => {
    const stats = DataService.getEquiposStats();
    return `
      <div class="stat-card stat-card--success">
        <div class="stat-card__icon">${Icons.checkCircle}</div>
        <span class="stat-card__label">Operativos</span>
        <span class="stat-card__value">${stats.operativos}</span>
      </div>
      <div class="stat-card stat-card--warning">
        <div class="stat-card__icon">${Icons.wrench}</div>
        <span class="stat-card__label">En Reparación</span>
        <span class="stat-card__value">${stats.enReparacion}</span>
      </div>
      <div class="stat-card stat-card--info">
        <div class="stat-card__icon">${Icons.monitor}</div>
        <span class="stat-card__label">Total Equipos</span>
        <span class="stat-card__value">${stats.total}</span>
      </div>
    `;
  };

  const renderEquipmentCards = (equipos) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'equipos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'equipos', 'delete');

    if (filterState.view === 'list') {
      let rows = equipos.map(equipo => {
        const cliente = DataService.getClienteById(equipo.clienteId);
        const reparaciones = DataService.getRecepcionesByEquipo(equipo.equipoId || equipo.id) || [];
        const statusClass = equipo.estado === 'Operativo' ? 'success' : equipo.estado === 'En Reparación' ? 'warning' : 'danger';
        return `
          <tr>
            <td>
              <div style="font-weight: 500;">${equipo.nombreEquipo}</div>
              <div style="font-size: 0.85rem; color: #666;">${equipo.marca} ${equipo.modelo}</div>
            </td>
            <td><span class="badge badge--${statusClass}">${equipo.estado}</span></td>
            <td>${equipo.serie || equipo.numeroSerie || equipo.numero_serie || 'N/A'}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="EquiposModule.viewClientDetail('${equipo.clienteId}')">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente?.nombreCliente || 'N')}&background=1a73e8&color=fff&size=24" style="border-radius: 50%; width: 24px; height: 24px;">
                <div>
                   <div style="line-height:1.2;">${cliente?.nombreCliente || 'Sin cliente'}</div>
                   <div style="font-size: 0.75rem; color: #666;">${cliente?.empresa || ''}</div>
                </div>
              </div>
            </td>
            <td>${reparaciones.length} rep.</td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 5px; justify-content: flex-end;">
                  <button class="btn btn--ghost btn--icon btn--sm" onclick="EquiposModule.viewDetail('${equipo.equipoId}')" title="Ver">${Icons.eye || 'O'}</button>
                  ${canUpdate ? `<button class="btn btn--ghost btn--icon btn--sm" onclick="EquiposModule.openEditModal('${equipo.equipoId}')" title="Editar">${Icons.edit || 'E'}</button>` : ''}
                  ${canDelete ? `<button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="EquiposModule.deleteEquipo('${equipo.equipoId}')" title="Eliminar">${Icons.trash || 'X'}</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      return `
        <div class="table-responsive card" style="width: 100%; border-radius: 8px; overflow: visible;">
          <table class="table" style="width: 100%; min-width: 800px; border-collapse: collapse;">
            <thead style="background: var(--bg-color); border-bottom: 1px solid var(--border-color);">
              <tr>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Equipo</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Estado</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Serie</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Cliente</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Reparaciones</th>
                <th style="padding: 12px 15px; text-align: right; font-weight: 600;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    }

    // Grid View (Default)
    return equipos.map(equipo => {
      const cliente = DataService.getClienteById(equipo.clienteId);
      const reparaciones = DataService.getRecepcionesByEquipo(equipo.equipoId || equipo.id) || [];
      const statusClass = equipo.estado === 'Operativo' ? 'success' : equipo.estado === 'En Reparación' ? 'warning' : 'danger';

      return `
        <div class="card equipment-card">
          <div class="card__body">
            <div class="equipment-card__header">
              <div class="equipment-card__icon">
                ${Icons.monitor}
              </div>
              <span class="badge badge--${statusClass}">${equipo.estado}</span>
            </div>
            <h3 class="equipment-card__title">${equipo.nombreEquipo}</h3>
            <p class="equipment-card__subtitle">${equipo.marca} ${equipo.modelo}</p>
            
            <div class="equipment-card__details">
              <div class="equipment-card__detail">
                <span class="text-muted">Serie:</span>
                <span class="font-medium">${equipo.serie || equipo.numeroSerie || equipo.numero_serie || 'N/A'}</span>
              </div>
              <div class="equipment-card__detail">
                <span class="text-muted">Ubicación:</span>
                <span>${equipo.ubicacion || 'N/A'}</span>
              </div>
            </div>
            
            <!-- Client Link -->
            <div class="equipment-card__client" onclick="EquiposModule.viewClientDetail('${equipo.clienteId}')">
              <div class="equipment-card__client-avatar">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente?.nombreCliente || 'N')}&background=1a73e8&color=fff&size=32" alt="">
              </div>
              <div class="equipment-card__client-info">
                <div class="equipment-card__client-name">${cliente?.nombreCliente || 'Sin cliente'}</div>
                <div class="equipment-card__client-company">${cliente?.empresa || ''}</div>
              </div>
            </div>
            
            <div class="equipment-card__stats">
              <span class="text-sm text-muted">${reparaciones.length} reparaciones registradas</span>
            </div>
            
            <div class="equipment-card__actions">
              <button class="btn btn--ghost btn--sm" onclick="EquiposModule.viewDetail('${equipo.equipoId}')">
                ${Icons.eye} Ver
              </button>
              ${canUpdate ? `
              <button class="btn btn--ghost btn--sm" onclick="EquiposModule.openEditModal('${equipo.equipoId}')">
                ${Icons.edit} Editar
              </button>
              ` : ''}
              ${canDelete ? `
              <button class="btn btn--ghost btn--sm text-danger" onclick="EquiposModule.deleteEquipo('${equipo.equipoId}')">
                ${Icons.trash} Eliminar
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderEmptyState = () => {
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'equipos', 'create');

    return `
      <div class="empty-state" style="grid-column: span 3;">
        <div class="empty-state__icon">${Icons.monitor}</div>
        <h3 class="empty-state__title">No hay equipos</h3>
        <p class="empty-state__description">Registra un nuevo equipo en el inventario.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="EquiposModule.openCreateModal()">
          ${Icons.plus} Nuevo Equipo
        </button>
        ` : ''}
      </div>
    `;
  };
  const renderFormModal = (equipo = null) => {
    const isEdit = equipo !== null;
    const clientes = DataService.getClientesSync();

    const selectedClienteId = equipo?.clienteId || equipo?.cliente_id || '';
    const selectedClienteObj = selectedClienteId ? clientes.find(c => c.id === selectedClienteId || c.clienteId === selectedClienteId) : null;
    const clientDisplayFormat = c => `${c.codigo || c.clienteId || c.id || ''} - ${c.nombreCliente || c.empresa || 'Sin Nombre'}`;
    const selectedClienteLabel = selectedClienteObj ? clientDisplayFormat(selectedClienteObj) : '';

    return `
      <style>
         .cliente-option:hover { background: var(--color-primary-50); color: var(--color-primary-700); }
      </style>
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
            <button class="modal__close" onclick="EquiposModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" style="overflow: visible;" onsubmit="EquiposModule.handleSubmit(event)">
            <input type="hidden" name="equipoId" value="${equipo?.equipoId || ''}">
            
            <div class="form-group" style="position: relative;">
                <label class="form-label form-label--required">Cliente</label>
                <input type="hidden" name="clienteId" id="hiddenClienteId" value="${selectedClienteId}" required>
                <input type="text" id="searchClienteInput" class="form-input" placeholder="Buscar código o nombre..." 
                       value="${selectedClienteLabel}" 
                       autocomplete="off" 
                       onfocus="EquiposModule.showClientesList()" 
                       onblur="setTimeout(() => { const d = document.getElementById('clientesDropdownList'); if(d) d.style.display = 'none'; }, 250)"
                       oninput="EquiposModule.filterClientesList(this.value)" required>
                <div id="clientesDropdownList" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 9999; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); max-height: 250px; overflow-y: auto;">
                  ${clientes.map(c => `
                    <div class="cliente-option" 
                         data-id="${c.id || c.clienteId}" 
                         data-label="${clientDisplayFormat(c)}" 
                         onclick="EquiposModule.selectClienteInline('${c.id || c.clienteId}', this.getAttribute('data-label'))" 
                         style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                      <div style="font-weight: 500;">${c.codigo || c.clienteId || c.id} - ${c.nombreCliente || c.empresa || ''}</div>
                    </div>
                  `).join('')}
                  ${clientes.length === 0 ? `<div style="padding: 10px 14px; color: var(--text-muted);">No hay clientes...</div>` : ''}
                </div>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Nombre del Equipo</label>
              <input type="text" name="nombreEquipo" class="form-input" 
                     value="${equipo?.nombreEquipo || ''}" 
                     placeholder="Ej: Servidor Principal" required>
            </div>
            
            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="form-label form-label--required" style="margin-bottom: 0;">Tipo de Equipo</label>
                  <button type="button" class="btn btn--icon btn--ghost btn--sm" onclick="EquiposModule.openTiposModal()" title="Administrar tipos de equipo" style="height: 24px; width: 24px; padding: 2px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
                </div>
                <input type="text" name="tipoEquipo" class="form-input" list="tipoEquipoList"
                       value="${equipo?.tipoEquipo || ''}" 
                       placeholder="Ej: Laptop, PC, Servidor..." required>
                <datalist id="tipoEquipoList">
                    ${getTiposEquipo().map(t => `<option value="${t}">`).join('')}
                </datalist>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Marca</label>
                <input type="text" name="marca" class="form-input" 
                       value="${equipo?.marca || ''}" placeholder="Ej: Dell" required>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Modelo</label>
                <input type="text" name="modelo" class="form-input" 
                       value="${equipo?.modelo || ''}" placeholder="Ej: PowerEdge R740" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Número de Serie</label>
                <input type="text" name="serie" class="form-input" 
                       value="${equipo?.serie || equipo?.numeroSerie || equipo?.numero_serie || ''}" placeholder="Ej: SRV-2024-001" required>
              </div>
              <div class="form-group">
                <label class="form-label">Ubicación</label>
                <input type="text" name="ubicacion" class="form-input" 
                       value="${equipo?.ubicacion || ''}" placeholder="Ej: Data Center">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Estado</label>
              <select name="estado" class="form-select" required>
                <option value="Operativo" ${(!equipo || equipo?.estado === 'Operativo') ? 'selected' : ''}>Operativo</option>
                <option value="En Reparación" ${equipo?.estado === 'En Reparación' ? 'selected' : ''}>En Reparación</option>
                <option value="Fuera de Servicio" ${equipo?.estado === 'Fuera de Servicio' ? 'selected' : ''}>Fuera de Servicio</option>
              </select>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="EquiposModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar' : 'Crear Equipo'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (equipo) => {
    const cliente = DataService.getClienteById(equipo.clienteId);
    const reparaciones = DataService.getRecepcionesByEquipo(equipo.equipoId || equipo.id) || [];
    const visitas = (DataService.getVisitasSync() || []).filter(v => v.equipo_id === (equipo.equipoId || equipo.id) || v.equipoId === (equipo.equipoId || equipo.id));

    // Unificar historial y ordenar por fecha descendente
    const historial = [
      ...reparaciones.map(r => ({ ...r, tipoIngreso: 'Recepción en Tienda', _esVisita: false })),
      ...visitas.map(v => ({ ...v, tipoIngreso: 'Visita / Asistencia Remota', _esVisita: true }))
    ].sort((a, b) => new Date(b.fecha_recepcion || b.created_at || b.fecha || b.fecha_visita || new Date()) - new Date(a.fecha_recepcion || a.created_at || a.fecha || a.fecha_visita || new Date()));

    const allUsers = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync() : [];
    const getAtendidoPor = (h) => {
      if (h._esVisita) {
        const tech = allUsers.find(u => u.id === h.usuarioSoporte || u.id === h.usuario_soporte);
        return tech ? (tech.name || tech.username) : (h.usuarioSoporte || h.usuario_soporte || 'N/A');
      } else {
        const creatorId = h.creado_por || h.recibido_por;
        const tech = allUsers.find(u => u.id === creatorId);
        const nameFromUUID = tech ? (tech.name || tech.username) : null;
        return h.creador?.full_name || h.creador?.name || h.usuario?.full_name || h.creador?.username || h.tecnico || h.tecnico_asignado || nameFromUUID || creatorId || 'Sistema';
      }
    };

    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'equipos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'equipos', 'delete');

    return `
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal modal--xl" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">${equipo.nombreEquipo}</h3>
              <p class="text-sm text-muted">${equipo.marca} ${equipo.modelo} | Serie: ${equipo.serie || equipo.numeroSerie || equipo.numero_serie || 'N/A'}</p>
            </div>
            <button class="modal__close" onclick="EquiposModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            <!-- Equipment Info and Client Link -->
            <div class="equipo-detail-header">
              <div class="detail-grid" style="flex: 1;">
                <div class="detail-item">
                  <div class="detail-item__label">Estado</div>
                  <div class="detail-item__value">
                    <span class="badge ${equipo.estado === 'Operativo' ? 'badge--success' : equipo.estado === 'En Reparación' ? 'badge--warning' : 'badge--danger'}">
                      ${equipo.estado}
                    </span>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Ubicación</div>
                  <div class="detail-item__value">${equipo.ubicacion || 'N/A'}</div>
                </div>
              </div>
              <div class="equipo-client-card">
                <div class="equipo-client-card__header">Cliente Propietario</div>
                <div class="equipo-client-card__body" onclick="EquiposModule.viewClientDetail('${equipo.clienteId}')">
                  <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente?.nombreCliente || 'N')}&background=1a73e8&color=fff&size=48" 
                       alt="" class="equipo-client-card__avatar">
                  <div class="equipo-client-card__info">
                    <div class="equipo-client-card__name">${cliente?.nombreCliente || 'Sin cliente'}</div>
                    <div class="equipo-client-card__company">${cliente?.empresa || ''}</div>
                    <div class="equipo-client-card__phone">${cliente?.telefono || ''}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Repair History Section -->
            <div class="repair-history-section">
              <div class="repair-history-header">
                <h4>Historial de Atenciones (${historial.length})</h4>
                <div class="repair-history-actions">
                  <button class="btn btn--secondary btn--sm" onclick="EquiposModule.exportEquipoPDF('${equipo.equipoId}')">
                    ${Icons.fileText} Exportar PDF
                  </button>
                  ${canUpdate ? `
                  <button class="btn btn--primary btn--sm" onclick="EquiposModule.openIngresoOpciones('${equipo.equipoId}', '${equipo.clienteId}')">
                    ${Icons.plus} Ingresar
                  </button>
                  ` : ''}
                </div>
              </div>
              
              ${historial.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo de Atención</th>
                      <th>Diagnóstico / Problema</th>
                      <th>Atendido por</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${historial.map(h => `
                      <tr>
                        <td>${new Date(h.fecha_recepcion || h.created_at || h.fecha || h.fecha_visita || new Date()).toLocaleDateString('es-NI')}</td>
                        <td><span class="badge ${h._esVisita ? 'badge--info' : 'badge--primary'}">${h.tipoIngreso}</span></td>
                        <td style="max-width: 250px;">${h.diagnostico_cliente || h.diagnostico_inicial || h.problema || '-'}</td>
                        <td>${getAtendidoPor(h)}</td>
                        <td>
                          <div class="flex gap-xs">
                            ${h._esVisita ? `
                              <button class="btn btn--ghost btn--icon btn--sm" 
                                      onclick="EquiposModule.closeModal(); App.navigate('visitas'); setTimeout(()=> { if(window.VisitasModule) VisitasModule.viewDetail('${h.id || h.visitaId}'); }, 300)"
                                      title="Ver Visita">
                                ${Icons.eye || 'V'}
                              </button>
                            ` : `
                              <button class="btn btn--ghost btn--icon btn--sm" 
                                      onclick="EquiposModule.closeModal(); RecepcionesModule.viewDetail('${h.id || h.recepcionId}')"
                                      title="Ver Recepción">
                                ${Icons.eye || 'V'}
                              </button>
                            `}
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="empty-state empty-state--compact">
                  <p class="text-muted">No hay atenciones registradas para este equipo.</p>
                  ${canUpdate ? `
                  <button class="btn btn--primary btn--sm" onclick="EquiposModule.openIngresoOpciones('${equipo.equipoId}', '${equipo.clienteId}')">
                    ${Icons.plus} Ingresar
                  </button>
                  ` : ''}
                </div>
              `}
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="EquiposModule.closeModal()">Cerrar</button>
            ${canUpdate ? `
            <button class="btn btn--primary" onclick="EquiposModule.openEditModal('${equipo.equipoId}')">${Icons.edit} Editar Equipo</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  };

  // ========== REPARACION MODAL ==========
  const renderReparacionModal = (equipoId, reparacion = null) => {
    const isEdit = reparacion !== null;
    const tecnicos = ['Técnico Juan', 'Técnico María', 'Técnico Carlos'];

    return `
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Reparación' : 'Nueva Reparación'}</h3>
            <button class="modal__close" onclick="EquiposModule.closeReparacionModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="EquiposModule.handleReparacionSubmit(event, '${equipoId}')">
            <input type="hidden" name="reparacionId" value="${reparacion?.reparacionId || ''}">
            <input type="hidden" name="equipoId" value="${equipoId}">
            
            <div class="form-group">
              <label class="form-label form-label--required">Fecha de Reparación</label>
              <input type="date" name="fecha" class="form-input" 
                     value="${reparacion?.fecha?.split('T')[0] || new Date().toISOString().split('T')[0]}" required>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Descripción del Problema</label>
              <textarea name="problema" class="form-textarea" rows="2" required
                        placeholder="Describa el problema reportado...">${reparacion?.problema || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Trabajo Realizado</label>
              <textarea name="trabajoRealizado" class="form-textarea" rows="3" required
                        placeholder="Describa el trabajo de reparación realizado...">${reparacion?.trabajoRealizado || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Técnico Responsable</label>
                <select name="tecnico" class="form-select" required>
                  ${tecnicos.map(t => `
                    <option value="${t}" ${reparacion?.tecnico === t ? 'selected' : ''}>${t}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Costo (USD)</label>
                <input type="number" name="costo" class="form-input" 
                       value="${reparacion?.costo || 0}" 
                       step="0.01" min="0"
                       placeholder="0.00">
                <span class="form-hint">Deje en 0 si es garantía</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Repuestos Utilizados</label>
              <input type="text" name="repuestos" class="form-input" 
                     value="${reparacion?.repuestos || ''}"
                     placeholder="Ej: Fuente de poder, Cable SATA">
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="EquiposModule.closeReparacionModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Registrar Reparación'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  // ========== PDF GENERATION ==========
  const generatePDFContent = (title, content) => {
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
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
          .info-item { padding: 8px; background: #f8f9fa; border-radius: 4px; }
          .info-label { font-size: 11px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 14px; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; }
          th { background: #1a73e8; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          .badge-danger { background: #f8d7da; color: #721c24; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content}
        <div class="footer">
          <p>ALLTECH - Sistema de Gestión Empresarial | Camoapa, Nicaragua</p>
          <p>Generado el: ${new Date().toLocaleString('es-NI')}</p>
        </div>
      </body>
      </html>
    `;
  };

  const exportEquipoPDF = (equipoId) => {
    const equipo = DataService.getEquipoById(equipoId);
    const cliente = DataService.getClienteById(equipo.clienteId);
    const reparaciones = DataService.getReparacionesByEquipo(equipoId);

    const statusClass = equipo.estado === 'Operativo' ? 'success' : equipo.estado === 'En Reparación' ? 'warning' : 'danger';

    const content = `
      <div class="header">
        <h1>Historial de Reparaciones</h1>
        <p>${equipo.nombreEquipo} - ${equipo.marca} ${equipo.modelo}</p>
      </div>
      
      <div class="section">
        <div class="section-title">Información del Equipo</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Número de Serie</div>
            <div class="info-value">${equipo.serie}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Estado Actual</div>
            <div class="info-value"><span class="badge badge-${statusClass}">${equipo.estado}</span></div>
          </div>
          <div class="info-item">
            <div class="info-label">Ubicación</div>
            <div class="info-value">${equipo.ubicacion || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total Reparaciones</div>
            <div class="info-value">${reparaciones.length}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Cliente Propietario</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nombre</div>
            <div class="info-value">${cliente?.nombreCliente || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Empresa</div>
            <div class="info-value">${cliente?.empresa || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Teléfono</div>
            <div class="info-value">${cliente?.telefono || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Correo</div>
            <div class="info-value">${cliente?.correo || 'N/A'}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Historial de Reparaciones</div>
        ${reparaciones.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Problema</th>
                <th>Trabajo Realizado</th>
                <th>Técnico</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              ${reparaciones.map(r => `
                <tr>
                  <td>${new Date(r.fecha).toLocaleDateString('es-NI')}</td>
                  <td>${r.problema}</td>
                  <td>${r.trabajoRealizado}</td>
                  <td>${r.tecnico}</td>
                  <td>${r.costo > 0 ? '$' + r.costo.toFixed(2) : 'Garantía'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No hay reparaciones registradas para este equipo.</p>'}
      </div>
    `;

    const htmlContent = generatePDFContent(`Historial - ${equipo.nombreEquipo}`, content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const exportGeneralPDF = () => {
    const equipos = DataService.getEquiposSync();

    const content = `
      <div class="header">
        <h1>Reporte General de Equipos</h1>
        <p>Inventario completo y estado de equipos</p>
      </div>
      
      <div class="section">
        <div class="section-title">Resumen</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Total Equipos</div>
            <div class="info-value">${equipos.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Operativos</div>
            <div class="info-value">${equipos.filter(e => e.estado === 'Operativo').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">En Reparación</div>
            <div class="info-value">${equipos.filter(e => e.estado === 'En Reparación').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Fuera de Servicio</div>
            <div class="info-value">${equipos.filter(e => e.estado === 'Fuera de Servicio').length}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Listado de Equipos</div>
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Marca/Modelo</th>
              <th>Serie</th>
              <th>Cliente</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th>Reparaciones</th>
            </tr>
          </thead>
          <tbody>
            ${equipos.map(e => {
      const cliente = DataService.getClienteById(e.clienteId);
      const reparaciones = DataService.getReparacionesByEquipo(e.equipoId);
      const statusClass = e.estado === 'Operativo' ? 'success' : e.estado === 'En Reparación' ? 'warning' : 'danger';
      return `
                <tr>
                  <td>${e.nombreEquipo}</td>
                  <td>${e.marca} ${e.modelo}</td>
                  <td>${e.serie}</td>
                  <td>${cliente?.empresa || 'N/A'}</td>
                  <td>${e.ubicacion || 'N/A'}</td>
                  <td><span class="badge badge-${statusClass}">${e.estado}</span></td>
                  <td>${reparaciones.length}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const htmlContent = generatePDFContent('Reporte General de Equipos', content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  // ========== EVENT HANDLERS ==========
  let searchTimeout;
  const handleSearch = (value) => {
    filterState.search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      App.refreshCurrentModule();
    }, 300);
  };
  const handleClienteFilter = (value) => { filterState.clienteId = value; App.refreshCurrentModule(); };
  const handleEstadoFilter = (value) => { filterState.estado = value; App.refreshCurrentModule(); };

  let isSubmitting = false; // Flag para prevenir doble submit


  const handleViewToggle = (view) => {
    filterState.view = view;
    App.refreshCurrentModule();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Prevenir múltiples envíos
    if (isSubmitting) {
      console.log('⚠️ Submit en progreso, ignorando...');
      return;
    }
    isSubmitting = true;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Guardando...';
    }

    const formData = new FormData(event.target);
    const rawData = Object.fromEntries(formData.entries());

    // Obtener el cliente correspondiente para usar el UUID
    const cliente = DataService.getClienteById(rawData.clienteId);

    // Mapear camelCase (UI) a snake_case (DB)
    // Mapear valor en MAYÚSCULAS para que cumpla con el ENUM de la base de datos (tipo_equipo_enum)
    const formatTipoEquipo = (tipo) => {
      if (!tipo) return 'Otro';
      const dict = {
        'LAPTOP': 'Laptop',
        'PC ESCRITORIO': 'Computadora',
        'COMPUTADORA': 'Computadora',
        'SERVIDOR': 'Servidor',
        'IMPRESORA': 'Impresora',
        'ROUTER / SWITCH': 'Router',
        'ROUTER': 'Router',
        'SWITCH': 'Switch',
        'FIREWALL': 'Firewall',
        'UPS': 'UPS',
        'NAS': 'NAS',
        'TABLET': 'Otro',
        'TELÉFONO': 'Otro',
        'TELEFONO': 'Otro',
        'OTRO': 'Otro'
      };

      const upper = tipo.toUpperCase().trim();
      if (dict[upper]) return dict[upper];

      const camelCased = tipo.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      // Validar si es una opción permitida o fallar silenciosamente a Otro
      if (Object.values(dict).includes(camelCased)) return camelCased;
      return 'Otro';
    };

    const data = {
      cliente_id: cliente?.id || rawData.clienteId,  // Usar UUID de Supabase
      nombre_equipo: rawData.nombreEquipo,
      tipo_equipo: formatTipoEquipo(rawData.tipoEquipo),
      marca: rawData.marca,
      modelo: rawData.modelo,
      serie: rawData.serie,
      ubicacion: rawData.ubicacion || null,
      estado: rawData.estado || 'Operativo'
    };
    console.log('📤 Datos a enviar:', data);

    try {
      if (rawData.equipoId && rawData.equipoId.trim() !== '') {
        // Actualizar equipo existente
        const result = await DataService.updateEquipo(rawData.equipoId, data);
        console.log('✅ Equipo actualizado:', result);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Equipo actualizado correctamente', 'success');
        }
      } else {
        // Crear nuevo equipo
        const result = await DataService.createEquipo(data);
        console.log('✅ Equipo creado:', result);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Equipo creado correctamente', 'success');
        }
      }
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('❌ Error al guardar equipo:', error);
      alert('Error al guardar el equipo: ' + (error.message || 'Error desconocido'));
      // Restaurar botón
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    } finally {
      isSubmitting = false;
    }
  };

  const handleReparacionSubmit = (event, equipoId) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    data.costo = parseFloat(data.costo) || 0;

    if (data.reparacionId) {
      DataService.updateReparacion(data.reparacionId, data);
    } else {
      data.reparacionId = 'REP' + String(Date.now()).slice(-6);
      data.equipoId = equipoId;
      DataService.createReparacion(data);
    }
    closeReparacionModal();
    viewDetail(equipoId);
  };

  // ========== MODAL ACTIONS ==========
  const openCreateModal = () => { document.getElementById('equipoModal').innerHTML = renderFormModal(); };
  const openEditModal = (id) => {
    const equipo = DataService.getEquipoById(id);
    if (equipo) document.getElementById('equipoModal').innerHTML = renderFormModal(equipo);
  };
  const viewDetail = (id) => {
    const equipo = DataService.getEquipoById(id);
    if (equipo) document.getElementById('equipoModal').innerHTML = renderDetailModal(equipo);
  };
  const showClientesList = () => {
    const dropdown = document.getElementById('clientesDropdownList');
    if (dropdown) dropdown.style.display = 'block';
  };

  const filterClientesList = (val) => {
    const dropdown = document.getElementById('clientesDropdownList');
    if (dropdown) dropdown.style.display = 'block';
    const term = val.toLowerCase();
    document.querySelectorAll('.cliente-option').forEach(el => {
      const label = (el.getAttribute('data-label') || '').toLowerCase();
      el.style.display = label.includes(term) ? 'block' : 'none';
      const hiddenInput = document.getElementById('hiddenClienteId');
      if (hiddenInput && hiddenInput.value !== '') {
        hiddenInput.value = '';
      }
    });
  };

  const selectClienteInline = (id, label) => {
    document.getElementById('hiddenClienteId').value = id;
    document.getElementById('searchClienteInput').value = label;
    document.getElementById('clientesDropdownList').style.display = 'none';
    document.getElementById('searchClienteInput').setCustomValidity('');
  };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('equipoModal').innerHTML = '';
  };

  const openReparacionModal = (equipoId) => {
    const equipoModal = document.getElementById('equipoModal');
    equipoModal.innerHTML += `<div id="reparacionModal">${renderReparacionModal(equipoId)}</div>`;
  };
  const openEditReparacion = (equipoId, reparacionId) => {
    const reparacion = DataService.getReparacionById(reparacionId);
    if (reparacion) {
      const equipoModal = document.getElementById('equipoModal');
      equipoModal.innerHTML += `<div id="reparacionModal">${renderReparacionModal(equipoId, reparacion)}</div>`;
    }
  };
  const closeReparacionModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('reparacionModal');
    if (modal) modal.remove();
  };
  const deleteReparacion = (reparacionId) => {
    if (confirm('¿Estás seguro de eliminar esta reparación?')) {
      const reparacion = DataService.getReparacionById(reparacionId);
      DataService.deleteReparacion(reparacionId);
      if (reparacion) viewDetail(reparacion.equipoId);
    }
  };

  const viewClientDetail = (clienteId) => {
    closeModal();
    App.navigate('clientes');
    setTimeout(() => ClientesModule.viewDetail(clienteId), 100);
  };

  const deleteEquipo = async (id) => {
    if (confirm('¿Estás seguro de eliminar este equipo? Esto eliminará también su historial de reparaciones.')) {
      try {
        await DataService.deleteEquipo(id);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Equipo eliminado', 'success');
        }
        console.log('✅ Equipo eliminado correctamente');
        App.refreshCurrentModule();
      } catch (error) {
        console.error('❌ Error al eliminar equipo:', error);
        alert('No se pudo eliminar el equipo: ' + (error.message || 'Error desconocido'));
      }
    }
  };
  const openIngresoOpciones = (equipoId, clienteId) => {
    const html = `
      <div class="modal-overlay open" id="ingresoOpcionesModal" style="z-index: 10005; display: flex; align-items: center; justify-content: center;">
        <div class="modal modal--sm" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Tipo de Ingreso</h3>
            <button class="modal__close" onclick="document.getElementById('ingresoOpcionesModal').remove()">${Icons.x}</button>
          </div>
          <div class="modal__body" style="display: flex; flex-direction: column; gap: 15px;">
            <p>Seleccione cómo desea procesar este equipo:</p>
            <button class="btn btn--primary btn--block" onclick="EquiposModule.ingresarComoRecepcion('${equipoId}', '${clienteId}')">
              💻 Recepción en Tienda
            </button>
            <button class="btn btn--secondary btn--block" onclick="EquiposModule.ingresarComoVisita('${equipoId}', '${clienteId}')">
              🚗 Visita / Asistencia Remota
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  const ingresarComoRecepcion = (equipoId, clienteId) => {
    const modal = document.getElementById('ingresoOpcionesModal');
    if (modal) modal.remove();
    EquiposModule.closeModal();
    App.navigate('recepciones');
    // Call next-tick instead of relying on arbitrary timeout
    setTimeout(() => { if (window.RecepcionesModule) RecepcionesModule.openCreateModal({ clienteId, equipoId }); }, 150);
  };

  const ingresarComoVisita = (equipoId, clienteId) => {
    const modal = document.getElementById('ingresoOpcionesModal');
    if (modal) modal.remove();
    EquiposModule.closeModal();
    App.navigate('visitas');
    // Call next-tick instead of relying on arbitrary timeout
    setTimeout(() => { if (window.VisitasModule) VisitasModule.openCreateModal({ clienteId, equipoId }); }, 150);
  };

  return {
    render, openCreateModal, openEditModal, viewDetail, closeModal,
    handleSearch, handleClienteFilter, handleEstadoFilter, handleSubmit,
    openReparacionModal, openEditReparacion, closeReparacionModal, deleteReparacion,
    handleReparacionSubmit, exportEquipoPDF, exportGeneralPDF, viewClientDetail, deleteEquipo,
    showClientesList, filterClientesList, selectClienteInline,
    openTiposModal, closeTiposModal, addTipoEquipo, deleteTipoEquipo, editTipoEquipo,
    handleViewToggle, openIngresoOpciones, ingresarComoRecepcion, ingresarComoVisita
  };
})();
