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
                       id="searchInput"
                       value="${filterState.search}"
                       oninput="ClientesModule.handleSearch(this.value)">
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
      <div class="modal-overlay open">
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
                <label class="form-label form-label--required">Tipo de Cliente</label>
                <select name="tipoRegistro" class="form-select" onchange="
                  const isEmpresa = this.value === 'Empresa';
                  document.getElementById('lbl-ident').innerText = isEmpresa ? 'RUC:' : 'Cédula ID:';
                  document.getElementById('input-ident').placeholder = 'xxx-xxxxxx-xxxxx';
                ">
                  <option value="Persona Natural" ${cliente?.tipoRegistro === 'Persona Natural' ? 'selected' : ''}>Persona Natural</option>
                  <option value="Empresa" ${cliente?.tipoRegistro === 'Empresa' ? 'selected' : ''}>Empresa</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required" id="lbl-ident">${cliente?.tipoRegistro === 'Empresa' ? 'RUC:' : 'Cédula ID:'}</label>
                <input type="text" id="input-ident" name="identificacion" class="form-input" value="${cliente?.identificacion || ''}" placeholder="xxx-xxxxxx-xxxxx" required
                  oninput="ClientesModule.formatIdentificacion(this)" maxlength="16">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Nombre de cliente:</label>
                <input type="text" 
                       name="nombreCliente" 
                       class="form-input" 
                       value="${cliente?.nombreCliente || ''}"
                       placeholder="Ej: Juan Pérez"
                       required>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Teléfono</label>
                <input type="tel" 
                       name="telefono" 
                       class="form-input" 
                       value="${cliente?.telefono || ''}"
                       placeholder="Ej: +505 8888-8888"
                       required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección</label>
              <textarea name="direccion" 
                        class="form-textarea" 
                        rows="2"
                        placeholder="Ej: Managua, Nicaragua">${cliente?.direccion || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Límite de Crédito</label>
                <input type="number" name="limiteCredito" class="form-input" value="${cliente?.limiteCredito || 0}" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label">Porcentaje de descuento</label>
                <div style="position:relative;">
                  <input type="number" name="porcentajeDescuento" class="form-input" value="${cliente?.porcentajeDescuento || 0}" step="0.01">
                  <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);">%</span>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Lista de Precios</label>
                <select name="listaPrecios" class="form-select">
                  <option value="General" ${cliente?.listaPrecios === 'General' ? 'selected' : ''}>General</option>
                  <option value="Mayorista" ${cliente?.listaPrecios === 'Mayorista' ? 'selected' : ''}>Mayorista</option>
                  <option value="VIP" ${cliente?.listaPrecios === 'VIP' ? 'selected' : ''}>VIP</option>
                  <option value="Credito" ${cliente?.listaPrecios === 'Credito' ? 'selected' : ''}>Crédito</option>
                </select>
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
              <label class="form-label">Nota</label>
              <textarea name="nota" class="form-textarea" rows="2">${cliente?.nota || ''}</textarea>
            </div>

            <!-- Impuestos -->
            <div style="background:var(--bg-secondary);padding:1rem;border-radius:8px;margin-bottom:1rem;border:1px solid var(--border-color);">
              <h4 style="margin:0 0 1rem 0;font-size:0.95rem;color:var(--text-primary);">Impuestos</h4>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
                
                <!-- Sumar Retencion -->
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impSumarRetencion" ${cliente?.impSumarRetencion ? 'checked' : ''} onchange="document.getElementById('val-sumar-ret').disabled = !this.checked">
                    Sumar Retención
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="val-sumar-ret" name="valSumarRetencion" class="form-input" value="${cliente?.valSumarRetencion || ''}" step="0.01" ${cliente?.impSumarRetencion ? '' : 'disabled'} placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                  <small style="color:var(--text-muted);font-size:0.75rem;line-height:1.2;">(Agregado individual por prod, no en factura global)</small>
                </div>
                
                <!-- Retencion -->
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impRetencion" ${cliente?.impRetencion ? 'checked' : ''} onchange="document.getElementById('val-ret').disabled = !this.checked">
                    Retención
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="val-ret" name="valRetencion" class="form-input" value="${cliente?.valRetencion || ''}" step="0.01" ${cliente?.impRetencion ? '' : 'disabled'} placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                  <small style="color:var(--text-muted);font-size:0.75rem;line-height:1.2;">(Descuenta del total general de factura)</small>
                </div>
                
                <!-- IVA -->
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impIva" ${cliente?.impIva ? 'checked' : ''} onchange="document.getElementById('val-iva').disabled = !this.checked">
                    IVA
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="val-iva" name="valIva" class="form-input" value="${cliente?.valIva || ''}" step="0.01" ${cliente?.impIva ? '' : 'disabled'} placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                  <small style="color:var(--text-muted);font-size:0.75rem;line-height:1.2;">(Suma al total general de factura)</small>
                </div>
                
              </div>
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

    // Datos fiscales del cliente
    const tipoRegistro = cliente.tipoRegistro || cliente.tipo_registro || 'Persona Natural';
    const identificacion = cliente.identificacion || 'No registrada';
    const limiteCredito = parseFloat(cliente.limiteCredito || cliente.limite_credito || 0);
    const porcentajeDescuento = parseFloat(cliente.porcentajeDescuento || cliente.porcentaje_descuento || 0);
    const listaPrecios = cliente.listaPrecios || cliente.lista_precios || 'General';
    const nota = cliente.nota || '';
    const correo = cliente.correo || 'No registrado';
    const telefono = cliente.telefono || 'No registrado';

    // Impuestos
    const impSumarRet = cliente.impSumarRetencion || cliente.imp_sumar_retencion || false;
    const valSumarRet = parseFloat(cliente.valSumarRetencion || cliente.val_sumar_retencion || 0);
    const impRetencion = cliente.impRetencion || cliente.imp_retencion || false;
    const valRetencion = parseFloat(cliente.valRetencion || cliente.val_retencion || 0);
    const impIva = cliente.impIva || cliente.imp_iva || false;
    const valIva = parseFloat(cliente.valIva || cliente.val_iva || 0);

    // Facturas (placeholder - se puede conectar con datos reales de ventas)
    const facturas = []; // TODO: conectar con DataService.getFacturasByCliente(uuid) cuando exista
    const facturasPendientes = facturas.filter(f => f.estado === 'Pendiente' || f.estado === 'Crédito');
    const totalPendiente = facturasPendientes.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);
    const totalFacturado = facturas.reduce((sum, f) => sum + (parseFloat(f.total) || 0), 0);

    return `
      <div class="modal-overlay open">
        <div class="modal modal--lg" onclick="event.stopPropagation()" style="max-width:900px;">
          <div class="modal__header">
            <div class="flex items-center gap-md">
              <div class="avatar avatar--lg">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cliente.nombreCliente)}&background=1a73e8&color=fff&size=56" 
                     alt="${cliente.nombreCliente}">
              </div>
              <div>
                <h3 class="modal__title">${cliente.nombreCliente}</h3>
                <p class="text-sm text-muted">${tipoRegistro} &middot; ${identificacion}</p>
              </div>
            </div>
            <button class="modal__close" onclick="ClientesModule.closeModal()">
              ${Icons.x}
            </button>
          </div>
          <div class="modal__body" style="max-height:65vh;overflow-y:auto;">
            <!-- Tabs -->
            <div class="modal__tabs" style="flex-wrap:wrap;gap:4px;">
              <button class="modal__tab active" onclick="ClientesModule.switchTab(this, 'info')">Información</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'facturas')">Facturas (${facturas.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'estado-cuenta')">Estado de Cuenta</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'contratos')">Contratos (${contratos.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'equipos')">Equipos (${equipos.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'visitas')">Visitas (${visitas.length})</button>
              <button class="modal__tab" onclick="ClientesModule.switchTab(this, 'proformas')">Proformas (${proformas.length})</button>
            </div>

            <!-- Info Tab -->
            <div id="tab-info" class="modal__tab-content active">
              <!-- Datos Generales -->
              <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Datos Generales</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-item__label">Tipo de Cliente</div>
                  <div class="detail-item__value">${tipoRegistro}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">${tipoRegistro === 'Empresa' ? 'RUC' : 'Cédula ID'}</div>
                  <div class="detail-item__value" style="font-family:monospace;font-weight:600;">${identificacion}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Teléfono</div>
                  <div class="detail-item__value">${telefono}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Correo</div>
                  <div class="detail-item__value">${correo}</div>
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
                  <div class="detail-item__value">${new Date(cliente.fechaCreacion || cliente.created_at).toLocaleDateString('es-NI')}</div>
                </div>
                <div class="detail-item detail-item--full">
                  <div class="detail-item__label">Dirección</div>
                  <div class="detail-item__value">${cliente.direccion || 'No especificada'}</div>
                </div>
              </div>

              <!-- Comercial -->
              <h4 style="margin:1.25rem 0 0.75rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Datos Comerciales</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-item__label">Límite de Crédito</div>
                  <div class="detail-item__value" style="font-weight:600;color:var(--primary);">
                    C$ ${limiteCredito.toFixed(2)}
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Descuento General</div>
                  <div class="detail-item__value" style="font-weight:600;color:var(--success);">
                    ${porcentajeDescuento}%
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Lista de Precios</div>
                  <div class="detail-item__value">
                    <span class="badge badge--primary">${listaPrecios}</span>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-item__label">Empresa</div>
                  <div class="detail-item__value">${cliente.empresa || cliente.nombreCliente}</div>
                </div>
              </div>

              <!-- Impuestos -->
              <h4 style="margin:1.25rem 0 0.75rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Configuración de Impuestos</h4>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
                <div style="background:var(--bg-secondary);padding:0.75rem;border-radius:8px;text-align:center;border:1px solid var(--border-color);">
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.25rem;">Sumar Retención</div>
                  <div style="font-size:1.1rem;font-weight:700;color:${impSumarRet ? 'var(--primary)' : 'var(--text-muted)'};">                    ${impSumarRet ? valSumarRet + '%' : 'Desactivado'}
                  </div>
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Individual por producto</div>
                </div>
                <div style="background:var(--bg-secondary);padding:0.75rem;border-radius:8px;text-align:center;border:1px solid var(--border-color);">
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.25rem;">Retención</div>
                  <div style="font-size:1.1rem;font-weight:700;color:${impRetencion ? 'var(--warning)' : 'var(--text-muted)'};">                    ${impRetencion ? valRetencion + '%' : 'Desactivado'}
                  </div>
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Sobre total factura</div>
                </div>
                <div style="background:var(--bg-secondary);padding:0.75rem;border-radius:8px;text-align:center;border:1px solid var(--border-color);">
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.25rem;">IVA</div>
                  <div style="font-size:1.1rem;font-weight:700;color:${impIva ? 'var(--success)' : 'var(--text-muted)'};">                    ${impIva ? valIva + '%' : 'Desactivado'}
                  </div>
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Suma al total</div>
                </div>
              </div>

              ${nota ? `
              <h4 style="margin:1.25rem 0 0.5rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Notas</h4>
              <div style="background:var(--bg-secondary);padding:0.75rem;border-radius:8px;border:1px solid var(--border-color);font-size:0.9rem;">
                ${nota}
              </div>
              ` : ''}
            </div>

            <!-- Facturas Tab -->
            <div id="tab-facturas" class="modal__tab-content">
              ${facturas.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>No. Factura</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Pagado</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${facturas.map(f => `
                      <tr>
                        <td style="font-weight:600;">${f.numero || f.id}</td>
                        <td>${new Date(f.fecha).toLocaleDateString('es-NI')}</td>
                        <td>C$ ${parseFloat(f.total || 0).toFixed(2)}</td>
                        <td style="color:var(--success);">C$ ${parseFloat(f.pagado || 0).toFixed(2)}</td>
                        <td style="color:${(f.total - (f.pagado || 0)) > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">C$ ${(parseFloat(f.total || 0) - parseFloat(f.pagado || 0)).toFixed(2)}</td>
                        <td>
                          <span class="badge ${f.estado === 'Pagada' ? 'badge--success' :
        f.estado === 'Pendiente' ? 'badge--warning' :
          f.estado === 'Crédito' ? 'badge--primary' :
            f.estado === 'Anulada' ? 'badge--danger' : 'badge--neutral'
      }">${f.estado}</span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="text-center p-lg">
                  <div style="font-size:2.5rem;margin-bottom:0.5rem;">📄</div>
                  <p class="text-muted">No hay facturas registradas para este cliente</p>
                  <p class="text-sm text-muted">Las facturas aparecerán aquí cuando se realicen ventas</p>
                </div>
              `}
            </div>

            <!-- Estado de Cuenta Tab -->
            <div id="tab-estado-cuenta" class="modal__tab-content">
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;margin-bottom:1.5rem;">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:1rem;border-radius:10px;color:#fff;">
                  <div style="font-size:0.8rem;opacity:0.85;">Total Facturado</div>
                  <div style="font-size:1.4rem;font-weight:700;margin-top:0.25rem;">C$ ${totalFacturado.toFixed(2)}</div>
                  <div style="font-size:0.75rem;opacity:0.7;margin-top:0.25rem;">${facturas.length} factura(s)</div>
                </div>
                <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);padding:1rem;border-radius:10px;color:#fff;">
                  <div style="font-size:0.8rem;opacity:0.85;">Saldo Pendiente</div>
                  <div style="font-size:1.4rem;font-weight:700;margin-top:0.25rem;">C$ ${totalPendiente.toFixed(2)}</div>
                  <div style="font-size:0.75rem;opacity:0.7;margin-top:0.25rem;">${facturasPendientes.length} pendiente(s)</div>
                </div>
                <div style="background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);padding:1rem;border-radius:10px;color:#fff;">
                  <div style="font-size:0.8rem;opacity:0.85;">Límite Disponible</div>
                  <div style="font-size:1.4rem;font-weight:700;margin-top:0.25rem;">C$ ${(limiteCredito - totalPendiente).toFixed(2)}</div>
                  <div style="font-size:0.75rem;opacity:0.7;margin-top:0.25rem;">de C$ ${limiteCredito.toFixed(2)}</div>
                </div>
              </div>

              <h4 style="margin:0 0 0.75rem;font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;">Facturas Pendientes de Pago</h4>
              ${facturasPendientes.length > 0 ? `
                <table class="data-table">
                  <thead class="data-table__head">
                    <tr>
                      <th>No. Factura</th>
                      <th>Fecha</th>
                      <th>Vencimiento</th>
                      <th>Total</th>
                      <th>Abonado</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody class="data-table__body">
                    ${facturasPendientes.map(f => `
                      <tr>
                        <td style="font-weight:600;">${f.numero || f.id}</td>
                        <td>${new Date(f.fecha).toLocaleDateString('es-NI')}</td>
                        <td>${f.vencimiento ? new Date(f.vencimiento).toLocaleDateString('es-NI') : '-'}</td>
                        <td>C$ ${parseFloat(f.total || 0).toFixed(2)}</td>
                        <td style="color:var(--success);">C$ ${parseFloat(f.pagado || 0).toFixed(2)}</td>
                        <td style="color:var(--danger);font-weight:700;">C$ ${(parseFloat(f.total || 0) - parseFloat(f.pagado || 0)).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="text-center p-lg" style="background:var(--bg-secondary);border-radius:8px;">
                  <div style="font-size:2rem;margin-bottom:0.5rem;">✅</div>
                  <p style="font-weight:600;color:var(--success);">Sin facturas pendientes</p>
                  <p class="text-sm text-muted">Este cliente no tiene cuentas por cobrar</p>
                </div>
              `}
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
      <div class="modal-overlay open">
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

  let searchTimeout;
  const handleSearch = (value) => {
    filterState.search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      App.refreshCurrentModule();
    }, 300);
  };

  const handleStatusFilter = (value) => {
    filterState.status = value;
    App.refreshCurrentModule();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const rawData = Object.fromEntries(formData.entries());

    // Validations and defaults
    const isEmpresa = rawData.tipoRegistro === 'Empresa';
    const finalEmpresa = isEmpresa ? rawData.nombreCliente : rawData.nombreCliente;
    const finalIdentificacion = rawData.identificacion || null;

    // Output mapped from UI names (camelCase) to DB cols (snake_case)
    const data = {
      tipo_registro: rawData.tipoRegistro || 'Persona Natural',
      identificacion: finalIdentificacion,
      nombre_cliente: rawData.nombreCliente,
      empresa: finalEmpresa,
      telefono: rawData.telefono,
      correo: rawData.correo || null,
      direccion: rawData.direccion || null,

      limite_credito: parseFloat(rawData.limiteCredito) || 0,
      porcentaje_descuento: parseFloat(rawData.porcentajeDescuento) || 0,
      lista_precios: rawData.listaPrecios || 'General',
      nota: rawData.nota || null,

      // Impuestos
      imp_sumar_retencion: rawData.impSumarRetencion === 'on',
      val_sumar_retencion: rawData.impSumarRetencion === 'on' ? (parseFloat(rawData.valSumarRetencion) || 0) : 0,

      imp_retencion: rawData.impRetencion === 'on',
      val_retencion: rawData.impRetencion === 'on' ? (parseFloat(rawData.valRetencion) || 0) : 0,

      imp_iva: rawData.impIva === 'on',
      val_iva: rawData.impIva === 'on' ? (parseFloat(rawData.valIva) || 0) : 0,

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
      document.body.classList.remove('modal-open');
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

  // ========== UTILIDADES ==========

  /**
   * Auto-formatea el campo de identificación (Cédula/RUC).
   * Formato: xxx-xxxxxx-xxxxx (3-6-5 con guiones automáticos)
   */
  const formatIdentificacion = (input) => {
    // Guardar posición del cursor
    const cursorPos = input.selectionStart;
    const prevLength = input.value.length;

    // Solo alfanuméricos en mayúscula
    let chars = input.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();

    // Limitar a 14 caracteres (13 dígitos + 1 letra para cédula, o 14 dígitos para RUC)
    chars = chars.substring(0, 14);

    // Aplicar formato xxx-xxxxxx-xxxxx
    let formatted = '';
    for (let i = 0; i < chars.length; i++) {
      if (i === 3 || i === 9) formatted += '-';
      formatted += chars[i];
    }

    input.value = formatted;

    // Restaurar posición del cursor ajustada
    const newLength = formatted.length;
    const diff = newLength - prevLength;
    const newPos = cursorPos + diff;
    input.setSelectionRange(newPos, newPos);
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
    switchTab,
    formatIdentificacion
  };
})();
