/**
 * ALLTECH - Proformas Module
 * Quotation management with PDF generation and reports
 */

const ProformasModule = (() => {
  let filterState = { search: '', clienteId: 'all', estado: 'all' };
  let currentItems = [];

  // ========== RENDER FUNCTIONS ==========

  const render = () => {
    const proformas = DataService.getProformasFiltered(filterState);
    const clientes = DataService.getClientesSync();
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'proformas', 'create');

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Proformas / Cotizaciones</h2>
            <p class="module-subtitle">${proformas.length} proformas registradas</p>
          </div>
          <div class="module-header__right">
            <button class="btn btn--secondary" onclick="ProformasModule.openReportModal()">
              ${Icons.barChart} Reportes
            </button>
            ${canCreate ? `
            <button class="btn btn--primary" onclick="ProformasModule.openCreateModal()">
              ${Icons.plus} Nueva Proforma
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
                <input type="text" class="form-input" placeholder="Buscar por número o cliente..." 
                       value="${filterState.search}"
                       onkeyup="ProformasModule.handleSearch(this.value)">
              </div>
              <select class="form-select" style="width: 180px;" 
                      onchange="ProformasModule.handleClienteFilter(this.value)">
                <option value="all">Todos los clientes</option>
                ${clientes.map(c => `
                  <option value="${c.id}" ${filterState.clienteId === c.id ? 'selected' : ''}>
                    ${c.empresa}
                  </option>
                `).join('')}
              </select>
              <select class="form-select" style="width: 140px;" 
                      onchange="ProformasModule.handleEstadoFilter(this.value)">
                <option value="all">Todos los estados</option>
                <option value="Activa" ${filterState.estado === 'Activa' ? 'selected' : ''}>Activa</option>
                <option value="Aprobada" ${filterState.estado === 'Aprobada' ? 'selected' : ''}>Aprobada</option>
                <option value="Vencida" ${filterState.estado === 'Vencida' ? 'selected' : ''}>Vencida</option>
                <option value="Anulada" ${filterState.estado === 'Anulada' ? 'selected' : ''}>Anulada</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Proformas Table -->
        <div class="card">
          <div class="card__body" style="padding: 0;">
            ${proformas.length > 0 ? renderTable(proformas) : renderEmptyState()}
          </div>
        </div>
      </div>
      <div id="proformaModal"></div>
    `;
  };

  const renderStats = () => {
    const stats = DataService.getProformasStats();
    return `
      <div class="stat-card stat-card--primary">
        <div class="stat-card__icon">${Icons.fileText}</div>
        <span class="stat-card__label">Total Proformas</span>
        <span class="stat-card__value">${stats.total}</span>
      </div>
      <div class="stat-card stat-card--success">
        <div class="stat-card__icon">${Icons.checkCircle}</div>
        <span class="stat-card__label">Aprobadas</span>
        <span class="stat-card__value">${stats.aprobadas}</span>
      </div>
      <div class="stat-card stat-card--warning">
        <div class="stat-card__icon">${Icons.alertCircle}</div>
        <span class="stat-card__label">Activas/Pendientes</span>
        <span class="stat-card__value">${stats.activas}</span>
      </div>
      <div class="stat-card stat-card--info">
        <div class="stat-card__icon">${Icons.wallet}</div>
        <span class="stat-card__label">Valor Aprobado</span>
        <span class="stat-card__value">$${stats.valorAprobado.toFixed(2)}</span>
      </div>
    `;
  };

  const renderTable = (proformas) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'proformas', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'proformas', 'delete');

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Nº</th>
            <th>ID</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Validez</th>
            <th>Items</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${proformas.map(proforma => {
      const cliente = DataService.getClienteById(proforma.clienteId || proforma.cliente_id);
      const fechaProforma = proforma.fecha_emision || proforma.fecha || '';
      const validezDias = proforma.validez_dias || proforma.validezDias || 15;
      const fechaVencimiento = new Date(fechaProforma);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + validezDias);
      const hoy = new Date();
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      const itemsCount = (proforma.items || []).length;
      const totalValue = parseFloat(proforma.total) || 0;

      return `
              <tr>
                <td><span class="font-medium">${proforma.numero || proforma.numero_proforma || ''}</span></td>
                <td><span class="text-muted">${proforma.proformaId || proforma.codigo_proforma || ''}</span></td>
                <td>
                  <div class="font-medium">${cliente?.empresa || 'N/A'}</div>
                  <div class="text-xs text-muted">${cliente?.nombreCliente || ''}</div>
                </td>
                <td>
                  <div>${fechaProforma ? new Date(fechaProforma).toLocaleDateString('es-NI') : '-'}</div>
                </td>
                <td>
                  <div class="text-sm">${validezDias} días</div>
                  ${proforma.estado === 'Activa' ? `
                    <div class="text-xs ${diasRestantes <= 3 ? 'text-danger' : 'text-muted'}">
                      ${diasRestantes > 0 ? `${diasRestantes} restantes` : 'Vencida'}
                    </div>
                  ` : ''}
                </td>
                <td>
                  <span class="badge badge--info">${itemsCount} items</span>
                </td>
                <td>
                  <span class="font-medium">${proforma.moneda === 'USD' ? '$' : 'C$'}${totalValue.toFixed(2)}</span>
                </td>
                <td>
                  <span class="badge ${getEstadoBadgeClass(proforma.estado)}">
                    ${proforma.estado}
                  </span>
                </td>
                <td>
                  <div class="flex gap-xs">
                    <button class="btn btn--ghost btn--icon btn--sm" onclick="ProformasModule.viewDetail('${proforma.proformaId || proforma.codigo_proforma}')" title="Ver">
                      ${Icons.eye}
                    </button>
                    <button class="btn btn--ghost btn--icon btn--sm" onclick="ProformasModule.generatePDF('${proforma.proformaId || proforma.codigo_proforma}')" title="PDF">
                      ${Icons.fileText}
                    </button>
                    ${proforma.estado === 'Activa' && canUpdate ? `
                      <button class="btn btn--ghost btn--icon btn--sm" onclick="ProformasModule.openEditModal('${proforma.proformaId || proforma.codigo_proforma}')" title="Editar">
                        ${Icons.edit}
                      </button>
                      <button class="btn btn--ghost btn--icon btn--sm text-success" onclick="ProformasModule.aprobarProforma('${proforma.proformaId || proforma.codigo_proforma}')" title="Aprobar">
                        ${Icons.checkCircle}
                      </button>
                    ` : ''}
                    ${canDelete ? `
                      <button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProformasModule.deleteProforma('${proforma.proformaId || proforma.codigo_proforma}')" title="Eliminar">
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

  const getEstadoBadgeClass = (estado) => {
    const classes = {
      'Activa': 'badge--primary',
      'Aprobada': 'badge--success',
      'Vencida': 'badge--warning',
      'Anulada': 'badge--danger'
    };
    return classes[estado] || 'badge--info';
  };

  const renderEmptyState = () => {
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'proformas', 'create');

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.fileText}</div>
        <h3 class="empty-state__title">No hay proformas</h3>
        <p class="empty-state__description">Crea una nueva proforma para cotizar servicios.</p>
        ${canCreate ? `
        <button class="btn btn--primary" onclick="ProformasModule.openCreateModal()">
          ${Icons.plus} Nueva Proforma
        </button>
        ` : ''}
      </div>
    `;
  };

  // ========== FORM MODAL ==========

  const renderFormModal = (proforma = null) => {
    const isEdit = proforma !== null;
    const clientes = DataService.getClientesSync();
    const productos = DataService.getProductosSync();
    currentItems = isEdit ? [...proforma.items] : [{ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }];

    return `
      <div class="modal-overlay open" onclick="ProformasModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Proforma' : 'Nueva Proforma'}</h3>
            <button class="modal__close" onclick="ProformasModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="ProformasModule.handleSubmit(event)">
            <input type="hidden" name="proformaId" value="${proforma?.proformaId || ''}">
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Cliente</label>
                <select name="clienteId" class="form-select" required>
                  <option value="">Seleccionar cliente...</option>
                  ${clientes.map(c => `
                    <option value="${c.id}" ${proforma?.cliente_id === c.id || proforma?.clienteId === c.clienteId ? 'selected' : ''}>
                      ${c.empresa} - ${c.nombreCliente}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Días de Validez</label>
                <input type="number" name="validezDias" class="form-input" 
                       value="${proforma?.validez_dias || proforma?.validezDias || 15}" min="1" max="90" required>
                <span class="form-hint">¿Cuántos días será válida esta proforma?</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Fecha</label>
                <input type="date" name="fecha" class="form-input" 
                       value="${proforma?.fecha_emision || proforma?.fecha || new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Moneda</label>
                <select name="moneda" class="form-select" onchange="ProformasModule.updateCurrencySymbols(this.value)">
                  <option value="USD" ${proforma?.moneda === 'USD' ? 'selected' : ''}>USD ($)</option>
                  <option value="NIO" ${proforma?.moneda === 'NIO' ? 'selected' : ''}>NIO (C$)</option>
                </select>
              </div>
            </div>

            <!-- Items Section -->
            <div class="form-group">
              <label class="form-label form-label--required">Productos / Servicios</label>
              <datalist id="productosList">
                ${productos.map(p => `<option value="${p.nombre}">From ${p.tipo}: $${p.precio}</option>`).join('')}
              </datalist>
              <div class="proforma-items" id="proformaItems">
                ${renderItemsEditor()}
              </div>
              <button type="button" class="btn btn--secondary btn--sm" style="margin-top: var(--spacing-sm);" onclick="ProformasModule.addItem()">
                ${Icons.plus} Agregar Línea
              </button>
            </div>

            <!-- Totals -->
            <div class="proforma-totals">
              <div class="proforma-totals__row">
                <span>Subtotal:</span>
                <span id="proformaSubtotal">$0.00</span>
              </div>
              <div class="proforma-totals__row proforma-totals__row--total">
                <span>Total:</span>
                <span id="proformaTotal">$0.00</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notas / Condiciones</label>
              <textarea name="notas" class="form-textarea" rows="2" 
                        placeholder="Notas adicionales o condiciones...">${proforma?.notas || ''}</textarea>
            </div>

            <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
              <button type="button" class="btn btn--secondary" onclick="ProformasModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Crear Proforma'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const renderItemsEditor = () => {
    return currentItems.map((item, index) => `
      <div class="proforma-item" data-index="${index}">
        <div class="proforma-item__row">
          <input type="number" class="form-input proforma-item__qty" 
                 value="${item.cantidad}" min="1" step="1"
                 placeholder="Cant."
                 onchange="ProformasModule.updateItem(${index}, 'cantidad', this.value)">
          <input type="text" class="form-input proforma-item__desc" 
                 value="${item.descripcion}" list="productosList"
                 placeholder="Descripción del producto o servicio"
                 onchange="ProformasModule.updateItem(${index}, 'descripcion', this.value)">
          <input type="number" class="form-input proforma-item__price" 
                 value="${item.precioUnitario}" min="0" step="0.01"
                 placeholder="Precio Unit."
                 onchange="ProformasModule.updateItem(${index}, 'precioUnitario', this.value)">
          <span class="proforma-item__total">$${item.total.toFixed(2)}</span>
          ${currentItems.length > 1 ? `
            <button type="button" class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProformasModule.removeItem(${index})">
              ${Icons.trash}
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  };

  const addItem = () => {
    currentItems.push({ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 });
    document.getElementById('proformaItems').innerHTML = renderItemsEditor();
  };

  const removeItem = (index) => {
    if (currentItems.length > 1) {
      currentItems.splice(index, 1);
      document.getElementById('proformaItems').innerHTML = renderItemsEditor();
      calculateTotals();
    }
  };

  const updateItem = (index, field, value) => {
    if (field === 'cantidad' || field === 'precioUnitario') {
      currentItems[index][field] = parseFloat(value) || 0;
      currentItems[index].total = currentItems[index].cantidad * currentItems[index].precioUnitario;
    } else if (field === 'descripcion') {
      currentItems[index][field] = value;
      // Auto-fill price if product found
      const productos = DataService.getProductosSync();
      const producto = productos.find(p => p.nombre === value);
      if (producto) {
        currentItems[index].precioUnitario = producto.precio;
        currentItems[index].total = currentItems[index].cantidad * producto.precio;
      }
    } else {
      currentItems[index][field] = value;
    }
    document.getElementById('proformaItems').innerHTML = renderItemsEditor();
    calculateTotals();
  };

  const calculateTotals = () => {
    const subtotal = currentItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal; // Sin IVA por ahora
    document.getElementById('proformaSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('proformaTotal').textContent = `$${total.toFixed(2)}`;
  };

  // ========== DETAIL MODAL ==========

  const renderDetailModal = (proforma) => {
    const cliente = DataService.getClienteById(proforma.clienteId || proforma.cliente_id);
    const fechaProforma = proforma.fecha_emision || proforma.fecha || '';
    const validezDias = proforma.validez_dias || proforma.validezDias || 15;
    const fechaVencimiento = new Date(fechaProforma);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + validezDias);
    const items = proforma.items || [];
    const subtotalValue = parseFloat(proforma.subtotal) || 0;
    const totalValue = parseFloat(proforma.total) || 0;
    const proformaCode = proforma.proformaId || proforma.codigo_proforma || '';
    const proformaNumero = proforma.numero || proforma.numero_proforma || '';

    return `
      <div class="modal-overlay open" onclick="ProformasModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <div>
              <h3 class="modal__title">Proforma #${proformaNumero}</h3>
              <p class="text-sm text-muted">${proformaCode}</p>
            </div>
            <button class="modal__close" onclick="ProformasModule.closeModal()">${Icons.x}</button>
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
                <div class="detail-item__label">Fecha Emisión</div>
                <div class="detail-item__value">${fechaProforma ? new Date(fechaProforma).toLocaleDateString('es-NI') : '-'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Creado Por</div>
                <div class="detail-item__value">${proforma.creadoPor || proforma.creado_por_nombre || 'Sistema'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Válida Hasta</div>
                <div class="detail-item__value">${fechaVencimiento.toLocaleDateString('es-NI')}</div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Estado</div>
                <div class="detail-item__value">
                  <span class="badge ${getEstadoBadgeClass(proforma.estado)}">${proforma.estado}</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-item__label">Moneda</div>
                <div class="detail-item__value">${proforma.moneda}</div>
              </div>
            </div>
            
            <!-- Items Table -->
            <div style="margin-top: var(--spacing-lg);">
              <h4 style="margin-bottom: var(--spacing-sm); color: var(--text-primary);">Detalle de Items</h4>
              ${items.length > 0 ? `
              <table class="data-table">
                <thead class="data-table__head">
                  <tr>
                    <th>Cantidad</th>
                    <th>Descripción</th>
                    <th>P. Unitario</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody class="data-table__body">
                  ${items.map(item => `
                    <tr>
                      <td>${item.cantidad}</td>
                      <td>${item.descripcion}</td>
                      <td>${proforma.moneda === 'USD' ? '$' : 'C$'}${(parseFloat(item.precioUnitario || item.precio_unitario) || 0).toFixed(2)}</td>
                      <td class="font-medium">${proforma.moneda === 'USD' ? '$' : 'C$'}${(parseFloat(item.total) || 0).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ` : '<p class="text-muted text-sm">No hay items registrados</p>'}
            </div>

            <div class="proforma-totals" style="margin-top: var(--spacing-md);">
              <div class="proforma-totals__row">
                <span>Subtotal:</span>
                <span>${proforma.moneda === 'USD' ? '$' : 'C$'}${subtotalValue.toFixed(2)}</span>
              </div>
              <div class="proforma-totals__row proforma-totals__row--total">
                <span>Total:</span>
                <span>${proforma.moneda === 'USD' ? '$' : 'C$'}${totalValue.toFixed(2)}</span>
              </div>
            </div>

            ${proforma.notas ? `
              <div class="detail-item detail-item--full" style="margin-top: var(--spacing-md);">
                <div class="detail-item__label">Notas</div>
                <div class="detail-item__value">${proforma.notas}</div>
              </div>
            ` : ''}
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="ProformasModule.closeModal()">Cerrar</button>
            <button class="btn btn--success" onclick="ProformasModule.sendViaWhatsApp('${proformaCode}')" title="Enviar por WhatsApp">
              ${Icons.messageCircle} WhatsApp
            </button>
            <button class="btn btn--primary" onclick="ProformasModule.generatePDF('${proformaCode}')">${Icons.fileText} Generar PDF</button>
          </div>
        </div>
      </div>
    `;
  };

  // ========== REPORT MODAL ==========

  const renderReportModal = () => {
    const clientes = DataService.getClientesSync();
    return `
      <div class="modal-overlay open" onclick="ProformasModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${Icons.barChart} Reportes de Proformas</h3>
            <button class="modal__close" onclick="ProformasModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            <div class="report-options">
              <h4 style="margin-bottom: var(--spacing-md);">Tipo de Reporte</h4>
              
              <!-- Por Cliente -->
              <div class="report-option card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md);">
                <h5 style="margin-bottom: var(--spacing-sm);">Reporte por Cliente</h5>
                <div class="form-row">
                  <select id="reportClienteId" class="form-select" style="flex: 1;">
                    <option value="">Seleccionar cliente...</option>
                    ${clientes.map(c => `<option value="${c.clienteId}">${c.empresa} - ${c.nombreCliente}</option>`).join('')}
                  </select>
                  <button type="button" class="btn btn--primary" onclick="ProformasModule.generateClienteReport()">
                    ${Icons.fileText} Generar
                  </button>
                </div>
              </div>

              <!-- Por Rango de Números -->
              <div class="report-option card" style="padding: var(--spacing-md);">
                <h5 style="margin-bottom: var(--spacing-sm);">Reporte por Secuencia</h5>
                <div class="form-row">
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Desde Nº</label>
                    <input type="number" id="reportNumInicio" class="form-input" min="1" placeholder="1">
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label class="form-label">Hasta Nº</label>
                    <input type="number" id="reportNumFin" class="form-input" min="1" placeholder="100">
                  </div>
                  <div class="form-group" style="align-self: flex-end;">
                    <button type="button" class="btn btn--primary" onclick="ProformasModule.generateRangoReport()">
                      ${Icons.fileText} Generar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="ProformasModule.closeModal()">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ========== PDF GENERATION ==========

  const generatePDF = (proformaId) => {
    const proforma = DataService.getProformaById(proformaId);
    if (!proforma) return;

    const cliente = DataService.getClienteById(proforma.clienteId || proforma.cliente_id);
    const fechaProforma = proforma.fecha_emision || proforma.fecha || '';
    const validezDias = proforma.validez_dias || proforma.validezDias || 15;
    const fechaVencimiento = new Date(fechaProforma);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + validezDias);
    const simbolo = proforma.moneda === 'USD' ? '$' : 'C$';
    const items = proforma.items || [];
    const subtotalValue = parseFloat(proforma.subtotal) || 0;
    const totalValue = parseFloat(proforma.total) || 0;
    const proformaNumero = proforma.numero || proforma.numero_proforma || '';

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        <div class="company-info">
          ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 50px; margin-bottom: 5px;">` : ''}
          <h1>${companyConfig.name}</h1>
          <p>Soluciones en Tecnología</p>
        </div>
        <div class="proforma-info">
          <h2>PROFORMA</h2>
          <p><strong>Nº:</strong> ${String(proformaNumero).padStart(4, '0')}</p>
          <p><strong>Fecha:</strong> ${fechaProforma ? new Date(fechaProforma).toLocaleDateString('es-NI') : '-'}</p>
          <p><strong>Válida hasta:</strong> ${fechaVencimiento.toLocaleDateString('es-NI')}</p>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Cliente</div>
        <div class="client-info">
          <p><strong>${cliente?.empresa || 'N/A'}</strong></p>
          <p>${cliente?.nombreCliente || ''}</p>
          <p>${cliente?.direccion || ''}</p>
          <p>Tel: ${cliente?.telefono || ''}</p>
          <p>Email: ${cliente?.correo || ''}</p>
        </div>
      </div>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Cant.</th>
              <th>Descripción</th>
              <th style="width: 100px;">P. Unitario</th>
              <th style="width: 100px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? items.map(item => `
              <tr>
                <td style="text-align: center;">${item.cantidad}</td>
                <td>${item.descripcion}</td>
                <td style="text-align: right;">${simbolo}${(parseFloat(item.precioUnitario || item.precio_unitario) || 0).toFixed(2)}</td>
                <td style="text-align: right;">${simbolo}${(parseFloat(item.total) || 0).toFixed(2)}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center;">Sin items</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${simbolo}${subtotalValue.toFixed(2)}</span>
        </div>
        <div class="totals-row totals-row--total">
          <span>TOTAL:</span>
          <span>${simbolo}${totalValue.toFixed(2)}</span>
        </div>
      </div>

      ${proforma.notas ? `
        <div class="section">
          <div class="section-title">Notas y Condiciones</div>
          <p>${proforma.notas}</p>
        </div>
      ` : ''}

      <div class="validity-notice">
        <p>Esta proforma tiene una validez de <strong>${validezDias} días</strong> a partir de la fecha de emisión.</p>
      </div>
    `;

    const htmlContent = generatePDFTemplate('Proforma', content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const generateClienteReport = () => {
    const clienteId = document.getElementById('reportClienteId').value;
    if (!clienteId) {
      alert('Por favor, selecciona un cliente.');
      return;
    }

    const cliente = DataService.getClienteById(clienteId);
    const proformas = DataService.getProformasByCliente(clienteId);

    if (proformas.length === 0) {
      alert('No hay proformas para este cliente.');
      return;
    }

    const totalValor = proformas.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
        <h1>${companyConfig.name} - Reporte por Cliente</h1>
        <p><strong>${cliente?.empresa}</strong> - ${cliente?.nombreCliente}</p>
        <p>Generado: ${new Date().toLocaleString('es-NI')}</p>
      </div>

      <div class="section">
        <div class="section-title">Resumen</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Total Proformas</div>
            <div class="info-value">${proformas.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Aprobadas</div>
            <div class="info-value">${proformas.filter(p => p.estado === 'Aprobada').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Activas</div>
            <div class="info-value">${proformas.filter(p => p.estado === 'Activa').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Valor Total</div>
            <div class="info-value">$${totalValor.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Historial de Proformas</div>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Fecha</th>
              <th>Items</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${proformas.map(p => `
              <tr>
                <td>${p.numero || p.numero_proforma || ''}</td>
                <td>${(p.fecha_emision || p.fecha) ? new Date(p.fecha_emision || p.fecha).toLocaleDateString('es-NI') : '-'}</td>
                <td>${(p.items || []).length}</td>
                <td>$${(parseFloat(p.total) || 0).toFixed(2)}</td>
                <td><span class="badge badge-${p.estado === 'Aprobada' ? 'success' : p.estado === 'Activa' ? 'primary' : 'warning'}">${p.estado}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const htmlContent = generatePDFTemplate('Reporte por Cliente', content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    closeModal();
  };

  const generateRangoReport = () => {
    const numInicio = parseInt(document.getElementById('reportNumInicio').value) || 1;
    const numFin = parseInt(document.getElementById('reportNumFin').value) || 9999;

    const proformas = DataService.getProformasByRango(numInicio, numFin);

    if (proformas.length === 0) {
      alert('No hay proformas en este rango.');
      return;
    }

    const totalValor = proformas.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
        <h1>${companyConfig.name} - Reporte por Secuencia</h1>
        <p>Rango: Nº ${numInicio} - ${numFin}</p>
        <p>Generado: ${new Date().toLocaleString('es-NI')}</p>
      </div>

      <div class="section">
        <div class="section-title">Resumen</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Total Proformas</div>
            <div class="info-value">${proformas.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Aprobadas</div>
            <div class="info-value">${proformas.filter(p => p.estado === 'Aprobada').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Activas</div>
            <div class="info-value">${proformas.filter(p => p.estado === 'Activa').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Valor Total</div>
            <div class="info-value">$${totalValor.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Listado de Proformas</div>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Items</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${proformas.map(p => {
      const cliente = DataService.getClienteById(p.clienteId || p.cliente_id);
      return `
                <tr>
                  <td>${p.numero || p.numero_proforma || ''}</td>
                  <td>${(p.fecha_emision || p.fecha) ? new Date(p.fecha_emision || p.fecha).toLocaleDateString('es-NI') : '-'}</td>
                  <td>${cliente?.empresa || 'N/A'}</td>
                  <td>${(p.items || []).length}</td>
                  <td>$${(parseFloat(p.total) || 0).toFixed(2)}</td>
                  <td><span class="badge badge-${p.estado === 'Aprobada' ? 'success' : p.estado === 'Activa' ? 'primary' : 'warning'}">${p.estado}</span></td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const htmlContent = generatePDFTemplate('Reporte por Secuencia', content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    closeModal();
  };

  const generatePDFTemplate = (title, content) => {
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH' };
    return `
      <!DOCTYPE html>
      <html>
      <head>
            <meta charset="UTF-8">
              <title>${title}</title>
              <style>
                * {margin: 0; padding: 0; box-sizing: border-box; }
                body {font - family: Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
                .header {display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #1a73e8; padding-bottom: 20px; }
                .header h1, .company-info h1 {color: #1a73e8; font-size: 24px; margin-bottom: 5px; }
                .header h2, .proforma-info h2 {color: #333; font-size: 20px; text-align: right; }
                .header p {color: #666; margin-top: 3px; }
                .proforma-info {text - align: right; }
                .section {margin - bottom: 25px; }
                .section-title {font - size: 14px; font-weight: bold; color: #1a73e8; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                .client-info p {margin: 3px 0; }
                .info-grid {display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .info-item {padding: 10px; background: #f8f9fa; border-radius: 4px; }
                .info-label {font - size: 10px; color: #666; text-transform: uppercase; margin-bottom: 3px; }
                .info-value {font - size: 16px; font-weight: 600; }
                table {width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td {padding: 10px 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th {background: #1a73e8; color: white; font-weight: 600; }
                tr:nth-child(even) {background: #f8f9fa; }
                .totals {margin - top: 20px; margin-left: auto; width: 250px; }
                .totals-row {display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                .totals-row--total {border - top: 2px solid #1a73e8; border-bottom: none; font-weight: bold; font-size: 16px; color: #1a73e8; padding-top: 12px; }
                .validity-notice {margin - top: 30px; padding: 15px; background: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107; }
                .footer {margin - top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
                .badge {display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 500; }
                .badge-success {background: #d4edda; color: #155724; }
                .badge-primary {background: #cce5ff; color: #004085; }
                .badge-warning {background: #fff3cd; color: #856404; }
                @media print {body {padding: 20px; } }
              </style>
          </head>
          <body>
            ${content}
            <div class="footer">
              <p>${companyConfig.name || 'ALLTECH'} - Sistema de Gestión Empresarial</p>
              <p>Generado automáticamente</p>
            </div>
          </body>
        </html>
    `;
  };

  // ========== EVENT HANDLERS ==========

  const handleSearch = (value) => { filterState.search = value; App.refreshCurrentModule(); };
  const handleClienteFilter = (value) => { filterState.clienteId = value; App.refreshCurrentModule(); };
  const handleEstadoFilter = (value) => { filterState.estado = value; App.refreshCurrentModule(); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    // Validate items
    const validItems = currentItems.filter(item => item.descripcion && item.cantidad > 0);
    if (validItems.length === 0) {
      alert('Por favor, agrega al menos un item válido.');
      return;
    }

    data.items = validItems;
    data.validezDias = parseInt(data.validezDias) || 15;
    data.subtotal = validItems.reduce((sum, item) => sum + item.total, 0);
    data.iva = 0;
    data.total = data.subtotal;

    // Add user info
    const user = State.get('user');
    data.usuarioId = user.id;
    data.creadoPor = user.name;

    try {
      if (data.proformaId) {
        await DataService.updateProforma(data.proformaId, data);
      } else {
        await DataService.createProforma(data);
      }

      closeModal();
      App.refreshCurrentModule();
      if (typeof App.showNotification === 'function') {
        App.showNotification(data.proformaId ? 'Proforma actualizada' : 'Proforma creada exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error al guardar proforma:', error);
      alert('Error al guardar la proforma: ' + (error.message || 'Error desconocido'));
    }
  };

  const aprobarProforma = async (proformaId) => {
    if (confirm('¿Deseas aprobar esta proforma?')) {
      try {
        await DataService.updateProforma(proformaId, { estado: 'Aprobada' });
        App.refreshCurrentModule();
        if (typeof App.showNotification === 'function') {
          App.showNotification('Proforma aprobada', 'success');
        }
      } catch (error) {
        console.error('Error al aprobar proforma:', error);
        alert('Error al aprobar: ' + (error.message || 'Error desconocido'));
      }
    }
  };

  const openCreateModal = () => {
    currentItems = [{ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }];
    document.getElementById('proformaModal').innerHTML = renderFormModal();
    setTimeout(calculateTotals, 100);
  };

  const openEditModal = (id) => {
    const proforma = DataService.getProformaById(id);
    if (proforma) {
      // Load existing items into editor (handle both legacy and DB field names)
      currentItems = (proforma.items || []).map(item => ({
        cantidad: parseFloat(item.cantidad) || 1,
        descripcion: item.descripcion || '',
        precioUnitario: parseFloat(item.precioUnitario || item.precio_unitario) || 0,
        total: parseFloat(item.total) || 0
      }));
      if (currentItems.length === 0) {
        currentItems = [{ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }];
      }
      document.getElementById('proformaModal').innerHTML = renderFormModal(proforma);
      setTimeout(calculateTotals, 100);
    }
  };

  const deleteProforma = async (proformaId) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta proforma?')) {
      try {
        await DataService.deleteProforma(proformaId);
        App.refreshCurrentModule();
        if (typeof App.showNotification === 'function') {
          App.showNotification('Proforma eliminada', 'success');
        }
      } catch (error) {
        console.error('Error al eliminar proforma:', error);
        alert('Error al eliminar: ' + (error.message || 'Error desconocido'));
      }
    }
  };

  const viewDetail = (id) => {
    const proforma = DataService.getProformaById(id);
    if (proforma) document.getElementById('proformaModal').innerHTML = renderDetailModal(proforma);
  };

  const openReportModal = () => {
    document.getElementById('proformaModal').innerHTML = renderReportModal();
  };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('proformaModal').innerHTML = '';
    currentItems = [];
  };

  // ========== WHATSAPP INTEGRATION ==========
  const sendViaWhatsApp = async (proformaId) => {
    const proforma = DataService.getProformaById(proformaId);
    if (!proforma) {
      alert('Proforma no encontrada');
      return;
    }

    const cliente = DataService.getClienteById(proforma.clienteId || proforma.cliente_id);
    if (!cliente || !cliente.telefono) {
      alert('Cliente no tiene teléfono registrado');
      return;
    }

    const items = proforma.items || [];
    const divisa = proforma.moneda || 'USD';
    const simbolo = divisa === 'USD' ? '$' : 'C$';

    // Formatear items para el mensaje
    const itemsList = items.map((item, index) => {
      const precio = parseFloat(item.precioUnitario || item.precio_unitario) || 0;
      const total = (parseFloat(item.cantidad) || 0) * precio;
      return `${index + 1}. ${item.descripcion}\n   Cant: ${item.cantidad} x ${simbolo}${precio.toFixed(2)} = ${simbolo}${total.toFixed(2)}`;
    }).join('\n\n');

    // Calcular totales
    const totalValue = parseFloat(proforma.total) || 0;
    const proformaCode = proforma.proformaId || proforma.codigo_proforma || '';

    // Preparar variables para el template
    const templateVars = {
      cliente: cliente.nombreCliente || cliente.empresa || 'Cliente',
      proformaId: proformaCode,
      items: itemsList,
      total: `${simbolo}${totalValue.toFixed(2)} ${divisa}`
    };

    // Enviar via WhatsApp usando template
    const result = await WhatsAppService.sendTemplate(
      cliente.telefono,
      'proforma_enviada',
      templateVars
    );

    if (result.success) {
      alert('WhatsApp abierto. Por favor confirma el envío del mensaje.');
      if (typeof LogService !== 'undefined') {
        LogService.log('proformas', 'whatsapp', proformaId,
          `Proforma enviada por WhatsApp a ${cliente.nombre}`);
      }
    } else {
      alert('Error al abrir WhatsApp: ' + result.error);
    }
  };

  // ========== CURRENCY MANAGEMENT ==========
  const updateCurrencySymbols = (moneda) => {
    const symbol = moneda === 'USD' ? '$' : 'C$';

    // Update all currency symbols in the form
    const subtotalEl = document.getElementById('proformaSubtotal');
    const totalEl = document.getElementById('proformaTotal');

    if (subtotalEl) {
      const currentSubtotal = parseFloat(subtotalEl.textContent.replace(/[^0-9.]/g, '')) || 0;
      subtotalEl.textContent = `${symbol}${currentSubtotal.toFixed(2)}`;
    }

    if (totalEl) {
      const currentTotal = parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) || 0;
      totalEl.textContent = `${symbol}${currentTotal.toFixed(2)}`;
    }

    // Update item totals
    const itemTotals = document.querySelectorAll('.proforma-item__total');
    itemTotals.forEach(el => {
      const currentValue = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
      el.textContent = `${symbol}${currentValue.toFixed(2)}`;
    });
  };

  // ========== PUBLIC API ==========
  return {
    render,
    openCreateModal,
    openEditModal,
    viewDetail,
    closeModal,
    handleSearch,
    handleClienteFilter,
    handleEstadoFilter,
    handleSubmit,
    addItem,
    removeItem,
    updateItem,
    generatePDF,
    openReportModal,
    generateClienteReport,
    generateRangoReport,
    aprobarProforma,
    deleteProforma,
    sendViaWhatsApp,
    updateCurrencySymbols
  };
})();
