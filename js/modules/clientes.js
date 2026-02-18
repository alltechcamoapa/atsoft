/**
 * ALLTECH - Clientes Module
 * Client management with full CRUD operations
 */

const ClientesModule = (() => {
  let currentClientId = null;
  let filterState = { search: '', status: 'all' };

  // ========== RENDER FUNCTIONS ==========

  const render = () => {
    const clientes = DataService.getClientesFiltered(filterState);
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'clientes', 'create');

    return `
      <div class="module-container">
        <!-- Module Header -->
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Gestión de Clientes</h2>
            <p class="module-subtitle">${clientes.length} clientes registrados</p>
          </div>
          <div class="module-header__right">
            ${canCreate ? `
            <button class="btn btn--primary" onclick="ClientesModule.openCreateModal()">
              ${Icons.plus} Nuevo Cliente
            </button>
            ` : ''}
          </div>
        </div>

        <!-- Filters -->
        <div class="module-filters card">
          <div class="card__body">
            <div class="filters-row">
              <div class="search-input" style="flex: 1; max-width: 300px;">
                <span class="search-input__icon">${Icons.search}</span>
                <input type="text" 
                       class="form-input" 
                       placeholder="Buscar cliente..." 
                       value="${filterState.search}"
                       onkeyup="ClientesModule.handleSearch(this.value)">
              </div>
              <select class="form-select" 
                      style="width: 160px;" 
                      onchange="ClientesModule.handleStatusFilter(this.value)">
                <option value="all" ${filterState.status === 'all' ? 'selected' : ''}>Todos</option>
                <option value="Activo" ${filterState.status === 'Activo' ? 'selected' : ''}>Activos</option>
                <option value="Inactivo" ${filterState.status === 'Inactivo' ? 'selected' : ''}>Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Clients Table -->
        <div class="card">
          <div class="card__body" style="padding: 0;">
            ${clientes.length > 0 ? renderTable(clientes) : renderEmptyState()}
          </div>
        </div>
      </div>

      <!-- Modal Container -->
      <div id="clienteModal"></div>
    `;
  };

  const renderTable = (clientes) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'clientes', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'clientes', 'delete');

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Cliente</th>
            <th>Empresa</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${clientes.map(cliente => `
            <tr>
              <td>
                <div class="flex items-center gap-md">
                  <div class="avatar">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente.nombreCliente)}&background=1a73e8&color=fff" 
                         alt="${cliente.nombreCliente}">
                  </div>
                  <div>
                    <div class="font-medium">${cliente.nombreCliente}</div>
                    <div class="text-xs text-muted">${cliente.clienteId}</div>
                  </div>
                </div>
              </td>
              <td>${cliente.empresa}</td>
              <td>${cliente.telefono}</td>
              <td>${cliente.correo}</td>
              <td>
                <span class="badge ${cliente.estado === 'Activo' ? 'badge--success' : 'badge--neutral'}">
                  ${cliente.estado}
                </span>
              </td>
              <td>
                <div class="flex gap-xs">
                  <button class="btn btn--ghost btn--icon btn--sm" 
                          onclick="ClientesModule.viewDetail('${cliente.clienteId}')"
                          title="Ver detalle">
                    ${Icons.eye}
                  </button>
                  ${canUpdate ? `
                  <button class="btn btn--ghost btn--icon btn--sm" 
                          onclick="ClientesModule.openEditModal('${cliente.clienteId}')"
                          title="Editar">
                    ${Icons.edit}
                  </button>
                  ` : ''}
                  ${canDelete ? `
                  <button class="btn btn--ghost btn--icon btn--sm" 
                          onclick="ClientesModule.confirmDelete('${cliente.clienteId}')"
                          title="Eliminar">
                    ${Icons.trash}
                  </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderEmptyState = () => {
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'clientes', 'create');

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.users}</div>
        <h3 class="empty-state__title">No hay clientes</h3>
        <p class="empty-state__description">
          ${filterState.search ? 'No se encontraron clientes con esos criterios.' : 'Comienza agregando tu primer cliente.'}
        </p>
        ${(!filterState.search && canCreate) ? `
          <button class="btn btn--primary" onclick="ClientesModule.openCreateModal()">
            ${Icons.plus} Agregar Cliente
          </button>
        ` : ''}
      </div>
    `;
  };

  // ========== MODAL FORMS ==========

  const renderFormModal = (cliente = null) => {
    const isEdit = cliente !== null;
    const title = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';

    return `
      <div class="modal-overlay open" onclick="ClientesModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${title}</h3>
            <button class="modal__close" onclick="ClientesModule.closeModal()">
              ${Icons.x}
            </button>
          </div>
          <form class="modal__body" onsubmit="ClientesModule.handleSubmit(event)">
            <input type="hidden" name="clienteId" value="${cliente?.clienteId || ''}">
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Nombre del Cliente</label>
                <input type="text" 
                       name="nombreCliente" 
                       class="form-input" 
                       value="${cliente?.nombreCliente || ''}"
                       placeholder="Ej: Juan Pérez"
                       required>
              </div>
              <div class="form-group">
                <label class="form-label">Empresa</label>
                <input type="text" 
                       name="empresa" 
                       class="form-input" 
                       value="${cliente?.empresa || ''}"
                       placeholder="Ej: Mi Empresa S.A.">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Teléfono</label>
                <input type="tel" 
                       name="telefono" 
                       class="form-input" 
                       value="${cliente?.telefono || ''}"
                       placeholder="Ej: +505 8888-8888"
                       required>
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" 
                       name="correo" 
                       class="form-input" 
                       value="${cliente?.correo || ''}"
                       placeholder="Ej: correo@ejemplo.com">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección</label>
              <textarea name="direccion" 
                        class="form-textarea" 
                        rows="2"
                        placeholder="Ej: Managua, Nicaragua">${cliente?.direccion || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Estado</label>
              <select name="estado" class="form-select">
                <option value="Activo" ${(!cliente || cliente?.estado === 'Activo') ? 'selected' : ''}>Activo</option>
                <option value="Inactivo" ${cliente?.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
              </select>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="ClientesModule.closeModal()">
                Cancelar
              </button>
              <button type="submit" class="btn btn--primary">
                ${isEdit ? 'Guardar Cambios' : 'Crear Cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (cliente) => {
    // Usar el UUID (cliente.id) para filtrar relaciones, ya que es la FK en tablas relacionadas
    const uuid = cliente.id;
    const contratos = DataService.getContratosByCliente(uuid);
    const equipos = DataService.getEquiposByCliente(uuid);
    const visitas = DataService.getVisitasByCliente(uuid);
    const proformas = DataService.getProformasByCliente(uuid);

    return `
      <div class="modal-overlay open" onclick="ClientesModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div class="flex items-center gap-md">
              <div class="avatar avatar--lg">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente.nombreCliente)}&background=1a73e8&color=fff&size=56" 
                     alt="${cliente.nombreCliente}">
              </div>
              <div>
                <h3 class="modal__title">${cliente.nombreCliente}</h3>
                <p class="text-sm text-muted">${cliente.empresa}</p>
              </div>
            </div>
            <button class="modal__close" onclick="ClientesModule.closeModal()">
              ${Icons.x}
            </button>
          </div>
          <div class="modal__body">
            <!-- Tabs -->
            <div class="modal__tabs">
              <button class="modal__tab active" onclick="ClientesModule.switchTab(this, 'info')">Información</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'contratos')">Contratos (${contratos.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'equipos')">Equipos (${equipos.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'visitas')">Visitas (${visitas.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'proformas')">Proformas (${proformas.length})</button>
            </div>

            <!-- Info Tab -->
            <div id="tab-info" class="modal__tab-content active">
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-item__label">Teléfono</div>
                  <div class="detail-item__value">${cliente.telefono}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Correo</div>
                  <div class="detail-item__value">${cliente.correo}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Estado</div>
                  <div class="detail-item__value">
                    <span class="badge ${cliente.estado === 'Activo' ? 'badge--success' : 'badge--neutral'}">
                      ${cliente.estado}
                    </span>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Fecha de Registro</div>
                  <div class="detail-item__value">${new Date(cliente.fechaCreacion).toLocaleDateString('es-NI')}</div>
                </div>
                <div class="detail-item detail-item--full">
                  <div class="detail-item__label">Dirección</div>
                  <div class="detail-item__value">${cliente.direccion || 'No especificada'}</div>
                </div>
              </div>
            </div>

            <!-- Contratos Tab -->
            <div id="tab-contratos" class="modal__tab-content">
              ${contratos.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>ID</th>
                      <th>Tipo</th>
                      <th>Tarifa</th>
                      <th>Vigencia</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${contratos.map(c => `
                      <tr>
                        <td>${c.contratoId}</td>
                        <td>${c.tipoContrato}</td>
                        <td>${c.moneda === 'USD' ? '$' : 'C$'}${c.tarifa.toFixed(2)}</td>
                        <td>${new Date(c.fechaInicio).toLocaleDateString('es-NI')} - ${new Date(c.fechaFin).toLocaleDateString('es-NI')}</td>
                        <td>
                          <span class="badge ${c.estadoContrato === 'Activo' ? 'badge--success' : c.estadoContrato === 'Vencido' ? 'badge--warning' : 'badge--danger'}">
                            ${c.estadoContrato}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-muted text-center p-lg">No hay contratos registrados</p>'}
            </div>

            <!-- Equipos Tab -->
            <div id="tab-equipos" class="modal__tab-content">
              ${equipos.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>Equipo</th>
                      <th>Marca/Modelo</th>
                      <th>Serie</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${equipos.map(e => `
                      <tr>
                        <td>${e.nombreEquipo}</td>
                        <td>${e.marca} ${e.modelo}</td>
                        <td>${e.serie}</td>
                        <td>
                          <span class="badge ${e.estado === 'Operativo' ? 'badge--success' : 'badge--warning'}">
                            ${e.estado}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-muted text-center p-lg">No hay equipos registrados</p>'}
            </div>

            <!-- Visitas Tab -->
            <div id="tab-visitas" class="modal__tab-content">
              ${visitas.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${visitas.map(v => `
                      <tr>
                        <td>${new Date(v.fechaInicio).toLocaleDateString('es-NI')}</td>
                        <td>${v.tipoVisita}</td>
                        <td>${v.descripcionTrabajo}</td>
                        <td>
                          <span class="badge ${v.trabajoRealizado ? 'badge--success' : 'badge--warning'}">
                            ${v.trabajoRealizado ? 'Completado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-muted text-center p-lg">No hay visitas registradas</p>'}
            </div>

            <!-- Proformas Tab -->
            <div id="tab-proformas" class="modal__tab-content">
              ${proformas.length > 0 ? `
                <div style="margin-bottom: var(--spacing-md);">
                  <button class="btn btn--primary btn--sm" onclick="App.navigate('proformas'); ClientesModule.closeModal();">
                    ${Icons.plus} Nueva Proforma
                  </button>
                </div>
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>No.</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${proformas.map(p => `
                      <tr>
                        <td>${p.proformaId}</td>
                        <td>${new Date(p.fecha).toLocaleDateString('es-NI')}</td>
                        <td>${p.moneda === 'USD' ? '$' : 'C$'}${p.total.toFixed(2)}</td>
                        <td>
                          <span class="badge ${p.estado === 'Activa' ? 'badge--primary' :
        p.estado === 'Aprobada' ? 'badge--success' :
          p.estado === 'Vencida' ? 'badge--warning' : 'badge--neutral'
      }">
                            ${p.estado}
                          </span>
                        </td>
                        <td>
                          <button class="btn btn--ghost btn--icon btn--sm" 
                                  onclick="App.navigate('proformas'); ClientesModule.closeModal();"
                                  title="Ver proforma">
                            ${Icons.eye}
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="text-center p-lg">
                  <p class="text-muted" style="margin-bottom: var(--spacing-md);">No hay proformas registradas</p>
                  <button class="btn btn--primary btn--sm" onclick="App.navigate('proformas'); ClientesModule.closeModal();">
                    ${Icons.plus} Crear Primera Proforma
                  </button>
                </div>
              `}
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="ClientesModule.closeModal()">
              Cerrar
            </button>
            <button class="btn btn--primary" onclick="ClientesModule.openEditModal('${cliente.clienteId}')">
              ${Icons.edit} Editar Cliente
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const renderDeleteConfirm = (cliente) => {
    return `
      <div class="modal-overlay open" onclick="ClientesModule.closeModal(event)">
        <div class="modal modal--confirm" onclick="event.stopPropagation()">
          <div class="modal__body" style="padding-top: var(--spacing-xl);">
            <div class="modal__icon modal__icon--danger">
              ${Icons.trash}
            </div>
            <h3 class="modal__title">¿Eliminar Cliente?</h3>
            <p class="modal__message">
              Esta acción eliminará a <strong>${cliente.nombreCliente}</strong> y no se puede deshacer.
            </p>
            <div class="modal__footer">
              <button class="btn btn--secondary" onclick="ClientesModule.closeModal()">
                Cancelar
              </button>
              <button class="btn btn--danger" onclick="ClientesModule.deleteCliente('${cliente.clienteId}')">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ========== EVENT HANDLERS ==========

  const handleSearch = (value) => {
    filterState.search = value;
    App.refreshCurrentModule();
  };

  const handleStatusFilter = (value) => {
    filterState.status = value;
    App.refreshCurrentModule();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const rawData = Object.fromEntries(formData.entries());

    // Auto-fill empresa with client name if left empty
    if (!rawData.empresa || rawData.empresa.trim() === '') {
      rawData.empresa = rawData.nombreCliente;
    }

    // Mapear camelCase (UI) a snake_case (DB)
    const data = {
      nombre_cliente: rawData.nombreCliente,
      empresa: rawData.empresa,
      telefono: rawData.telefono,
      correo: rawData.correo || null,
      direccion: rawData.direccion || null,
      estado: rawData.estado || 'Activo'
    };

    try {
      if (rawData.clienteId && rawData.clienteId.trim() !== '') {
        // Actualizar cliente existente
        await DataService.updateCliente(rawData.clienteId, data);
        console.log('✅ Cliente actualizado correctamente');
      } else {
        // Crear nuevo cliente
        await DataService.createCliente(data);
        console.log('✅ Cliente creado correctamente');
      }
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('❌ Error al guardar cliente:', error);
      alert('Error al guardar el cliente: ' + (error.message || 'Error desconocido'));
    }
  };

  // ========== MODAL ACTIONS ==========

  const openCreateModal = () => {
    document.getElementById('clienteModal').innerHTML = renderFormModal();
  };

  const openEditModal = (clienteId) => {
    const cliente = DataService.getClienteById(clienteId);
    if (cliente) {
      document.getElementById('clienteModal').innerHTML = renderFormModal(cliente);
    }
  };

  const viewDetail = (clienteId) => {
    const cliente = DataService.getClienteById(clienteId);
    if (cliente) {
      document.getElementById('clienteModal').innerHTML = renderDetailModal(cliente);
    }
  };

  const confirmDelete = (clienteId) => {
    const cliente = DataService.getClienteById(clienteId);
    if (cliente) {
      document.getElementById('clienteModal').innerHTML = renderDeleteConfirm(cliente);
    }
  };

  const deleteCliente = async (clienteId) => {
    try {
      await DataService.deleteCliente(clienteId);
      console.log('✅ Cliente eliminado correctamente');
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('❌ Error al eliminar cliente:', error);
      alert('Error al eliminar el cliente: ' + (error.message || 'Error desconocido'));
    }
  };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('clienteModal').innerHTML = '';
  };

  const switchTab = (button, tabId) => {
    document.querySelectorAll('.modal__tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal__tab-content').forEach(c => c.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
  };

  // ========== PUBLIC API ==========
  return {
    render,
    openCreateModal,
    openEditModal,
    viewDetail,
    confirmDelete,
    deleteCliente,
    closeModal,
    handleSearch,
    handleStatusFilter,
    handleSubmit,
    switchTab
  };
})();
