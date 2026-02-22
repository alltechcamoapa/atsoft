/**
 * ALLTECH - Contratos Module
 * Contract management with PDF reports of repaired equipment
 */

const ContratosModule = (() => {
  let filterState = { search: '', status: 'all', tipo: 'all' };

  const render = () => {
    const contratos = DataService.getContratosFiltered(filterState);
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'contratos', 'create');

    return `
      <div class="module-container">
        <!-- Module Header -->
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Gestión de Contratos</h2>
            <p class="module-subtitle">${contratos.length} contratos registrados</p>
          </div>
          <div class="module-header__right">
            <button class="btn btn--secondary" onclick="ContractEditorModule.openTemplatesList()" style="margin-right: var(--spacing-sm);">
              ${Icons.fileText} Plantillas
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="ContratosModule.openCreateModal()">
              ${Icons.plus} Nuevo Contrato
            </button>
            ` : ''}
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="module-stats">
          ${renderStats()}
        </div>

        <!-- Filters -->
        <div class="module-filters card">
          <div class="card__body">
            <div class="filters-row">
              <div class="search-input" style="flex: 1; max-width: 300px;">
                <span class="search-input__icon">${Icons.search}</span>
                <input type="text" 
                       class="form-input" 
                       placeholder="Buscar contrato..." 
                       value="${filterState.search}"
                       onkeyup="ContratosModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 150px;" 
                      onchange="ContratosModule.handleStatusFilter(this.value)">
                <option value="all">Todos</option>
                <option value="Activo" ${filterState.status === 'Activo' ? 'selected' : ''}>Activos</option>
                <option value="Vencido" ${filterState.status === 'Vencido' ? 'selected' : ''}>Vencidos</option>
                <option value="Cancelado" ${filterState.status === 'Cancelado' ? 'selected' : ''}>Cancelados</option>
              </select>
              <select class="form-select" style="width: 150px;" 
                      onchange="ContratosModule.handleTipoFilter(this.value)">
                <option value="all">Todos los tipos</option>
                <option value="Mensual" ${filterState.tipo === 'Mensual' ? 'selected' : ''}>Mensual</option>
                <option value="Anual" ${filterState.tipo === 'Anual' ? 'selected' : ''}>Anual</option>
                <option value="Soporte por horas" ${filterState.tipo === 'Soporte por horas' ? 'selected' : ''}>Por horas</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Contracts Table -->
        <div class="card">
          <div class="card__body" style="padding: 0;">
            ${contratos.length > 0 ? renderTable(contratos) : renderEmptyState()}
          </div>
        </div>
      </div>

      <div id="contratoModal"></div>
    `;
  };

  const renderStats = () => {
    const stats = DataService.getContratosStats();
    return `
      <div class="stat-card stat-card--success">
        <div class="stat-card__icon">${Icons.checkCircle}</div>
        <span class="stat-card__label">Activos</span>
        <span class="stat-card__value">${stats.activos}</span>
      </div>
      <div class="stat-card stat-card--warning">
        <div class="stat-card__icon">${Icons.alertCircle}</div>
        <span class="stat-card__label">Por Vencer</span>
        <span class="stat-card__value">${stats.porVencer}</span>
      </div>
      <div class="stat-card stat-card--info">
        <div class="stat-card__icon">${Icons.wallet}</div>
        <span class="stat-card__label">Ingresos Mensuales</span>
        <span class="stat-card__value">$${stats.ingresosMensuales.toFixed(2)}</span>
      </div>
    `;
  };

  const renderTable = (contratos) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'contratos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'contratos', 'delete');

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Contrato</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Tarifa</th>
            <th>Vigencia</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${contratos.map(contrato => {
      const cliente = DataService.getClienteById(contrato.clienteId);
      return `
              <tr>
                <td><span class="font-medium">${contrato.contratoId}</span></td>
                <td>
                  <div>
                    <div class="font-medium">${cliente?.empresa || 'N/A'}</div>
                    <div class="text-xs text-muted">${cliente?.nombreCliente || ''}</div>
                  </div>
                </td>
                <td>
                  <span class="badge badge--primary">${contrato.tipoContrato}</span>
                </td>
                <td>
                  <span class="font-medium">${contrato.moneda === 'USD' ? '$' : 'C$'}${contrato.tarifa.toFixed(2)}</span>
                  <span class="text-xs text-muted">/${contrato.tipoContrato === 'Mensual' ? 'mes' : contrato.tipoContrato === 'Anual' ? 'año' : 'hr'}</span>
                </td>
                <td>
                  <div class="text-sm">${new Date(contrato.fechaInicio).toLocaleDateString('es-NI')}</div>
                  <div class="text-xs text-muted">${new Date(contrato.fechaFin).toLocaleDateString('es-NI')}</div>
                </td>
                <td>
                  <span class="badge ${contrato.estadoContrato === 'Activo' ? 'badge--success' : contrato.estadoContrato === 'Vencido' ? 'badge--warning' : 'badge--danger'}">
                    ${contrato.estadoContrato}
                  </span>
                </td>
                <td>
                  <div class="flex gap-xs">
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="ContratosModule.viewDetail('${contrato.contratoId}')"
                            title="Ver detalle">
                      ${Icons.eye}
                    </button>
                    ${canUpdate ? `
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="ContratosModule.openEditModal('${contrato.contratoId}')"
                            title="Editar">
                      ${Icons.edit}
                    </button>
                    ` : ''}
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="ContratosModule.openReportModal('${contrato.contratoId}')"
                            title="Generar Reporte PDF">
                      ${Icons.fileText}
                    </button>
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="ContractEditorModule.selectTemplateToPrint('${contrato.contratoId}')"
                            title="Imprimir Contrato">
                      ${Icons.printer}
                    </button>
                    ${(contrato.estadoContrato === 'Vencido' && canUpdate) ? `
                      <button class="btn btn--ghost btn--icon btn--sm text-success" 
                              onclick="ContratosModule.renovarContrato('${contrato.contratoId}')"
                              title="Renovar">
                        ${Icons.plus}
                      </button>
                    ` : ''}
                    ${canDelete ? `
                      <button class="btn btn--ghost btn--icon btn--sm text-danger" 
                              onclick="ContratosModule.deleteContrato('${contrato.contratoId}')"
                              title="Eliminar">
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
    const canCreate = DataService.canPerformAction(user.role, 'contratos', 'create');

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.fileText}</div>
        <h3 class="empty-state__title">No hay contratos</h3>
        <p class="empty-state__description">Comienza creando un nuevo contrato.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="ContratosModule.openCreateModal()">
          ${Icons.plus} Nuevo Contrato
        </button>
        ` : ''}
      </div>
    `;
  };

  const renderFormModal = (contrato = null) => {
    const isEdit = contrato !== null;
    const clientes = DataService.getClientesSync();

    return `
      <div class="modal-overlay open" onclick="ContratosModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Contrato' : 'Nuevo Contrato'}</h3>
            <button class="modal__close" onclick="ContratosModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="ContratosModule.handleSubmit(event)">
            <input type="hidden" name="contratoId" value="${contrato?.contratoId || ''}">
            
            <div class="form-group">
              <label class="form-label form-label--required">Cliente</label>
              <select name="clienteId" class="form-select" required>
                <option value="">Seleccionar cliente...</option>
                ${clientes.map(c => `
                  <option value="${c.clienteId}" ${contrato?.clienteId === c.clienteId ? 'selected' : ''}>
                    ${c.empresa} - ${c.nombreCliente}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Tipo de Contrato</label>
                <select name="tipoContrato" class="form-select" required>
                  <option value="Mensual" ${contrato?.tipoContrato === 'Mensual' ? 'selected' : ''}>Mensual</option>
                  <option value="Anual" ${contrato?.tipoContrato === 'Anual' ? 'selected' : ''}>Anual</option>
                  <option value="Soporte por horas" ${contrato?.tipoContrato === 'Soporte por horas' ? 'selected' : ''}>Soporte por horas</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Estado</label>
                <select name="estadoContrato" class="form-select" required>
                  <option value="Activo" ${(!contrato || contrato?.estadoContrato === 'Activo') ? 'selected' : ''}>Activo</option>
                  <option value="Vencido" ${contrato?.estadoContrato === 'Vencido' ? 'selected' : ''}>Vencido</option>
                  <option value="Cancelado" ${contrato?.estadoContrato === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Tarifa</label>
                <div class="input-group">
                  <input type="number" 
                         name="tarifa" 
                         class="form-input" 
                         value="${contrato?.tarifa || ''}"
                         step="0.01"
                         min="0"
                         required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Moneda</label>
                <select name="moneda" class="form-select" required>
                  <option value="USD" ${(!contrato || contrato?.moneda === 'USD') ? 'selected' : ''}>USD ($)</option>
                  <option value="NIO" ${contrato?.moneda === 'NIO' ? 'selected' : ''}>NIO (C$)</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Fecha Inicio</label>
                <input type="date" 
                       name="fechaInicio" 
                       class="form-input" 
                       value="${contrato?.fechaInicio || ''}"
                       required>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Fecha Fin</label>
                <input type="date" 
                       name="fechaFin" 
                       class="form-input" 
                       value="${contrato?.fechaFin || ''}"
                       required>
              </div>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="ContratosModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Crear Contrato'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (contrato) => {
    const cliente = DataService.getClienteById(contrato.clienteId);
    const visitas = DataService.getVisitasByContrato(contrato.contratoId);
    const equipos = DataService.getEquiposByCliente(contrato.clienteId);
    const reparaciones = equipos.flatMap(e =>
      DataService.getReparacionesByEquipo(e.equipoId).map(r => ({ ...r, equipo: e }))
    ).filter(r => {
      const fecha = new Date(r.fecha);
      return fecha >= new Date(contrato.fechaInicio) && fecha <= new Date(contrato.fechaFin);
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return `
      <div class="modal-overlay open" onclick="ContratosModule.closeModal(event)">
        <div class="modal modal--xl" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">Contrato ${contrato.contratoId}</h3>
              <p class="text-sm text-muted">${cliente?.empresa || 'Cliente no encontrado'}</p>
            </div>
            <button class="modal__close" onclick="ContratosModule.closeModal()">${Icons.x}</button>
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
                <div class="detail-item__label">Tipo de Contrato</div>
                <div class="detail-item__value">${contrato.tipoContrato}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Tarifa</div>
                <div class="detail-item__value">${contrato.moneda === 'USD' ? '$' : 'C$'}${contrato.tarifa.toFixed(2)}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Fecha Inicio</div>
                <div class="detail-item__value">${new Date(contrato.fechaInicio).toLocaleDateString('es-NI')}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Fecha Fin</div>
                <div class="detail-item__value">${new Date(contrato.fechaFin).toLocaleDateString('es-NI')}</div>
              </div>
              <div class="detail-item detail-item--full">
                <div class="detail-item__label">Estado</div>
                <div class="detail-item__value">
                  <span class="badge ${contrato.estadoContrato === 'Activo' ? 'badge--success' : contrato.estadoContrato === 'Vencido' ? 'badge--warning' : 'badge--danger'}">
                    ${contrato.estadoContrato}
                  </span>
                </div>
              </div>
            </div>

            <!-- Visits Section -->
            <div class="contract-section">
              <div class="contract-section__header">
                <h4>Visitas del Contrato (${visitas.length})</h4>
              </div>
              ${visitas.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr><th>Fecha</th><th>Tipo</th><th>Equipo</th><th>Trabajo</th><th>Estado</th></tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${visitas.map(v => {
      const eq = v.equipoId ? DataService.getEquipoById(v.equipoId) : null;
      return `
                        <tr>
                          <td>${new Date(v.fechaInicio).toLocaleDateString('es-NI')}</td>
                          <td>${v.tipoVisita}</td>
                          <td>${eq ? eq.nombreEquipo : '-'}</td>
                          <td>${v.descripcionTrabajo}</td>
                          <td><span class="badge ${v.trabajoRealizado ? 'badge--success' : 'badge--warning'}">${v.trabajoRealizado ? 'Completado' : 'Pendiente'}</span></td>
                        </tr>
                      `;
    }).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-muted">No hay visitas registradas para este contrato.</p>'}
            </div>

            <!-- Repairs Section -->
            <div class="contract-section">
              <div class="contract-section__header">
                <h4>Equipos Reparados en Vigencia (${reparaciones.length})</h4>
              </div>
              ${reparaciones.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr><th>Fecha</th><th>Equipo</th><th>Problema</th><th>Trabajo Realizado</th><th>Técnico</th><th>Costo</th></tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${reparaciones.map(r => `
                      <tr>
                        <td>${new Date(r.fecha).toLocaleDateString('es-NI')}</td>
                        <td>${r.equipo.nombreEquipo}</td>
                        <td>${r.problema}</td>
                        <td>${r.trabajoRealizado}</td>
                        <td>${r.tecnico}</td>
                        <td>${r.costo > 0 ? '$' + r.costo.toFixed(2) : 'Garantía'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-muted">No hay reparaciones registradas durante la vigencia del contrato.</p>'}
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="ContratosModule.closeModal()">Cerrar</button>
            <button class="btn btn--secondary" onclick="ContratosModule.openReportModal('${contrato.contratoId}')">${Icons.fileText} Generar PDF</button>
            <button class="btn btn--primary" onclick="ContratosModule.openEditModal('${contrato.contratoId}')">${Icons.edit} Editar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ========== REPORT MODAL ==========
  const renderReportModal = (contratoId) => {
    const contrato = DataService.getContratoById(contratoId);
    const cliente = DataService.getClienteById(contrato?.clienteId);

    return `
      <div class="modal-overlay open" onclick="ContratosModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${Icons.fileText} Reporte de Contrato</h3>
            <button class="modal__close" onclick="ContratosModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="ContratosModule.generateReport(event, '${contratoId}')">
            <div class="form-group">
              <label class="form-label">Contrato</label>
              <input type="text" class="form-input" value="${contrato?.contratoId} - ${cliente?.empresa}" disabled>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha Inicio (filtro)</label>
                <input type="date" name="fechaInicio" class="form-input" value="${contrato?.fechaInicio || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Fecha Fin (filtro)</label>
                <input type="date" name="fechaFin" class="form-input" value="${contrato?.fechaFin || ''}">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Contenido del Reporte</label>
              <div class="form-checkboxes">
                <label class="toggle">
                  <input type="checkbox" name="incluirVisitas" class="toggle__input" checked>
                  <span class="toggle__track"><span class="toggle__thumb"></span></span>
                  <span class="toggle__label">Incluir visitas de servicio</span>
                </label>
                <label class="toggle">
                  <input type="checkbox" name="incluirReparaciones" class="toggle__input" checked>
                  <span class="toggle__track"><span class="toggle__thumb"></span></span>
                  <span class="toggle__label">Incluir reparaciones de equipos</span>
                </label>
                <label class="toggle">
                  <input type="checkbox" name="incluirEquipos" class="toggle__input" checked>
                  <span class="toggle__track"><span class="toggle__thumb"></span></span>
                  <span class="toggle__label">Incluir listado de equipos</span>
                </label>
              </div>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="ContratosModule.sendReport('whatsapp', '${contratoId}')" title="Enviar por WhatsApp">
                ${Icons.messageCircle} WhatsApp
              </button>
              <button type="button" class="btn btn--secondary" onclick="ContratosModule.sendReport('email', '${contratoId}')" title="Enviar por Email">
                ${Icons.mail} Email
              </button>
              <button type="button" class="btn btn--secondary" onclick="ContratosModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${Icons.fileText} Generar PDF</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  // ========== PDF GENERATION ==========
  const generateReport = (event, contratoId) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const options = {
      fechaInicio: formData.get('fechaInicio'),
      fechaFin: formData.get('fechaFin'),
      incluirVisitas: formData.has('incluirVisitas'),
      incluirReparaciones: formData.has('incluirReparaciones'),
      incluirEquipos: formData.has('incluirEquipos')
    };

    const contrato = DataService.getContratoById(contratoId);
    const cliente = DataService.getClienteById(contrato.clienteId);
    const equipos = DataService.getEquiposByCliente(contrato.clienteId);

    // Filter visits by date
    let visitas = DataService.getVisitasByContrato(contratoId);
    if (options.fechaInicio) {
      visitas = visitas.filter(v => new Date(v.fechaInicio) >= new Date(options.fechaInicio));
    }
    if (options.fechaFin) {
      visitas = visitas.filter(v => new Date(v.fechaInicio) <= new Date(options.fechaFin + 'T23:59:59'));
    }

    // Filter repairs by date
    let reparaciones = equipos.flatMap(e =>
      DataService.getReparacionesByEquipo(e.equipoId).map(r => ({ ...r, equipo: e }))
    );
    if (options.fechaInicio) {
      reparaciones = reparaciones.filter(r => new Date(r.fecha) >= new Date(options.fechaInicio));
    }
    if (options.fechaFin) {
      reparaciones = reparaciones.filter(r => new Date(r.fecha) <= new Date(options.fechaFin + 'T23:59:59'));
    }
    reparaciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
        <h1>${companyConfig.name} - Reporte de Contrato</h1>
        <p>${contrato.contratoId} - ${cliente?.empresa || 'Cliente'}</p>
        <p>Período: ${options.fechaInicio || contrato.fechaInicio} a ${options.fechaFin || contrato.fechaFin}</p>
      </div>
      
      <div class="section">
        <div class="section-title">Información del Contrato</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Cliente</div>
            <div class="info-value">${cliente?.nombreCliente || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Empresa</div>
            <div class="info-value">${cliente?.empresa || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Tipo</div>
            <div class="info-value">${contrato.tipoContrato}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Tarifa</div>
            <div class="info-value">${contrato.moneda === 'USD' ? '$' : 'C$'}${contrato.tarifa.toFixed(2)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Vigencia</div>
            <div class="info-value">${new Date(contrato.fechaInicio).toLocaleDateString('es-NI')} - ${new Date(contrato.fechaFin).toLocaleDateString('es-NI')}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Estado</div>
            <div class="info-value"><span class="badge badge-${contrato.estadoContrato === 'Activo' ? 'success' : 'warning'}">${contrato.estadoContrato}</span></div>
          </div>
        </div>
      </div>
      
      ${options.incluirVisitas ? `
        <div class="section">
          <div class="section-title">Visitas de Servicio (${visitas.length})</div>
          ${visitas.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Equipo</th>
                  <th>Trabajo</th>
                  <th>Técnico</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${visitas.map(v => {
      const eq = v.equipoId ? DataService.getEquipoById(v.equipoId) : null;
      return `
                    <tr>
                      <td>${new Date(v.fechaInicio).toLocaleDateString('es-NI')}</td>
                      <td>${v.tipoVisita}</td>
                      <td>${eq ? eq.nombreEquipo : '-'}</td>
                      <td>${v.descripcionTrabajo}</td>
                      <td>${ (() => {
                      const t = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === v.usuarioSoporte) : null;
                      return t ? (t.name || t.username) : (v.usuarioSoporte || 'N/A');
                  })() }</td>
                      <td><span class="badge badge-${v.trabajoRealizado ? 'success' : 'warning'}">${v.trabajoRealizado ? 'Completado' : 'Pendiente'}</span></td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          ` : '<p>No hay visitas en el período seleccionado.</p>'}
        </div>
      ` : ''}
      
      ${options.incluirReparaciones ? `
        <div class="section">
          <div class="section-title">Reparaciones de Equipos (${reparaciones.length})</div>
          ${reparaciones.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
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
                    <td>${r.equipo.nombreEquipo}</td>
                    <td>${r.problema}</td>
                    <td>${r.trabajoRealizado}</td>
                    <td>${r.tecnico}</td>
                    <td>${r.costo > 0 ? '$' + r.costo.toFixed(2) : 'Garantía'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-top: 10px; text-align: right;">
              <strong>Costo Total Reparaciones: $${reparaciones.reduce((s, r) => s + (r.costo || 0), 0).toFixed(2)}</strong>
            </div>
          ` : '<p>No hay reparaciones en el período seleccionado.</p>'}
        </div>
      ` : ''}
      
      ${options.incluirEquipos ? `
        <div class="section">
          <div class="section-title">Equipos del Cliente (${equipos.length})</div>
          ${equipos.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Marca/Modelo</th>
                  <th>Serie</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${equipos.map(e => `
                  <tr>
                    <td>${e.nombreEquipo}</td>
                    <td>${e.marca} ${e.modelo}</td>
                    <td>${e.serie}</td>
                    <td>${e.ubicacion || 'N/A'}</td>
                    <td><span class="badge badge-${e.estado === 'Operativo' ? 'success' : 'warning'}">${e.estado}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p>No hay equipos registrados para este cliente.</p>'}
        </div>
      ` : ''}
    `;

    const htmlContent = generatePDFContent(`Contrato ${contrato.contratoId}`, content);
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
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
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
        <div class="footer">
          <p>${companyConfig.name || 'ALLTECH'} - Sistema de Gestión Empresarial</p>
          <p>Generado el: ${new Date().toLocaleString('es-NI')}</p>
        </div>
      </body>
      </html>
    `;
  };

  const sendReport = async (type, contratoId) => {
    const contrato = DataService.getContratoById(contratoId);
    const cliente = DataService.getClienteById(contrato?.clienteId);

    if (!cliente) return alert('Cliente no encontrado');

    const message = `Hola ${cliente.nombreCliente}, adjunto reporte del contrato ${contratoId}.`;

    if (type === 'whatsapp') {
      const phone = cliente.telefono || prompt('Ingrese el teléfono del cliente:');
      if (phone) {
        if (confirm(`¿Enviar reporte a ${phone} por WhatsApp ? `)) {
          const result = await WhatsAppService.sendMessage(phone, message);
          if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
            NotificationService.showToast('Mensaje de WhatsApp enviado', 'success');
          } else {
            alert('Mensaje de WhatsApp enviado');
          }
        }
      }
    } else if (type === 'email') {
      const email = cliente.correo || prompt('Ingrese el correo del cliente:');
      if (email) {
        if (confirm(`¿Enviar reporte a ${email} por Email ? `)) {
          const result = await EmailService.sendEmail(email, `Reporte Contrato ${contratoId} `, message);
          if (result.success) {
            if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
              NotificationService.showToast('Email enviado correctamente', 'success');
            } else {
              alert('Email enviado correctamente');
            }
          } else {
            alert('Error enviando Email: ' + result.error);
          }
        }
      }
    }
  };

  const deleteContrato = async (id) => {
    if (confirm('¿Estás seguro de eliminar este contrato? Esta acción no se puede deshacer.')) {
      try {
        await DataService.deleteContrato(id);
        if (typeof NotificationService !== 'undefined' && NotificationService.showToast) {
          NotificationService.showToast('Contrato eliminado', 'success');
        }
        console.log('✅ Contrato eliminado correctamente');
        App.refreshCurrentModule();
      } catch (error) {
        console.error('❌ Error al eliminar contrato:', error);
        alert('No se pudo eliminar el contrato: ' + (error.message || 'Error desconocido'));
      }
    }
  };

  // ========== EVENT HANDLERS ==========
  const handleSearch = (value) => { filterState.search = value; App.refreshCurrentModule(); };
  const handleStatusFilter = (value) => { filterState.status = value; App.refreshCurrentModule(); };
  const handleTipoFilter = (value) => { filterState.tipo = value; App.refreshCurrentModule(); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const rawData = Object.fromEntries(formData.entries());

    // Obtener el cliente correspondiente para usar el UUID
    const cliente = DataService.getClienteById(rawData.clienteId);

    // Mapear camelCase (UI) a snake_case (DB)
    const data = {
      cliente_id: cliente?.id || rawData.clienteId,  // Usar UUID de Supabase
      tipo_contrato: rawData.tipoContrato,
      estado_contrato: rawData.estadoContrato,
      tarifa: parseFloat(rawData.tarifa),
      moneda: rawData.moneda,
      fecha_inicio: rawData.fechaInicio,
      fecha_fin: rawData.fechaFin
    };

    try {
      if (rawData.contratoId && rawData.contratoId.trim() !== '') {
        // Actualizar contrato existente
        await DataService.updateContrato(rawData.contratoId, data);
        console.log('✅ Contrato actualizado correctamente');
      } else {
        // Crear nuevo contrato
        await DataService.createContrato(data);
        console.log('✅ Contrato creado correctamente');
      }
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('❌ Error al guardar contrato:', error);
      alert('Error al guardar el contrato: ' + (error.message || 'Error desconocido'));
    }
  };

  const openCreateModal = () => { document.getElementById('contratoModal').innerHTML = renderFormModal(); };
  const openEditModal = (id) => {
    const contrato = DataService.getContratoById(id);
    if (contrato) document.getElementById('contratoModal').innerHTML = renderFormModal(contrato);
  };
  const viewDetail = (id) => {
    const contrato = DataService.getContratoById(id);
    if (contrato) document.getElementById('contratoModal').innerHTML = renderDetailModal(contrato);
  };
  const openReportModal = (id) => { document.getElementById('contratoModal').innerHTML = renderReportModal(id); };
  const renovarContrato = (id) => {
    const contrato = DataService.getContratoById(id);
    if (contrato) {
      const newContrato = { ...contrato };
      newContrato.fechaInicio = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      newContrato.fechaFin = endDate.toISOString().split('T')[0];
      newContrato.estadoContrato = 'Activo';
      document.getElementById('contratoModal').innerHTML = renderFormModal(newContrato);
    }
  };
  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('contratoModal').innerHTML = '';
  };

  return {
    render, openCreateModal, openEditModal, viewDetail, renovarContrato,
    closeModal, handleSearch, handleStatusFilter, handleTipoFilter, handleSubmit,
    openReportModal, generateReport, sendReport, deleteContrato
  };
})();
