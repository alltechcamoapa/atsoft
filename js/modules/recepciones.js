/**
 * ALLTECH - Recepción de Equipos Module
 * Gestión de equipos ingresados para revisión técnica
 */

const RecepcionesModule = (() => {
  let filterState = { search: '', estado: 'all', viewMode: 'list' };

  const render = () => {
    const recepciones = DataService.getRecepcionesFiltered(filterState);
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'create');

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Recepción de Equipos</h2>
            <p class="module-subtitle">${recepciones.length} recepciones registradas</p>
          </div>
          <div class="module-header__right" style="display: flex; gap: 10px;">
            <button class="btn btn--outline" onclick="RecepcionesModule.exportGlobalReport()">
              ${Icons.fileText || '📋'} Reporte Global
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="RecepcionesModule.openCreateModal()">
              ${Icons.plus} Nueva Recepción
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
                <input type="text" class="form-input" placeholder="Buscar recepción, serie o cliente..." 
                       id="searchInput"
                       value="${filterState.search}"
                       oninput="RecepcionesModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 200px;" 
                      onchange="RecepcionesModule.handleEstadoFilter(this.value)">
                <option value="all">Todos los estados</option>
                <option value="Recibido" ${filterState.estado === 'Recibido' ? 'selected' : ''}>Recibido</option>
                <option value="En Revisión" ${filterState.estado === 'En Revisión' ? 'selected' : ''}>En Revisión</option>
                <option value="Diagnosticado" ${filterState.estado === 'Diagnosticado' ? 'selected' : ''}>Diagnosticado</option>
                <option value="Esperando Aprobación" ${filterState.estado === 'Esperando Aprobación' ? 'selected' : ''}>Esperando Aprobación</option>
                <option value="Entregado" ${filterState.estado === 'Entregado' ? 'selected' : ''}>Entregado</option>
              </select>
              <div class="view-toggle" style="display: flex; gap: 5px; margin-left: auto;">
                 <button class="btn btn--icon ${filterState.viewMode !== 'list' ? 'btn--primary' : 'btn--ghost'}" onclick="RecepcionesModule.toggleViewMode('grid')" title="Vista Cuadrícula">
                   ${Icons.grid || '▦'}
                 </button>
                 <button class="btn btn--icon ${filterState.viewMode === 'list' ? 'btn--primary' : 'btn--ghost'}" onclick="RecepcionesModule.toggleViewMode('list')" title="Vista Lista">
                   ${Icons.list || '☰'}
                 </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Recepciones Content -->
        <div class="${filterState.viewMode === 'list' ? 'equipment-list' : 'equipment-grid'}">
          ${recepciones.length > 0 ? renderRecepcionCards(recepciones) : renderEmptyState()}
        </div>
      </div>
      <div id="recepcionModal"></div>
    `;
  };

  const renderStats = () => {
    const stats = DataService.getRecepcionesStats();
    return `
      <div class="stat-card stat-card--warning">
        <div class="stat-card__icon">${Icons.monitor}</div>
        <span class="stat-card__label">Recibidos</span>
        <span class="stat-card__value">${stats.pendientes}</span>
      </div>
      <div class="stat-card stat-card--info">
        <div class="stat-card__icon">${Icons.wrench}</div>
        <span class="stat-card__label">En Revisión</span>
        <span class="stat-card__value">${stats.enRevision}</span>
      </div>
      <div class="stat-card stat-card--success">
        <div class="stat-card__icon">${Icons.checkCircle}</div>
        <span class="stat-card__label">Total Recepciones</span>
        <span class="stat-card__value">${stats.total}</span>
      </div>
    `;
  };

  const renderRecepcionCards = (recepciones) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'update');
    const canDelete = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'delete');

    return recepciones.map(r => {
      let statusClass = 'neutral';
      switch (r.estado) {
        case 'Recibido': statusClass = 'warning'; break;
        case 'En Revisión': statusClass = 'info'; break;
        case 'Diagnosticado': statusClass = 'primary'; break;
        case 'Esperando Aprobación': statusClass = 'danger'; break;
        case 'Reparado': statusClass = 'success'; break;
        case 'Entregado': statusClass = 'success'; break;
      }

      return `
        <div class="card equipment-card">
          <div class="card__body">
            <div class="equipment-card__header">
              <div class="flex" style="gap: 5px; font-weight: bold; align-items: center; color: var(--primary-color);">
                ${Icons.fileText} ${r.codigo_recepcion || r.numero_recepcion || 'N/A'}
              </div>
              <span class="badge badge--${statusClass}">${r.estado}</span>
            </div>
            <h3 class="equipment-card__title" style="margin-top: 5px;">${r.equipo?.nombre_equipo || r.equipo?.nombreEquipo || 'Equipo Desconocido'}</h3>
            <p class="equipment-card__subtitle">${r.equipo?.marca || ''} ${r.equipo?.modelo || ''}</p>
            
            <div class="equipment-card__details">
              <div class="equipment-card__detail">
                <span class="text-muted">Ingreso:</span>
                <span class="font-medium">${new Date(r.fecha_recepcion || r.created_at).toLocaleDateString('es-NI')}</span>
              </div>
              <div class="equipment-card__detail">
                <span class="text-muted">Serie:</span>
                <span>${r.equipo?.numero_serie || r.equipo?.serie || 'N/A'}</span>
              </div>
            </div>
            
            <!-- Client Link -->
            <div class="equipment-card__client">
              <div class="equipment-card__client-avatar">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(r.cliente?.nombre_cliente || r.cliente?.nombreCliente || 'N')}&background=1a73e8&color=fff&size=32" alt="">
              </div>
              <div class="equipment-card__client-info">
                <div class="equipment-card__client-name">${r.cliente?.nombre_cliente || r.cliente?.nombreCliente || 'Sin cliente'}</div>
                <div class="equipment-card__client-company">${r.cliente?.empresa || ''}</div>
              </div>
            </div>
            
            <div class="equipment-card__actions" style="margin-top: 15px; display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap !important;">
              <button class="btn btn--lg btn--outline" onclick="RecepcionesModule.viewDetail('${r.recepcionId || r.id}')" title="Ver Detalle" style="padding: 12px 20px !important; display: flex; align-items: center; gap: 10px; font-size: 16px !important; min-height: 48px !important; min-width: 130px !important;">
                 <span style="display: flex; transform: scale(1.4); width: 24px !important; height: 24px !important; align-items: center; justify-content: center;">${Icons.eye}</span> Ver
              </button>
              ${canUpdate ? `
              <button class="btn btn--lg btn--warning" onclick="RecepcionesModule.openChangeStatusModal('${r.recepcionId || r.id}')" title="Cambiar Estado" style="padding: 12px 20px !important; display: flex; align-items: center; min-height: 48px !important; min-width: 60px !important;">
                <span style="display: flex; transform: scale(1.4); width: 24px !important; height: 24px !important; align-items: center; justify-content: center;">${Icons.refreshCw || '⟳'}</span>
              </button>
              ` : ''}
              <button class="btn btn--lg btn--primary" onclick="RecepcionesModule.exportRecepcionPDF('${r.recepcionId || r.id}')" title="Imprimir Recibo" style="padding: 12px 20px !important; display: flex; align-items: center; min-height: 48px !important; min-width: 60px !important;">
                <span style="display: flex; transform: scale(1.4); width: 24px !important; height: 24px !important; align-items: center; justify-content: center;">${Icons.fileText || '📄'}</span>
              </button>
              ${canDelete ? `
              <button class="btn btn--lg btn--ghost text-danger" onclick="RecepcionesModule.deleteRecepcion('${r.recepcionId || r.id}')" title="Eliminar" style="padding: 12px 15px !important; display: flex; align-items: center; min-height: 48px !important; min-width: 50px !important;">
                <span style="display: flex; transform: scale(1.4); width: 24px !important; height: 24px !important; align-items: center; justify-content: center;">${Icons.trash}</span>
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
    const canCreate = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'create');

    return `
      <div class="empty-state" style="grid-column: span 3;">
        <div class="empty-state__icon">${Icons.inbox}</div>
        <h3 class="empty-state__title">No hay recepciones registradas</h3>
        <p class="empty-state__description">Inicie una nueva recepción para registrar un equipo a revisar.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="RecepcionesModule.openCreateModal()">
          ${Icons.plus} Nueva Recepción
        </button>
        ` : ''}
      </div>
    `;
  };

  const getClientOptions = (selectedId) => {
    const clientes = DataService.getClientesSync();
    return clientes.map(c => {
      const isSelected = (selectedId === (c.id || c.clienteId)) ? 'selected' : '';
      return `<option value="${c.id || c.clienteId}" ${isSelected}>${c.empresa || ''} - ${c.nombreCliente || c.nombre_cliente}</option>`;
    }).join('');
  };

  const getEquipmentOptions = (clienteId, selectedId) => {
    if (!clienteId || clienteId === 'NEW') return '';
    const equipos = DataService.getEquiposByCliente(clienteId);
    return equipos.map((e, index) => {
      const isSelected = (selectedId === (e.id || e.equipoId)) ? 'selected' : '';
      return `<option value="${e.id || e.equipoId}" ${isSelected}>${index + 1}. ${e.nombreEquipo || e.nombre_equipo} (${e.marca || ''} ${e.modelo || ''}) - ${e.serie || e.numero_serie || ''}</option>`;
    }).join('');
  };

  const renderFormModal = (recepcion = null) => {
    const isEdit = recepcion !== null;
    const user = State.get('user');

    return `
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal modal--xl" style="height: 90vh; display: flex; flex-direction: column;" onclick="event.stopPropagation()">
          <div class="modal__header text-center">
            <h3 class="modal__title">${isEdit ? 'Editar Recepción' : 'Nueva Recepción de Equipo'}</h3>
            <button class="modal__close" onclick="RecepcionesModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" id="recepcionForm" onsubmit="RecepcionesModule.handleSubmit(event)" style="overflow-y: auto; flex: 1; padding: 20px;">
            <input type="hidden" name="recepcionId" value="${recepcion?.recepcionId || recepcion?.id || ''}">
            
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
              <!-- COLUMNA 1: Cliente y Equipo -->
              <div class="section-card card" style="padding: 15px;">
                  <h4 style="margin-bottom: 15px; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">1. Datos del Cliente</h4>
                  
                  <div class="form-group" style="position: relative;">
                    <label class="form-label form-label--required">Cliente</label>
                    <input type="text" id="clienteSearchInput" class="form-input" 
                           placeholder="Buscar cliente por nombre o código..." 
                           autocomplete="off"
                           onclick="RecepcionesModule.showClientesList()"
                           onkeyup="RecepcionesModule.filterClientesList(this.value)">
                    <div id="clientesList" class="dropdown-list" style="display: none; position: absolute; z-index: 1000; width: 100%; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      <div class="dropdown-item" onclick="RecepcionesModule.selectClienteInline('NEW', '+ Crear Nuevo Cliente')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-weight: bold; color: var(--primary-color);">
                        + Crear Nuevo Cliente
                      </div>
                      ${DataService.getClientesSync().map(c => {
      const idText = c.codigo_cliente || c.codigoCliente || c.id || c.clienteId || 'ID';
      const nameText = c.nombreCliente || c.nombre_cliente || c.empresa || '';
      const text = `${idText} - ${nameText}`;
      return `<div class="dropdown-item cliente-item" data-name="${text.toLowerCase()}" onclick="RecepcionesModule.selectClienteInline('${c.id || c.clienteId}', '${text.replace(/'/g, "\\'")}')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
                            ${text}
                          </div>`;
    }).join('')}
                    </div>
                    <input type="hidden" name="clienteId" id="clienteId" value="${recepcion?.clienteId || recepcion?.cliente_id || ''}" onchange="RecepcionesModule.onClienteChange()">
                  </div>

                  <div id="newClienteSection" style="display: none; background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h5 style="margin-bottom: 10px;">Nuevo Cliente</h5>
                      <div class="form-group">
                        <label class="form-label form-label--required">Nombre Completo</label>
                        <input type="text" name="nuevoClienteNombre" id="nuevoClienteNombre" class="form-input" placeholder="Ej: Juan Pérez">
                      </div>
                      <div class="form-group">
                        <label class="form-label">Cédula</label>
                        <input type="text" name="nuevoClienteCedula" class="form-input" placeholder="xxx-xxxxxx-xxxxA">
                      </div>
                      <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" name="nuevoClienteTelefono" class="form-input" placeholder="Ej: 8888-8888">
                      </div>
                  </div>

                  <h4 style="margin-bottom: 15px; margin-top: 20px; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">2. Datos del Equipo</h4>
                  
                  <div class="form-group">
                    <label class="form-label form-label--required">Equipo</label>
                    <select name="equipoId" id="equipoId" class="form-select" onchange="RecepcionesModule.onEquipoChange()" disabled>
                      <option value="">Primero seleccione un cliente...</option>
                    </select>
                  </div>

                  <div id="newEquipoSection" style="display: none; background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h5 style="margin-bottom: 10px;">Nuevo Equipo</h5>
                      <div class="form-row">
                          <div class="form-group">
                              <label class="form-label form-label--required">Tipo (Ej: Laptop, Imprésora)</label>
                              <input type="text" name="nuevoEquipoTipo" id="nuevoEquipoTipo" class="form-input">
                          </div>
                      </div>
                      <div class="form-row">
                          <div class="form-group">
                            <label class="form-label form-label--required">Marca</label>
                            <input type="text" name="nuevoEquipoMarca" id="nuevoEquipoMarca" class="form-input">
                          </div>
                          <div class="form-group">
                            <label class="form-label form-label--required">Modelo</label>
                            <input type="text" name="nuevoEquipoModelo" id="nuevoEquipoModelo" class="form-input">
                          </div>
                      </div>
                      <div class="form-row">
                          <div class="form-group">
                            <label class="form-label">Número de Serie</label>
                            <input type="text" name="nuevoEquipoSerie" class="form-input">
                          </div>
                          <div class="form-group">
                            <label class="form-label">Color</label>
                            <input type="text" name="nuevoEquipoColor" class="form-input">
                          </div>
                      </div>
                      <div class="form-group">
                          <label class="form-label text-danger" style="color: var(--danger-color);">Contraseña del Equipo (Si tiene)</label>
                          <input type="text" name="nuevoEquipoContrasena" class="form-input" placeholder="Contraseña de usuario / PIN">
                      </div>
                  </div>
              </div>

              <!-- COLUMNA 2: Detalles de Recepción -->
              <div class="section-card card" style="padding: 15px;">
                  <h4 style="margin-bottom: 15px; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">3. Detalles de Recepción</h4>
                  
                  <div class="form-group">
                    <label class="form-label form-label--required">Problema Reportado (Diagnóstico Cliente)</label>
                    <textarea name="diagnosticoCliente" class="form-textarea" rows="3" placeholder="El cliente indica que...">${recepcion?.diagnostico_cliente || recepcion?.diagnosticoCliente || ''}</textarea>
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Artículos o Accesorios Recibidos</span>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="RecepcionesModule.addAccesorioInput()" style="padding: 2px 8px; font-size: 0.8rem;">+ Nueva Línea</button>
                    </label>
                    <div id="accesoriosContainer" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
                    </div>
                    <input type="hidden" name="accesoriosIncluidos" id="accesoriosIncluidosValue" value="${recepcion?.accesorios_incluidos || recepcion?.accesoriosIncluidos || ''}">
                  </div>

                  <div class="form-group">
                    <label class="form-label">Estado Físico del Equipo</label>
                    <input type="text" name="estadoFisico" class="form-input" value="${recepcion?.estado_fisico || recepcion?.estadoFisico || ''}" placeholder="Ej: Rayones en tapa, pantalla intacta">
                  </div>

                  <div class="form-row">
                      <div class="form-group">
                        <label class="form-label form-label--required">Fecha Recepción</label>
                        <input type="datetime-local" name="fechaRecepcion" class="form-input" 
                               value="${recepcion?.fecha_recepcion ? recepcion.fecha_recepcion.slice(0, 16) : new Date(new Date().toLocaleString("en-US", { timeZone: "America/Managua" })).toLocaleString("sv-SE").replace(' ', 'T').slice(0, 16)}" readonly style="background: var(--bg-secondary);">
                      </div>
                      <div class="form-group">
                        <label class="form-label form-label--required">Fecha Posible Revisión</label>
                        <input type="date" name="fechaRevisionPosible" class="form-input" 
                               value="${recepcion?.fecha_revision_posible ? recepcion.fecha_revision_posible.split('T')[0] : ''}">
                      </div>
                  </div>

                  <div class="form-row">
                      <div class="form-group">
                          <label class="form-label">Estado</label>
                          <select name="estado" class="form-select">
                              <option value="Recibido" ${(!recepcion || recepcion.estado === 'Recibido') ? 'selected' : ''}>Recibido</option>
                              <option value="En Revisión" ${recepcion?.estado === 'En Revisión' ? 'selected' : ''}>En Revisión</option>
                              <option value="Diagnosticado" ${recepcion?.estado === 'Diagnosticado' ? 'selected' : ''}>Diagnosticado</option>
                              <option value="Esperando Aprobación" ${recepcion?.estado === 'Esperando Aprobación' ? 'selected' : ''}>Esperando Aprobación</option>
                              <option value="Entregado" ${recepcion?.estado === 'Entregado' ? 'selected' : ''}>Entregado</option>
                          </select>
                      </div>
                      <div class="form-group">
                          <label class="form-label">Recibido por</label>
                          <input type="text" class="form-input" name="recibidoPor" value="${recepcion?.recibido_por || user?.name || ''}" readonly style="background: var(--bg-secondary);">
                      </div>
                  </div>
              </div>
            </div>

            <div class="modal__footer" style="padding-top: 20px; border-top: 1px solid var(--border-color); margin-top: 20px;">
              <button type="button" class="btn btn--secondary" onclick="RecepcionesModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Registrar Recepción y Generar Recibo'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (recepcion) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'update');
    const canDelete = DataService.canPerformAction(user?.role || 'Usuario', 'recepciones', 'delete');
    return `
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal modal--lg" onclick="event.stopPropagation()" style="margin: auto;">
            <div class="modal__header">
                <h3 class="modal__title">Recepción ${recepcion.numero_recepcion || recepcion.codigo_recepcion || ''}</h3>
                <button class="modal__close" onclick="RecepcionesModule.closeModal()">${Icons.x}</button>
            </div>
            <div class="modal__body">
                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin-bottom: 10px; color: var(--primary-color);">Datos del Cliente</h4>
                        <p><strong>Cliente:</strong> ${recepcion.cliente?.nombre_cliente || recepcion.cliente?.nombreCliente || 'N/A'}</p>
                        <p><strong>Empresa:</strong> ${recepcion.cliente?.empresa || 'N/A'}</p>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 10px; color: var(--primary-color);">Datos del Equipo</h4>
                        <p><strong>Equipo:</strong> ${recepcion.equipo?.nombre_equipo || recepcion.equipo?.nombreEquipo || 'N/A'}</p>
                        <p><strong>Marca/Modelo:</strong> ${recepcion.equipo?.marca || ''} ${recepcion.equipo?.modelo || ''}</p>
                        <p><strong>Serie:</strong> ${recepcion.equipo?.numero_serie || recepcion.equipo?.serie || 'N/A'}</p>
                        <p><strong>Color:</strong> ${recepcion.equipo?.color || 'N/A'}</p>
                    </div>
                </div>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
                ${recepcion.total_reparacion > 0 ? `
                <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid var(--primary-color);">
                    <h4 style="margin-bottom: 10px; color: var(--primary-color);">Resumen de Reparación</h4>
                    <p><strong>Mano de Obra:</strong> $${parseFloat(recepcion.mano_de_obra || 0).toFixed(2)}</p>
                    ${recepcion.productos_reparacion && recepcion.productos_reparacion.length > 0 ? `
                        <p><strong>Repuestos/Materiales:</strong></p>
                        <ul style="padding-left: 20px; font-size: 13px; margin: 5px 0;">
                            ${recepcion.productos_reparacion.map(p => `<li>${p.nombre} (x${p.cantidad}) - $${((p.precio || 0) * (p.cantidad || 1)).toFixed(2)}</li>`).join('')}
                        </ul>
                    ` : ''}
                    <p style="font-size: 16px; margin-top: 10px;"><strong>TOTAL A PAGAR: <span style="color: var(--primary-color);">$${parseFloat(recepcion.total_reparacion || 0).toFixed(2)}</span></strong></p>
                </div>
                ` : ''}
                <div>
                    <h4 style="margin-bottom: 10px; color: var(--primary-color);">Detalles de Ingreso e Historial</h4>
                    <p><strong>Problema Reportado:</strong> <br/> <span style="white-space: pre-wrap;">${recepcion.diagnostico_inicial || recepcion.diagnosticoInicial || '-'}</span></p>
                    <br/>
                    <p><strong>Accesorios Incluidos:</strong> <br/> ${recepcion.accesorios || '-'}</p>
                    <br/>
                    <p><strong>Historial de Notas:</strong> <br/> <div style="white-space: pre-wrap; font-family: monospace; font-size: 12px; color: #444; background: #f5f5f5; padding: 10px; border-radius: 4px; border: 1px solid #ddd; max-height: 200px; overflow-y: auto;">${recepcion.notas || '-'}</div></p>
                    <hr style="margin: 15px 0; border: none; border-top: 1px dashed var(--border-color);">
                    <div class="grid" style="grid-template-columns: 1fr 1fr; font-size: 13px;">
                        <div>
                            <p><strong>Fecha Ingreso:</strong> ${new Date(recepcion.fecha_recepcion || recepcion.created_at).toLocaleString('es-NI')}</p>
                            <p><strong>Posible Revisión:</strong> ${recepcion.fecha_revision_posible ? new Date(recepcion.fecha_revision_posible).toLocaleDateString('es-NI') : '-'}</p>
                        </div>
                        <div style="text-align: right;">
                             <p><strong>Atendido por:</strong> ${recepcion.creador?.full_name || recepcion.creador?.name || recepcion.recibido_por || '-'}</p>
                             <p><strong>Estado Actual:</strong> <span class="badge badge--primary">${recepcion.estado}</span></p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal__footer" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 8px;">
                  ${canDelete ? `
                  <button class="btn btn--ghost text-danger" onclick="RecepcionesModule.deleteRecepcion('${recepcion.id || recepcion.recepcionId}')" title="Eliminar Recepción">
                    ${Icons.trash} Eliminar
                  </button>
                  ` : ''}
                </div>
                <div style="display: flex; gap: 8px;">
                  ${canUpdate ? `
                  <button class="btn btn--warning" onclick="RecepcionesModule.openChangeStatusModal('${recepcion.id || recepcion.recepcionId}')">Cambiar Estado</button>
                  <button class="btn btn--outline" onclick="RecepcionesModule.openEditModal('${recepcion.id || recepcion.recepcionId}')">${Icons.edit} Editar</button>
                  ` : ''}
                  <button class="btn btn--secondary" onclick="RecepcionesModule.exportRecepcionPDF('${recepcion.id || recepcion.recepcionId}')">Recibo Ingreso</button>
                  ${recepcion.total_reparacion > 0 ? `<button class="btn btn--success" onclick="RecepcionesModule.exportPagoPDF('${recepcion.id || recepcion.recepcionId}')">${Icons.dollarSign || '$'} Recibo Pago</button>` : ''}
                  <button class="btn btn--primary" onclick="RecepcionesModule.closeModal()">Cerrar</button>
                </div>
            </div>
        </div>
      </div>
    `;
  };

  const openChangeStatusModal = (recepcionId) => {
    const recepcion = DataService.getRecepcionById(recepcionId);
    if (!recepcion) return;

    // Reset temp products
    window._tempSelectedProducts = recepcion.productos_reparacion || [];

    document.getElementById('recepcionModal').innerHTML = `
      <div class="modal-overlay open" style="display: flex; align-items: center; justify-content: center;">
        <div class="modal modal--md" onclick="event.stopPropagation()">
            <div class="modal__header">
                <h3 class="modal__title">Actualizar Estado del Equipo</h3>
                <button class="modal__close" onclick="RecepcionesModule.closeModal()">${Icons.x}</button>
            </div>
            <form class="modal__body" onsubmit="RecepcionesModule.handleStatusChange(event, '${recepcionId}')" style="padding: 20px;">
                <p style="margin-bottom: 15px; font-size: 14px; color: var(--text-muted);">
                  Equipo: <strong>${recepcion.equipo?.nombre_equipo || 'Equipo'}</strong> 
                  (${recepcion.codigo_recepcion || recepcion.numero_recepcion})
                </p>
                <div class="form-group">
                    <label class="form-label form-label--required">Nuevo Estado</label>
                    <select id="selectNuevoEstado" name="nuevoEstado" class="form-select" required onchange="RecepcionesModule.onStatusChangeInModal(this.value, '${recepcionId}')">
                        <option value="Recibido" ${recepcion.estado === 'Recibido' ? 'selected' : ''}>Recibido</option>
                        <option value="En Revisión" ${recepcion.estado === 'En Revisión' ? 'selected' : ''}>En Revisión</option>
                        <option value="Diagnosticado" ${recepcion.estado === 'Diagnosticado' ? 'selected' : ''}>Diagnosticado</option>
                        <option value="Esperando Aprobación" ${recepcion.estado === 'Esperando Aprobación' ? 'selected' : ''}>Esperando Aprobación</option>
                        <option value="Reparado" ${recepcion.estado === 'Reparado' ? 'selected' : ''}>Reparado</option>
                        <option value="Entregado" ${recepcion.estado === 'Entregado' ? 'selected' : ''}>Entregado</option>
                    </select>
                </div>

                <!-- Diagnostic/Price Section -->
                <div id="diagnosticSection" style="${recepcion.estado === 'Diagnosticado' || recepcion.estado === 'Reparado' || recepcion.estado === 'Entregado' ? 'display: block;' : 'display: none;'} margin-top: 20px; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; background: #f9f9f9;">
                    <h4 style="margin-bottom: 10px; font-size: 14px; color: var(--primary-color);">Presupuesto y Repuestos</h4>
                    <div class="form-row" style="grid-template-columns: 1fr 1fr;">
                        <div class="form-group">
                            <label class="form-label">Costo Mano de Obra ($)</label>
                            <input type="number" name="manoDeObra" class="form-input" value="${recepcion.mano_de_obra || 0}" step="0.01" oninput="RecepcionesModule.calculateTotalReparacion()">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Total Reparación ($)</label>
                            <input type="number" id="totalReparacionInp" name="totalReparacion" class="form-input" value="${recepcion.total_reparacion || 0}" step="0.01" readonly style="background: #eee;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 15px;">
                        <label class="form-label">Repuestos / Productos Utilizados</label>
                        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                            <div class="search-input" style="flex: 1;">
                                <input type="text" id="prodSearch" class="form-input" placeholder="Buscar producto..." onkeyup="RecepcionesModule.searchProducts(this.value)">
                                <div id="prodSearchResults" style="position: absolute; width: 100%; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd; z-index: 100; display: none; box-shadow: var(--shadow-md);"></div>
                            </div>
                        </div>
                        <div id="selectedProductsList" style="display: flex; flex-direction: column; gap: 5px;">
                            ${renderSelectedProductsList()}
                        </div>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 15px;">
                    <label class="form-label">Notas de Diagnóstico / Reparación</label>
                    <textarea name="comentarioCambio" class="form-textarea" rows="3" placeholder="Detalles técnicos, diagnóstico final o motivos de entrega..."></textarea>
                </div>
                <div class="modal__footer" style="padding-top: 20px; border-top: 1px solid var(--border-color); margin-top: 20px;">
                    <button type="button" class="btn btn--secondary" onclick="RecepcionesModule.closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn--primary">${recepcion.estado === 'Reparado' && 'Entregado' === recepcion.estado ? 'Generar Recibo y Entregar' : 'Guardar Cambio'}</button>
                </div>
            </form>
        </div>
      </div>
    `;
  };

  const onStatusChangeInModal = (value, recepcionId) => {
    const section = document.getElementById('diagnosticSection');
    if (section) {
      if (value === 'Diagnosticado' || value === 'Reparado' || value === 'Entregado') {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    }
  };

  const searchProducts = (val) => {
    const results = document.getElementById('prodSearchResults');
    if (!results) return;
    if (!val || val.length < 2) {
      results.style.display = 'none';
      return;
    }

    const products = DataService.getProductosSync();
    const filtered = products.filter(p =>
      p.nombre.toLowerCase().includes(val.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(val.toLowerCase()))
    );

    if (filtered.length > 0) {
      results.innerHTML = filtered.map(p => `
        <div class="prod-search-item" onclick="RecepcionesModule.addProductToReparacion('${p.id}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_venta || p.precio || 0})" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold;">${p.nombre}</div>
          <div style="font-size: 12px; color: #666;">Precio: $${parseFloat(p.precio_venta || p.precio || 0).toFixed(2)}</div>
        </div>
      `).join('');
      results.style.display = 'block';
    } else {
      results.innerHTML = '<div style="padding: 10px; color: #999;">No hay coincidencias</div>';
      results.style.display = 'block';
    }
  };

  const addProductToReparacion = (id, nombre, precio) => {
    if (!window._tempSelectedProducts) window._tempSelectedProducts = [];

    const existing = window._tempSelectedProducts.find(p => p.id === id);
    if (existing) {
      existing.cantidad = (existing.cantidad || 1) + 1;
    } else {
      window._tempSelectedProducts.push({ id, nombre, precio, cantidad: 1 });
    }

    const searchInp = document.getElementById('prodSearch');
    if (searchInp) searchInp.value = '';

    const resultsDiv = document.getElementById('prodSearchResults');
    if (resultsDiv) resultsDiv.style.display = 'none';

    const list = document.getElementById('selectedProductsList');
    if (list) list.innerHTML = renderSelectedProductsList();
    calculateTotalReparacion();
  };

  const removeProductFromReparacion = (index) => {
    if (!window._tempSelectedProducts) return;
    window._tempSelectedProducts.splice(index, 1);
    const list = document.getElementById('selectedProductsList');
    if (list) list.innerHTML = renderSelectedProductsList();
    calculateTotalReparacion();
  };

  const renderSelectedProductsList = () => {
    const products = window._tempSelectedProducts || [];
    if (products.length === 0) return '<p style="color: #999; font-size: 12px; font-style: italic;">Sin productos/repuestos agregados</p>';

    return products.map((p, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd; font-size: 13px;">
        <div style="flex: 1;"><strong>${p.nombre}</strong> (x${p.cantidad || 1})</div>
        <div style="width: 80px; text-align: right; color: var(--primary-color); font-weight: bold;">$${parseFloat((p.precio || 0) * (p.cantidad || 1)).toFixed(2)}</div>
        <button type="button" class="btn btn--icon btn--ghost text-danger" onclick="RecepcionesModule.removeProductFromReparacion(${index})" style="min-width: 24px; height: 24px; padding: 0; margin-left: 10px;">&times;</button>
      </div>
    `).join('');
  };

  const calculateTotalReparacion = () => {
    const manoDeObra = parseFloat(document.querySelector('input[name="manoDeObra"]')?.value || 0);
    const products = window._tempSelectedProducts || [];
    const prodTotal = products.reduce((acc, p) => acc + ((p.precio || 0) * (p.cantidad || 1)), 0);

    const total = manoDeObra + prodTotal;
    const totalInp = document.getElementById('totalReparacionInp');
    if (totalInp) totalInp.value = total.toFixed(2);
  };





  const handleStatusChange = async (event, recepcionId) => {
    event.preventDefault();
    const recepcion = DataService.getRecepcionById(recepcionId);
    if (!recepcion) return;

    const formData = new FormData(event.target);
    const nuevoEstado = formData.get('nuevoEstado');
    const comentario = formData.get('comentarioCambio');
    const manoDeObra = parseFloat(formData.get('manoDeObra') || 0);
    const totalReparacion = parseFloat(formData.get('totalReparacion') || 0);

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Guardando...';
    }

    try {
      const user = State.get('user');
      const timeStr = new Date().toLocaleString('es-NI');
      let logText = `\n--- [${timeStr}] ESTADO: ${nuevoEstado.toUpperCase()} ---\nAutor: ${user?.name || 'Sistema'}`;

      if (nuevoEstado === 'Diagnosticado' || nuevoEstado === 'Reparado' || nuevoEstado === 'Entregado') {
        logText += `\nPresupuesto: $${totalReparacion.toFixed(2)} (Mano de obra: $${manoDeObra.toFixed(2)})`;
        if (window._tempSelectedProducts && window._tempSelectedProducts.length > 0) {
          logText += `\nRepuestos: ${window._tempSelectedProducts.map(p => `${p.nombre} (x${p.cantidad})`).join(', ')}`;
        }
      }

      if (comentario && comentario.trim() !== '') {
        logText += `\nNota: ${comentario}`;
      }

      const newNotas = (recepcion.notas ? recepcion.notas.trim() + '\n' : '') + logText;

      const updateData = {
        estado: nuevoEstado,
        notas: newNotas,
        mano_de_obra: manoDeObra,
        total_reparacion: totalReparacion,
        productos_reparacion: window._tempSelectedProducts || []
      };

      await DataService.updateRecepcion(recepcion.id || recepcionId, updateData);

      // Si se entrega, generar recibo de pago
      if (nuevoEstado === 'Entregado') {
        exportPagoPDF(recepcionId);
      }

      NotificationService.show('Estado actualizado y cambio registrado.', 'success');
      App.refreshCurrentModule();
      closeModal();
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Cambio';
      }
      alert('Error al cambiar el estado: ' + error.message);
    }
  };

  const onClienteChange = () => {
    const clienteId = document.getElementById('clienteId').value;
    const newClienteSection = document.getElementById('newClienteSection');
    const equipoIdSelect = document.getElementById('equipoId');
    const newEquipoSection = document.getElementById('newEquipoSection');

    if (!equipoIdSelect) return;

    if (clienteId === 'NEW') {
      newClienteSection.style.display = 'block';
      equipoIdSelect.innerHTML = '<option value="NEW">+ Crear Nuevo Equipo para este Cliente</option>';
      equipoIdSelect.disabled = false;
      onEquipoChange(); // show new equipo form

      // Reset fields (native required is removed, validation handled in submit)
      // document.getElementById('nuevoClienteNombre').required = true;
      // document.getElementById('nuevoEquipoTipo').required = true;
      // document.getElementById('nuevoEquipoMarca').required = true;
      // document.getElementById('nuevoEquipoModelo').required = true;
    } else if (clienteId) {
      newClienteSection.style.display = 'none';
      // document.getElementById('nuevoClienteNombre').required = false;

      // Check if client has equipment
      const clientEquipments = DataService.getEquiposByCliente(clienteId);

      let optionsHtml = '<option value="">Seleccionar equipo...</option>';
      optionsHtml += '<option value="NEW" style="font-weight: bold; color: var(--primary-color);">+ Crear Nuevo Equipo</option>';

      optionsHtml += clientEquipments.map((e, index) => {
        const isSelected = (document.getElementById('equipoId').getAttribute('data-selected-val') === (e.id || e.equipoId)) ? 'selected' : '';
        return `<option value="${e.id || e.equipoId}" ${isSelected}>${index + 1}. ${e.nombreEquipo || e.nombre_equipo || 'Equipo'} (${e.marca || ''} ${e.modelo || ''}) - ${e.serie || ''}</option>`;
      }).join('');

      equipoIdSelect.innerHTML = optionsHtml;
      equipoIdSelect.disabled = false;

      // Si el cliente seleccionado cambia, verificar si equipo estaba seleccionado
      onEquipoChange();
    } else {
      newClienteSection.style.display = 'none';
      equipoIdSelect.innerHTML = '<option value="">Primero seleccione un cliente...</option>';
      equipoIdSelect.disabled = true;
      newEquipoSection.style.display = 'none';
      // document.getElementById('nuevoClienteNombre').required = false;
    }
  };

  const onEquipoChange = () => {
    const equipoId = document.getElementById('equipoId').value;
    const newEquipoSection = document.getElementById('newEquipoSection');

    if (equipoId === 'NEW') {
      newEquipoSection.style.display = 'block';
      // Validación en handleSubmit manual
    } else {
      newEquipoSection.style.display = 'none';
    }
  };

  // ========== PDF GENERATION ==========
  const exportRecepcionPDF = (recepcionId) => {
    const recepcion = DataService.getRecepcionById(recepcionId);
    if (!recepcion) return;

    let titleCode = recepcion.codigo_recepcion || recepcion.numero_recepcion || '';
    const dateRecepcion = new Date(recepcion.fecha_recepcion || recepcion.created_at).toLocaleString('es-NI');
    const dateRevision = recepcion.fecha_revision_posible ? new Date(recepcion.fecha_revision_posible).toLocaleDateString('es-NI') : 'Pendiente';
    const cacheConfig = typeof DataService.getConfig === 'function' ? DataService.getConfig() : null;
    const phone = cacheConfig?.empresaTelefono || '+505 8944 1777';
    const logoUrl = cacheConfig?.empresaLogo || 'assets/logo.png';
    const empresaName = cacheConfig?.empresaNombre || 'ALLTECH SERVICIOS TÉCNICOS';
    const direccion = cacheConfig?.empresaDireccion || 'Camoapa, Nicaragua';
    const recibidoPor = recepcion.creador?.full_name || recepcion.creador?.name || recepcion.recibido_por || State.get('user')?.name || 'Sistema';

    let logoAbsoluteUrl = logoUrl;
    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
      let basePath = window.location.href;
      logoAbsoluteUrl = basePath.substring(0, basePath.lastIndexOf('/') + 1) + logoUrl;
    }

    const renderTicket = (copyType) => `
      <div style="border: 1px solid #ddd; padding: 25px; border-radius: 8px; page-break-inside: avoid; background-color: #fff; position: relative;">
        <!-- Cabecera de Empresa -->
        <table style="width: 100%; border-bottom: 2px solid #1a73e8; padding-bottom: 15px; margin-bottom: 20px;">
          <tr>
            <td style="width: 120px; text-align: left;">
              ${logoAbsoluteUrl ? `<img src="${logoAbsoluteUrl}" alt="Logo" style="max-height: 60px; object-fit: contain;">` : ''}
            </td>
            <td style="text-align: right; vertical-align: bottom;">
              <h1 style="color: #222; margin: 0; font-size: 20px; text-transform: uppercase;">${empresaName}</h1>
              <p style="color: #666; font-size: 11px; margin-top: 5px;">${direccion} | Tel: <strong>${phone}</strong></p>
              <h2 style="margin: 5px 0 0 0; color: #1a73e8; font-size: 16px;">ORDEN DE RECEPCIÓN: ${titleCode ? titleCode : ''}</h2>
              <p style="font-size: 11px; color: #777; font-weight: bold; margin-top: 5px;">Copia: ${copyType}</p>
            </td>
          </tr>
        </table>

        <!-- Secciones Cliente y Equipo -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 15px;">
          <tr>
            <!-- Datos del Cliente -->
            <td style="width: 48%; padding-right: 10px; vertical-align: top;">
              <h3 style="font-size: 13px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 8px;">1. Datos del Cliente</h3>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Nombre:</strong> ${recepcion.cliente?.nombre_cliente || recepcion.cliente?.nombreCliente || 'N/A'}</p>
              ${recepcion.cliente?.empresa ? `<p style="margin-bottom: 4px; font-size: 12px;"><strong>Empresa:</strong> ${recepcion.cliente.empresa}</p>` : ''}
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Teléfono:</strong> ${recepcion.cliente?.telefono || 'N/A'}</p>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Ingreso:</strong> ${dateRecepcion}</p>
            </td>

            <!-- Datos del Equipo -->
            <td style="width: 48%; padding-left: 10px; vertical-align: top; border-left: 1px solid #eee;">
              <h3 style="font-size: 13px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 8px;">2. Datos del Equipo</h3>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Equipo:</strong> ${recepcion.equipo?.nombre_equipo || recepcion.equipo?.nombreEquipo || 'N/A'}</p>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Marca/Mod:</strong> ${recepcion.equipo?.marca || '-'} / ${recepcion.equipo?.modelo || '-'}</p>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>N° Serie:</strong> ${recepcion.equipo?.numero_serie || recepcion.equipo?.serie || 'N/A'} (Color: ${recepcion.equipo?.color || '-'})</p>
              <p style="margin-bottom: 4px; font-size: 12px;"><strong>Atendido por:</strong> ${recibidoPor}</p>
            </td>
          </tr>
        </table>

         <!-- Detalles del Problema -->
         <h3 style="font-size: 13px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 8px;">3. Detalles de Ingreso</h3>
         
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; border: 1px solid #ddd;">
           <tr>
             <td style="background-color: #f4f6f8; width: 140px; padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Falla Reportada:</td>
             <td style="padding: 8px; border-bottom: 1px solid #ddd; border-left: 1px solid #ddd;">
                <span style="white-space: pre-wrap;">${recepcion.diagnostico_inicial || recepcion.diagnosticoInicial || '-'}</span>
             </td>
           </tr>
           <tr>
             <td style="background-color: #f4f6f8; width: 140px; padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Accesorios:</td>
             <td style="padding: 8px; border-bottom: 1px solid #ddd; border-left: 1px solid #ddd;">${recepcion.accesorios || '-'}</td>
           </tr>
           <tr>
             <td style="background-color: #f4f6f8; width: 140px; padding: 8px; font-weight: bold; vertical-align: top;">Estado Físico:</td>
             <td style="padding: 8px; border-left: 1px solid #ddd; vertical-align: top;">
                <span style="white-space: pre-wrap; color: #555;">${recepcion.notas || '-'}</span>
             </td>
           </tr>
         </table>

        <!-- Firmas -->
        <table style="width: 100%; margin-top: 30px; text-align: center; font-size: 11px;">
            <tr>
                <td style="width: 50%; padding: 0 40px;">
                    <div style="border-top: 1px solid #222; padding-top: 5px; margin-bottom: 2px; font-weight: bold;">Técnico / Recepcionista</div>
                </td>
                <td style="width: 50%; padding: 0 40px;">
                    <div style="border-top: 1px solid #222; padding-top: 5px; margin-bottom: 2px; font-weight: bold;">Firma del Cliente</div>
                </td>
            </tr>
        </table>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <base href="${window.location.href}">
        <title>Recibo Recepción ${titleCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; padding: 40px; color: #333; line-height: 1.5; }
          @media print {
            body { background-color: #fff; padding: 0; }
            .no-print { display: none; }
          }
          .ticket-container { max-width: 800px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 30px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
          <button onclick="window.print()" style="background: #1a73e8; color: white; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px; transition: background 0.2s;">🖨️ IMPRIMIR RECIBO</button>
          <p style="margin-top: 10px; color: #666; font-size: 13px;">Se abrirán 2 copias: una para el cliente y otra para el taller.</p>
        </div>
        
        <div class="ticket-container">
          ${renderTicket('CLIENTE')}
          <div style="margin: 40px 0; border-top: 1px dashed #ccc; position: relative;">
             <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #f9f9f9; padding: 0 10px; color: #999; font-size: 12px;">TIJERAS AQUÍ</span>
          </div>
          ${renderTicket('TALLER')}
        </div>

        <script>
          // Auto imprimir al cargar
          window.onload = () => {
            // setTimeout(() => { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(htmlContent);
    win.document.close();
  };

  const exportPagoPDF = (id) => {
    const r = DataService.getRecepcionById(id);
    if (!r) return;

    const cacheConfig = typeof DataService.getConfig === 'function' ? DataService.getConfig() : null;
    const phone = cacheConfig?.empresaTelefono || '+505 8944 1777';
    const logoUrl = cacheConfig?.empresaLogo || 'assets/logo.png';
    const empresaName = cacheConfig?.empresaNombre || 'ALLTECH SERVICIOS TÉCNICOS';
    const direccion = cacheConfig?.empresaDireccion || 'Camoapa, Nicaragua';

    let logoAbsoluteUrl = logoUrl;
    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
      let basePath = window.location.href;
      logoAbsoluteUrl = basePath.substring(0, basePath.lastIndexOf('/') + 1) + logoUrl;
    }

    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Comprobante de Pago ${r.codigo_recepcion || ''}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; margin-bottom: 20px; }
                    .title { font-size: 24px; color: #1a73e8; margin: 0; }
                    .subtitle { font-size: 14px; color: #666; }
                    .section { margin-bottom: 20px; }
                    .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-size: 16px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { text-align: left; background: #f5f5f5; padding: 10px; border: 1px solid #ddd; }
                    td { padding: 10px; border: 1px solid #ddd; }
                    .total-box { margin-left: auto; width: 250px; margin-top: 20px; }
                    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
                    .grand-total { font-size: 18px; font-weight: bold; color: #1a73e8; border-top: 2px solid #1a73e8; padding-top: 10px; }
                    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${logoAbsoluteUrl ? `<img src="${logoAbsoluteUrl}" style="max-height: 60px;">` : ''}
                    <h1 class="title">${empresaName}</h1>
                    <p class="subtitle">RECIBO DE PAGO TÉCNICO - ${r.codigo_recepcion || r.id}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Datos del Cliente y Equipo</div>
                    <p><strong>Cliente:</strong> ${r.cliente?.nombre_cliente || 'N/A'}</p>
                    <p><strong>Equipo:</strong> ${r.equipo?.nombre_equipo || 'N/A'} (${r.equipo?.marca} ${r.equipo?.modelo})</p>
                    <p><strong>Fecha Entrega:</strong> ${new Date().toLocaleString('es-NI')}</p>
                </div>

                <div class="section">
                    <div class="section-title">Detalle de Cobro</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Mano de Obra / Servicio Técnico</td>
                                <td>1</td>
                                <td>$${parseFloat(r.mano_de_obra || 0).toFixed(2)}</td>
                                <td>$${parseFloat(r.mano_de_obra || 0).toFixed(2)}</td>
                            </tr>
                            ${(r.productos_reparacion || []).map(p => `
                                <tr>
                                    <td>${p.nombre}</td>
                                    <td>${p.cantidad || 1}</td>
                                    <td>$${parseFloat(p.precio || 0).toFixed(2)}</td>
                                    <td>$${((p.precio || 0) * (p.cantidad || 1)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="total-box">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${parseFloat(r.total_reparacion || 0).toFixed(2)}</span>
                    </div>
                    <div class="total-row grand-total">
                        <span>TOTAL PAGADO:</span>
                        <span>$${parseFloat(r.total_reparacion || 0).toFixed(2)}</span>
                    </div>
                </div>

                <div class="footer">
                    <p>¡Gracias por su confianza! Vuelva pronto.</p>
                    <br><br>
                    <div style="display: flex; justify-content: space-around; margin-top: 30px;">
                        <div style="width: 200px; border-top: 1px solid #333;">Firma Autorizada</div>
                        <div style="width: 200px; border-top: 1px solid #333;">Firma Cliente</div>
                    </div>
                </div>
            </body>
            </html>
        `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const exportGlobalReport = () => {
    const recepciones = DataService.getRecepcionesFiltered(filterState);
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Recepciones</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #1a73e8; color: white; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .header { text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>REPORTE DE EQUIPOS RECEPCIONADOS</h1>
                    <p>Total registros: ${recepciones.length}</p>
                    <p>Fecha de reporte: ${new Date().toLocaleString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Equipo</th>
                            <th>Estado</th>
                            <th>Total ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recepciones.map(r => `
                            <tr>
                                <td>${r.codigo_recepcion || r.id}</td>
                                <td>${new Date(r.fecha_recepcion || r.created_at).toLocaleDateString()}</td>
                                <td>${r.cliente?.nombre_cliente || 'N/A'}</td>
                                <td>${r.equipo?.nombre_equipo || 'N/A'}</td>
                                <td>${r.estado}</td>
                                <td>$${parseFloat(r.total_reparacion || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
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
  const handleEstadoFilter = (value) => { filterState.estado = value; App.refreshCurrentModule(); };

  let isSubmitting = false;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    let btn = null;
    let originalText = '';

    try {
      isSubmitting = true;

      btn = event.target.querySelector('button[type="submit"]');
      if (btn) {
        originalText = btn.innerText;
        btn.disabled = true;
        btn.innerHTML = '⏳ Guardando...';
      }

      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());

      if (!data.fechaRecepcion) throw new Error('La fecha de recepción es obligatoria.');
      if (!data.fechaRevisionPosible) throw new Error('Por favor, establezca la Fecha Posible de Revisión.');
      if (!data.diagnosticoCliente || data.diagnosticoCliente.trim() === '') throw new Error('Por favor, ingrese el Diagnóstico / Problema Reportado.');

      if (!data.clienteId) throw new Error('Por favor, busque y seleccione un cliente de la lista, o elija "+ Crear Nuevo Cliente".');
      if (!data.equipoId) throw new Error('Por favor, seleccione un equipo o cree uno nuevo.');

      let finalClienteId = data.clienteId;
      let finalEquipoId = data.equipoId;

      // Si es necesario crear un cliente
      if (finalClienteId === 'NEW') {
        if (!data.nuevoClienteNombre || data.nuevoClienteNombre.trim() === '') throw new Error('Por favor, ingrese el nombre del nuevo cliente.');

        const nuevoClienteData = {
          nombre_cliente: data.nuevoClienteNombre,
          cedula: data.nuevoClienteCedula,
          telefono: data.nuevoClienteTelefono,
          empresa: 'Personal' // O un input para esto
        };
        const cliRes = await DataService.createCliente(nuevoClienteData);
        if (cliRes.error) throw new Error(cliRes.error);
        finalClienteId = cliRes.id || cliRes.clienteId || cliRes.data?.id || cliRes.data?.clienteId;
      }

      // Si es necesario crear un equipo
      if (finalEquipoId === 'NEW') {
        if (!data.nuevoEquipoTipo || data.nuevoEquipoTipo.trim() === '') throw new Error('Por favor, ingrese el tipo de equipo (Ej: Laptop, Impresora).');
        if (!data.nuevoEquipoMarca || data.nuevoEquipoMarca.trim() === '') throw new Error('Por favor, ingrese la marca del equipo.');
        if (!data.nuevoEquipoModelo || data.nuevoEquipoModelo.trim() === '') throw new Error('Por favor, ingrese el modelo del equipo.');

        const nuevoEquipoData = {
          cliente_id: finalClienteId,
          nombre_equipo: data.nuevoEquipoTipo,
          tipo_equipo: data.nuevoEquipoTipo,
          marca: data.nuevoEquipoMarca,
          modelo: data.nuevoEquipoModelo,
          numero_serie: data.nuevoEquipoSerie,
          color: data.nuevoEquipoColor,
          contrasena_equipo: data.nuevoEquipoContrasena,
          estado: 'En Reparación' // Por defecto como va a recepción
        };
        const eqRes = await DataService.createEquipo(nuevoEquipoData);
        finalEquipoId = eqRes.id || eqRes.equipoId || eqRes.data?.id; // createEquipo de data-service no devuelve estandar dict. Pero updatearemos refresh.
        if (!finalEquipoId) { // Fallback get last
          await DataService.refreshData(); // Esto debería hacerse global
          const syncEquipos = DataService.getEquiposSync();
          const justCreatedEq = syncEquipos.find(e => e.serie === data.nuevoEquipoSerie && e.modelo === data.nuevoEquipoModelo);
          finalEquipoId = justCreatedEq?.id;
        }
      }

      const user = State.get('user');
      const payload = {
        cliente_id: finalClienteId,
        equipo_id: finalEquipoId,
        fecha_recepcion: data.fechaRecepcion,
        fecha_posible_revision: data.fechaRevisionPosible,
        diagnostico_inicial: data.diagnosticoCliente,
        contrasena_equipo: data.contrasenaEquipo || '',
        accesorios: data.accesoriosIncluidos,
        notas: data.estadoFisico ? `Estado Físico: ${data.estadoFisico} ` : '',
        estado: data.estado || 'Recibido',
        creado_por: user?.id || null
      };

      console.log('🟡 Recepcion payload:', JSON.stringify(payload));
      console.log('🟡 finalClienteId:', finalClienteId, 'finalEquipoId:', finalEquipoId);

      if (data.recepcionId && data.recepcionId.trim() !== '') {
        await DataService.updateRecepcion(data.recepcionId, payload);
        await DataService.refreshData(); // Forza la cache local actual a refrescar
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Recepción actualizada', 'success');
        }
      } else {
        const newRes = await DataService.createRecepcion(payload);
        await DataService.refreshData(); // Forza sync inmediata desde Supabase a memoria local

        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Recepción registrada', 'success');
        }

        const generatedId = newRes?.id || newRes?.recepcionId || newRes?.data?.id;
        if (generatedId && typeof exportRecepcionPDF === 'function') {
          // Usar setTimeout pequeño asegura que el ciclo de JS asigne la caché de refreshData antes del PDF.
          setTimeout(() => { exportRecepcionPDF(generatedId); }, 100);
        }
      }

      closeModal();
      App.refreshCurrentModule();

    } catch (error) {
      console.error('❌ Error fatal al guardar recepción:', error);
      alert('Error al guardar: ' + (error.message || error.toString() || 'Error desconocido'));
    } finally {
      isSubmitting = false;
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    }
  };

  const openCreateModal = (initData = null) => {
    document.getElementById('recepcionModal').innerHTML = renderFormModal(initData);
    setTimeout(() => {
      initAccesorios();
      if (initData && initData.clienteId) {
        const ci = document.getElementById('clienteId');
        const csearch = document.getElementById('clienteSearchInput');
        if (ci && csearch) {
          // It was rendered with the given variables, but onClienteChange is needed
          ci.value = initData.clienteId;
          const c = DataService.getClienteById(initData.clienteId);
          if (c) {
            csearch.value = `${c.codigo_cliente || c.codigoCliente || c.id || c.clienteId} - ${c.nombre_cliente || c.nombreCliente || c.empresa} `;
          }
          if (initData.equipoId) {
            document.getElementById('equipoId').setAttribute('data-selected-val', initData.equipoId);
          }
          onClienteChange();
        }
      }
    }, 50);
  };

  const openEditModal = (id) => {
    const recepcion = DataService.getRecepcionById(id);
    if (!recepcion) return;
    document.getElementById('recepcionModal').innerHTML = renderFormModal(recepcion);
    setTimeout(() => {
      initAccesorios();
      const ci = document.getElementById('clienteId');
      const csearch = document.getElementById('clienteSearchInput');
      if (ci && ci.value) {
        // Restore text input from existing val
        const c = DataService.getClienteById(ci.value);
        if (c) csearch.value = `${c.codigo_cliente || c.codigoCliente || c.id || c.clienteId} - ${c.nombre_cliente || c.nombreCliente || c.empresa} `;
        document.getElementById('equipoId').setAttribute('data-selected-val', recepcion.equipoId || recepcion.equipo_id);
        onClienteChange();
      }
    }, 50);

    // Trigger onchange to validate
    setTimeout(() => {
      onClienteChange();
    }, 100);
  };

  const viewDetail = (id) => {
    const recepcion = DataService.getRecepcionById(id);
    if (!recepcion) return;
    document.getElementById('recepcionModal').innerHTML = renderDetailModal(recepcion);
  };

  const deleteRecepcion = async (id) => {
    if (confirm('¿Está seguro de eliminar este registro de recepción? Esta acción no se puede deshacer.')) {
      try {
        await DataService.deleteRecepcion(id);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Recepción eliminada', 'success');
        }
        App.refreshCurrentModule();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  const closeModal = () => {
    document.getElementById('recepcionModal').innerHTML = '';
  };


  const initAccesorios = () => {
    const valEl = document.getElementById('accesoriosIncluidosValue');
    if (!valEl) return;
    const container = document.getElementById('accesoriosContainer');
    if (!container) return;
    container.innerHTML = '';
    const items = valEl.value.split('\n').filter(i => i.trim() !== '');
    if (items.length === 0) {
      addAccesorioInput('');
    } else {
      items.forEach(i => addAccesorioInput(i));
    }
  };

  const addAccesorioInput = (val = '') => {
    const container = document.getElementById('accesoriosContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.innerHTML = `
  < input type = "text" class="form-input acc-inp" value = "${val}" placeholder = "Ej: Cargador original..." oninput = "RecepcionesModule.updateAccesoriosValue()" style = "flex: 1; padding: 6px 12px; font-size: 0.9rem;" >
    <button type="button" class="btn btn--danger btn--icon" onclick="this.parentElement.remove(); RecepcionesModule.updateAccesoriosValue()" style="padding: 6px; min-width: 32px; height: 32px;" title="Remover">${Icons.trash2 || 'X'}</button>
`;
    container.appendChild(div);

    // focus the new input
    const newInp = div.querySelector('input');
    if (newInp && val === '') newInp.focus();
  };

  const updateAccesoriosValue = () => {
    const inputs = document.querySelectorAll('.acc-inp');
    const vals = Array.from(inputs).map(i => i.value).filter(v => v.trim() !== '');
    const valEl = document.getElementById('accesoriosIncluidosValue');
    if (valEl) valEl.value = vals.join('\n');
  };

  const addPatternNode = (n) => {
    const pwdInp = document.getElementById('nuevoEquipoContrasena');
    if (!pwdInp) return;
    if (pwdInp.value.length > 0 && !pwdInp.value.includes('-')) {
      // If it was standard text, reset
      pwdInp.value = '';
    }
    if (pwdInp.value !== '') {
      pwdInp.value += '-' + n;
    } else {
      pwdInp.value = n;
    }
  };

  const clearPattern = () => {
    const pwdInp = document.getElementById('nuevoEquipoContrasena');
    if (pwdInp) pwdInp.value = '';
  };

  // Override openEditModal and openCreateModal wrapper to init accesorios
  const _oldOpenCreate = openCreateModal;
  const _oldOpenEdit = openEditModal;


  const showClientesList = () => {
    const list = document.getElementById('clientesList');
    if (list) {
      list.style.display = 'block';
      const input = document.getElementById('clienteSearchInput');
      if (input) input.select();
      const items = document.querySelectorAll('.cliente-item');
      items.forEach(item => { item.style.display = 'block'; });
    }
  };

  const filterClientesList = (val) => {
    const list = document.getElementById('clientesList');
    if (list) list.style.display = 'block';
    const items = document.querySelectorAll('.cliente-item');
    const lowerVal = val.toLowerCase();
    items.forEach(item => {
      if (item.getAttribute('data-name').includes(lowerVal)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  };

  const selectClienteInline = (id, label) => {
    const searchInput = document.getElementById('clienteSearchInput');
    const hiddenInput = document.getElementById('clienteId');
    const list = document.getElementById('clientesList');

    if (searchInput && hiddenInput && list) {
      searchInput.value = label;
      hiddenInput.value = id;
      list.style.display = 'none';

      // Trigger change
      onClienteChange();
    }
  };

  // Close dropdowns on outside click
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const list = document.getElementById('clientesList');
      const searchInput = document.getElementById('clienteSearchInput');
      if (list && searchInput && e.target !== list && e.target !== searchInput && !list.contains(e.target)) {
        list.style.display = 'none';
      }
    });
  }

  const toggleViewMode = (mode) => {
    filterState.viewMode = mode;
    App.refreshCurrentModule();
  };

  return {
    initAccesorios, addAccesorioInput, updateAccesoriosValue, addPatternNode, clearPattern, toggleViewMode,

    render,
    openCreateModal,
    openEditModal,
    viewDetail,
    closeModal,
    handleSubmit,
    deleteRecepcion,
    handleSearch,
    handleEstadoFilter,
    exportRecepcionPDF,
    onClienteChange,
    onEquipoChange,
    showClientesList,
    filterClientesList,
    selectClienteInline,
    openChangeStatusModal,
    handleStatusChange,
    onStatusChangeInModal,
    searchProducts,
    addProductToReparacion,
    removeProductFromReparacion,
    calculateTotalReparacion,
    exportPagoPDF,
    exportGlobalReport
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RecepcionesModule;
}
