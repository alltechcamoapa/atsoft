/**
 * ALLTECH - Equipos Module
 * Equipment inventory with repair history CRUD and PDF generation
 */

const EquiposModule = (() => {
  let filterState = { search: '', estado: 'all', clienteId: 'all' };

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
                       value="${filterState.search}"
                       onkeyup="EquiposModule.handleSearch(this.value)">
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
            </div>
          </div>
        </div>

        <!-- Equipment Grid -->
        <div class="equipment-grid">
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

    return equipos.map(equipo => {
      const cliente = DataService.getClienteById(equipo.clienteId);
      const reparaciones = DataService.getReparacionesByEquipo(equipo.equipoId);
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
                <span class="font-medium">${equipo.serie}</span>
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

    return `
      <div class="modal-overlay open" onclick="EquiposModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
            <button class="modal__close" onclick="EquiposModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="EquiposModule.handleSubmit(event)">
            <input type="hidden" name="equipoId" value="${equipo?.equipoId || ''}">
            
            <div class="form-group">
              <label class="form-label form-label--required">Cliente</label>
              <select name="clienteId" class="form-select" required>
                <option value="">Seleccionar cliente...</option>
                ${clientes.map(c => `
                  <option value="${c.clienteId}" ${equipo?.clienteId === c.clienteId ? 'selected' : ''}>
                    ${c.empresa} - ${c.nombreCliente}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Nombre del Equipo</label>
              <input type="text" name="nombreEquipo" class="form-input" 
                     value="${equipo?.nombreEquipo || ''}" 
                     placeholder="Ej: Servidor Principal" required>
            </div>
            
            <div class="form-group">
                <label class="form-label form-label--required">Tipo de Equipo</label>
                <input type="text" name="tipoEquipo" class="form-input" list="tipoEquipoList"
                       value="${equipo?.tipoEquipo || ''}" 
                       placeholder="Ej: Laptop, PC, Servidor..." required>
                <datalist id="tipoEquipoList">
                    <option value="Laptop">
                    <option value="Computadora">
                    <option value="Servidor">
                    <option value="Impresora">
                    <option value="Router">
                    <option value="Switch">
                    <option value="Firewall">
                    <option value="UPS">
                    <option value="NAS">
                    <option value="Otro">
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
                       value="${equipo?.serie || ''}" placeholder="Ej: SRV-2024-001" required>
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
    const reparaciones = DataService.getReparacionesByEquipo(equipo.equipoId);

    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'equipos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'equipos', 'delete');

    return `
      <div class="modal-overlay open" onclick="EquiposModule.closeModal(event)">
        <div class="modal modal--xl" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">${equipo.nombreEquipo}</h3>
              <p class="text-sm text-muted">${equipo.marca} ${equipo.modelo} | Serie: ${equipo.serie}</p>
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
                <h4>Historial de Reparaciones (${reparaciones.length})</h4>
                <div class="repair-history-actions">
                  <button class="btn btn--secondary btn--sm" onclick="EquiposModule.exportEquipoPDF('${equipo.equipoId}')">
                    ${Icons.fileText} Exportar PDF
                  </button>
                  ${canUpdate ? `
                  <button class="btn btn--primary btn--sm" onclick="EquiposModule.openReparacionModal('${equipo.equipoId}')">
                    ${Icons.plus} Nueva Reparación
                  </button>
                  ` : ''}
                </div>
              </div>
              
              ${reparaciones.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción del Problema</th>
                      <th>Trabajo Realizado</th>
                      <th>Técnico</th>
                      <th>Costo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${reparaciones.map(r => `
                      <tr>
                        <td>${new Date(r.fecha).toLocaleDateString('es-NI')}</td>
                        <td style="max-width: 200px;">${r.problema}</td>
                        <td style="max-width: 200px;">${r.trabajoRealizado}</td>
                        <td>${r.tecnico}</td>
                        <td>${r.costo > 0 ? `$${r.costo.toFixed(2)}` : 'Garantía'}</td>
                        <td>
                          <div class="flex gap-xs">
                            ${canUpdate ? `
                            <button class="btn btn--ghost btn--icon btn--sm" 
                                    onclick="EquiposModule.openEditReparacion('${equipo.equipoId}', '${r.reparacionId}')"
                                    title="Editar">
                              ${Icons.edit}
                            </button>
                            ` : ''}
                            ${canDelete ? `
                            <button class="btn btn--ghost btn--icon btn--sm" 
                                    onclick="EquiposModule.deleteReparacion('${r.reparacionId}')"
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
              ` : `
                <div class="empty-state empty-state--compact">
                  <p class="text-muted">No hay reparaciones registradas para este equipo.</p>
                  ${canUpdate ? `
                  <button class="btn btn--primary btn--sm" onclick="EquiposModule.openReparacionModal('${equipo.equipoId}')">
                    ${Icons.plus} Registrar Primera Reparación
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
      <div class="modal-overlay open" onclick="EquiposModule.closeReparacionModal(event)">
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
  const handleSearch = (value) => { filterState.search = value; App.refreshCurrentModule(); };
  const handleClienteFilter = (value) => { filterState.clienteId = value; App.refreshCurrentModule(); };
  const handleEstadoFilter = (value) => { filterState.estado = value; App.refreshCurrentModule(); };

  let isSubmitting = false; // Flag para prevenir doble submit

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
      if (!tipo) return 'Equipo General';
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
      return dict[tipo.toUpperCase().trim()] || 'Otro';
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

  return {
    render, openCreateModal, openEditModal, viewDetail, closeModal,
    handleSearch, handleClienteFilter, handleEstadoFilter, handleSubmit,
    openReparacionModal, openEditReparacion, closeReparacionModal, deleteReparacion,
    handleReparacionSubmit, exportEquipoPDF, exportGeneralPDF, viewClientDetail, deleteEquipo
  };
})();
