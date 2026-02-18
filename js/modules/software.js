/**
 * ALLTECH - Software Module
 * Management of software licenses and updates policy
 */

const SoftwareModule = (() => {
  let filterState = { search: '', tipo: 'all', activacion: 'all' };

  const render = () => {
    const softwareList = DataService.getSoftwareFiltered(filterState);
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'software', 'create');

    return `
      <div class="module-container">
        <!-- Module Header -->
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Gestión de Software</h2>
            <p class="module-subtitle">${softwareList.length} licencias registradas</p>
          </div>
          <div class="module-header__right">
             <button class="btn btn--secondary" onclick="SoftwareModule.openReportModal()">
              ${Icons.fileText} Reporte por Registro
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="SoftwareModule.openCreateModal()">
              ${Icons.plus} Nueva Licencia
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
                       placeholder="Buscar software, serie, registro..." 
                       value="${filterState.search}"
                       onkeyup="SoftwareModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 150px;" 
                      onchange="SoftwareModule.handleTipoFilter(this.value)">
                <option value="all">Licencia: Todas</option>
                <option value="SERVIDOR" ${filterState.tipo === 'SERVIDOR' ? 'selected' : ''}>SERVIDOR</option>
                <option value="ADICIONAL" ${filterState.tipo === 'ADICIONAL' ? 'selected' : ''}>ADICIONAL</option>
              </select>
              <select class="form-select" style="width: 150px;" 
                      onchange="SoftwareModule.handleActivacionFilter(this.value)">
                <option value="all">Activación: Todas</option>
                <option value="ORIGINAL" ${filterState.activacion === 'ORIGINAL' ? 'selected' : ''}>ORIGINAL</option>
                <option value="HACK" ${filterState.activacion === 'HACK' ? 'selected' : ''}>HACK</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Software Grid -->
        <div class="card">
          <div class="card__body" style="padding: 0;">
             ${softwareList.length > 0 ? renderTable(softwareList) : renderEmptyState()}
          </div>
        </div>
      </div>

      <div id="softwareModal"></div>
    `;
  };

  const renderTable = (softwareList) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'software', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'software', 'delete');

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Software / Tipo</th>
            <th>Licencia Empresa / PC</th>
            <th>Registro</th>
            <th>Estado</th>
            <th>Póliza</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${softwareList.map(item => `
            <tr>
              <td>
                <div class="font-medium">${item.nombreSoftware}</div>
                <div class="text-xs text-muted">${item.tipoSoftware || 'General'}</div>
              </td>
              <td>
                <div style="font-size: 11px;">Emp: ${item.numeroLicencia}</div>
                <div style="font-size: 11px; color: var(--text-muted);">PC: ${item.numeroSerie || 'N/A'}</div>
              </td>
              <td>
                <div class="text-sm">${item.cliente?.empresa || item.cliente?.nombreCliente || item.nombreRegistro || '-'}</div>
              </td>
              <td>
                <span class="badge ${item.tipoLicencia === 'SERVIDOR' ? 'badge--primary' : 'badge--neutral'}" style="margin-right: 4px;">${item.tipoLicencia}</span>
                <span class="badge ${item.modoActivacion === 'ORIGINAL' ? 'badge--success' : 'badge--warning'}">
                  ${item.modoActivacion}
                </span>
              </td>
              <td>
                <div class="text-xs">Inicio: ${new Date(item.fechaInicioPoliza).toLocaleDateString('es-NI')}</div>
                <div class="text-xs ${new Date(item.fechaFinPoliza) < new Date() ? 'text-danger' : 'text-success'}">
                  Fin: ${item.fechaFinPoliza ? new Date(item.fechaFinPoliza).toLocaleDateString('es-NI') : 'N/A'}
                </div>
              </td>
              <td>
                  <div class="flex gap-xs">
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="SoftwareModule.viewDetail('${item.id}')"
                            title="Ver detalle">
                      ${Icons.eye}
                    </button>
                    ${canUpdate ? `
                    <button class="btn btn--ghost btn--icon btn--sm" 
                            onclick="SoftwareModule.openEditModal('${item.id}')"
                            title="Editar">
                      ${Icons.edit}
                    </button>
                    ` : ''}
                    ${canDelete ? `
                    <button class="btn btn--ghost btn--icon btn--sm text-danger" 
                            onclick="SoftwareModule.deleteSoftware('${item.id}')"
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
    const canCreate = DataService.canPerformAction(user.role, 'software', 'create');

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.monitor}</div>
        <h3 class="empty-state__title">No hay licencias registradas</h3>
        <p class="empty-state__description">Comienza agregando una nueva licencia de software.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="SoftwareModule.openCreateModal()">
          ${Icons.plus} Nueva Licencia
        </button>
        ` : ''}
      </div>
    `;
  };

  const renderFormModal = (software = null) => {
    const isEdit = software !== null;
    const clientes = DataService.getClientesSync();

    return `
      <div class="modal-overlay open" onclick="SoftwareModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Licencia' : 'Nueva Licencia'}</h3>
            <button class="modal__close" onclick="SoftwareModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="SoftwareModule.handleSubmit(event)">
            <input type="hidden" name="id" value="${software?.id || ''}">
            
             <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label form-label--required">Nombre de Software</label>
                <input type="text" name="nombreSoftware" class="form-input" value="${software?.nombreSoftware || ''}" required placeholder="Ej: Windows 10 Pro">
              </div>
              <div class="form-group" style="flex: 1;">
                 <label class="form-label">Tipo de Software</label>
                 <input type="text" name="tipoSoftware" class="form-input" value="${software?.tipoSoftware || ''}" placeholder="Ej: SO, Antivirus...">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Tipo de Licencia</label>
                <select name="tipoLicencia" class="form-select" required>
                  <option value="SERVIDOR" ${software?.tipoLicencia === 'SERVIDOR' ? 'selected' : ''}>SERVIDOR</option>
                  <option value="ADICIONAL" ${software?.tipoLicencia === 'ADICIONAL' ? 'selected' : ''}>ADICIONAL</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Modo de Activación</label>
                <select name="modoActivacion" class="form-select" required>
                  <option value="ORIGINAL" ${software?.modoActivacion === 'ORIGINAL' ? 'selected' : ''}>ORIGINAL</option>
                  <option value="HACK" ${software?.modoActivacion === 'HACK' ? 'selected' : ''}>HACK</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Número de Licencia Empresa</label>
                <input type="text" name="numeroLicencia" class="form-input" value="${software?.numeroLicencia || ''}" required placeholder="XXXX-XXXX-XXXX">
              </div>
               <div class="form-group">
                <label class="form-label">Número Licencia PC</label>
                <input type="text" name="numeroSerie" class="form-input" value="${software?.numeroSerie || ''}" placeholder="SN-00000">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label form-label--required">Cliente / Organización</label>
              <select name="clienteId" class="form-select" required>
                 <option value="">Seleccione un cliente...</option>
                 ${clientes.map(c => `
                    <option value="${c.id}" ${software?.clienteId === c.id ? 'selected' : ''}>
                        ${c.empresa || c.nombreCliente}
                    </option>`).join('')}
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Inicio Póliza Actualización</label>
                <input type="date" name="fechaInicioPoliza" class="form-input" value="${software?.fechaInicioPoliza || new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Fin Póliza Actualización</label>
                <input type="date" name="fechaFinPoliza" class="form-input" value="${software?.fechaFinPoliza || ''}">
              </div>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="SoftwareModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Registrar Licencia'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderDetailModal = (software) => {
    const cliente = DataService.getClienteById(software.cliente_id || software.clienteId);

    return `
      <div class="modal-overlay open" onclick="SoftwareModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">Detalle de Licencia</h3>
              <p class="text-sm text-muted">${software.nombreSoftware}</p>
            </div>
            <button class="modal__close" onclick="SoftwareModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-item__label">Software</div>
                <div class="detail-item__value">${software.nombreSoftware}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Tipo</div>
                <div class="detail-item__value">${software.tipoSoftware || 'General'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Tipo de Licencia</div>
                <div class="detail-item__value">
                  <span class="badge ${software.tipoLicencia === 'SERVIDOR' ? 'badge--primary' : 'badge--neutral'}">${software.tipoLicencia}</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Modo Activación</div>
                <div class="detail-item__value">
                   <span class="badge ${software.modoActivacion === 'ORIGINAL' ? 'badge--success' : 'badge--warning'}">
                    ${software.modoActivacion}
                  </span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Licencia Empresa</div>
                <div class="detail-item__value font-mono" style="word-break: break-all;">${software.numeroLicencia}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Licencia PC / Serie</div>
                <div class="detail-item__value font-mono">${software.numeroSerie || 'N/A'}</div>
              </div>
              <div class="detail-item detail-item--full">
                <div class="detail-item__label">Cliente / Organización</div>
                <div class="detail-item__value">${cliente?.empresa || cliente?.nombreCliente || 'No asignado'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Inicio Póliza</div>
                <div class="detail-item__value">${new Date(software.fechaInicioPoliza).toLocaleDateString('es-NI')}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Fin Póliza</div>
                <div class="detail-item__value ${new Date(software.fechaFinPoliza) < new Date() ? 'text-error' : 'text-success'}">
                  ${software.fechaFinPoliza ? new Date(software.fechaFinPoliza).toLocaleDateString('es-NI') : 'N/A'}
                </div>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="SoftwareModule.closeModal()">Cerrar</button>
            <button class="btn btn--primary" onclick="SoftwareModule.openEditModal('${software.id}')">${Icons.edit} Editar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ========== REPORT MODAL ==========
  const renderReportModal = () => {
    const registros = DataService.getSoftwareUniqueRegistros();

    return `
      <div class="modal-overlay open" onclick="SoftwareModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${Icons.fileText} Reporte por Registro</h3>
            <button class="modal__close" onclick="SoftwareModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="SoftwareModule.generateReport(event)">
            <div class="form-group">
              <label class="form-label">Seleccionar Nombre de Registro</label>
              <select name="nombreRegistro" class="form-select" required>
                <option value="">Seleccione...</option>
                ${registros.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            
            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="SoftwareModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${Icons.fileText} Generar PDF</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // ========== PDF GENERATION ==========
  const generateReport = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const nombreRegistro = formData.get('nombreRegistro');

    const licenses = DataService.getSoftwareByRegistro(nombreRegistro);

    const content = `
      <div class="header">
        <h1>Reporte de Licencias de Software</h1>
        <p>Registro: <strong>${nombreRegistro}</strong></p>
        <p>Total Licencias: ${licenses.length}</p>
      </div>

      <div class="section">
         <table>
          <thead>
            <tr>
              <th>Software</th>
              <th>Tipo</th>
              <th>Licencia Empresa</th>
              <th>Licencia PC</th>
              <th>Activación</th>
              <th>Vencimiento Póliza</th>
            </tr>
          </thead>
          <tbody>
            ${licenses.map(lic => `
              <tr>
                <td>
                    <b>${lic.nombreSoftware}</b><br>
                    <span style="font-size:10px; color:#666;">${lic.tipoSoftware || '-'}</span>
                </td>
                <td>${lic.tipoLicencia}</td>
                <td style="font-family: monospace;">${lic.numeroLicencia}</td>
                <td style="font-family: monospace;">${lic.numeroSerie || '-'}</td>
                <td>
                    <span class="badge badge-${lic.modoActivacion === 'ORIGINAL' ? 'success' : 'warning'}">
                        ${lic.modoActivacion}
                    </span>
                </td>
                <td>
                    ${lic.fechaFinPoliza ? new Date(lic.fechaFinPoliza).toLocaleDateString('es-NI') : 'N/A'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Licencias - ${nombreRegistro}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a73e8; padding-bottom: 20px; }
          .header h1 { color: #1a73e8; font-size: 24px; }
          .header p { color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; font-size: 11px; }
          th { background: #1a73e8; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f8f9fa; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content}
        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
          <p>ALLTECH - Generado el ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    closeModal();
  };

  // ========== EVENT HANDLERS ==========
  const handleSearch = (value) => { filterState.search = value; App.refreshCurrentModule(); };
  const handleTipoFilter = (value) => { filterState.tipo = value; App.refreshCurrentModule(); };
  const handleActivacionFilter = (value) => { filterState.activacion = value; App.refreshCurrentModule(); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Guardando...';

    try {
      if (data.id) {
        await DataService.updateSoftware(data.id, data);
        // alert('Licencia actualizada correctamente');
      } else {
        await DataService.createSoftware(data);
        // alert('Licencia registrada correctamente');
      }
      closeModal();
      App.refreshCurrentModule();
    } catch (error) {
      console.error('Error saving software:', error);
      alert('Error al guardar: ' + (error.message || 'Error desconocido'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  const deleteSoftware = (id) => {
    if (confirm('¿Está seguro de eliminar esta licencia?')) {
      DataService.deleteSoftware(id);
      App.refreshCurrentModule();
    }
  };

  const openCreateModal = () => { document.getElementById('softwareModal').innerHTML = renderFormModal(); };
  const openEditModal = (id) => {
    const sw = DataService.getSoftwareById(id);
    if (sw) document.getElementById('softwareModal').innerHTML = renderFormModal(sw);
  };
  const viewDetail = (id) => {
    const sw = DataService.getSoftwareById(id);
    if (sw) document.getElementById('softwareModal').innerHTML = renderDetailModal(sw);
  };
  const openReportModal = () => { document.getElementById('softwareModal').innerHTML = renderReportModal(); };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('softwareModal').innerHTML = '';
  };

  return {
    render, openCreateModal, openEditModal, openReportModal, closeModal, deleteSoftware, viewDetail,
    handleSearch, handleTipoFilter, handleActivacionFilter, handleSubmit, generateReport
  };
})();
