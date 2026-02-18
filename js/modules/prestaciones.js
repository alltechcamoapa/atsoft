/**
 * ALLTECH - Módulo de Prestaciones Sociales (Nicaragua)

 * Gestión de prestaciones laborales conforme a la ley nicaragüense
 */

const PrestacionesModule = (() => {

  // State

  let currentTab = 'empleados';

  let currentComplementoTab = 'ausencias';

  let searchTerm = '';

  // ========== RENDERING ==========

  const render = () => {

    return `

      <div class="module-container">

        <div class="module-header">

          <h2 class="module-title">${Icons.users} Prestaciones Sociales</h2>

        </div>

        <!-- Tabs -->

        <div class="tabs-container">

          <button class="tab-btn ${currentTab === 'empleados' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('empleados')">

            ${Icons.users} <span>Empleados</span>

          </button>

          <button class="tab-btn ${currentTab === 'vacaciones' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('vacaciones')">

            ${Icons.calendar} <span>Vacaciones</span>

          </button>

          <button class="tab-btn ${currentTab === 'complementos' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('complementos')">

            ${Icons.plusCircle} <span>Complementos Salariales</span>

          </button>

          <button class="tab-btn ${currentTab === 'recibos' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('recibos')">

            ${Icons.fileText} <span>Recibos</span>

          </button>

          <button class="tab-btn ${currentTab === 'aguinaldo' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('aguinaldo')">

            ${Icons.gift} <span>Aguinaldo</span>

          </button>

          <button class="tab-btn ${currentTab === 'liquidacion' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('liquidacion')">

            ${Icons.dollarSign} <span>Liquidación</span>

          </button>

          <button class="tab-btn ${currentTab === 'reportes' ? 'active' : ''}" 

                  onclick="PrestacionesModule.changeTab('reportes')">

            ${Icons.barChart} <span>Reportes</span>

          </button>

        </div>

        <!-- Tab Content -->

        <div class="module-content">

          ${renderTabContent()}

        </div>

      </div>

      <div id="prestacionesModal"></div>

    `;

  };

  const renderTabContent = () => {

    switch (currentTab) {

      case 'empleados': return renderEmpleadosTab();

      case 'vacaciones': return renderVacacionesTab();

      case 'complementos': return renderComplementosTab();

      case 'aguinaldo': return renderAguinaldoTab();

      case 'recibos': return renderRecibosTab();

      case 'liquidacion': return renderLiquidacionTab();

      case 'reportes': return renderReportesTab();

      default: return renderEmpleadosTab();

    }

  };

  // ========== COMPLEMENTOS TAB (TABBED LAYOUT) ==========

  const changeSubTab = (tab) => {

    currentComplementoTab = tab;

    App.refreshCurrentModule();

  };

  const renderComplementosTab = () => {

    setTimeout(() => {

      if (currentComplementoTab === 'ausencias') loadAusenciasTable();

      if (currentComplementoTab === 'extras') loadHorasExtrasTable();

      if (currentComplementoTab === 'bonos') loadBonificacionesTable();

      if (currentComplementoTab === 'adelantos') loadAdelantosTable();

    }, 100);

    const tabs = [

      { id: 'ausencias', label: 'Ausencias', icon: Icons.clock },

      { id: 'extras', label: 'Horas Extras', icon: Icons.clock },

      { id: 'bonos', label: 'Bonos', icon: Icons.award },

      { id: 'adelantos', label: 'Adelantos', icon: Icons.dollarSign }

    ];

    return `

      <div class="sub-tabs-container" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">

        ${tabs.map(t => `

            <button class="btn ${currentComplementoTab === t.id ? 'btn--primary' : 'btn--ghost'}" 

                    onclick="PrestacionesModule.changeSubTab('${t.id}')">

                ${t.icon} ${t.label}

            </button>

        `).join('')}

      </div>

      

      <div class="sub-tab-content">

        ${currentComplementoTab === 'ausencias' ? `

            <div class="card">

              <div class="card__header" style="background: #1a1f36; color: white;">

                <h3 class="card__title" style="color: white;">${Icons.clock} Ausencias y Permisos</h3>

                <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.registrarAusencia()">

                  ${Icons.plus} Registrar Ausencia

                </button>

              </div>

              <div class="card__body" style="overflow-x: auto;">

                  <table class="data-table">

                    <thead><tr><th>Empleado</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Tipo</th><th>Motivo</th><th>Acciones</th></tr></thead>

                    <tbody id="ausenciasTableBody"><tr><td colspan="7">Cargando...</td></tr></tbody>

                  </table>

              </div>

            </div>

        ` : ''}

        ${currentComplementoTab === 'extras' ? `

            <div class="card">

              <div class="card__header" style="background: #1a1f36; color: white;">

                <h3 class="card__title" style="color: white;">${Icons.clock} Horas Extras Trabajadas</h3>

                <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.registrarHoraExtra()">

                  ${Icons.plus} Registrar Horas

                </button>

              </div>

              <div class="card__body" style="overflow-x: auto;">

                  <table class="data-table">

                    <thead><tr><th>Empleado</th><th>Fecha</th><th>Horas</th><th>Monto</th><th>Motivo</th><th>Acciones</th></tr></thead>

                    <tbody id="horasExtrasTableBody"><tr><td colspan="6">Cargando...</td></tr></tbody>

                  </table>

              </div>

            </div>

        ` : ''}

        ${currentComplementoTab === 'bonos' ? `

            <div class="card">

              <div class="card__header" style="background: #1a1f36; color: white;">

                <h3 class="card__title" style="color: white;">${Icons.award} Bonos y Comisiones</h3>

                <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.registrarBonificacion()">

                  ${Icons.plus} Registrar Bono

                </button>

              </div>

              <div class="card__body" style="overflow-x: auto;">

                  <table class="data-table">

                    <thead><tr><th>Empleado</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Acciones</th></tr></thead>

                    <tbody id="bonosTableBody"><tr><td colspan="5">Cargando...</td></tr></tbody>

                  </table>

              </div>

            </div>

        ` : ''}

        ${currentComplementoTab === 'adelantos' ? `

            <div class="card">

              <div class="card__header" style="background: #1a1f36; color: white;">

                <h3 class="card__title" style="color: white;">${Icons.dollarSign} Adelantos de Salario</h3>

                <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.registrarAdelanto()">

                  ${Icons.plus} Solicitar Adelanto

                </button>

              </div>

              <div class="card__body" style="overflow-x: auto;">

                  <table class="data-table">

                    <thead><tr><th>Empleado</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead>

                    <tbody id="adelantosTableBody"><tr><td colspan="5">Cargando...</td></tr></tbody>

                  </table>

              </div>

            </div>

        ` : ''}

      </div>

      

      <style>

        .sub-tabs-container .btn {

            border-bottom: 2px solid transparent;

            border-radius: 0;

            padding: 10px 20px;

            font-weight: 500;

        }

        .sub-tabs-container .btn.btn--primary {

            background: none;

            color: var(--color-primary-600);

            border-bottom-color: var(--color-primary-600);

        }

        .sub-tabs-container .btn:hover {

            background: var(--color-primary-50);

        }

      </style>

    `;

  };

  // Helper functions for Complementos

  const loadAusenciasTable = async () => {

    // Reuse existing logic

    const ausencias = await DataService.getAllAusencias();

    const tbody = document.getElementById('ausenciasTableBody');

    if (tbody) tbody.innerHTML = renderAusenciasRows(ausencias);

  };

  const renderAusenciasRows = (list) => {

    if (!list || !list.length) return '<tr><td colspan="7" class="text-center">No hay registros</td></tr>';

    return list.map(a => `

        <tr>

            <td>${a.empleado?.nombre || 'N/A'}</td>

            <td>${new Date(a.fecha_inicio).toLocaleDateString('es-NI')}</td>

            <td>${new Date(a.fecha_fin).toLocaleDateString('es-NI')}</td>

            <td>${a.dias}</td>

            <td>${a.tipo_descuento === 'vacaciones' ? 'Vacaciones' : 'Día Laboral'}</td>

            <td>${a.motivo || '-'}</td>

             <td>

                <button class="btn btn--ghost btn--icon btn--sm" onclick="PrestacionesModule.editAusencia('${a.id}')" title="Editar">${Icons.edit}</button>

                <button class="btn btn--ghost btn--sm btn--icon text-error" onclick="PrestacionesModule.deleteAusencia('${a.id}')">${Icons.trash}</button>

            </td>

        </tr>`).join('');

  };

  // ========== EMPLEADOS TAB ==========

  const renderEmpleadosTab = () => {

    const empleados = DataService.getEmpleadosSync?.() || [];

    const filtered = empleados.filter(e => {

      if (!searchTerm) return true;

      const term = searchTerm.toLowerCase();

      return e.nombre?.toLowerCase().includes(term) ||

        e.cedula?.includes(term) ||

        e.cargo?.toLowerCase().includes(term);

    });

    return `

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 20px;">

        <div class="search-bar" style="flex: 1; margin-bottom: 0;">

            <input type="text" class="search-input" placeholder="Buscar empleados..." 

                value="${searchTerm}" 

                oninput="PrestacionesModule.handleSearch(this.value)">

        </div>

        <button class="btn btn--primary" onclick="PrestacionesModule.openEmpleadoModal()">

            ${Icons.plus} Nuevo Empleado

        </button>

      </div>

      <div class="table-container">

        <table class="data-table">

          <thead>

            <tr>

              <th>Empleado</th>

              <th>Cédula</th>

              <th>Cargo</th>

              <th>Fecha Alta</th>

              <th>Salario</th>

              <th>Tipo Contrato</th>

              <th>Estado</th>

              <th>Acciones</th>

            </tr>

          </thead>

          <tbody>

            ${filtered.length === 0 ? `

              <tr>

                <td colspan="8" class="table__empty">

                  <p>No hay empleados registrados</p>

                </td>

              </tr>

            ` : filtered.map(emp => {

      const fechaAlta = emp.fechaAlta || emp.fecha_alta;

      const salario = parseFloat(emp.salarioTotal || emp.salario_total) || 0;

      const contrato = emp.tipoContrato || emp.tipo_contrato || 'No especificado';

      const isReContratado = (emp.observaciones || '').includes('[RE-CONTRATACIÓN');

      return `

              <tr>

                <td data-label="Empleado">

                  <div>

                    <div class="font-medium">${emp.nombre} ${isReContratado ? `<span class="badge badge--info" style="font-size: 10px; padding: 2px 6px;">RE-CONTRATADO</span>` : ''}</div>

                    <div class="text-sm text-muted">${emp.email || '-'}</div>

                  </div>

                </td>

                <td data-label="Cédula">${emp.cedula || '-'}</td>

                <td data-label="Cargo">${emp.cargo || '-'}</td>

                <td data-label="Fecha Alta">${fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-NI') : '-'}</td>

                <td data-label="Salario" class="font-medium">C$${salario.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>

                <td data-label="Tipo Contrato">

                  <span class="badge ${contrato === 'Indefinido' ? 'badge--success' : 'badge--warning'}">

                    ${contrato}

                  </span>

                </td>

                <td data-label="Estado">

                  <span class="badge ${emp.estado === 'Activo' ? 'badge--success' : 'badge--error'}">

                    ${emp.estado || 'Activo'}

                  </span>

                </td>

                <td data-label="Acciones">

                  <div class="table__actions">

                    <button class="btn btn--ghost btn--icon btn--sm" 

                            onclick="PrestacionesModule.viewEmpleado('${emp.id}')" 

                            title="Ver detalles">

                      ${Icons.eye}

                    </button>

                    ${emp.estado === 'Inactivo' ? `

                    <button class="btn btn--ghost btn--icon btn--sm text-success" 

                            onclick="PrestacionesModule.darDeAltaEmpleado('${emp.id}')" 

                            title="Dar de Alta (Re-contratar)">

                      ${Icons.checkCircle}

                    </button>

                    ` : ''}

                    <button class="btn btn--ghost btn--icon btn--sm" 

                            onclick="PrestacionesModule.editEmpleado('${emp.id}')" 

                            title="Editar">

                      ${Icons.edit}

                    </button>

                    <button class="btn btn--ghost btn--icon btn--sm text-error" 

                            onclick="PrestacionesModule.deleteEmpleado('${emp.id}')" 

                            title="Eliminar">

                      ${Icons.trash}

                    </button>

                  </div>

                </td>

              </tr>

            `;

    }).join('')}

          </tbody>

        </table>

      </div>

    `;

  };

  // ========== VACACIONES TAB ==========

  const renderVacacionesTab = () => {

    const empleados = DataService.getEmpleadosSync?.() || [];

    const activosConVacaciones = empleados

      .filter(e => e.estado === 'Activo')

      .map(e => calcularVacaciones(e));

    return `

      <div class="card">

        <div class="card__header">

          <h3 class="card__title">${Icons.calendar} Control de Vacaciones</h3>

          <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.registrarVacaciones()">

            ${Icons.plus} Registrar Vacaciones

          </button>

        </div>

        <div class="card__body">

          <div class="table-container">

            <table class="data-table">

              <thead>

                <tr>

                  <th>Empleado</th>

                  <th>Antigüedad</th>

                  <th>Días Acumulados</th>

                  <th>Días Tomados</th>

                  <th>Días Disponibles</th>

                  <th>Próximo Período</th>

                  <th>Acciones</th>

                </tr>

              </thead>

              <tbody>

                ${activosConVacaciones.map(vac => `

                  <tr>

                    <td>

                      <div class="font-medium">${vac.nombre}</div>

                      <div class="text-sm text-muted">${vac.cargo}</div>

                    </td>

                    <td>${vac.antiguedadAnios} año(s)</td>

                    <td class="text-center">${vac.diasAcumulados}</td>

                    <td class="text-center">${vac.diasTomados}</td>

                    <td class="text-center">

                      <span class="badge ${vac.diasDisponibles > 5 ? 'badge--success' : 'badge--warning'}">

                        ${vac.diasDisponibles} días

                      </span>

                    </td>

                    <td>${vac.proximoPeriodo}</td>

                    <td>

                      <div class="table__actions">

                        <button class="btn btn--primary btn--sm btn--icon" 

                                onclick="PrestacionesModule.registrarVacaciones('${vac.id}')" title="Registrar Vacaciones">

                          ${Icons.plus}

                        </button>

                        <button class="btn btn--ghost btn--sm" 

                                onclick="PrestacionesModule.verHistorialVacaciones('${vac.id}')">

                          Historial

                        </button>

                        <button class="btn btn--ghost btn--icon btn--sm text-error" 

                                onclick="PrestacionesModule.eliminarHistorialVacaciones('${vac.id}')" title="Eliminar Todo el Historial">

                          ${Icons.trash}

                        </button>

                      </div>

                    </td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      <div class="info-card info-card--primary" style="margin-top: var(--spacing-lg);">

        <h4>ðŸ“˜ Ley Laboral de Nicaragua - Vacaciones</h4>

        <ul style="margin: var(--spacing-sm) 0; padding-left: var(--spacing-lg);">

          <li>15 días continuos después del primer año de trabajo</li>

          <li>1 día adicional por cada año a partir del segundo año (máximo 30 días)</li>

          <li>Las vacaciones no pueden compensarse en dinero, salvo al finalizar el contrato</li>

          <li>El empleado recibe su salario ordinario más un día adicional por cada 6 meses trabajados</li>

        </ul>

      </div>

    `;

  };

  // --- Complementos Storage Helpers (Local for now, mocked Generic Tables) ---

  const saveComplemento = (key, data) => {

    const current = JSON.parse(localStorage.getItem(key) || '[]');

    if (data.id) {

      const index = current.findIndex(x => x.id === data.id);

      if (index !== -1) {

        current[index] = { ...current[index], ...data };

      } else {

        current.push({ ...data, createdAt: new Date().toISOString() }); // Should not happen usually

      }

    } else {

      current.push({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() });

    }

    localStorage.setItem(key, JSON.stringify(current));

    App.showNotification?.('Registro guardado localmente', 'success');

    App.refreshCurrentModule();

  };

  const deleteComplemento = (key, id) => {

    if (!confirm('¿Eliminar registro?')) return;

    const current = JSON.parse(localStorage.getItem(key) || '[]');

    const filtered = current.filter(x => x.id !== id);

    localStorage.setItem(key, JSON.stringify(filtered));

    App.refreshCurrentModule();

  };

  const editComplemento = (key, id) => {

    const data = JSON.parse(localStorage.getItem(key) || '[]');

    const item = data.find(x => x.id === id);

    if (!item) return;

    if (key === 'horas_extras') registrarHoraExtra(item);

    if (key === 'bonificaciones') registrarBonificacion(item);

    if (key === 'adelantos') registrarAdelanto(item);

  };

  // Loaders implementation

  const loadHorasExtrasTable = async () => {

    const data = JSON.parse(localStorage.getItem('horas_extras') || '[]');

    const empleados = DataService.getEmpleadosSync();

    const tbody = document.getElementById('horasExtrasTableBody');

    if (tbody) {

      if (!data.length) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay registros</td></tr>';

      else tbody.innerHTML = data.map(d => {

        const emp = empleados.find(e => e.id === d.empleadoId);

        return `<tr><td>${emp?.nombre || 'Unknown'}</td><td>${d.fecha}</td><td>${d.cantidad}</td><td>C$${parseFloat(d.monto).toFixed(2)}</td><td>${d.motivo || '-'}</td>

            <td>

                <button class="btn btn--ghost btn--icon btn--sm" onclick="PrestacionesModule.editComplemento('horas_extras', '${d.id}')" title="Editar">${Icons.edit}</button>

                <button class="btn btn--ghost btn--icon btn--sm text-error" onclick="PrestacionesModule.deleteComplemento('horas_extras', '${d.id}')" title="Eliminar">${Icons.trash}</button>

            </td></tr>`;

      }).join('');

    }

  };

  const loadBonificacionesTable = async () => {

    const data = JSON.parse(localStorage.getItem('bonificaciones') || '[]');

    const empleados = DataService.getEmpleadosSync();

    const tbody = document.getElementById('bonosTableBody');

    if (tbody) {

      if (!data.length) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay registros</td></tr>';

      else tbody.innerHTML = data.map(d => {

        const emp = empleados.find(e => e.id === d.empleadoId);

        return `<tr><td>${emp?.nombre || 'Unknown'}</td><td>${d.fecha}</td><td>${d.concepto}</td><td>C$${parseFloat(d.monto).toFixed(2)}</td>

            <td>

                <button class="btn btn--ghost btn--icon btn--sm" onclick="PrestacionesModule.editComplemento('bonificaciones', '${d.id}')" title="Editar">${Icons.edit}</button>

                <button class="btn btn--ghost btn--icon btn--sm text-error" onclick="PrestacionesModule.deleteComplemento('bonificaciones', '${d.id}')" title="Eliminar">${Icons.trash}</button>

            </td></tr>`;

      }).join('');

    }

  };

  const loadAdelantosTable = async () => {

    const data = JSON.parse(localStorage.getItem('adelantos') || '[]');

    const empleados = DataService.getEmpleadosSync();

    const tbody = document.getElementById('adelantosTableBody');

    if (tbody) {

      if (!data.length) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay registros</td></tr>';

      else tbody.innerHTML = data.map(d => {

        const emp = empleados.find(e => e.id === d.empleadoId);

        return `<tr><td>${emp?.nombre || 'Unknown'}</td><td>${d.fecha}</td><td>C$${parseFloat(d.monto).toFixed(2)}</td><td><span class="badge badge--success">${d.estado || 'Aprobado'}</span></td>

            <td>

                <button class="btn btn--ghost btn--icon btn--sm" onclick="PrestacionesModule.editComplemento('adelantos', '${d.id}')" title="Editar">${Icons.edit}</button>

                <button class="btn btn--ghost btn--icon btn--sm" onclick="PrestacionesModule.imprimirReciboAdelanto('${d.id}')" title="Imprimir Recibo">${Icons.print}</button>

                <button class="btn btn--ghost btn--icon btn--sm text-error" onclick="PrestacionesModule.deleteComplemento('adelantos', '${d.id}')" title="Eliminar">${Icons.trash}</button>

            </td></tr>`;

      }).join('');

    }

  };

  // Actions

  const registrarHoraExtra = (editItem = null) => {

    const empleados = DataService.getEmpleadosSync();

    const html = `

        <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

            <div class="modal" onclick="event.stopPropagation()">

              <div class="modal__header">

                <h3 class="modal__title">${editItem ? 'Editar' : 'Registrar'} Horas Extras</h3>

                <button class="modal__close" onclick="PrestacionesModule.closeModal()">&times;</button>

              </div>

              <div class="modal__body">

                <form onsubmit="event.preventDefault(); const fd=new FormData(event.target); PrestacionesModule.saveComplemento('horas_extras', Object.fromEntries(fd)); PrestacionesModule.closeModal();">

                  <input type="hidden" name="id" value="${editItem?.id || ''}">

                    <div class="form-group">

                      <label>Empleado</label>

                      <select name="empleadoId" class="form-select" required>

                        ${empleados.map(e => `<option value="${e.id}" ${editItem?.empleadoId == e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}

                      </select>

                    </div>

                    <div class="form-row">

                      <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" required value="${editItem?.fecha || ''}"></div>

                      <div class="form-group"><label>Cantidad Horas</label><input type="number" name="cantidad" step="0.5" class="form-input" required value="${editItem?.cantidad || ''}"></div>

                    </div>

                    <div class="form-group"><label>Monto Total (C$)</label><input type="number" name="monto" step="0.01" class="form-input" required placeholder="Calculado según salario hora" value="${editItem?.monto || ''}"></div>

                    <div class="form-group"><label>Motivo</label><input type="text" name="motivo" class="form-input" placeholder="Ej: Proyecto urgente" value="${editItem?.motivo || ''}"></div>

                    <button type="submit" class="btn btn--primary">Guardar</button>

                </form>

              </div>

            </div>

        </div>`;

    document.getElementById('prestacionesModal').innerHTML = html;

  };

  const registrarBonificacion = (editItem = null) => {

    const empleados = DataService.getEmpleadosSync();

    const html = `

        <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

            <div class="modal" onclick="event.stopPropagation()">

              <div class="modal__header">

                <h3 class="modal__title">${editItem ? 'Editar' : 'Registrar'} Bonificación</h3>

                <button class="modal__close" onclick="PrestacionesModule.closeModal()">&times;</button>

              </div>

              <div class="modal__body">

                <form onsubmit="event.preventDefault(); const fd=new FormData(event.target); PrestacionesModule.saveComplemento('bonificaciones', Object.fromEntries(fd)); PrestacionesModule.closeModal();">

                  <input type="hidden" name="id" value="${editItem?.id || ''}">

                    <div class="form-group">

                      <label>Empleado</label>

                      <select name="empleadoId" class="form-select" required>

                        ${empleados.map(e => `<option value="${e.id}" ${editItem?.empleadoId == e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}

                      </select>

                    </div>

                    <div class="form-row">

                      <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" required value="${editItem?.fecha || ''}"></div>

                      <div class="form-group"><label>Monto (C$)</label><input type="number" name="monto" step="0.01" class="form-input" required value="${editItem?.monto || ''}"></div>

                    </div>

                    <div class="form-group"><label>Concepto</label><input type="text" name="concepto" class="form-input" placeholder="Ej: Bono por Cumplimiento" value="${editItem?.concepto || ''}"></div>

                    <button type="submit" class="btn btn--primary">Guardar</button>

                </form>

              </div>

            </div>

        </div>`;

    document.getElementById('prestacionesModal').innerHTML = html;

  };

  const registrarAdelanto = (editItem = null) => {

    const empleados = DataService.getEmpleadosSync();

    const html = `

        <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

            <div class="modal" onclick="event.stopPropagation()">

                <div class="modal__header">

                    <h3 class="modal__title">${editItem ? 'Editar' : 'Solicitar'} Adelanto</h3>

                    <button class="modal__close" onclick="PrestacionesModule.closeModal()">&times;</button>

                </div>

                <div class="modal__body">

                  <form onsubmit="event.preventDefault(); const fd=new FormData(event.target); PrestacionesModule.saveComplemento('adelantos', Object.fromEntries(fd)); PrestacionesModule.closeModal();">

                    <input type="hidden" name="id" value="${editItem?.id || ''}">

                      <div class="form-group">

                        <label>Empleado</label>

                        <select name="empleadoId" class="form-select" required>

                          ${empleados.map(e => `<option value="${e.id}" ${editItem?.empleadoId == e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}

                        </select>

                      </div>

                      <div class="form-row">

                        <div class="form-group"><label>Fecha</label><input type="date" name="fecha" class="form-input" required value="${editItem?.fecha || ''}"></div>

                        <div class="form-group"><label>Monto Solicitado (C$)</label><input type="number" name="monto" step="0.01" class="form-input" required value="${editItem?.monto || ''}"></div>

                      </div>

                      <input type="hidden" name="estado" value="Aprobado">

                      <button type="submit" class="btn btn--primary">Guardar</button>

                  </form>

                </div>

            </div>

        </div>`;

    document.getElementById('prestacionesModal').innerHTML = html;

  };

  // ========== AGUINALDO TAB ==========

  const renderAguinaldoTab = () => {

    const empleados = DataService.getEmpleadosSync?.() || [];

    const activos = empleados.filter(e => e.estado === 'Activo');

    const aguinaldos = activos.map(e => calcularAguinaldo(e));

    const totalAguinaldo = aguinaldos.reduce((sum, a) => sum + a.monto, 0);

    return `

      <div class="stats-row">

        <div class="stat-card stat-card--success">

          <div class="stat-card__header">

            <div class="stat-card__icon">${Icons.users}</div>

          </div>

          <span class="stat-card__label">Empleados Activos</span>

          <span class="stat-card__value">${activos.length}</span>

        </div>

        

        <div class="stat-card stat-card--primary">

          <div class="stat-card__header">

            <div class="stat-card__icon">${Icons.dollarSign}</div>

          </div>

          <span class="stat-card__label">Total Aguinaldo ${new Date().getFullYear()}</span>

          <span class="stat-card__value">C$${totalAguinaldo.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>

        </div>

      </div >

      <div class="card" style="margin-top: var(--spacing-lg);">

        <div class="card__header">

          <h3 class="card__title">${Icons.gift} Cálculo de Aguinaldo</h3>

          <button class="btn btn--primary btn--sm" onclick="PrestacionesModule.generarAguinaldoReporte()">

            ${Icons.download} Generar Planilla

          </button>

        </div>

        <div class="card__body">

          <div class="table-container">

            <table class="data-table">

              <thead>

                <tr>

                  <th>Empleado</th>

                  <th>Fecha Alta</th>

                  <th>Meses Laborados</th>

                  <th>Salario Mensual</th>

                  <th>Monto Aguinaldo</th>

                  <th>Estado Pago</th>

                  <th>Acciones</th>

                </tr>

              </thead>

              <tbody>

                ${aguinaldos.map(ag => `

                  <tr>

                    <td>

                      <div class="font-medium">${ag.nombre}</div>

                      <div class="text-sm text-muted">${ag.cedula}</div>

                    </td>

                    <td>${new Date(ag.fechaAlta).toLocaleDateString('es-NI')}</td>

                    <td class="text-center">${ag.mesesLaborados}</td>

                    <td>C$${ag.salario.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>

                    <td class="font-medium text-success">C$${ag.monto.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>

                    <td>

                      <span class="badge ${ag.pagado ? 'badge--success' : 'badge--warning'}">

                        ${ag.pagado ? 'Pagado' : 'Pendiente'}

                      </span>

                    </td>

                    <td>

                      <div class="table__actions">

                        <button class="btn btn--ghost btn--icon btn--sm" 

                                onclick="PrestacionesModule.imprimirReciboAguinaldo('${ag.empleadoId}')" title="Imprimir Recibo">

                          ${Icons.printer}

                        </button>

                        ${!ag.pagado ? `

                        <button class="btn btn--ghost btn--icon btn--sm" 

                                onclick="PrestacionesModule.editAguinaldo('${ag.empleadoId}')" title="Editar Monto">

                          ${Icons.edit}

                        </button>

                        <button class="btn btn--primary btn--sm" 

                                onclick="PrestacionesModule.marcarAguinaldoPagado('${ag.empleadoId}')" title="Pagar">

                          Pagar

                        </button>` : `

                        <button class="btn btn--ghost btn--sm text-error" 

                                onclick="PrestacionesModule.deleteAguinaldo('${ag.empleadoId}')" title="Eliminar Pago">

                          ${Icons.trash} Revertir

                        </button>`}

                        <button class="btn btn--ghost btn--sm" 

                                onclick="PrestacionesModule.verHistorialAguinaldos('${ag.empleadoId}')" title="Historial">

                          Historial

                        </button>

                      </div>

                    </td>

                  </tr>

                `).join('')}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      <div class="info-card info-card--warning" style="margin-top: var(--spacing-lg);">

        <h4>ðŸ“˜ Ley Laboral de Nicaragua - Aguinaldo (Decimotercer Mes)</h4>

        <ul style="margin: var(--spacing-sm) 0; padding-left: var(--spacing-lg);">

          <li>Se paga en los primeros 10 días de diciembre</li>

          <li>Equivale a 1 mes de salario por año trabajado (proporcional si < 1 año)</li>

          <li>Fórmula: (Salario mensual ÷ 12) × meses laborados</li>

          <li>Es obligatorio para todo empleador</li>

        </ul>

      </div>

`;

  };

  // ========== RECIBOS TAB ==========

  const deleteNomina = async (id) => {

    if (!confirm('¿Eliminar este recibo de pago? Esta acción es irreversible.')) return;

    try {

      // Attempt to delete via DataService

      if (DataService.deleteNomina) {

        await DataService.deleteNomina(id);

      } else {

        // Fallback if specific method doesn't exist but generic likely does

        console.warn('deleteNomina not found, trying generic delete if available or mocking');

        // Assuming DataService has a generic way or we just hide it from UI if failed

        throw new Error('Función eliminar no implementada en DataService');

      }

      App.showNotification?.('Recibo eliminado correctamente', 'success');

      // Reload history

      loadHistorialRecibos();

    } catch (e) {

      console.error(e);

      alert('Error al eliminar recibo: ' + e.message);

    }

  };

  const renderRecibosTab = () => {

    // Listeners script to update status message

    setTimeout(() => {

      const checkStatus = async () => {

        const empId = document.querySelector('select[name="empleadoId"]')?.value;

        const periodo = document.querySelector('select[name="periodo"]')?.value;

        const mes = document.querySelector('input[name="mes"]')?.value;

        const quincena = document.querySelector('select[name="quincena"]')?.value;

        const msgDiv = document.getElementById('pagoStatusMsg');

        const submitBtn = document.getElementById('btnGenerarRecibo');

        if (empId && periodo && mes) {

          // Check if paid

          const nominas = await DataService.getAllNominas(); // Better to filter in DB but we sync

          let exists = false;

          if (periodo === 'quincenal') {

            // Logic to match quincena range

            // Simplified: check notes or period strings

            // Ideally check dates, but let's check exact match if possible or relying on business logic

            // We will match by 'empleadoId' and overlapping dates

            // For now, let's just fetch and see

          }

          // Detailed check in generarRecibos, here just a hint?

          // The user wants "muestra la info de a quienes se les ha hecho pago"

          // Maybe filter the table below?

          filterHistorialRecibos(periodo, mes, quincena);

        }

      };

      const formInputs = document.querySelectorAll('select[name="periodo"], input[name="mes"], select[name="quincena"], select[name="empleadoId"]');

      formInputs.forEach(i => i.addEventListener('change', checkStatus));

    }, 500);

    return `<div class="card">

          <div class="card__header">

            <h3 class="card__title">${Icons.fileText} Generar Recibo de Pago Individual</h3>

          </div>

          <div class="card__body">

            <form onsubmit="PrestacionesModule.generarRecibos(event)" class="form">

              <div class="form-row">

                  <div class="form-group">

                      <label class="form-label form-label--required">Empleado</label>

                       <select name="empleadoId" class="form-select" required>

                          <option value="">Seleccionar empleado...</option>

                          ${(DataService.getEmpleadosSync?.() || [])

        .filter(e => e.estado === 'Activo')

        .map(e => `<option value="${e.id}">${e.nombre} - ${e.cargo}</option>`).join('')}

                        </select>

                  </div>

              </div>

              <div class="form-row">

                <div class="form-group">

                  <label class="form-label form-label--required">Período de Pago</label>

                  <select name="periodo" class="form-select" required>

                    <option value="">Seleccionar período...</option>

                    <option value="quincenal">Quincenal</option>

                    <option value="mensual">Mensual</option>

                  </select>

                </div>

                <div class="form-group">

                  <label class="form-label form-label--required">Mes</label>

                  <input type="month" name="mes" class="form-input" 

                         value="${new Date().toISOString().slice(0, 7)}" required>

                </div>

                <div class="form-group" id="quincenaGroup">

                   <label class="form-label form-label--required">Quincena</label>

                   <select name="quincena" class="form-select">

                      <option value="1">Primera (1-15)</option>

                      <option value="2">Segunda (16-Fin)</option>

                   </select>

                </div>

              </div>

              

              <div class="form-row">

                  <div class="form-group">

                      <label class="form-label form-label--required">Método de Pago</label>

                      <select name="metodoPago" class="form-select" required>

                          <option value="Transferencia">Transferencia Bancaria</option>

                          <option value="Efectivo">Efectivo</option>

                      </select>

                  </div>

              </div>

              <script>

                  document.querySelector('select[name="periodo"]')?.addEventListener('change', function(e) {

                      const qGroup = document.getElementById('quincenaGroup');

                      if(qGroup) qGroup.style.display = e.target.value === 'quincenal' ? 'block' : 'none';

                  });

              </script>

              <div id="pagoStatusMsg" class="info-card info-card--warning" style="display:none; margin-bottom: 1rem;"></div>

              <button type="submit" id="btnGenerarRecibo" class="btn btn--primary">

                ${Icons.fileText} Generar Recibo

              </button>

            </form>

          </div>

        </div>

        <div class="info-card info-card--info" style="margin-top: var(--spacing-lg);">

          <h4>ðŸ“‹ Información del Recibo de Pago</h4>

          <p>Los recibos incluyen:</p>

          <ul style="margin: var(--spacing-sm) 0; padding-left: var(--spacing-lg);">

            <li>Salario base, Horas Extras, Bonificaciones</li>

            <li>Deducciones de Ley (INSS)</li>

            <li>Adelantos Salariales y Otras Deducciones</li>

            <li>Salario Neto a Recibir</li>

          </ul>

        </div>

      <div class="card" style="margin-top: var(--spacing-lg);">

        <div class="card__header">

          <h3 class="card__title">${Icons.clock} Historial de Pagos (Filtrado por Período)</h3>

        </div>

        <div class="card__body">

            <div class="table-container">

                <table class="data-table">

                    <thead>

                        <tr>

                            <th>Empleado</th>

                            <th>Período</th>

                            <th>Tipo</th>

                            <th class="text-right">Total Neto</th>

                            <th>Estado</th>

                            <th>Acciones</th>

                        </tr>

                    </thead>

                    <tbody id="historialRecibosBody">

                        <tr><td colspan="6" class="text-center">Cargando historial...</td></tr>

                    </tbody>

                </table>

            </div>

        </div>

      </div>

`;

  };

  // Filter functionality helper

  const filterHistorialRecibos = async (periodo, mes, quincena) => {

    const tbody = document.getElementById('historialRecibosBody');

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Filtrando...</td></tr>';

    try {

      const nominas = await DataService.getAllNominas();

      // Filter Logic based on User inputs

      // If inputs are empty, show all? Or show recent?

      // Let's matching based on dates roughly

      let filtered = nominas;

      if (mes) {

        filtered = filtered.filter(n => n.periodo_inicio && n.periodo_inicio.startsWith(mes));

      }

      if (periodo) {

        filtered = filtered.filter(n => n.tipo_periodo?.toLowerCase() === periodo.toLowerCase());

      }

      // Quincena check is harder without exact dates logic, skipping for now or assumed by date range

      if (!filtered.length) {

        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No existen pagos para este período</td></tr>';

        return;

      }

      tbody.innerHTML = filtered.map(n => {

        const nombre = n.empleado?.nombre || 'N/A';

        return `< tr >

                    <td>${nombre}</td>

                    <td>${n.periodo_inicio ? new Date(n.periodo_inicio).toLocaleDateString('es-NI') : '-'} al ${n.periodo_fin ? new Date(n.periodo_fin).toLocaleDateString('es-NI') : '-'}</td>

                    <td>${n.tipo_periodo}</td>

                    <td class="text-right font-bold">C$${(n.total_neto || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>

                    <td><span class="badge badge--success">${n.estado}</span></td>

                    <td>

                        <button class="btn btn--ghost btn--sm btn--icon" onclick="PrestacionesModule.imprimirRecibo('${n.id}')" title="Imprimir">${Icons.printer}</button>

                        <button class="btn btn--ghost btn--sm btn--icon text-error" onclick="PrestacionesModule.deleteNomina('${n.id}')" title="Eliminar">${Icons.trash}</button>

                    </td>

                </tr > `;

      }).join('');

    } catch (e) {

      console.error(e);

      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-error">Error cargando historial</td></tr>';

    }

  };

  // Cargar historial de recibos async al renderizar tab

  const loadHistorialRecibos = async () => {

    // Initial load generic

    filterHistorialRecibos(null, null, null);

  };

  // Imprimir un recibo individual

  const imprimirRecibo = async (nominaId) => {

    try {

      const nominas = await DataService.getAllNominas();

      // Sequential Numbering Logic

      const sorted = [...nominas].sort((a, b) => {

        const tA = new Date(a.periodo_fin || 0).getTime();

        const tB = new Date(b.periodo_fin || 0).getTime();

        if (tA !== tB) return tA - tB;

        return (a.empleadoId || '').localeCompare(b.empleadoId || '');

      });

      const index = sorted.findIndex(x => x.id === nominaId);

      const sequence = (index + 1).toString().padStart(4, '0');

      const reciboNo = `ROE - ${sequence} `;

      const n = sorted[index];

      if (!n) {

        App.showNotification?.('Recibo no encontrado', 'error');

        return;

      }

      const nombre = n.empleado?.nombre || 'N/A';

      const cargo = n.empleado?.cargo || 'Colaborador';

      const periodoInicio = n.periodo_inicio ? new Date(n.periodo_inicio).toLocaleDateString('es-NI') : '-';

      const periodoFin = n.periodo_fin ? new Date(n.periodo_fin).toLocaleDateString('es-NI') : '-';

      const fmt = (v) => (parseFloat(v) || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Parsing detailed notes

      let rows = [];

      let notesText = n.notas || '';

      rows.push({ label: 'Salario Base', ingreso: Number(n.salario_base || 0), deduccion: 0 });

      if (notesText && notesText.startsWith('Detalles:')) {

        try {

          const parts = notesText.replace('Detalles: ', '').split(', ');

          parts.forEach(p => {

            const splitArr = p.split(': ');

            if (splitArr.length >= 2) {

              const lbl = splitArr[0].trim();

              const val = parseFloat(splitArr[1].replace('C$', '').replace(/,/g, '').trim()) || 0;

              if (lbl.includes('Extras') || lbl.includes('Bonos')) {

                rows.push({ label: lbl, ingreso: val, deduccion: 0 });

              } else if (lbl.includes('Adelantos') || lbl.includes('Ausencias')) {

                rows.push({ label: lbl, ingreso: 0, deduccion: val });

              }

            }

          });

          notesText = '';

        } catch (e) { console.error('Error parsing notes', e); }

      } else {

        if (n.horas_extras > 0) rows.push({ label: 'Horas Extras', ingreso: n.horas_extras, deduccion: 0 });

        if (n.bonificaciones > 0) rows.push({ label: 'Bonificaciones', ingreso: n.bonificaciones, deduccion: 0 });

        if (n.adelantos > 0) rows.push({ label: 'Adelantos', ingreso: 0, deduccion: n.adelantos });

        if (n.otras_deducciones > 0) rows.push({ label: 'Otras Deducciones', ingreso: 0, deduccion: n.otras_deducciones });

      }

      if (n.deduccion_inss > 0) rows.push({ label: 'INSS Laboral', ingreso: 0, deduccion: n.deduccion_inss });

      if (n.deduccion_ir > 0) rows.push({ label: 'IR', ingreso: 0, deduccion: n.deduccion_ir });

      const totalIngresos = rows.reduce((s, r) => s + (r.ingreso || 0), 0);

      const totalDeducciones = rows.reduce((s, r) => s + (r.deduccion || 0), 0);

      const neto = totalIngresos - totalDeducciones;

      // COMPACT TEMPLATE

      const renderReceiptHtml = (title) => `

        <div style="padding: 15px 25px; border: 1px solid #ccc; font-family: 'Arial Narrow', Arial, sans-serif; font-size: 11px; background: white;">

            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px;">

                <div>

                    ${getLogoHtml('35px')}

                    <div style="font-size: 9px; color: #555; margin-top: 2px; letter-spacing: 0.5px;">${getCompanyConfig().slogan}</div>

                </div>

                <div style="text-align: right;">

                    <div style="font-weight: bold; font-size: 14px;">RECIBO DE PAGO</div>

                    <div style="font-size: 12px; color: #d00;">${reciboNo}</div>

                </div>

            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">

                <div style="line-height: 1.3;">

                    <div><strong>EMPLEADO:</strong> ${nombre}</div>

                    <div><strong>CARGO:</strong> ${cargo}</div>

                </div>

                <div style="text-align: right; line-height: 1.3;">

                    <div><strong>PERIODO:</strong> ${periodoInicio} al ${periodoFin}</div>

                    <div><strong style="background: #eee; padding: 2px 5px; border-radius: 3px;">${title}</strong></div>

                </div>

            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">

                <thead style="border-bottom: 1px solid #000; border-top: 1px solid #000; background: #f9f9f9;">

                    <tr>

                        <th style="text-align: left; padding: 4px;">CONCEPTO</th>

                        <th style="text-align: right; padding: 4px;">INGRESOS</th>

                        <th style="text-align: right; padding: 4px;">DEDUCCIONES</th>

                    </tr>

                </thead>

                <tbody>

                    ${rows.map(r => `

                        <tr>

                            <td style="padding: 2px 4px;">${r.label}</td>

                            <td style="padding: 2px 4px; text-align: right;">${r.ingreso ? fmt(r.ingreso) : ''}</td>

                            <td style="padding: 2px 4px; text-align: right;">${r.deduccion ? fmt(r.deduccion) : ''}</td>

                        </tr>

                    `).join('')}

                    <tr style="border-top: 1px solid #000; font-weight: bold;">

                        <td style="padding: 6px 4px; text-align: right;">TOTALES:</td>

                        <td style="padding: 6px 4px; text-align: right;">${fmt(totalIngresos)}</td>

                         <td style="padding: 6px 4px; text-align: right;">${fmt(totalDeducciones)}</td>

                    </tr>

                </tbody>

            </table>

            <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">

                 <div style="border: 2px solid #000; padding: 5px 15px; font-weight: bold; font-size: 14px; background: #eef;">

                    NETO A RECIBIR: C$ ${fmt(neto)}

                 </div>

            </div>

            <div style="display: flex; gap: 40px; justify-content: space-between; text-align: center; margin-top: 30px;">

                 <div style="flex: 1; border-top: 1px solid #000; padding-top: 5px;">Recibí Conforme (Colaborador)</div>

                 <div style="flex: 1; border-top: 1px solid #000; padding-top: 5px;">Autorizado (RRHH)</div>

            </div>

            ${notesText ? `<div style="margin-top: 10px; font-size: 10px; color: #555;"><i>Nota: ${notesText}</i></div>` : ''}

        </div>

  `;

      const content = `

        <div style="max-width: 800px; margin: 0 auto; background: white;">

          ${renderReceiptHtml('ORIGINAL')}

          <div style="display: flex; align-items: center; margin: 25px 0; color: #ccc; font-size: 9px;">

            <div style="flex: 1; border-top: 1px dashed #ccc;"></div>

            <div style="padding: 0 10px;">âœ‚ï¸ CORTAR AQUÍ</div>

            <div style="flex: 1; border-top: 1px dashed #ccc;"></div>

          </div>

          ${renderReceiptHtml('COPIA')}

        </div>

  `;

      printDocument(`Recibo ${reciboNo} `, content);

    } catch (e) {

      console.error('Error imprimiendo recibo:', e);

      App.showNotification?.('Error al generar recibo', 'error');

    }

  };

  // ========== LIQUIDACIÓN TAB ==========

  const renderLiquidacionTab = () => {

    return `

      <div class="card">

        <div class="card__header">

          <h3 class="card__title">${Icons.dollarSign} Calcular Liquidación</h3>

        </div>

        <div class="card__body">

          <form onsubmit="PrestacionesModule.calcularLiquidacion(event)" class="form">

            <div class="form-group">

              <label class="form-label form-label--required">Empleado</label>

              <select name="empleadoId" class="form-select" required 

                      onchange="PrestacionesModule.loadEmpleadoData(this.value)">

                <option value="">Seleccionar empleado...</option>

                ${(DataService.getEmpleadosSync?.() || [])

        .filter(e => e.estado === 'Activo')

        .map(e => `

                    <option value="${e.id}">${e.nombre} - ${e.cargo}</option>

                  `).join('')}

              </select>

            </div>

            <div id="empleadoInfo"></div>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label form-label--required">Fecha de Salida</label>

                <input type="date" name="fechaSalida" class="form-input" required>

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">Motivo</label>

                <select name="motivo" class="form-select" required>

                  <option value="">Seleccionar...</option>

                  <option value="renuncia">Renuncia Voluntaria</option>

                  <option value="despido_con_justa_causa">Despido con Justa Causa</option>

                  <option value="despido_sin_justa_causa">Despido sin Justa Causa</option>

                  <option value="mutuo_acuerdo">Mutuo Acuerdo</option>

                  <option value="fin_contrato">Fin de Contrato Temporal</option>

                </select>

              </div>

            </div>

            <div class="form-group">

              <label class="form-label">Observaciones</label>

              <textarea name="observaciones" class="form-textarea" rows="3" 

                        placeholder="Detalles adicionales..."></textarea>

            </div>

            <button type="submit" class="btn btn--primary">

              ${Icons.calculator} Calcular Liquidación

            </button>

          </form>

        </div>

      </div>

      <div id="liquidacionResult"></div>

      <div class="info-card info-card--error" style="margin-top: var(--spacing-lg);">

        <h4>ðŸ“˜ Ley Laboral de Nicaragua - Indemnización</h4>

        <ul style="margin: var(--spacing-sm) 0; padding-left: var(--spacing-lg);">

          <li><strong>Despido sin justa causa:</strong> 1 mes de salario por cada año o fracción >= 6 meses</li>

          <li><strong>Antigüedad:</strong> 1 mes por cada año o fracción >= 6 meses (máximo 5 meses)</li>

          <li><strong>Vacaciones no gozadas:</strong> Días proporcionales acumulados</li>

          <li><strong>Aguinaldo proporcional:</strong> Según meses trabajados en el año</li>

          <li><strong>Salarios pendientes:</strong> Días trabajados sin pagar</li>

        </ul>

      </div>

`;

  };

  // ==  ======== REPORTES TAB ==========

  const renderReportesTab = () => {

    return `

      <div class="reports-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">

        <div class="card">

          <div class="card__header">

            <h3 class="card__title">${Icons.users} Reporte de Empleados</h3>

          </div>

          <div class="card__body">

            <p class="text-muted">Lista completa de empleados con sus datos laborales</p>

            <button class="btn btn--primary" style="margin-top: var(--spacing-md);" 

                    onclick="PrestacionesModule.generarReporteEmpleados()">

              ${Icons.download} Generar PDF

            </button>

          </div>

        </div>

        <div class="card">

          <div class="card__header">

            <h3 class="card__title">${Icons.calendar} Reporte de Vacaciones</h3>

          </div>

          <div class="card__body">

            <p class="text-muted">Estado de vacaciones de todos los empleados</p>

            <button class="btn btn--primary" style="margin-top: var(--spacing-md);" 

                    onclick="PrestacionesModule.generarReporteVacaciones()">

              ${Icons.download} Generar PDF

            </button>

          </div>

        </div>

        <div class="card">

          <div class="card__header">

            <h3 class="card__title">${Icons.dollarSign} Planilla Mensual</h3>

          </div>

          <div class="card__body">

            <p class="text-muted">Resumen de salarios y deducciones por mes</p>

            <div class="form-group" style="margin-top: 10px;">

              <label class="text-sm">Seleccionar Mes:</label>

              <input type="month" id="reportPlanillaMes" class="form-input" value="${new Date().toISOString().slice(0, 7)}">

            </div>

            <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" 

                    onclick="PrestacionesModule.generarPlanillaMensual()">

              ${Icons.download} Generar PDF

            </button>

          </div>

        </div>

        <div class="card">

          <div class="card__header">

             <h3 class="card__title">${Icons.barChart} Costos Laborales</h3>

          </div>

          <div class="card__body">

            <p class="text-muted">Análisis de costos laborales totales</p>

            <button class="btn btn--primary" style="margin-top: var(--spacing-md);" 

                    onclick="PrestacionesModule.generarReporteCostos()">

              ${Icons.download} Generar PDF

            </button>

          </div>

        </div>

        <div class="card" style="grid-column: span 2;">

          <div class="card__header" style="background: #1a1f36; color: white;">

             <h3 class="card__title" style="color: white;">${Icons.fileText} Pagos Hechos por Empleado</h3>

          </div>

          <div class="card__body">

            <p class="text-muted">Historial detallado de recibos, bonos y adelantos.</p>

            <!-- Filtros de Fecha -->

            <div class="form-row" style="margin-top: 15px; align-items: flex-end;">

               <div class="form-group">

                 <label class="text-xs">Empleado:</label>

                 <select id="reportPagosEmpleadoId" class="form-select">

                    <option value="all">Todos los Empleados</option>

                    ${DataService.getEmpleadosSync().map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}

                 </select>

               </div>

               

               <div class="form-group">

                 <label class="text-xs">Tipo de Filtro:</label>

                 <select id="reportPagosTipoFiltro" class="form-select" onchange="PrestacionesModule.toggleReportFilters()">

                    <option value="mes">Por Mes</option>

                    <option value="anio">Por Año</option>

                    <option value="rango">Rango de Fechas</option>

                 </select>

               </div>

               <!-- Inputs dinámicos según filtro -->

               <div class="form-group" id="filterContainerMes">

                 <label class="text-xs">Mes:</label>

                 <input type="month" id="reportPagosMes" class="form-input" value="${new Date().toISOString().slice(0, 7)}">

               </div>

               <div class="form-group" id="filterContainerAnio" style="display:none;">

                 <label class="text-xs">Año:</label>

                 <select id="reportPagosAnio" class="form-select">

                    ${Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => `<option value="${y}">${y}</option>`).join('')}

                 </select>

               </div>

               <div class="form-group" id="filterContainerRango" style="display:none; gap: 5px; flex-direction: row;">

                  <div>

                    <label class="text-xs">Desde:</label>

                    <input type="date" id="reportPagosDesde" class="form-input">

                  </div>

                  <div>

                    <label class="text-xs">Hasta:</label>

                    <input type="date" id="reportPagosHasta" class="form-input">

                  </div>

               </div>

               <button class="btn btn--primary" style="margin-left: auto;" 

                    onclick="PrestacionesModule.generarReportePagosHechos()">

                ${Icons.download} Generar

               </button>

            </div>

          </div>

        </div>

      </div>

    `;

  };

  // ========== CÁLCULOS LABORALES (Nicaragua) ==========

  const calcularVacaciones = (empleado) => {

    const fechaAltaStr = empleado.fechaAlta || empleado.fecha_alta;

    if (!fechaAltaStr) return { id: empleado.id, nombre: empleado.nombre, cargo: empleado.cargo, antiguedadAnios: 0, diasAcumulados: 0, diasTomados: 0, diasDisponibles: 0, proximoPeriodo: '-' };

    const fechaAlta = new Date(fechaAltaStr);

    const hoy = new Date();

    const diffTime = Math.abs(hoy - fechaAlta);

    const diasTotales = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const mesesLaborados = diasTotales / 30.417;

    const diasAcumulados = parseFloat((mesesLaborados * 2.5).toFixed(2));

    const diasTomados = empleado.vacacionesTomadas || empleado.vacaciones_tomadas || 0;

    const diasDisponibles = parseFloat((diasAcumulados - diasTomados).toFixed(2));

    const antiguedadAnios = parseFloat((mesesLaborados / 12).toFixed(1));

    const proximaFecha = new Date(fechaAlta);

    proximaFecha.setFullYear(hoy.getFullYear() + 1);

    while (proximaFecha < hoy) {

      proximaFecha.setFullYear(proximaFecha.getFullYear() + 1);

    }

    return {

      id: empleado.id,

      nombre: empleado.nombre,

      cargo: empleado.cargo,

      antiguedadAnios,

      diasAcumulados,

      diasTomados,

      diasDisponibles,

      proximoPeriodo: proximaFecha.toLocaleDateString('es-NI')

    };

  };

  const calcularAguinaldo = (empleado) => {

    const fechaAltaStr = empleado.fechaAlta || empleado.fecha_alta;

    if (!fechaAltaStr) return { empleadoId: empleado.id, nombre: empleado.nombre, cedula: empleado.cedula, fechaAlta: '', mesesLaborados: 0, salario: 0, monto: 0, pagado: false };

    const fechaAlta = new Date(fechaAltaStr);

    const hoy = new Date();

    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

    const fechaInicio = fechaAlta > inicioAnio ? fechaAlta : inicioAnio;

    const mesesLaborados = Math.min(12, Math.floor((hoy - fechaInicio) / (30.44 * 24 * 60 * 60 * 1000)));

    const salario = parseFloat(empleado.salarioTotal || empleado.salario_total) || 0;

    const monto = (salario / 12) * mesesLaborados;

    return {

      empleadoId: empleado.id,

      nombre: empleado.nombre,

      cedula: empleado.cedula,

      fechaAlta: fechaAltaStr,

      mesesLaborados,

      salario,

      monto,

      pagado: empleado.aguinaldoPagado || empleado.aguinaldo_pagado || false

    };

  };

  const calcularINSS = (salario) => {

    // Nicaragua: INSS empleado 7% (Reformas 2019)

    // Patronal: 21.5% (< 50 empleados) o 22.5% (> 50 empleados). Usamos 21.5% por defecto.

    return {

      empleado: salario * 0.07,

      empleador: salario * 0.215,

      total: salario * 0.285

    };

  };

  const calcularIR = (salario) => {

    // Tabla IR Nicaragua 2024 (progresiva mensual)

    const tramos = [

      { hasta: 100000, tasa: 0 },

      { hasta: 200000, tasa: 0.15, sobre: 100000 },

      { hasta: 350000, tasa: 0.20, sobre: 200000 },

      { hasta: 500000, tasa: 0.25, sobre: 350000 },

      { hasta: Infinity, tasa: 0.30, sobre: 500000 }

    ];

    const salarioAnual = salario * 12;

    let ir = 0;

    let baseAnterior = 0;

    for (const tramo of tramos) {

      if (salarioAnual <= tramo.hasta) {

        ir += (salarioAnual - (tramo.sobre || 0)) * tramo.tasa;

        break;

      } else if (tramo.sobre !== undefined) {

        ir += (tramo.hasta - tramo.sobre) * tramo.tasa;

      }

    }

    return ir / 12; // Mensual

  };

  // ========== MODAL HANDLERS ==========

  const openEmpleadoModal = (empleadoId = null) => {

    let emp = null;

    let title = 'Nuevo Empleado';

    let btnText = 'Crear Empleado';

    if (empleadoId) {

      emp = DataService.getEmpleadoById(empleadoId);

      if (!emp) return;

      title = 'Editar Empleado';

      btnText = 'Guardar Cambios';

    }

    const safeVal = (val) => val || '';

    const dateVal = (date) => {

      if (!date) return '';

      try {

        const d = new Date(date);

        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];

      } catch (e) { return ''; }

    };

    document.getElementById('prestacionesModal').innerHTML = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal modal--large" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">${empleadoId ? Icons.edit : Icons.plus} ${title}</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">

              ${Icons.x}

            </button>

          </div>

          <form class="modal__body" onsubmit="PrestacionesModule.saveEmpleado(event)">

            <input type="hidden" name="id" value="${safeVal(empleadoId)}">

            <h4>Datos Personales</h4>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label form-label--required">Nombre Completo</label>

                <input type="text" name="nombre" class="form-input" value="${safeVal(emp?.nombre)}" required>

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">Cédula</label>

                <input type="text" name="cedula" class="form-input" maxlength="16"

                  placeholder="000-000000-0000A"

                  oninput="this.value = this.value.toUpperCase().replace(/[^0-9A-Z-]/g,''); if(this.value.length==3 || this.value.length==10) if(event.inputType!='deleteContentBackward') this.value+='-';"

                  value="${safeVal(emp?.cedula)}" required>

              </div>

            </div>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label">Email</label>

                <input type="email" name="email" class="form-input" value="${safeVal(emp?.email)}">

              </div>

              <div class="form-group">

                <label class="form-label">Teléfono</label>

                <input type="tel" name="telefono" class="form-input" value="${safeVal(emp?.telefono)}">

              </div>

            </div>

            <h4 style="margin-top: var(--spacing-lg);">Información Laboral</h4>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label form-label--required">Cargo</label>

                <input type="text" name="cargo" class="form-input" value="${safeVal(emp?.cargo)}" required>

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">Fecha de Alta</label>

                <input type="date" name="fechaAlta" class="form-input"

                  value="${(emp?.fechaAlta || emp?.fecha_alta) ? dateVal(emp.fechaAlta || emp.fecha_alta) : new Date().toISOString().split('T')[0]}" required>

              </div>

            </div>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label form-label--required">Tipo de Salario</label>

                <select name="tipoSalario" class="form-select" required>

                  <option value="">Seleccionar...</option>

                  <option value="Mensual" ${(emp?.tipoSalario || emp?.tipo_salario) === 'Mensual' ? 'selected' : ''}>Mensual</option>

                  <option value="Quincenal" ${(emp?.tipoSalario || emp?.tipo_salario) === 'Quincenal' ? 'selected' : ''}>Quincenal</option>

                  <option value="Por Hora" ${(emp?.tipoSalario || emp?.tipo_salario) === 'Por Hora' ? 'selected' : ''}>Por Hora</option>

                  <option value="Por Proyecto" ${(emp?.tipoSalario || emp?.tipo_salario) === 'Por Proyecto' ? 'selected' : ''}>Por Proyecto</option>

                </select>

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">Salario Total (C$)</label>

                <input type="number" name="salarioTotal" class="form-input"

                  step="0.01" min="0" value="${emp?.salarioTotal || emp?.salario_total || ''}" required>

              </div>

            </div>

            <div class="form-row">

              <div class="form-group">

                <label class="form-label form-label--required">Tipo de Contrato</label>

                <select name="tipoContrato" class="form-select" required>

                  <option value="">Seleccionar...</option>

                  <option value="Indefinido" ${(emp?.tipoContrato || emp?.tipo_contrato) === 'Indefinido' ? 'selected' : ''}>Indefinido</option>

                  <option value="Temporal" ${(emp?.tipoContrato || emp?.tipo_contrato) === 'Temporal' ? 'selected' : ''}>Temporal</option>

                  <option value="Por Obra" ${(emp?.tipoContrato || emp?.tipo_contrato) === 'Por Obra' ? 'selected' : ''}>Por Obra</option>

                  <option value="Prueba" ${(emp?.tipoContrato || emp?.tipo_contrato) === 'Prueba' ? 'selected' : ''}>Prueba (30 días)</option>

                </select>

              </div>

              <div class="form-group">

                <label class="form-label">Duración Contrato (meses)</label>

                <input type="number" name="tiempoContrato" class="form-input"

                  min="1" placeholder="Solo para contratos temporales" value="${safeVal(emp?.tiempoContrato || emp?.tiempo_contrato)}">

                  <span class="form-hint">Dejar vacío si es indefinido</span>

              </div>

            </div>

            <div class="form-group" style="margin-top: var(--spacing-md);">

              <label class="form-label">Observaciones</label>

              <textarea name="observaciones" class="form-textarea" rows="3">${safeVal(emp?.observaciones)}</textarea>

            </div>

            <div class="modal__footer" style="padding-top: var(--spacing-lg);">

              <button type="button" class="btn btn--secondary" onclick="PrestacionesModule.closeModal()">Cancelar</button>

              <button type="submit" class="btn btn--primary">${empleadoId ? Icons.save : Icons.plus} ${btnText}</button>

            </div>

          </form>

        </div>

      </div>

    `;

  };

  const saveEmpleado = async (event) => {

    event.preventDefault();

    const formData = new FormData(event.target);

    const data = Object.fromEntries(formData.entries());

    const id = data.id;

    delete data.id;

    // Convertir tipos numéricos desde el formulario

    if (data.salarioTotal) data.salarioTotal = parseFloat(data.salarioTotal);

    // IMPORTANTE: Evitar enviar cadena vacía "" a campos INTEGER de Supabase

    if (data.tiempoContrato === "" || data.tiempoContrato === undefined) {

      data.tiempoContrato = null;

    } else {

      data.tiempoContrato = parseInt(data.tiempoContrato);

      if (isNaN(data.tiempoContrato)) data.tiempoContrato = null;

    }

    try {

      if (id) {

        await DataService.updateEmpleado(id, data);

        App.showNotification?.('Empleado actualizado correctamente', 'success') || alert('Empleado actualizado correctamente');

      } else {

        // Verificar duplicados por cédula

        const existe = (DataService.getEmpleadosSync?.() || []).find(e => e.cedula === data.cedula);

        if (existe) {

          throw new Error(`Ya existe un empleado con la cédula ${data.cedula} (${existe.nombre})`);

        }

        data.estado = 'Activo';

        data.vacacionesTomadas = 0;

        data.aguinaldoPagado = false;

        await DataService.createEmpleado(data);

        App.showNotification?.('Empleado creado correctamente', 'success') || alert('Empleado creado correctamente');

      }

      closeModal();

      changeTab('empleados');

      App.refreshCurrentModule();

    } catch (error) {

      console.error('Error saving employee:', error);

      App.showNotification?.('Error al guardar: ' + error.message, 'error') || alert('Error al guardar: ' + error.message);

    }

  };

  const closeModal = (event) => {

    if (event && event.target !== event.currentTarget) return;

    document.getElementById('prestacionesModal').innerHTML = '';

    document.getElementById('prestacionesModal').classList.remove('open');

  };

  // ========== IMPLEMENTACIÓN FUNCIONES ==========

  // --- Empleados ---

  const viewEmpleado = (id) => {

    const emp = DataService.getEmpleadoById(id);

    if (!emp) return;

    const fechaAlta = emp.fechaAlta || emp.fecha_alta;

    const salario = parseFloat(emp.salarioTotal || emp.salario_total) || 0;

    const contrato = emp.tipoContrato || emp.tipo_contrato || '-';

    const tipoSalario = emp.tipoSalario || emp.tipo_salario || '-';

    const vacTomadas = emp.vacacionesTomadas || emp.vacaciones_tomadas || 0;

    const vacData = calcularVacaciones(emp);

    const contenido = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">${Icons.users} ${emp.nombre}</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

          </div>

          <div class="modal__body">

            <h4 style="margin-bottom: var(--spacing-sm); color: var(--text-secondary);">Datos Personales</h4>

            <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">

              <p><strong>Cargo:</strong> ${emp.cargo}</p>

              <p><strong>Cédula:</strong> ${emp.cedula}</p>

              <p><strong>Email:</strong> ${emp.email || '-'}</p>

              <p><strong>Teléfono:</strong> ${emp.telefono || '-'}</p>

            </div>

            <h4 style="margin-top: var(--spacing-md); margin-bottom: var(--spacing-sm); color: var(--text-secondary);">Información Laboral</h4>

            <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">

              <p><strong>Salario:</strong> C$${salario.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p>

              <p><strong>Tipo Salario:</strong> ${tipoSalario}</p>

              <p><strong>Contrato:</strong> ${contrato}</p>

              <p><strong>Fecha Alta:</strong> ${fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-NI') : '-'}</p>

              <p><strong>Antigüedad:</strong> ${vacData.antiguedadAnios} años</p>

              <p><strong>Estado:</strong> <span class="badge ${emp.estado === 'Activo' ? 'badge--success' : 'badge--error'}">${emp.estado || 'Activo'}</span></p>

            </div>

            <h4 style="margin-top: var(--spacing-md); margin-bottom: var(--spacing-sm); color: var(--text-secondary);">Prestaciones</h4>

            <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">

              <p>

                <strong>Vacaciones Tomadas:</strong> ${vacTomadas} días

                <button class="btn btn--ghost btn--xs btn--icon" onclick="PrestacionesModule.verHistorialVacaciones('${emp.id}')" title="Ver Historial">${Icons.clock}</button>

              </p>

              <p><strong>Vacaciones Disponibles:</strong> ${vacData.diasDisponibles} días</p>

              <p>

                <strong>Aguinaldo Pagado:</strong> ${(emp.aguinaldoPagado || emp.aguinaldo_pagado) ? 'Sí' : 'No'}

                <button class="btn btn--ghost btn--xs btn--icon" onclick="PrestacionesModule.verHistorialAguinaldos('${emp.id}')" title="Ver Historial">${Icons.clock}</button>

              </p>

              <p>

                <strong>Nóminas:</strong>

                <button class="btn btn--ghost btn--xs" onclick="PrestacionesModule.verHistorialNominas('${emp.id}')">Ver Recibos</button>

              </p>

            </div>

          </div>

          <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">

            <button class="btn btn--secondary" onclick="PrestacionesModule.closeModal()">Cerrar</button>

            ${emp.estado === 'Inactivo' ? `

                      <button class="btn btn--success" onclick="PrestacionesModule.darDeAltaEmpleado('${emp.id}')">

                        ${Icons.checkCircle} Dar de Alta

                      </button>

                      ` : ''}

            <button class="btn btn--primary" onclick="PrestacionesModule.editEmpleado('${emp.id}')">${Icons.edit} Editar</button>

          </div>

        </div>

      </div>

  `;

    document.getElementById('prestacionesModal').innerHTML = contenido;

  };

  const editEmpleado = (id) => {

    openEmpleadoModal(id);

  };

  // --- Vacaciones ---

  const calcularDiasEntreFechas = (fechaInicio, fechaFin) => {

    if (!fechaInicio || !fechaFin) return 0;

    const inicio = new Date(fechaInicio);

    const fin = new Date(fechaFin);

    if (fin < inicio) return 0;

    const diffMs = fin - inicio;

    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 incluye ambos días

  };

  const registrarVacaciones = (arg = null) => {

    let preSelectedId = null;

    let editItem = null;

    if (arg && typeof arg === 'object') editItem = arg;

    else preSelectedId = arg;

    const empleados = DataService.getEmpleadosSync();

    document.getElementById('prestacionesModal').innerHTML = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">${Icons.calendar} ${editItem ? 'Editar' : 'Registrar'} Vacaciones</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

          </div>

          <form class="modal__body" onsubmit="PrestacionesModule.saveVacaciones(event)">

            <input type="hidden" name="id" value="${editItem?.id || ''}">

              <div class="form-group">

                <label class="form-label form-label--required">Empleado</label>

                <select name="empleadoId" class="form-select" required>

                  <option value="">Seleccionar empleado...</option>

                  ${empleados.map(e => `<option value="${e.id}" ${editItem?.empleadoId == e.id || e.id === preSelectedId ? 'selected' : ''}>${e.nombre}</option>`).join('')}

                </select>

              </div>

              <div class="form-row">

                <div class="form-group">

                  <label class="form-label form-label--required">Desde</label>

                  <input type="date" name="fechaInicio" class="form-input" required

                    value="${editItem?.fechaInicio || editItem?.fecha_inicio ? new Date(editItem?.fechaInicio || editItem?.fecha_inicio).toISOString().split('T')[0] : ''}"

                    onchange="PrestacionesModule.onVacacionFechaChange()">

                </div>

                <div class="form-group">

                  <label class="form-label form-label--required">Hasta</label>

                  <input type="date" name="fechaFin" class="form-input" required

                    value="${editItem?.fechaFin || editItem?.fecha_fin ? new Date(editItem?.fechaFin || editItem?.fecha_fin).toISOString().split('T')[0] : ''}"

                    onchange="PrestacionesModule.onVacacionFechaChange()">

                </div>

              </div>

              <div class="info-card info-card--info" id="diasCalculadosInfo" style="display:${editItem ? 'block' : 'none'}; margin-bottom: var(--spacing-md);">

                <strong>Días a descontar:</strong> <span id="diasCalculadosValor">${editItem?.dias || 0}</span> día(s)

              </div>

              <div class="form-group">

                <label class="form-label">Observaciones</label>

                <textarea name="observaciones" class="form-textarea">${editItem?.observaciones || ''}</textarea>

              </div>

              <button type="submit" class="btn btn--primary" style="margin-top: 1rem;">${Icons.save} ${editItem ? 'Guardar Cambios' : 'Registrar'}</button>

          </form>

        </div>

      </div>

  `;

  };

  const onVacacionFechaChange = () => {

    const fechaInicio = document.querySelector('input[name="fechaInicio"]')?.value;

    const fechaFin = document.querySelector('input[name="fechaFin"]')?.value;

    const infoEl = document.getElementById('diasCalculadosInfo');

    const valorEl = document.getElementById('diasCalculadosValor');

    if (fechaInicio && fechaFin && infoEl && valorEl) {

      const dias = calcularDiasEntreFechas(fechaInicio, fechaFin);

      valorEl.textContent = dias;

      infoEl.style.display = dias > 0 ? 'block' : 'none';

    }

  };

  const saveVacaciones = async (event) => {

    event.preventDefault();

    const fd = new FormData(event.target);

    const data = Object.fromEntries(fd.entries());

    // Auto-calcular días desde fechas

    data.dias = calcularDiasEntreFechas(data.fechaInicio, data.fechaFin);

    if (data.dias <= 0) {

      App.showNotification?.('Las fechas son inválidas', 'error');

      return;

    }

    data.anioCorrespondiente = new Date().getFullYear();

    const id = data.id;

    delete data.id;

    try {

      if (id && DataService.updateVacacion) {

        await DataService.updateVacacion(id, data);

        App.showNotification?.('Vacaciones actualizadas', 'success');

      } else {

        await DataService.createVacacion(data);

        App.showNotification?.('Vacaciones registradas correctamente', 'success');

      }

      closeModal();

      App.refreshCurrentModule();

    } catch (e) {

      console.error('Error guardando vacaciones:', e);

      App.showNotification?.('Error: ' + e.message, 'error');

    }

  };

  const verHistorialVacaciones = async (empleadoId) => {

    try {

      const historial = await DataService.getVacacionesByEmpleado(empleadoId);

      const emp = DataService.getEmpleadoById(empleadoId);

      // Create a map for buttons to access data? Or just reuse API.

      // We will attach a helper to window or module to open edit for a specific item.

      window._tempVacaciones = historial.reduce((acc, h) => { acc[h.id] = h; return acc; }, {});

      document.getElementById('prestacionesModal').innerHTML = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal modal--large" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">Historial: ${emp ? emp.nombre : ''}</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

          </div>

          <div class="modal__body">

            <table class="data-table">

              <thead><tr><th>Inicio</th><th>Fin</th><th>Días</th><th>Obs</th><th>Acción</th></tr></thead>

              <tbody>

                ${historial.length ? historial.map(h => `

                                            <tr>

                                                <td>${new Date(h.fecha_inicio).toLocaleDateString()}</td>

                                                <td>${new Date(h.fecha_fin).toLocaleDateString()}</td>

                                                <td>${h.dias}</td>

                                                <td>${h.observaciones || '-'}</td>

                                                <td>

                                                    <button class="btn btn--ghost btn--sm btn--icon" 

                                                        onclick="PrestacionesModule.editVacacion('${h.id}')" title="Editar">${Icons.edit}</button>

                                                </td>

                                            </tr>

                                        `).join('') : '<tr><td colspan="5">No hay registros</td></tr>'}

              </tbody>

            </table>

          </div>

        </div>

      </div>

  `;

    } catch (e) {

      console.error(e);

      alert('Error cargando historial');

    }

  };

  const editVacacion = (id) => {

    const item = window._tempVacaciones ? window._tempVacaciones[id] : null;

    if (item) {

      registrarVacaciones(item);

    }

  };

  const deleteVacacion = async (id) => {

    if (!confirm('¿Eliminar registro? Se devolverán los días al saldo.')) return;

    try {

      await DataService.deleteVacacion(id);

      closeModal();

      App.showNotification?.('Registro de vacaciones eliminado', 'success') || alert('Registro eliminado');

      App.refreshCurrentModule();

    } catch (e) {

      console.error('Error eliminando vacación:', e);

      App.showNotification?.('Error: ' + e.message, 'error') || alert('Error: ' + e.message);

    }

  };

  // --- Ausencias ---

  const registrarAusencia = (arg = null) => {

    let preSelectedId = null;

    let editItem = null;

    if (arg && typeof arg === 'object') {

      editItem = arg;

    } else {

      preSelectedId = arg;

    }

    const empleados = DataService.getEmpleadosSync();

    document.getElementById('prestacionesModal').innerHTML = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">${Icons.clock} ${editItem ? 'Editar' : 'Registrar'} Ausencia</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

          </div>

          <form class="modal__body" onsubmit="PrestacionesModule.saveAusencia(event)">

            <input type="hidden" name="id" value="${editItem?.id || ''}">

              <div class="form-group">

                <label class="form-label form-label--required">Empleado</label>

                <select name="empleadoId" class="form-select" required>

                  <option value="">Seleccionar empleado...</option>

                  ${empleados.map(e => `<option value="${e.id}" ${(editItem?.empleadoId == e.id || e.id === preSelectedId) ? 'selected' : ''}>${e.nombre}</option>`).join('')}

                </select>

              </div>

              <div class="form-row">

                <div class="form-group">

                  <label class="form-label form-label--required">Desde</label>

                  <input type="date" name="fechaInicio" class="form-input" required

                    value="${editItem?.fechaInicio || editItem?.fecha_inicio || ''}"

                    onchange="PrestacionesModule.onAusenciaFechaChange()">

                </div>

                <div class="form-group">

                  <label class="form-label form-label--required">Hasta</label>

                  <input type="date" name="fechaFin" class="form-input" required

                    value="${editItem?.fechaFin || editItem?.fecha_fin || ''}"

                    onchange="PrestacionesModule.onAusenciaFechaChange()">

                </div>

              </div>

              <div class="info-card info-card--info" id="ausenciaDiasInfo" style="display:${editItem ? 'block' : 'none'}; margin-bottom: var(--spacing-md);">

                <strong>Días de ausencia:</strong> <span id="ausenciaDiasValor">${editItem?.dias || 0}</span> día(s)

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">¿De dónde se descuenta?</label>

                <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-sm);">

                  <label style="display: flex; align-items: center; gap: var(--spacing-xs); cursor: pointer; padding: var(--spacing-sm) var(--spacing-md); border: 2px solid var(--border-color); border-radius: var(--radius-md); flex: 1; transition: all 0.2s;">

                    <input type="radio" name="tipoDescuento" value="vacaciones" required ${(editItem?.tipoDescuento || editItem?.tipo_descuento) === 'vacaciones' ? 'checked' : ''}>

                      <span>${Icons.calendar} <strong>Vacaciones</strong></span>

                  </label>

                  <label style="display: flex; align-items: center; gap: var(--spacing-xs); cursor: pointer; padding: var(--spacing-sm) var(--spacing-md); border: 2px solid var(--border-color); border-radius: var(--radius-md); flex: 1; transition: all 0.2s;">

                    <input type="radio" name="tipoDescuento" value="dia_laboral" ${(editItem?.tipoDescuento || editItem?.tipo_descuento) === 'dia_laboral' ? 'checked' : (!editItem ? 'checked' : '')}> <!-- Default to dia_laboral if new -->

                      <span>${Icons.clock} <strong>Día Laboral</strong></span>

                  </label>

                </div>

              </div>

              <div class="form-group">

                <label class="form-label">Motivo</label>

                <input type="text" name="motivo" class="form-input" placeholder="Ej: Cita médica, permiso personal..." value="${editItem?.motivo || ''}">

              </div>

              <div class="form-group">

                <label class="form-label">Observaciones</label>

                <textarea name="observaciones" class="form-textarea" rows="2">${editItem?.observaciones || ''}</textarea>

              </div>

              <button type="submit" class="btn btn--primary" style="margin-top: 1rem;">${Icons.save} ${editItem ? 'Guardar Cambios' : 'Registrar Ausencia'}</button>

          </form>

        </div>

      </div>

  `;

  };

  const onAusenciaFechaChange = () => {

    const fechaInicio = document.querySelector('input[name="fechaInicio"]')?.value;

    const fechaFin = document.querySelector('input[name="fechaFin"]')?.value;

    const infoEl = document.getElementById('ausenciaDiasInfo');

    const valorEl = document.getElementById('ausenciaDiasValor');

    if (fechaInicio && fechaFin && infoEl && valorEl) {

      const dias = calcularDiasEntreFechas(fechaInicio, fechaFin);

      valorEl.textContent = dias;

      infoEl.style.display = dias > 0 ? 'block' : 'none';

    }

  };

  const saveAusencia = async (event) => {

    event.preventDefault();

    const fd = new FormData(event.target);

    const data = Object.fromEntries(fd.entries());

    const id = data.id; // Check if update

    delete data.id;

    data.dias = calcularDiasEntreFechas(data.fechaInicio, data.fechaFin);

    if (data.dias <= 0) {

      App.showNotification?.('Las fechas son inválidas', 'error') || alert('Las fechas son inválidas');

      return;

    }

    try {

      if (id) {

        await DataService.updateAusencia(id, data);

        App.showNotification?.('Ausencia actualizada', 'success');

      } else {

        await DataService.createAusencia(data);

        const tipoLabel = data.tipoDescuento === 'vacaciones' ? 'vacaciones' : 'día laboral';

        App.showNotification?.(`Ausencia registrada(${data.dias} días descontados de ${tipoLabel})`, 'success');

      }

      closeModal();

      App.refreshCurrentModule();

    } catch (e) {

      console.error('Error guardando ausencia:', e);

      App.showNotification?.('Error: ' + e.message, 'error') || alert('Error: ' + e.message);

    }

  };

  const deleteAusencia = async (id) => {

    if (!confirm('¿Eliminar ausencia? Si fue descontada de vacaciones, se devolverán los días.')) return;

    try {

      await DataService.deleteAusencia(id);

      App.showNotification?.('Ausencia eliminada', 'success');

      App.refreshCurrentModule();

    } catch (e) {

      console.error('Error eliminando ausencia:', e);

      App.showNotification?.('Error: ' + e.message, 'error') || alert('Error: ' + e.message);

    }

  };

  const editAusencia = async (id) => {

    try {

      const ausencias = await DataService.getAllAusencias();

      const item = ausencias.find(a => a.id === id);

      if (item) {

        registrarAusencia(item);

      } else {

        alert('Ausencia no encontrada');

      }

    } catch (e) {

      console.error(e);

    }

  };

  // --- Aguinaldo ---

  const generarAguinaldoReporte = () => {

    const empleados = DataService.getEmpleadosSync().filter(e => e.estado === 'Activo');

    const aguinaldos = empleados.map(e => calcularAguinaldo(e));

    const total = aguinaldos.reduce((sum, a) => sum + a.monto, 0);

    const content = `

      <table>

        <thead>

          <tr>

            <th>Empleado</th>

            <th>Fecha Alta</th>

            <th class="text-center">Meses Computables</th>

            <th class="text-right">Salario Base</th>

            <th class="text-right">Aguinaldo a Pagar</th>

            <th class="text-center">Estado</th>

          </tr>

        </thead>

        <tbody>

          ${aguinaldos.map(a => `

            <tr>

              <td>${a.nombre}</td>

              <td>${new Date(a.fechaAlta).toLocaleDateString()}</td>

              <td class="text-center">${a.mesesLaborados}</td>

              <td class="text-right">C$${a.salario.toLocaleString()}</td>

              <td class="text-right font-bold">C$${a.monto.toLocaleString()}</td>

              <td class="text-center">${a.pagado ? 'PAGADO' : 'PENDIENTE'}</td>

            </tr>

          `).join('')}

          <tr class="total-row">

            <td colspan="4" class="text-right">TOTAL PLANILLA AGUINALDO:</td>

            <td class="text-right">C$${total.toLocaleString()}</td>

            <td></td>

          </tr>

        </tbody>

      </table>

  `;

    printDocument(`Planilla de Aguinaldo ${new Date().getFullYear()} `, content, 'landscape');

  };

  const marcarAguinaldoPagado = async (empleadoId) => {

    if (!confirm('¿Confirmar pago de aguinaldo del año en curso?')) return;

    try {

      const emp = DataService.getEmpleadoById(empleadoId);

      if (!emp) throw new Error('Empleado no encontrado');

      const calculo = calcularAguinaldo(emp);

      await DataService.createAguinaldo({

        empleadoId,

        anio: new Date().getFullYear(),

        monto: calculo.monto,

        diasCalculados: Math.floor(calculo.mesesLaborados * 2.5),

        fechaPago: new Date().toISOString(),

        observaciones: 'Pago generado desde sistema'

      });

      App.refreshCurrentModule();

      App.showNotification?.('Pago de aguinaldo registrado', 'success') || alert('Pago registrado');

    } catch (e) {

      console.error('Error registrando aguinaldo:', e);

      App.showNotification?.('Error: ' + e.message, 'error') || alert('Error: ' + e.message);

    }

  };

  const editAguinaldo = (empleadoId) => {

    // Abre el cálculo y permite modificar o confirmar

    // Para simplificar, llamamos a marcarAguinaldoPagado pero podríamos abrir un modal

    // Si el usuario pidió "botón de editar", quizás quiere editar el monto manualmente

    const emp = DataService.getEmpleadoById(empleadoId);

    if (!emp) return;

    const calc = calcularAguinaldo(emp);

    const newMonto = prompt(`Confirmar monto de aguinaldo para ${emp.nombre}: `, calc.monto);

    if (newMonto !== null) {

      // Guardar con monto modificado

      if (!confirm(`¿Registrar pago de C$${newMonto}?`)) return;

      DataService.createAguinaldo({

        empleadoId,

        anio: new Date().getFullYear(),

        monto: parseFloat(newMonto),

        diasCalculados: Math.floor(calc.mesesLaborados * 2.5),

        fechaPago: new Date().toISOString(),

        observaciones: 'Pago generado con ajuste manual'

      }).then(() => {

        App.showNotification?.('Aguinaldo registrado', 'success');

        App.refreshCurrentModule();

      });

    }

  };

  const verHistorialAguinaldos = async (empleadoId) => {

    try {

      const historial = await DataService.getAguinaldosByEmpleado(empleadoId);

      const emp = DataService.getEmpleadoById(empleadoId);

      const content = `

        <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

          <div class="modal modal--large" onclick="event.stopPropagation()">

            <div class="modal__header">

              <h3 class="modal__title">Historial Aguinaldos: ${emp?.nombre || ''}</h3>

              <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

            </div>

            <div class="modal__body">

              <table class="data-table">

                <thead><tr><th>Año</th><th>Fecha Pago</th><th>Monto</th></tr></thead>

                <tbody>

                  ${historial && historial.length ? historial.map(h => `

                           <tr>

                             <td class="text-center">${h.anio}</td>

                             <td class="text-center">${new Date(h.fecha_pago || h.fechaPago || new Date()).toLocaleDateString()}</td>

                             <td class="text-right">C$${(h.monto || 0).toLocaleString()}</td>

                           </tr>

                         `).join('') : '<tr><td colspan="3" class="text-center">No hay registros de aguinaldo</td></tr>'}

                </tbody>

              </table>

              <div class="modal__footer" style="padding-top: var(--spacing-md);">

                <button class="btn btn--secondary" onclick="PrestacionesModule.closeModal()">Cerrar</button>

              </div>

            </div>

          </div>

        </div>

      `;

      document.getElementById('prestacionesModal').innerHTML = content;

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error cargando historial', 'error') || alert('Error cargando historial');

    }

  };

  // Helper to fetch complementos (Mock for now, to be connected to DB new tables)

  // Helper to fetch complementos (Mock for now, using LocalStorage tables)

  const getComplementosForEmpleado = async (id, inicio, fin) => {

    const getSum = (key) => {

      const data = JSON.parse(localStorage.getItem(key) || '[]');

      return data

        .filter(x => x.empleadoId == id && x.fecha >= inicio && x.fecha <= fin)

        .reduce((sum, x) => sum + (parseFloat(x.monto) || 0), 0);

    };

    let deduccionAusencias = 0;

    try {

      // Fetch ausencias from DataService (Supabase)

      const ausencias = await DataService.getAllAusencias?.() || [];

      const emp = DataService.getEmpleadoById(id);

      const salarioDiario = (parseFloat(emp?.salarioTotal || emp?.salario_total) || 0) / 30;

      if (ausencias.length && emp) {

        const periodStart = new Date(inicio);

        const periodEnd = new Date(fin);

        const relevant = ausencias.filter(a => {

          if (a.empleadoId != id) return false;

          const aStart = new Date(a.fechaInicio); // YYYY-MM-DD

          const aEnd = new Date(a.fechaFin);

          return aStart <= periodEnd && aEnd >= periodStart;

        });

        let totalDias = 0;

        relevant.forEach(a => {

          const overlapStart = new Date(Math.max(new Date(a.fechaInicio), periodStart));

          const overlapEnd = new Date(Math.min(new Date(a.fechaFin), periodEnd));

          const diffTime = overlapEnd - overlapStart;

          const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          // Only deduct if type is 'dia_laboral' (or null/undefined as fallback if field missing)

          if (days > 0 && (a.tipoDescuento === 'dia_laboral')) {

            totalDias += days;

          }

        });

        deduccionAusencias = totalDias * salarioDiario;

      }

    } catch (e) {

      console.error('Error calculating ausencias:', e);

    }

    return {

      horasExtras: getSum('horas_extras'),

      bonificaciones: getSum('bonificaciones'),

      adelantos: getSum('adelantos'),

      ausencias: deduccionAusencias

    };

  };

  // --- Recibos ---

  // --- Recibos ---

  const generarRecibos = async (event) => {

    event.preventDefault();

    const fd = new FormData(event.target);

    const periodo = fd.get('periodo'); // quincenal, mensual

    const mes = fd.get('mes');

    const quincena = fd.get('quincena'); // 1, 2

    const metodoPago = fd.get('metodoPago');

    const empleadoId = fd.get('empleadoId');

    const emp = DataService.getEmpleadoById(empleadoId);

    if (!emp) {

      App.showNotification?.('Seleccione un empleado válido', 'error');

      return;

    }

    // Calcular fechas

    let fechaInicio, fechaFin;

    const year = parseInt(mes.split('-')[0]);

    const month = parseInt(mes.split('-')[1]) - 1; // 0-indexed

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    if (periodo === 'quincenal') {

      if (quincena === '1') {

        fechaInicio = `${mes}-01`;

        fechaFin = `${mes}-15`;

      } else {

        fechaInicio = `${mes}-16`;

        fechaFin = `${mes}-${lastDayOfMonth}`;

      }

    } else {

      fechaInicio = `${mes}-01`;

      fechaFin = `${mes}-${lastDayOfMonth}`;

    }

    // Validar duplicados

    try {

      const nominas = await DataService.getAllNominas();

      console.log('Verificando duplicados en', nominas.length, 'registros para empleado', empleadoId, 'fechas', fechaInicio, fechaFin);

      const exists = nominas.find(n => {

        const dbStart = n.periodo_inicio ? n.periodo_inicio.substring(0, 10) : '';

        const dbEnd = n.periodo_fin ? n.periodo_fin.substring(0, 10) : '';

        // Soporte para ambos formatos de propiedad (camelCase y snake_case)

        const nEmpId = n.empleadoId || n.empleado_id;

        return String(nEmpId) === String(empleadoId) &&

          dbStart === fechaInicio &&

          dbEnd === fechaFin;

      });

      if (exists) {

        App.showNotification?.('Ya existe un pago registrado para este empleado en este período.', 'warning');

        const msgDiv = document.getElementById('pagoStatusMsg');

        if (msgDiv) {

          msgDiv.style.display = 'block';

          msgDiv.innerHTML = `âš ï¸ <strong>${emp.nombre}</strong> ya tiene un recibo del <strong>${new Date(fechaInicio).toLocaleDateString('es-NI')} al ${new Date(fechaFin).toLocaleDateString('es-NI')}</strong>.`;

        }

        return;

      }

    } catch (e) { console.error('Error validando duplicados:', e); }

    // Calcular salario base según periodo

    let salarioTotal = parseFloat(emp.salarioTotal || emp.salario_total || 0);

    if (isNaN(salarioTotal) || salarioTotal <= 0) {

      alert('Error: El empleado no tiene un salario válido asignado.');

      return;

    }

    let salarioBase = salarioTotal;

    if (periodo === 'quincenal') salarioBase = salarioBase / 2;

    // Obtener complementos

    const comps = await getComplementosForEmpleado(emp.id, fechaInicio, fechaFin);

    // Deducciones

    const inss = (salarioBase + comps.horasExtras) * 0.07; // 7% INSS laboral

    const ir = 0; // IR desactivado

    const totalIngresos = salarioBase + comps.horasExtras + comps.bonificaciones;

    const totalDeducciones = inss + ir + comps.adelantos + (comps.ausencias || 0);

    const neto = totalIngresos - totalDeducciones;

    console.log('Generando recibo para:', emp.nombre, { salarioBase, comps, neto });

    try {

      // Construir notas detalladas ya que algunos campos se fusionan en DB

      const partesNotas = [];

      if (comps.horasExtras > 0) partesNotas.push(`Extras: C$${comps.horasExtras.toFixed(2)} `);

      if (comps.bonificaciones > 0) partesNotas.push(`Bonos: C$${comps.bonificaciones.toFixed(2)} `);

      if (comps.adelantos > 0) partesNotas.push(`Adelantos: C$${comps.adelantos.toFixed(2)} `);

      if (comps.ausencias > 0) partesNotas.push(`Ausencias: C$${comps.ausencias.toFixed(2)} `);

      const notasAutogeneradas = partesNotas.length > 0 ? `Detalles: ${partesNotas.join(', ')} ` : `Generado para ${periodo} de ${mes} `;

      await DataService.createNomina({

        empleadoId: emp.id,

        periodoInicio: fechaInicio,

        periodoFin: fechaFin,

        tipoPeriodo: periodo === 'quincenal' ? 'Quincenal' : 'Mensual',

        metodo_pago: metodoPago,

        salarioBase: salarioBase,

        horas_extras: comps.horasExtras,

        bonificaciones: comps.bonificaciones,

        adelantos: comps.adelantos,

        deduccionInss: inss,

        deduccionIr: ir,

        otrasDeducciones: (comps.ausencias || 0),

        totalNeto: neto,

        estado: 'Pagado',

        notas: notasAutogeneradas

      });

      App.showNotification?.(`Recibo generado exitosamente`, 'success');

      // Clear warning

      const msgDiv = document.getElementById('pagoStatusMsg');

      if (msgDiv) msgDiv.style.display = 'none';

      // Refresh History

      if (typeof filterHistorialRecibos === 'function') {

        filterHistorialRecibos(periodo, mes, quincena);

      } else {

        App.refreshCurrentModule();

      }

    } catch (err) {

      console.error('Error generando recibo:', err);

      const msg = (err.message || (typeof err === 'object' ? JSON.stringify(err) : err));

      App.showNotification?.('Error al generar recibo: ' + msg, 'error') || alert('Error al generar recibo: ' + msg);

    }

  };

  const verHistorialNominas = async (empleadoId) => {

    try {

      const historial = await DataService.getNominasByEmpleado(empleadoId);

      const emp = DataService.getEmpleadoById(empleadoId);

      const content = `

        <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

          <div class="modal modal--large" onclick="event.stopPropagation()">

            <div class="modal__header">

              <h3 class="modal__title">Historial Nóminas: ${emp?.nombre || ''}</h3>

              <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">${Icons.x}</button>

            </div>

            <div class="modal__body">

              <div class="table-container">

                <table class="data-table">

                  <thead><tr><th>Período</th><th>Tipo</th><th>Neto</th><th>Estado</th></tr></thead>

                  <tbody>

                    ${historial && historial.length ? historial.map(h => `

                           <tr>

                             <td>${new Date(h.periodo_inicio).toLocaleDateString()} - ${new Date(h.periodo_fin).toLocaleDateString()}</td>

                             <td>${h.tipo_periodo}</td>

                             <td class="text-right">C$${(h.total_neto || 0).toLocaleString()}</td>

                             <td><span class="badge ${h.estado === 'Pagado' ? 'badge--success' : 'badge--warning'}">${h.estado}</span></td>

                           </tr>

                         `).join('') : '<tr><td colspan="4" class="text-center">No hay registros de nómina</td></tr>'}

                  </tbody>

                </table>

              </div>

              <div class="modal__footer" style="padding-top: var(--spacing-md);">

                <button class="btn btn--secondary" onclick="PrestacionesModule.closeModal()">Cerrar</button>

              </div>

            </div>

          </div>

        </div>

      `;

      document.getElementById('prestacionesModal').innerHTML = content;

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error cargando historial de nóminas', 'error');

    }

  };

  // --- Liquidación ---

  const loadEmpleadoData = (id) => {

    if (!id) return;

    const emp = DataService.getEmpleadoById(id);

    const info = document.getElementById('empleadoInfo');

    if (!info) return;

    if (!emp) {

      info.innerHTML = '<div class="info-card info-card--error">Empleado no encontrado</div>';

      return;

    }

    const fechaAlta = emp.fechaAlta || emp.fecha_alta;

    const salario = parseFloat(emp.salarioTotal || emp.salario_total) || 0;

    const vacData = calcularVacaciones(emp);

    info.innerHTML = `

      <div class="info-card info-card--info">

          <p><strong>Empleado:</strong> ${emp.nombre || 'N/A'}</p>

          <p><strong>Fecha Alta:</strong> ${fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-NI') : '-'}</p>

          <p><strong>Salario Mensual:</strong> C$${salario.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</p>

          <p><strong>Vacaciones Pendientes:</strong> ${vacData.diasDisponibles} días</p>

          <p><strong>Antigüedad:</strong> ${vacData.antiguedadAnios} años</p>

      </div>

    `;

  };

  const calcularLiquidacion = (event) => {

    try {

      event.preventDefault();

      const fd = new FormData(event.target);

      const empleadoId = fd.get('empleadoId');

      const motivo = fd.get('motivo');

      const fSalidaStr = fd.get('fechaSalida');

      console.log('--- Iniciando cálculo de Liquidación ---');

      const resultDiv = document.getElementById('liquidacionResult');

      if (!resultDiv) {

        alert('Error interno: No se encontró el contenedor de resultados.');

        return;

      }

      if (!empleadoId || !fSalidaStr || !motivo) {

        App.showNotification?.('Complete todos los campos del formulario', 'warning');

        return;

      }

      const emp = DataService.getEmpleadoById(empleadoId);

      if (!emp) {

        App.showNotification?.('Error al obtener datos del empleado', 'error');

        return;

      }

      const fechaSalida = new Date(fSalidaStr);

      if (isNaN(fechaSalida.getTime())) {

        App.showNotification?.('Fecha de salida no válida', 'error');

        return;

      }

      // Mostrar indicador de carga inmediato para dar feedback de "está pasando algo"

      resultDiv.innerHTML = `<div class="card p-4 text-center"><p>${Icons.loader} Procesando datos de ${emp.nombre}...</p></div>`;

      // Datos base

      const salarioMensual = parseFloat(emp.salarioTotal || emp.salario_total || 0);

      const salarioDiario = salarioMensual / 30;

      const fechaAltaStr = emp.fechaAlta || emp.fecha_alta;

      if (!fechaAltaStr) {

        throw new Error('El empleado no tiene registrada su fecha de contratación.');

      }

      const fechaAltaEmp = new Date(fechaAltaStr);

      // 1. Vacaciones (Saldo acumulado)

      const vacData = calcularVacaciones(emp);

      const diasVacaciones = Math.max(0, parseFloat(vacData.diasDisponibles) || 0);

      const montoVacaciones = diasVacaciones * salarioDiario;

      // 2. Aguinaldo Proporcional

      // Período: Desde 1 de Enero del año de salida o fecha alta, hasta fecha salida

      const inicioAnio = new Date(fechaSalida.getFullYear(), 0, 1);

      const inicioComputo = new Date(Math.max(fechaAltaEmp.getTime(), inicioAnio.getTime()));

      const diffMs = fechaSalida.getTime() - inicioComputo.getTime();

      const diffTotalDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const mesesAguinaldo = diffTotalDays / 30.417; // Promedio mensual

      const montoAguinaldo = (salarioMensual / 12) * mesesAguinaldo;

      // 3. Indemnización (Art. 45)

      let indemnizacion = 0;

      const antiguedadExacta = (Math.max(0, fechaSalida.getTime() - fechaAltaEmp.getTime())) / (1000 * 60 * 60 * 24 * 365.25);

      if (['despido_sin_justa_causa', 'renuncia', 'mutuo_acuerdo'].includes(motivo)) {

        let mesesIndem = 0;

        if (antiguedadExacta <= 3) {

          mesesIndem = antiguedadExacta; // 1 mes por año

        } else {

          mesesIndem = 3 + (antiguedadExacta - 3) * (20 / 30); // 20 días por año adicional

        }

        if (mesesIndem > 5) mesesIndem = 5; // Tope 5 meses

        indemnizacion = mesesIndem * salarioMensual;

      }

      const granTotal = montoVacaciones + montoAguinaldo + indemnizacion;

      // Helper para formato Cordobas

      const formatMoney = (val) => (val || 0).toLocaleString('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 });

      const htmlResult = `

        <div class="card" style="margin-top: 2rem; border: 2px solid var(--color-primary-400); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">

                <div class="card__header" style="background: var(--color-primary-50); border-bottom: 2px solid var(--color-primary-100); display: flex; justify-content: space-between; align-items: center;">

                    <h3 class="card__title">${Icons.fileText} Resultados de Liquidación</h3>

                    <div style="display: flex; gap: 10px;">

                        <button class="btn btn--secondary btn--sm" onclick="PrestacionesModule.printDocument('Liquidación - ${emp.nombre || 'Empleado'}', document.getElementById('liquidacionTabla').innerHTML)">

                            ${Icons.printer} Imprimir PDF

                        </button>

                        <button class="btn btn--ghost btn--sm text-error" onclick="PrestacionesModule.darDeBajaEmpleado('${emp.id}', '${fSalidaStr}')">

                            Registrar Baja

                        </button>

                    </div>

                </div>

                <div class="card__body" id="liquidacionTabla" style="padding: 0;">

                    <div style="padding: 30px; font-family: 'Inter', sans-serif; background: #fff; color: #1a1f36;">

                        <!-- Encabezado con logo de empresa -->

                        <div style="text-align: center; margin-bottom: 30px;">

                            ${getLogoHtml('50px')}

                            <p style="margin: 3px 0; font-size: 10px; color: #1a73e8; font-weight: 600; letter-spacing: 1px;">${getCompanyConfig().slogan}</p>

                            <p style="margin: 8px 0; font-size: 14px; color: #4b5563; font-weight: 500;">LIQUIDACIÓN DEFINITIVA DE PRESTACIONES</p>

                            <div style="width: 60px; height: 3px; background: #1a73e8; margin: 10px auto;"></div>

                        </div>

                        <!-- Info Empleado -->

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px;">

                            <div>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">Empleado:</span> <strong style="color: #1a1f36;">${emp.nombre || 'N/A'}</strong></p>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">N° Cédula:</span> <strong>${emp.cedula || 'N/A'}</strong></p>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">Cargo:</span> <strong>${emp.cargo || 'N/A'}</strong></p>

                            </div>

                            <div>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">Fecha Ingreso:</span> <strong>${fechaAltaEmp.toLocaleDateString('es-NI')}</strong></p>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">Fecha Salida:</span> <strong>${fechaSalida.toLocaleDateString('es-NI')}</strong></p>

                                <p style="margin: 5px 0;"><span style="color: #64748b;">Antigüedad:</span> <strong>${antiguedadExacta.toFixed(2)} años</strong></p>

                            </div>

                        </div>

                        <!-- Detalles -->

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">

                            <thead>

                                <tr style="background: #f1f5f9;">

                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">Concepto</th>

                                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">Detalle/Tiempo</th>

                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">Total (C$)</th>

                                </tr>

                            </thead>

                            <tbody>

                                <tr style="border-bottom: 1px solid #f1f5f9;">

                                    <td style="padding: 15px 12px;">Vacaciones Proporcional / Pendientes</td>

                                    <td style="padding: 15px 12px; text-align: center;">${diasVacaciones.toFixed(2)} días</td>

                                    <td style="padding: 15px 12px; text-align: right; font-weight: 500;">${formatMoney(montoVacaciones).replace('NIO', 'C$')}</td>

                                </tr>

                                <tr style="border-bottom: 1px solid #f1f5f9;">

                                    <td style="padding: 15px 12px;">Décimo Tercer Mes (Aguinaldo) Prop.</td>

                                    <td style="padding: 15px 12px; text-align: center;">${mesesAguinaldo.toFixed(2)} meses</td>

                                    <td style="padding: 15px 12px; text-align: right; font-weight: 500;">${formatMoney(montoAguinaldo).replace('NIO', 'C$')}</td>

                                </tr>

                                ${indemnizacion > 0 ? `

                                <tr style="border-bottom: 1px solid #f1f5f9;">

                                    <td style="padding: 15px 12px;">Indemnización por Antigüedad (Art. 45)</td>

                                    <td style="padding: 15px 12px; text-align: center;">${antiguedadExacta.toFixed(2)} años</td>

                                    <td style="padding: 15px 12px; text-align: right; font-weight: 500;">${formatMoney(indemnizacion).replace('NIO', 'C$')}</td>

                                </tr>

                                ` : ''}

                            </tbody>

                            <tfoot>

                                <tr style="background: #1a73e8; color: #fff;">

                                    <td colspan="2" style="padding: 15px 12px; font-weight: 700; border-radius: 0 0 0 5px; font-size: 16px;">NETO A PAGAR</td>

                                    <td style="padding: 15px 12px; text-align: right; font-weight: 700; border-radius: 0 0 5px 0; font-size: 20px;">${formatMoney(granTotal).replace('NIO', 'C$')}</td>

                                </tr>

                            </tfoot>

                        </table>

                        <!-- Firmas -->

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 80px; text-align: center; font-size: 12px;">

                            <div>

                                <div style="height: 1px; background: #94a3b8; margin-bottom: 10px;"></div>

                                <p style="margin: 0; font-weight: 600;">${emp.nombre || 'El Trabajador'}</p>

                                <p style="margin: 5px 0; color: #64748b;">Recibido Conforme</p>

                            </div>

                            <div>

                                <div style="height: 1px; background: #94a3b8; margin-bottom: 10px;"></div>

                                <p style="margin: 0; font-weight: 600;">${getCompanyConfig().name}</p>

                                <p style="margin: 5px 0; color: #64748b;">Entrega Autorizada</p>

                            </div>

                        </div>

                        <div style="margin-top: 60px; padding: 15px; background: #fffbeb; border-radius: 6px; border-left: 4px solid #f59e0b; font-size: 11px; color: #92400e;">

                            <strong>Nota Legal:</strong> La presente liquidación se rige por el Código del Trabajo de la República de Nicaragua. Al firmar este documento, el trabajador otorga el finiquito más amplio en derecho.

                        </div>

                    </div>

                </div>

            </div>

  `;

      resultDiv.innerHTML = htmlResult;

      // Scroll suave al resultado

      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {

      console.error('CRITICAL ERROR in calcularLiquidacion:', err);

      App.showNotification?.('Ocurrió un error en el cálculo: ' + err.message, 'error');

      const resDiv = document.getElementById('liquidacionResult');

      if (resDiv) {

        resDiv.innerHTML = `

          <div class="card p-4 border-error" style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; margin-top: 1rem;">

                    <h3 style="color: #b91c1c; margin-top: 0;">No se pudo completar el cálculo</h3>

                    <p style="color: #7f1d1d;">Detalle: ${err.message}</p>

                    <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 15px 0;">

                    <p style="font-size: 0.9em; color: #991b1b;">Sugerencia: Revise que el empleado tenga un salario y fecha de alta válidos.</p>

                </div>

`;

      }

    }

  };

  const darDeAltaEmpleado = (id) => {

    const emp = DataService.getEmpleadoById(id);

    if (!emp) {

      App.showNotification?.('Error: No se encontró el empleado', 'error');

      return;

    }

    const hoy = new Date().toISOString().split('T')[0];

    document.getElementById('prestacionesModal').innerHTML = `

      <div class="modal-overlay open" onclick="PrestacionesModule.closeModal(event)">

        <div class="modal" onclick="event.stopPropagation()">

          <div class="modal__header">

            <h3 class="modal__title">${Icons.checkCircle} Re-contratación de Empleado</h3>

            <button class="btn btn--ghost btn--icon" onclick="PrestacionesModule.closeModal()">

              ${Icons.x}

            </button>

          </div>

          <form class="modal__body" onsubmit="PrestacionesModule.processReincorporacion(event)">

            <input type="hidden" name="id" value="${id}">

              <div class="info-card info-card--info" style="margin-bottom: var(--spacing-md);">

                <p>Vas a reactivar a <strong>${emp.nombre}</strong>. Sus contadores de vacaciones y aguinaldo se reiniciarán para este nuevo periodo.</p>

              </div>

              <div class="form-group">

                <label class="form-label form-label--required">Nueva Fecha de Inicio / Contrato</label>

                <input type="date" name="fechaAlta" class="form-input" value="${hoy}" required>

              </div>

              <div class="form-group">

                <label class="form-label">Notas de Re-contratación (Opcional)</label>

                <textarea name="notas" class="form-textarea" rows="3"

                  placeholder="Ej: Nuevo contrato firmado. Se mantiene cargo anterior."></textarea>

              </div>

              <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">

                <button type="button" class="btn btn--secondary" onclick="PrestacionesModule.closeModal()">Cancelar</button>

                <button type="submit" class="btn btn--success">

                  ${Icons.checkCircle} Confirmar Re-ingreso

                </button>

              </div>

          </form>

        </div>

      </div>

  `;

  };

  const processReincorporacion = async (event) => {

    event.preventDefault();

    const fd = new FormData(event.target);

    const id = fd.get('id');

    const fechaAlta = fd.get('fechaAlta');

    const notas = fd.get('notas');

    try {

      const emp = DataService.getEmpleadoById(id);

      const oldObs = emp.observaciones || emp.notas || '';

      const timestamp = new Date().toLocaleDateString('es-NI');

      const newObs = `[RE-CONTRATACIÓN ${timestamp}]: ${notas || 'Sin notas adicionales.'} \n---\n${oldObs} `;

      await DataService.updateEmpleado(id, {

        estado: 'Activo',

        fechaAlta: fechaAlta,

        fecha_alta: fechaAlta,

        fecha_baja: null,

        fechaSalida: null,

        vacaciones_tomadas: 0,

        vacacionesTomadas: 0,

        aguinaldo_pagado: false,

        aguinaldoPagado: false,

        observaciones: newObs

      });

      App.showNotification?.('Empleado reactivado exitosamente', 'success');

      closeModal();

      App.refreshCurrentModule();

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error al reactivar empleado: ' + e.message, 'error');

    }

  };

  const darDeBajaEmpleado = async (id, fechaSalida) => {

    if (!confirm('¿Está seguro de dar de baja a este empleado? Pasará a estado Inactivo.')) return;

    try {

      await DataService.updateEmpleado(id, {

        estado: 'Inactivo',

        fecha_baja: fechaSalida,

        fechaSalida: fechaSalida

      });

      App.showNotification?.('Empleado dado de baja exitosamente', 'success');

      App.refreshCurrentModule();

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error al dar de baja', 'error');

    }

  };

  const deleteAguinaldo = async (empleadoId) => {

    if (!confirm('¿Desea eliminar el último pago de aguinaldo registrado para este empleado?')) return;

    try {

      const historial = await DataService.getAguinaldosByEmpleado(empleadoId);

      if (historial.length > 0) {

        const ultimo = historial[0];

        // Use generic delete if deleteAguinaldo not explicitly in SupabaseDataService

        const res = await (SupabaseDataService.deleteAguinaldo ? SupabaseDataService.deleteAguinaldo(ultimo.id) : { success: false, error: 'Función no implementada' });

        if (res?.success) {

          // Revertir estado en empleado

          await DataService.updateEmpleado(empleadoId, { aguinaldoPagado: false });

          App.showNotification?.('Pago de aguinaldo eliminado y estado revertido', 'success');

          App.refreshCurrentModule();

        } else {

          // Fallback: try generic delete or report failure

          App.showNotification?.('Error: ' + (res?.error || 'No se pudo eliminar el registro'), 'error');

        }

      } else {

        App.showNotification?.('No hay pagos registrados para eliminar', 'info');

      }

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error: ' + e.message, 'error');

    }

  };

  const eliminarHistorialVacaciones = async (empleadoId) => {

    if (!confirm('¿Está ABSOLUTAMENTE SEGURO de eliminar TODO el historial de vacaciones de este empleado? Esta acción no se puede deshacer.')) return;

    try {

      const historial = await DataService.getVacacionesByEmpleado(empleadoId);

      if (!historial.length) {

        App.showNotification?.('No hay vacaciones para eliminar', 'info');

        return;

      }

      for (const v of historial) {

        await DataService.deleteVacacion(v.id);

      }

      App.showNotification?.('Historial de vacaciones vaciado correctamente', 'success');

      App.refreshCurrentModule();

    } catch (e) {

      console.error(e);

      App.showNotification?.('Error al vaciar historial', 'error');

    }

  };

  // --- Reportes ---

  // --- Reportes Helpers ---

  // ========== BRANDING CONFIG ==========

  const getCompanyConfig = () => {

    return (typeof State !== 'undefined' && State.get('companyConfig')) || {

      name: 'ALLTECH',

      slogan: 'Soluciones Tecnológicas',

      logoUrl: 'assets/logo.png'

    };

  };

  // Helper: genera HTML del logo (img tag para imágenes cargadas, o svg si es inline)

  const getLogoHtml = (height = '45px') => {

    const { logoUrl, name } = getCompanyConfig();

    // Si es SVG inline

    if (logoUrl && logoUrl.trim().startsWith('<svg')) {

      // Insertar estilo de altura en el tag svg si no lo tiene

      if (!logoUrl.includes('style=')) {

        return logoUrl.replace('<svg', `<svg style="height:${height};width:auto;"`);

      }

      return logoUrl; // Si ya tiene estilo, devolver tal cual (o podríamos forzar replace)

    }

    // Si es ruta de imagen (png, jpg, base64)

    return `<img src="${logoUrl}" alt="${name}" style="height:${height}; width:auto; object-fit:contain;">`;

  };

  const printDocument = (title, content, orientation = 'portrait') => {

    const printWindow = window.open('', '_blank');

    if (!printWindow) { alert('Por favor habilite las ventanas emergentes para imprimir el reporte.'); return; }

    const config = getCompanyConfig();

    printWindow.document.write(`<!DOCTYPE html>

    <html>

      <head>

        <title>${title} - ${config.name}</title>

        <style>

          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          body {font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 0; margin: 0; color: #1a1f36; background: white; }

          .container {padding: 30px; max-width: 900px; margin: 0 auto; }

          .print-header {display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; border-bottom: 2px solid #e3e8ee; padding-bottom: 12px; }

          .print-header h1 {margin: 0; font-size: 18px; color: #1a73e8; text-transform: uppercase; letter-spacing: 0.5px; }

          .print-header p {margin: 3px 0 0; font-size: 11px; color: #697386; }

          table {width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }

          th {background-color: #f7f9fc; color: #4f566b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding: 12px 10px; border: 1px solid #e3e8ee; text-align: left; }

          td {padding: 10px; border: 1px solid #e3e8ee; color: #3c4257; }

          tr:nth-child(even) {background-color: #fcfdfe; }

          .text-right {text-align: right; }

          .text-center {text-align: center; }

          .font-bold {font-weight: 700; }

          .footer {margin-top: 30px; padding-top: 15px; border-top: 1px solid #e3e8ee; font-size: 10px; text-align: center; color: #697386; }

          @media print {

            @page {size: ${orientation}; margin: 12mm; }

            body {-webkit-print-color-adjust: exact; print-color-adjust: exact; }

            .no-print {display: none !important; }

            .container {padding: 0; }

          }

        </style>

      </head>

      <body>

        <div class="container">

          <div class="print-header">

            <div>

              <h1>${title}</h1>

              <p>Generado: ${new Date().toLocaleString('es-NI')}</p>

            </div>

            <div style="text-align: right;">

              ${getLogoHtml('45px')}

              <p style="font-weight: 600; color: #1a73e8; margin: 4px 0 0; font-size: 10px; letter-spacing: 1px;">${config.slogan}</p>

            </div>

          </div>

          ${content}

          <div class="footer">

            Este documento fue generado electrónicamente por el sistema ${config.name} &bull; ${config.slogan}

          </div>

        </div>

        <script>

          setTimeout(() => { window.print(); }, 500);

        </script>

      </body>

    </html>`);

    printWindow.document.close();

  };

  // --- Implementación Reportes ---

  const generarReporteEmpleados = () => {

    const empleados = DataService.getEmpleadosSync().filter(e => e.estado === 'Activo');

    const content = `

    < table >

        <thead>

          <tr>

            <th>Nombre</th>

            <th>Cédula</th>

            <th>Cargo</th>

            <th>Fecha Alta</th>

            <th>Salario Total</th>

            <th>Contrato</th>

            <th>Email / Tel</th>

          </tr>

        </thead>

        <tbody>

          ${empleados.map(e => `

            <tr>

              <td>${e.nombre}</td>

              <td>${e.cedula || '-'}</td>

              <td>${e.cargo}</td>

              <td>${(e.fechaAlta || e.fecha_alta) ? new Date(e.fechaAlta || e.fecha_alta).toLocaleDateString() : '-'}</td>

              <td class="text-right">C$${(parseFloat(e.salarioTotal || e.salario_total) || 0).toLocaleString()}</td>

              <td>${e.tipoContrato || e.tipo_contrato || '-'}</td>

              <td>${e.email || ''}<br>${e.telefono || ''}</td>

            </tr>

          `).join('')}

        </tbody>

      </table >

  `;

    printDocument('Reporte de Personal Activo', content, 'landscape');

  };

  const generarReporteVacaciones = () => {

    const empleados = DataService.getEmpleadosSync().filter(e => e.estado === 'Activo');

    const datos = empleados.map(e => calcularVacaciones(e));

    const content = `

  < table >

        <thead>

          <tr>

            <th>Empleado</th>

            <th>Cargo</th>

            <th>Antigüedad (Años)</th>

            <th class="text-center">Días Acumulados</th>

            <th class="text-center">Días Tomados</th>

            <th class="text-center">Saldo Disponible</th>

            <th>Valor Monetario (Est.)</th>

          </tr>

        </thead>

        <tbody>

          ${datos.map(d => {

      const empleado = empleados.find(e => e.id === d.id);

      const valorDia = (parseFloat(empleado.salarioTotal || empleado.salario_total) || 0) / 30;

      const valorSaldo = d.diasDisponibles * valorDia;

      return `

              <tr>

                <td>${d.nombre}</td>

                <td>${d.cargo}</td>

                <td class="text-center">${d.antiguedadAnios}</td>

                <td class="text-center">${d.diasAcumulados}</td>

                <td class="text-center">${d.diasTomados}</td>

                <td class="text-center" style="font-weight:bold; color: ${d.diasDisponibles >= 0 ? 'inherit' : 'red'};">${d.diasDisponibles}</td>

                <td class="text-right">C$${valorSaldo.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

              </tr>

            `;

    }).join('')}

          <tr class="total-row">

            <td colspan="6" class="text-right">TOTAL PASIVO VACACIONAL ESTIMADO:</td>

            <td class="text-right">C$${datos.reduce((sum, d) => sum + (d.diasDisponibles * ((parseFloat(empleados.find(e => e.id === d.id)?.salarioTotal || empleados.find(e => e.id === d.id)?.salario_total) || 0) / 30)), 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>

          </tr>

        </tbody>

      </table >

  `;

    printDocument('Reporte de Estado de Vacaciones', content, 'landscape');

  };

  const generarPlanillaMensual = () => {

    const mesSeleccionado = document.getElementById('reportPlanillaMes')?.value || new Date().toISOString().slice(0, 7);

    const empleados = DataService.getEmpleadosSync().filter(e => e.estado === 'Activo');

    // Obtener complementos del Storage para el cálculo

    const extras = JSON.parse(localStorage.getItem('horas_extras') || '[]');

    const bonos = JSON.parse(localStorage.getItem('bonificaciones') || '[]');

    const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');

    // Obtener ausencias desde DataService (asumimos que ya están en DB)

    const loadAndFilterAusencias = async () => {

      const allAusencias = await DataService.getAllAusencias();

      return allAusencias.filter(a => a.fecha_inicio?.startsWith(mesSeleccionado));

    };

    // Puesto que es una operación async, manejaremos la lógica dentro de un wrapper si fuera necesario, 

    // pero para este entorno usaremos una carga previa o simplificada.

    const ausenciasLocal = (DataService.getAusenciasSync ? DataService.getAusenciasSync() : []).filter(a => a.fecha_inicio?.startsWith(mesSeleccionado));

    let totalSalarioBase = 0;

    let totalExtras = 0;

    let totalBonos = 0;

    let totalAdelantos = 0;

    let totalInss = 0;

    let totalNetoGeneral = 0;

    const rows = empleados.map(e => {

      const salarioBase = parseFloat(e.salarioTotal || e.salario_total) || 0;

      const mExtras = extras.filter(x => x.empleadoId === e.id && x.fecha?.startsWith(mesSeleccionado))

        .reduce((sum, x) => sum + (parseFloat(x.monto) || 0), 0);

      const mBonos = bonos.filter(b => b.empleadoId === e.id && b.fecha?.startsWith(mesSeleccionado))

        .reduce((sum, b) => sum + (parseFloat(b.monto) || 0), 0);

      const mAdelantos = adelantos.filter(a => a.empleadoId === e.id && a.fecha?.startsWith(mesSeleccionado))

        .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

      // Calcular deducción por ausencias (días laborales que no son vacaciones)

      const empAusencias = ausenciasLocal.filter(a => a.empleadoId === e.id && a.tipo_descuento !== 'vacaciones');

      const diasAusentes = empAusencias.reduce((sum, a) => sum + (parseInt(a.dias) || 0), 0);

      const decAusencia = (salarioBase / 30) * diasAusentes;

      const ingresosBrutos = salarioBase + mExtras + mBonos;

      const inss = ingresosBrutos * 0.07;

      const neto = ingresosBrutos - inss - mAdelantos - decAusencia;

      totalSalarioBase += salarioBase;

      totalExtras += mExtras;

      totalBonos += mBonos;

      totalAdelantos += (mAdelantos + decAusencia); // Sumamos ambos como deducciones totales en el reporte

      totalInss += inss;

      totalNetoGeneral += neto;

      return `

  < tr >

                <td>${e.nombre}</td>

                <td class="text-right">C$${salarioBase.toLocaleString()}</td>

                <td class="text-right text-success">+ C$${mExtras.toLocaleString()}</td>

                <td class="text-right text-success">+ C$${mBonos.toLocaleString()}</td>

                <td class="text-right text-danger">${diasAusentes > 0 ? `<div style="font-size:9px">(${diasAusentes}d)</div>` : ''}- C$${decAusencia.toLocaleString()}</td>

                <td class="text-right text-danger">- C$${inss.toLocaleString()}</td>

                <td class="text-right text-danger">- C$${mAdelantos.toLocaleString()}</td>

                <td class="text-right font-bold" style="background: #f8fafc;">C$${neto.toLocaleString()}</td>

            </tr >

  `;

    }).join('');

    const content = `

  < h3 > Nómina Mensual Detallada(${mesSeleccionado})</h3 >

      <p style="font-size: 11px; color: #666; margin-bottom: 20px;">Reporte integral incluye Salario Base, Horas Extras, Bonificaciones y Deducciones (INSS / Adelantos / Ausencias).</p>

      <table>

        <thead>

          <tr>

            <th>Empleado</th>

            <th class="text-right">Salario Base</th>

            <th class="text-right">H. Extras</th>

            <th class="text-right">Bonos</th>

            <th class="text-right">Ausenc.</th>

            <th class="text-right">INSS (7%)</th>

            <th class="text-right">Adelantos</th>

            <th class="text-right">Neto Recibir</th>

          </tr>

        </thead>

        <tbody>

          ${rows}

          <tr class="total-row" style="background: #f1f5f9; font-weight: bold;">

            <td class="text-right">TOTALES:</td>

            <td class="text-right">C$${totalSalarioBase.toLocaleString()}</td>

            <td class="text-right">C$${totalExtras.toLocaleString()}</td>

            <td class="text-right">C$${totalBonos.toLocaleString()}</td>

            <td colspan="3"></td>

            <td class="text-right" style="color: #1a73e8; font-size: 14px;">C$${totalNetoGeneral.toLocaleString()}</td>

          </tr>

        </tbody>

      </table>

`;

    printDocument('Planilla Mensual Detallada', content, 'landscape');

  };

  const imprimirReciboAdelanto = (id) => {

    const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');

    const item = adelantos.find(a => a.id === id);

    if (!item) return;

    const emp = DataService.getEmpleadosSync().find(e => e.id === item.empleadoId);

    const renderReceipt = (copyTitle) => `

  < div style = "border: 2px solid #1a1f36; padding: 15px; margin-bottom: 10px; position: relative; min-height: 320px;" >

        <div style="text-align: right; color: #666; font-size: 10px; margin-bottom: 5px;">${copyTitle}</div>

        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f3f9; padding-bottom: 5px; margin-bottom: 10px;">

          <div>

            ${getLogoHtml('30px')}

            <div style="font-size: 8px; color: #697386; letter-spacing: 0.5px; margin-top: 1px;">${getCompanyConfig().slogan}</div>

          </div>

          <div style="text-align: center; flex: 1;">

            <h3 style="margin:0; color: #1a1f36; font-size: 16px;">RECIBO DE ADELANTO</h3>

            <p style="margin:2px 0; color: #697386; font-size: 11px;">No. AD-${item.id.slice(-6)}</p>

          </div>

          <div style="text-align: right;">

            <h3 style="margin:0; font-size: 16px;">C$ ${parseFloat(item.monto).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</h3>

          </div>

        </div>

        

        <p style="font-size: 11px; line-height: 1.4; margin-bottom: 15px;">

          He recibido de <strong>${getCompanyConfig().name}</strong> la cantidad de <strong>C$ ${parseFloat(item.monto).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</strong> 

          en concepto de adelanto de salario correspondiente al mes de <strong>${new Date(item.fecha).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</strong>.

        </p>

        <div style="margin-top: 20px;">

          <table style="width: 100%; border:0;">

            <tr>

              <td style="width: 50%;">

                <p style="margin: 2px 0; font-size: 11px;"><strong>Empleado:</strong> ${emp?.nombre || 'N/A'}</p>

                <p style="margin: 2px 0; font-size: 11px;"><strong>Cédula:</strong> ${emp?.cedula || '-'}</p>

                <p style="margin: 2px 0; font-size: 11px;"><strong>Fecha de Pago:</strong> ${new Date(item.fecha).toLocaleDateString('es-NI')}</p>

              </td>

              <td style="width: 50%; vertical-align: bottom; text-align: center;">

                <div style="border-top: 1px solid #1f2937; width: 150px; margin: 0 auto; padding-top: 5px; font-size: 11px;">

                  Firma del Empleado

                </div>

              </td>

            </tr>

          </table>

        </div>

      </div >

  `;

    const content = `

  < div style = "font-family: 'Inter', sans-serif;" >

    ${renderReceipt('COPIA EMPRESA')}

<div style="border-top: 1px dashed #ccc; margin: 15px 0;"></div>

        ${renderReceipt('COPIA CLIENTE')}

      </div >

  `;

    printDocument(`Recibo de Adelanto - ${emp?.nombre} `, content, 'portrait');

  };

  const imprimirReciboAguinaldo = (empleadoId) => {

    const emp = DataService.getEmpleadosSync().find(e => e.id === empleadoId);

    if (!emp) return;

    const data = calcularAguinaldo(emp);

    const year = new Date().getFullYear();

    const renderReceipt = (copyTitle) => `

  < div style = "border: 2px solid #1a1f36; padding: 15px; margin-bottom: 10px; position: relative; min-height: 320px;" >

        <div style="text-align: right; color: #666; font-size: 10px; margin-bottom: 5px;">${copyTitle}</div>

        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f1f3f9; padding-bottom: 5px; margin-bottom: 10px;">

          <div>

            ${getLogoHtml('30px')}

            <div style="font-size: 8px; color: #697386; letter-spacing: 0.5px; margin-top: 1px;">${getCompanyConfig().slogan}</div>

          </div>

          <div style="text-align: center; flex: 1;">

            <h3 style="margin:0; color: #1a1f36; font-size: 16px;">RECIBO DE AGUINALDO</h3>

            <p style="margin:2px 0; color: #697386; font-size: 11px;">CORRESPONDIENTE AL AÑO ${year}</p>

          </div>

          <div style="text-align: right;">

            <h3 style="margin:0; font-size: 16px;">C$ ${parseFloat(data.monto).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</h3>

          </div>

        </div>

        <div style="margin-bottom: 15px;">

            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Empleado:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">${emp.nombre}</td></tr>

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Cédula:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">${emp.cedula || '-'}</td></tr>

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Cargo:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">${emp.cargo || '-'}</td></tr>

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Fecha Contratación:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">${new Date(emp.fechaAlta || emp.fecha_alta).toLocaleDateString('es-NI')}</td></tr>

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Meses Computables:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">${data.mesesLaborados.toFixed(2)} meses</td></tr>

                <tr><td style="padding: 3px; border-bottom: 1px solid #eee;"><strong>Salario Mensual:</strong></td><td style="padding: 3px; border-bottom: 1px solid #eee;">C$ ${parseFloat(data.salario).toLocaleString('es-NI')}</td></tr>

            </table>

        </div>

        

        <p style="font-size: 11px; line-height: 1.4; margin-bottom: 15px;">

          He recibido de <strong>${getCompanyConfig().name}</strong> la cantidad de <strong>C$ ${parseFloat(data.monto).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</strong> 

          en concepto de pago de decimotercer mes (Aguinaldo) conforme al Código del Trabajo de Nicaragua.

        </p>

        <div style="margin-top: 20px;">

          <table style="width: 100%; border:0;">

            <tr>

              <td style="width: 50%;">

                <p style="margin: 2px 0; font-size: 11px;"><strong>Fecha de Pago:</strong> ${new Date().toLocaleDateString('es-NI')}</p>

                 <p style="margin: 2px 0; font-size: 11px;"><strong>Elaborado por:</strong> RRHH</p>

              </td>

              <td style="width: 50%; vertical-align: bottom; text-align: center;">

                <div style="border-top: 1px solid #1f2937; width: 150px; margin: 0 auto; padding-top: 5px; font-size: 11px;">

                  Firma del Empleado

                </div>

              </td>

            </tr>

          </table>

        </div>

      </div >

  `;

    const content = `

  < div style = "font-family: 'Inter', sans-serif;" >

    ${renderReceipt('COPIA EMPRESA')}

<div style="border-top: 1px dashed #ccc; margin: 15px 0;"></div>

        ${renderReceipt('COPIA CLIENTE')}

      </div >

  `;

    printDocument(`Recibo Aguinaldo - ${emp.nombre} `, content, 'portrait');

  };

  const toggleReportFilters = () => {

    const tipo = document.getElementById('reportPagosTipoFiltro').value;

    document.getElementById('filterContainerMes').style.display = tipo === 'mes' ? 'block' : 'none';

    document.getElementById('filterContainerAnio').style.display = tipo === 'anio' ? 'block' : 'none';

    document.getElementById('filterContainerRango').style.display = tipo === 'rango' ? 'flex' : 'none';

  };

  const generarReportePagosHechos = () => {

    const empId = document.getElementById('reportPagosEmpleadoId').value;

    const tipoFiltro = document.getElementById('reportPagosTipoFiltro').value;

    // Definir rango de fechas

    let fechaInicio, fechaFin;

    const today = new Date();

    if (tipoFiltro === 'mes') {

      const mesInput = document.getElementById('reportPagosMes').value; // YYYY-MM

      if (!mesInput) return alert('Seleccione un mes válido');

      const [y, m] = mesInput.split('-');

      fechaInicio = new Date(y, m - 1, 1); // Primer día

      fechaFin = new Date(y, m, 0, 23, 59, 59); // Último día

    } else if (tipoFiltro === 'anio') {

      const y = document.getElementById('reportPagosAnio').value;

      fechaInicio = new Date(y, 0, 1);

      fechaFin = new Date(y, 11, 31, 23, 59, 59);

    } else if (tipoFiltro === 'rango') {

      const dInicio = document.getElementById('reportPagosDesde').value;

      const dFin = document.getElementById('reportPagosHasta').value;

      if (!dInicio || !dFin) return alert('Seleccione fecha inicial y final');

      fechaInicio = new Date(dInicio);

      fechaFin = new Date(dFin);

      fechaFin.setHours(23, 59, 59); // Final del día

    }

    const allEmps = DataService.getEmpleadosSync();

    const emps = empId === 'all' ? allEmps : [allEmps.find(e => e.id === empId)];

    const nominas = JSON.parse(localStorage.getItem('nominas_historial') || '[]');

    const bonos = JSON.parse(localStorage.getItem('bonificaciones') || '[]');

    const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');

    const content = emps.map(e => {

      // Filter by Employee AND Date Range

      const filterByDate = (item, dateField) => {

        if (item.empleadoId !== e.id) return false;

        const d = new Date(item[dateField]);

        return d >= fechaInicio && d <= fechaFin;

      };

      const eNominas = nominas.filter(n => filterByDate(n, 'fechaPago')); // fechaPago used in nominas

      const eBonos = bonos.filter(b => filterByDate(b, 'fecha'));

      const eAdelantos = adelantos.filter(a => filterByDate(a, 'fecha'));

      if (!eNominas.length && !eBonos.length && !eAdelantos.length) return '';

      // Calculate Totals per Employee

      const totalNominas = eNominas.reduce((acc, curr) => acc + (parseFloat(curr.montoNeto) || 0), 0);

      const totalBonos = eBonos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

      const totalAdelantos = eAdelantos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

      const grandTotal = totalNominas + totalBonos - totalAdelantos; // Adelantos are deductions usually, but here we list payments MADE. If it's "Pagos Hechos", adelantos are money OUT. Nominas are money OUT. 

      return `

  < div style = "margin-bottom: 40px; page-break-inside: avoid;" >

          <h3 style="border-bottom: 2px solid #1a1f36; padding-bottom: 5px; color: #1a73e8;">${e.nombre}</h3>

          <p style="font-size: 11px; margin-top: -5px;">Cargo: ${e.cargo} | Cédula: ${e.cedula}</p>

          

          <table style="margin-top: 10px;">

            <thead>

              <tr>

                <th>Fecha</th>

                <th>Tipo de Pago / Concepto</th>

                <th class="text-right">Monto</th>

              </tr>

            </thead>

            <tbody>

              ${eNominas.map(n => `<tr><td>${new Date(n.fechaPago).toLocaleDateString()}</td><td>Nómina Mensual (${n.mes})</td><td class="text-right">C$${parseFloat(n.montoNeto).toLocaleString()}</td></tr>`).join('')}

              ${eBonos.map(b => `<tr><td>${new Date(b.fecha).toLocaleDateString()}</td><td>Bono: ${b.concepto}</td><td class="text-right">C$${parseFloat(b.monto).toLocaleString()}</td></tr>`).join('')}

              ${eAdelantos.map(a => `<tr><td>${new Date(a.fecha).toLocaleDateString()}</td><td>Adelanto de Salario (Deducción Futura)</td><td class="text-right text-warning">C$${parseFloat(a.monto).toLocaleString()}</td></tr>`).join('')}

            </tbody>

            <tfoot>

               <tr style="background: #f8fafc; font-weight: bold;">

                 <td colspan="2" class="text-right">Total Pagado:</td>

                 <td class="text-right">C$${(totalNominas + totalBonos + totalAdelantos).toLocaleString()}</td>

               </tr>

            </tfoot>

          </table>

        </div >

  `;

    }).join('') || '<p>No se encontraron registros de pagos para la selección y período indicados.</p>';

    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };

    const periodStr = `Del ${fechaInicio.toLocaleDateString('es-NI', dateOptions)} al ${fechaFin.toLocaleDateString('es-NI', dateOptions)} `;

    printDocument(`Historial de Pagos - ${periodStr} `, content, 'portrait');

  };

  const generarReporteCostos = () => {

    const empleados = DataService.getEmpleadosSync().filter(e => e.estado === 'Activo');

    let totalSalario = 0;

    let totalINSSPatronal = 0;

    let totalINATE = 0; // INATEC 2%

    let totalVacaciones = 0; // Provisión 1/12

    let totalAguinaldo = 0; // Provisión 1/12

    const rows = empleados.map(e => {

      const salario = parseFloat(e.salarioTotal || e.salario_total) || 0;

      const inssPatronal = calcularINSS(salario).empleador;

      const inatec = salario * 0.02;

      const provisionLey = (salario / 12) * 2; // Vacaciones + Aguinaldo (approx 1 mes cada uno por año)

      const costoTotal = salario + inssPatronal + inatec + provisionLey;

      totalSalario += salario;

      totalINSSPatronal += inssPatronal;

      totalINATE += inatec;

      totalVacaciones += (salario / 12);

      totalAguinaldo += (salario / 12);

      return `

  < tr >

                <td>${e.nombre}</td>

                <td class="text-right">C$${salario.toLocaleString()}</td>

                <td class="text-right">C$${inssPatronal.toLocaleString()}</td>

                <td class="text-right">C$${inatec.toLocaleString()}</td>

                <td class="text-right">C$${provisionLey.toLocaleString()}</td>

                <td class="text-right font-bold">C$${costoTotal.toLocaleString()}</td>

            </tr >

  `;

    }).join('');

    const granTotal = totalSalario + totalINSSPatronal + totalINATE + totalVacaciones + totalAguinaldo;

    const content = `

  < h3 > Costos Laborales Mensuales(Carga Patronal)</h3 >

      <table>

        <thead>

          <tr>

            <th>Empleado</th>

            <th class="text-right">Salario Base</th>

            <th class="text-right">INSS Patronal (21.5%)</th>

            <th class="text-right">INATEC (2%)</th>

            <th class="text-right">Prov. Ley (Vac+Agui)</th>

            <th class="text-right">Costo Total</th>

          </tr>

        </thead>

        <tbody>

          ${rows}

          <tr class="total-row">

            <td class="text-right">TOTALES:</td>

            <td class="text-right">C$${totalSalario.toLocaleString()}</td>

            <td class="text-right">C$${totalINSSPatronal.toLocaleString()}</td>

            <td class="text-right">C$${totalINATE.toLocaleString()}</td>

            <td class="text-right">C$${(totalVacaciones + totalAguinaldo).toLocaleString()}</td>

            <td class="text-right">C$${granTotal.toLocaleString()}</td>

          </tr>

        </tbody>

      </table>

      <p style="margin-top: 20px; font-size: 11px; color: #666;">Nota: INSS Patronal calculado al 21.5% (Régimen < 50 empleados). INATEC 2%. Provisiones de Ley incluyen doceava parte de Vacaciones y Aguinaldo.</p>

`;

    printDocument('Reporte de Costos Laborales', content, 'landscape');

  };

  // ========== PUBLIC API ==========

  const changeTab = (tab) => {

    currentTab = tab;

    App.refreshCurrentModule();

    // Cargar datos async según la pestaña

    if (tab === 'recibos') {

      setTimeout(() => loadHistorialRecibos(), 150);

    }

  };

  const handleSearch = (value) => {

    searchTerm = value;

    App.refreshCurrentModule();

  };

  // --- Eliminar Empleado ---

  const deleteEmpleado = async (id) => {

    const emp = DataService.getEmpleadoById(id);

    if (!emp) return;

    if (!confirm(`¿Eliminar al empleado "${emp.nombre}" ? Esta acción no se puede deshacer.`)) return;

    try {

      await DataService.deleteEmpleado(id);

      App.showNotification?.(`Empleado "${emp.nombre}" eliminado`, 'success') || alert('Empleado eliminado');

      App.refreshCurrentModule();

    } catch (e) {

      console.error('Error eliminando empleado:', e);

      App.showNotification?.('Error al eliminar: ' + e.message, 'error') || alert('Error al eliminar: ' + e.message);

    }

  };

  return {

    render,

    changeTab,

    changeSubTab,

    handleSearch,

    openEmpleadoModal,

    saveEmpleado,

    viewEmpleado,

    editEmpleado,

    deleteEmpleado,

    registrarVacaciones,

    saveVacaciones,

    onVacacionFechaChange,

    verHistorialVacaciones,

    deleteVacacion,

    // Ausencias

    registrarAusencia,

    onAusenciaFechaChange,

    saveAusencia,

    deleteAusencia,

    // Complementos

    registrarHoraExtra,

    registrarBonificacion,

    registrarAdelanto,

    saveComplemento,

    editComplemento,

    loadAusenciasTable,

    loadHorasExtrasTable,

    loadBonificacionesTable,

    loadAdelantosTable,

    deleteComplemento,

    editAusencia,

    // Aguinaldo

    generarAguinaldoReporte,

    marcarAguinaldoPagado,

    verHistorialAguinaldos,

    // Recibos

    generarRecibos,

    verHistorialNominas,

    imprimirRecibo,

    deleteNomina,

    // Liquidación

    calcularLiquidacion,

    loadEmpleadoData,

    // Reportes

    generarReporteEmpleados,

    generarReporteVacaciones,

    generarPlanillaMensual,

    generarReporteCostos,

    imprimirReciboAdelanto,

    imprimirReciboAguinaldo,

    generarReportePagosHechos,

    toggleReportFilters,

    // Utils

    closeModal,

    printDocument,

    getLogoHtml,

    getCompanyConfig,

    editVacacion,

    editAguinaldo,

    deleteAguinaldo,

    eliminarHistorialVacaciones,

    darDeBajaEmpleado,

    darDeAltaEmpleado,

    processReincorporacion

  };

})();

