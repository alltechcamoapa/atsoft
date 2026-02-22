/**
 * ALLTECH - Reportes Module
 * Reports and analytics
 */

const ReportesModule = (() => {
  let filterState = { periodo: 'month', fechaInicio: '', fechaFin: '' };

  const render = () => {
    const user = State.get('user');
    if (!DataService.canPerformAction(user.role, 'reportes', 'read')) {
      return `
        <div class="module-container">
          <div class="empty-state">
            <div class="empty-state__icon">${Icons.lock}</div>
            <h3 class="empty-state__title">Acceso Denegado</h3>
            <p class="empty-state__description">No tienes permisos para ver los reportes.</p>
          </div>
        </div>
      `;
    }

    const stats = DataService.getReportesStats(filterState);

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Reportes e Historial</h2>
            <p class="module-subtitle">Análisis y estadísticas del sistema</p>
          </div>
          <div class="module-header__right">
            <button class="btn btn--primary" onclick="ReportesModule.generateGeneralReport()">
              ${Icons.fileText} Reporte General de Trabajos
            </button>
            <button class="btn btn--secondary" onclick="ReportesModule.exportReport()">
              ${Icons.download} Exportar Dashboard
            </button>
          </div>
        </div>

        <!-- Period Filter -->
        <div class="card">
          <div class="card__body">
            <div class="filters-row">
              <select class="form-select" style="width: 150px;" 
                      onchange="ReportesModule.handlePeriodoFilter(this.value)">
                <option value="week" ${filterState.periodo === 'week' ? 'selected' : ''}>Esta Semana</option>
                <option value="month" ${filterState.periodo === 'month' ? 'selected' : ''}>Este Mes</option>
                <option value="quarter" ${filterState.periodo === 'quarter' ? 'selected' : ''}>Este Trimestre</option>
                <option value="year" ${filterState.periodo === 'year' ? 'selected' : ''}>Este Año</option>
                <option value="custom" ${filterState.periodo === 'custom' ? 'selected' : ''}>Personalizado</option>
              </select>
              ${filterState.periodo === 'custom' ? `
                <input type="date" class="form-input" style="width: 150px;"
                       value="${filterState.fechaInicio}"
                       onchange="ReportesModule.handleFechaInicio(this.value)">
                <span class="text-muted">a</span>
                <input type="date" class="form-input" style="width: 150px;"
                       value="${filterState.fechaFin}"
                       onchange="ReportesModule.handleFechaFin(this.value)">
              ` : ''}
              <button class="btn btn--ghost" onclick="App.refreshCurrentModule()">
                ${Icons.search} Actualizar
              </button>
            </div>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="module-stats module-stats--4">
          <div class="stat-card stat-card--primary">
            <div class="stat-card__icon">${Icons.users}</div>
            <span class="stat-card__label">Total Clientes</span>
            <span class="stat-card__value">${stats.totalClientes}</span>
          </div>
          <div class="stat-card stat-card--success">
            <div class="stat-card__icon">${Icons.wrench}</div>
            <span class="stat-card__label">Servicios Realizados</span>
            <span class="stat-card__value">${stats.totalServicios}</span>
          </div>
          <div class="stat-card stat-card--warning">
            <div class="stat-card__icon">${Icons.wallet}</div>
            <span class="stat-card__label">Ingresos Totales</span>
            <span class="stat-card__value">$${stats.ingresosTotales.toFixed(2)}</span>
          </div>
          <div class="stat-card stat-card--info">
            <div class="stat-card__icon">${Icons.fileText}</div>
            <span class="stat-card__label">Contratos Activos</span>
            <span class="stat-card__value">${stats.contratosActivos}</span>
          </div>
        </div>

        <!-- Report Cards Grid -->
        <div class="reports-grid">
          <!-- Services by Technician -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Servicios por Técnico</h4>
            </div>
            <div class="card__body">
              ${renderTecnicoStats(stats.serviciosPorTecnico)}
            </div>
          </div>

          <!-- Services by Type -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Servicios por Tipo</h4>
            </div>
            <div class="card__body">
              ${renderServiceTypeStats(stats.serviciosPorTipo)}
            </div>
          </div>

          <!-- Contract vs Eventual -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Contrato vs Eventual</h4>
            </div>
            <div class="card__body">
              ${renderContratoVsEventual(stats.contratoVsEventual)}
            </div>
          </div>

          <!-- Revenue by Currency -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Ingresos por Moneda</h4>
            </div>
            <div class="card__body">
              ${renderIngresosPorMoneda(stats.ingresosPorMoneda)}
            </div>
          </div>
        </div>

        <!-- Detailed Tables -->
        <div class="reports-tables">
          <!-- Client History -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Historial por Cliente</h4>
              <button class="btn btn--ghost btn--sm" onclick="App.setCurrentModule('clientes')">Ver todo</button>
            </div>
            <div class="card__body" style="padding: 0;">
              ${renderClienteHistory(stats.historialClientes)}
            </div>
          </div>

          <!-- Equipment Status -->
          <div class="card">
            <div class="card__header">
              <h4 class="card__title">Estado de Equipos</h4>
            </div>
            <div class="card__body" style="padding: 0;">
              ${renderEquipoStatus(stats.estadoEquipos)}
            </div>
          </div>
        </div>

        <!-- REPORT CENTER SECTION -->
        <div class="report-center" style="margin-top: var(--spacing-xl);">
          <div class="module-header" style="margin-bottom: var(--spacing-md);">
            <div class="module-header__left">
              <h3 class="module-title" style="font-size: 1.25rem;">${Icons.fileText} Centro de Generación de Reportes</h3>
              <p class="module-subtitle">Acceso directo a todos los generadores de reportes del sistema</p>
            </div>
          </div>
          
          <div class="reports-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
            <!-- Reporte de Visitas -->
            <div class="card report-card clickable-card" onclick="ReportesModule.openExternalReport('visitas')">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">${Icons.wrench}</div>
                  <div class="report-card__title">Visitas y Servicios</div>
                </div>
                <p class="report-card__desc">Reporte detallado de visitas de soporte, servicios eventuales y remotos.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Abrir Generador ${Icons.chevronRight}</span>
                </div>
              </div>
            </div>

            <!-- Reporte de Contratos -->
            <div class="card report-card clickable-card" onclick="ReportesModule.openExternalReport('contratos')">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">${Icons.fileText}</div>
                  <div class="report-card__title">Contratos de Mantenimiento</div>
                </div>
                <p class="report-card__desc">Historial de servicios realizados bajo contrato y cumplimiento de pólizas.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Abrir Generador ${Icons.chevronRight}</span>
                </div>
              </div>
            </div>

            <!-- Reporte de Pedidos -->
            <div class="card report-card clickable-card" onclick="ReportesModule.openExternalReport('pedidos')">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">${Icons.shoppingBag}</div>
                  <div class="report-card__title">Pedidos y Compras</div>
                </div>
                <p class="report-card__desc">Reportes por cliente, categorías y rango de fechas de todos los pedidos.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Abrir Generador ${Icons.chevronRight}</span>
                </div>
              </div>
            </div>

            <!-- Reporte de Software -->
            <div class="card report-card clickable-card" onclick="ReportesModule.openExternalReport('software')">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">${Icons.package}</div>
                  <div class="report-card__title">Software y Licencia</div>
                </div>
                <p class="report-card__desc">Reportes de registros de software, series y activaciones por cliente.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Abrir Generador ${Icons.chevronRight}</span>
                </div>
              </div>
            </div>

            <!-- Reporte de Prestaciones -->
            <div class="card report-card clickable-card" onclick="ReportesModule.openExternalReport('prestaciones')">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">${Icons.users}</div>
                  <div class="report-card__title">Nóminas y Prestaciones</div>
                </div>
                <p class="report-card__desc">Reportes de aguinaldos, vacaciones, recibos de pago y liquidaciones.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Ir a Módulo ${Icons.chevronRight}</span>
                </div>
              </div>
            </div>

            <!-- Reporte de Productos -->
            <div class="card report-card clickable-card" onclick="ReportesModule.generateInventoryReport()">
              <div class="card__body">
                <div class="report-card__header">
                  <div class="report-card__icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">${Icons.box}</div>
                  <div class="report-card__title">Catálogo / Inventario</div>
                </div>
                <p class="report-card__desc">Generar listado completo de productos y servicios con precios vigentes.</p>
                <div class="report-card__footer">
                  <span class="btn btn--ghost btn--sm">Generar Ahora ${Icons.fileText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderTecnicoStats = (data) => {
    if (!data || data.length === 0) {
      return '<p class="text-muted">No hay datos disponibles</p>';
    }

    const maxValue = Math.max(...data.map(d => d.count));

    return data.map(item => `
      <div class="report-bar">
        <div class="report-bar__info">
          <span class="report-bar__label">${item.tecnico}</span>
          <span class="report-bar__value">${item.count} servicios</span>
        </div>
        <div class="report-bar__track">
          <div class="report-bar__fill" style="width: ${(item.count / maxValue) * 100}%"></div>
        </div>
      </div>
    `).join('');
  };

  const renderServiceTypeStats = (data) => {
    if (!data) return '<p class="text-muted">No hay datos disponibles</p>';

    const total = data.fisica + data.remota;
    const fisicaPercent = total > 0 ? (data.fisica / total) * 100 : 0;
    const remotaPercent = total > 0 ? (data.remota / total) * 100 : 0;

    return `
      <div class="pie-chart-container">
        <div class="pie-chart-legend">
          <div class="pie-chart-item">
            <span class="pie-chart-color" style="background: var(--color-primary-500);"></span>
            <span>Física: ${data.fisica} (${fisicaPercent.toFixed(0)}%)</span>
          </div>
          <div class="pie-chart-item">
            <span class="pie-chart-color" style="background: var(--color-info);"></span>
            <span>Remota: ${data.remota} (${remotaPercent.toFixed(0)}%)</span>
          </div>
        </div>
        <div class="progress-stacked">
          <div class="progress-stacked__bar" style="width: ${fisicaPercent}%; background: var(--color-primary-500);"></div>
          <div class="progress-stacked__bar" style="width: ${remotaPercent}%; background: var(--color-info);"></div>
        </div>
      </div>
    `;
  };

  const renderContratoVsEventual = (data) => {
    if (!data) return '<p class="text-muted">No hay datos disponibles</p>';

    const total = data.contrato + data.eventual;
    const contratoPercent = total > 0 ? (data.contrato / total) * 100 : 0;
    const eventualPercent = total > 0 ? (data.eventual / total) * 100 : 0;

    return `
      <div class="pie-chart-container">
        <div class="pie-chart-legend">
          <div class="pie-chart-item">
            <span class="pie-chart-color" style="background: var(--color-success);"></span>
            <span>Con Contrato: ${data.contrato} (${contratoPercent.toFixed(0)}%)</span>
          </div>
          <div class="pie-chart-item">
            <span class="pie-chart-color" style="background: var(--color-warning);"></span>
            <span>Eventual: ${data.eventual} (${eventualPercent.toFixed(0)}%)</span>
          </div>
        </div>
        <div class="progress-stacked">
          <div class="progress-stacked__bar" style="width: ${contratoPercent}%; background: var(--color-success);"></div>
          <div class="progress-stacked__bar" style="width: ${eventualPercent}%; background: var(--color-warning);"></div>
        </div>
      </div>
    `;
  };

  const renderIngresosPorMoneda = (data) => {
    if (!data) return '<p class="text-muted">No hay datos disponibles</p>';

    return `
      <div class="currency-stats">
        <div class="currency-stat">
          <span class="currency-stat__symbol">$</span>
          <div class="currency-stat__info">
            <span class="currency-stat__label">USD</span>
            <span class="currency-stat__value">$${data.usd.toFixed(2)}</span>
          </div>
        </div>
        <div class="currency-stat">
          <span class="currency-stat__symbol">C$</span>
          <div class="currency-stat__info">
            <span class="currency-stat__label">NIO</span>
            <span class="currency-stat__value">C$${data.nio.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  };

  const renderClienteHistory = (data) => {
    if (!data || data.length === 0) {
      return '<p class="text-muted text-center p-lg">No hay datos disponibles</p>';
    }

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Cliente</th>
            <th>Servicios</th>
            <th>Último Servicio</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${data.slice(0, 5).map(item => `
            <tr>
              <td>
                <div class="font-medium">${item.empresa}</div>
                <div class="text-xs text-muted">${item.nombreCliente}</div>
              </td>
              <td>${item.totalServicios}</td>
              <td>${item.ultimoServicio ? new Date(item.ultimoServicio).toLocaleDateString('es-NI') : 'N/A'}</td>
              <td><span class="badge ${item.estado === 'Activo' ? 'badge--success' : 'badge--neutral'}">${item.estado}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderEquipoStatus = (data) => {
    if (!data || data.length === 0) {
      return '<p class="text-muted text-center p-lg">No hay datos disponibles</p>';
    }

    return `
      <table class="data-table">
        <thead class="data-table__head">
          <tr>
            <th>Estado</th>
            <th>Cantidad</th>
            <th>Porcentaje</th>
          </tr>
        </thead>
        <tbody class="data-table__body">
          ${data.map(item => `
            <tr>
              <td>
                <span class="badge ${item.estado === 'Operativo' ? 'badge--success' : item.estado === 'En Reparación' ? 'badge--warning' : 'badge--danger'}">
                  ${item.estado}
                </span>
              </td>
              <td>${item.count}</td>
              <td>${item.porcentaje.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  // Event Handlers
  const handlePeriodoFilter = (value) => { filterState.periodo = value; App.refreshCurrentModule(); };
  const handleFechaInicio = (value) => { filterState.fechaInicio = value; App.refreshCurrentModule(); };
  const handleFechaFin = (value) => { filterState.fechaFin = value; App.refreshCurrentModule(); };

  const exportReport = () => {
    const stats = DataService.getReportesStats(filterState);
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png', sidebarColor: '#1a73e8' };
    
    // Construir tabla de técnicos
    let tecnicosRows = '<p>No hay datos</p>';
    if(stats.serviciosPorTecnico && stats.serviciosPorTecnico.length > 0) {
        tecnicosRows = '<table style="width:100%; border-collapse:collapse; margin-top:10px;"><thead><tr><th style="border-bottom:1px solid #ddd; text-align:left; padding:5px;">Técnico</th><th style="border-bottom:1px solid #ddd; text-align:right; padding:5px;">Servicios</th></tr></thead><tbody>';
        stats.serviciosPorTecnico.forEach(t => {
            tecnicosRows += `<tr><td style="padding:5px;">${t.tecnico}</td><td style="text-align:right; padding:5px;">${t.count}</td></tr>`;
        });
        tecnicosRows += '</tbody></table>';
    }

    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px; border: none; background: transparent;">` : ''}
        <h1 style="color: #1e3a8a;">${companyConfig.name} - Dashboard Analítico</h1>
        <p style="color: #64748b;">Resumen General del Sistema</p>
        <p style="color: #64748b; font-size: 11px;">Filtro Aplicado: ${filterState.periodo.toUpperCase()} | Fecha de Emisión: ${new Date().toLocaleDateString('es-NI')}</p>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Total Clientes</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.totalClientes}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Servicios Realizados</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.totalServicios}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Ingresos Totales (USD)</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">$${stats.ingresosTotales.toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Contratos Activos</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.contratosActivos}</div>
        </div>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 30px;">
        <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Servicios por Técnico</h3>
            ${tecnicosRows}
        </div>
        <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Distribución de Servicios</h3>
            <p>Física: <b>${stats.serviciosPorTipo.fisica}</b></p>
            <p>Remota: <b>${stats.serviciosPorTipo.remota}</b></p>
            <br>
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Modalidad</h3>
            <p>Con Contrato: <b>${stats.contratoVsEventual.contrato}</b></p>
            <p>Eventual: <b>${stats.contratoVsEventual.eventual}</b></p>
        </div>
      </div>
    `;

    printReport('Dashboard Analítico', content);
  };

  // ========== ACTIONS ==========
  const openExternalReport = (type) => {
    switch (type) {
      case 'contratos':
        App.navigate('contratos');
        setTimeout(() => {
          if (typeof window.NotificationService !== 'undefined' && window.NotificationService.showToast) { window.NotificationService.showToast('Ve a la lista de Contratos y presiona "Generar PDF" en el recuadro del cliente que desees.', 'info'); }
        }, 300);
        break;
      case 'pedidos':
        App.navigate('pedidos');
        setTimeout(() => {
          if (typeof PedidosModule !== 'undefined' && PedidosModule.openReportModal) {
            PedidosModule.openReportModal();
          }
        }, 300);
        break;
      case 'visitas':
        App.navigate('visitas');
        setTimeout(() => {
          if (typeof VisitasModule !== 'undefined' && VisitasModule.openReportModal) {
            VisitasModule.openReportModal();
          }
        }, 300);
        break;
      case 'software':
        App.navigate('software');
        setTimeout(() => {
          if (typeof SoftwareModule !== 'undefined' && SoftwareModule.openReportModal) {
            SoftwareModule.openReportModal();
          }
        }, 300);
        break;
      case 'prestaciones':
        App.navigate('prestaciones');
        setTimeout(() => {
          if (typeof PrestacionesModule !== 'undefined' && PrestacionesModule.changeTab) {
            PrestacionesModule.changeTab('reportes');
          }
        }, 300);
        break;
    }
  };

  const generateInventoryReport = () => {
    const productos = DataService.getProductosSync();
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png', sidebarColor: '#1a73e8' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px; border: none; background: transparent;">` : ''}
        <h1>${companyConfig.name} - Catálogo</h1>
        <p>Reporte de Inventario y Precios</p>
        <p>Fecha de emisión: ${new Date().toLocaleDateString('es-NI')}</p>
      </div>
      
      <div class="section">
        <div class="section-title">Resumen de Catálogo</div>
        <div style="display: flex; gap: 20px; margin-bottom: 20px;">
           <div style="flex: 1; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #1a73e8;">
             <div style="font-size: 10px; color: #666; text-transform: uppercase;">Total Items</div>
             <div style="font-size: 20px; font-weight: bold;">${productos.length}</div>
           </div>
           <div style="flex: 1; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
             <div style="font-size: 10px; color: #666; text-transform: uppercase;">Productos</div>
             <div style="font-size: 20px; font-weight: bold;">${productos.filter(p => p.tipo === 'Producto').length}</div>
           </div>
           <div style="flex: 1; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #8b5cf6;">
             <div style="font-size: 10px; color: #666; text-transform: uppercase;">Servicios</div>
             <div style="font-size: 20px; font-weight: bold;">${productos.filter(p => p.tipo === 'Servicio').length}</div>
           </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre / Descripción</th>
              <th>Categoría</th>
              <th>Tipo</th>
              <th>Precio Venta</th>
            </tr>
          </thead>
          <tbody>
            ${productos.map(p => `
              <tr>
                <td><code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${p.codigo || 'N/A'}</code></td>
                <td>
                  <div style="font-weight: 600;">${p.nombre}</div>
                  <div style="font-size: 10px; color: #777;">${p.descripcion || ''}</div>
                </td>
                <td>${p.categoria || '-'}</td>
                <td><span class="badge" style="background: ${p.tipo === 'Servicio' ? '#e0f2fe' : '#dcfce7'}; color: ${p.tipo === 'Servicio' ? '#0369a1' : '#15803d'}; font-size: 9px;">${p.tipo}</span></td>
                <td style="font-weight: bold;">$${(parseFloat(p.precio) || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    printReport('Reporte de Inventario', content);
  };

  const printReport = (title, content) => {
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH' };
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
          .header h1 { color: #1e3a8a; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
          .header p { color: #64748b; font-size: 13px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 16px; font-weight: 700; color: #3b82f6; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
          th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; }
          tr:nth-child(even) { background: #f1f5f9; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
          .badge-success { background: #dcfce7; color: #155e75; }
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content}
        <div class="footer">
          <p>${companyConfig.name || 'ALLTECH'} - Sistema de Gestión Empresarial</p>
          <p>Generado automáticamente en ${new Date().toLocaleString('es-NI')}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const generateGeneralReport = () => {
    const visitas = DataService.getVisitasSync();
    const sortedVisitas = [...visitas].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));

    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png' };
    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px; border: none; background: transparent;">` : ''}
        <h1>${companyConfig.name} - Reporte de Actividades</h1>
        <p>Resumen detallado de servicios realizados</p>
        <p>Fecha: ${new Date().toLocaleDateString('es-NI')}</p>
      </div>
      
      <div class="section">
        <div class="section-title">Listado de Servicios</div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Técnico</th>
              <th>Trabajo Realizado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${sortedVisitas.map(v => {
      const cliente = DataService.getClienteById(v.clienteId);
      return `
                <tr>
                  <td style="white-space: nowrap;">${new Date(v.fechaInicio).toLocaleDateString('es-NI')}</td>
                  <td>
                    <div style="font-weight: bold;">${cliente?.empresa || 'N/A'}</div>
                    <div style="font-size: 9px; color: #666;">${cliente?.nombreCliente || ''}</div>
                  </td>
                  <td>${v.tipoVisita}</td>
                  <td>${ (() => {
                      const t = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === v.usuarioSoporte) : null;
                      return t ? (t.name || t.username) : (v.usuarioSoporte || 'N/A');
                  })() }</td>
                  <td>${v.descripcionTrabajo || '-'}</td>
                  <td>
                    <span class="badge" style="background: ${v.trabajoRealizado ? '#dcfce7' : '#fef3c7'}; color: ${v.trabajoRealizado ? '#166534' : '#92400e'};">
                      ${v.trabajoRealizado ? 'Completado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;

    printReport('Reporte General de Visitas', content);
  };

  return {
    render,
    handlePeriodoFilter,
    handleFechaInicio,
    handleFechaFin,
    exportReport,
    generateGeneralReport,
    openExternalReport,
    generateInventoryReport
  };
})();
