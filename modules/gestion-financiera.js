/**
 * ALLTECH - Gestión Financiera Module
 * Módulo completo de finanzas estilo QuickBooks para Nicaragua (DGI, IVA 15%)
 */
const GestionFinancieraModule = (() => {
    const IVA_RATE = 0.15;
    let currentView = 'dashboard';
    let selectedPeriod = 'mes';

    // Usar DataService si está disponible, si no usar localStorage
    const useDataService = typeof DataService !== 'undefined';

    // ========== DATA LAYER (localStorage fallback) ==========
    const STORAGE_KEYS = {
        ingresos: 'fin_ingresos', gastos: 'fin_gastos', categorias: 'fin_categorias',
        facturas: 'fin_facturas', cuentasCobrar: 'fin_cuentas_cobrar', cuentasPagar: 'fin_cuentas_pagar',
        presupuestos: 'fin_presupuestos', impuestos: 'fin_impuestos'
    };

    const getData = (key) => { 
        if (useDataService) {
            const map = { ingresos: 'finIngresos', gastos: 'finGastos', categorias: 'finCategorias', facturas: 'finFacturas', cuentasCobrar: 'finCuentasCobrar', cuentasPagar: 'finCuentasPagar', presupuestos: 'finPresupuestos' };
            const cacheKey = map[key];
            return cacheKey ? DataService.getCache()[cacheKey] || [] : [];
        }
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]'); } catch { return []; } 
    };
    const setData = (key, data) => {
        if (!useDataService) localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
    };
    const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const addRecord = (key, record) => { 
        if (useDataService) {
            if (key === 'ingresos') DataService.addFinIngreso(record);
            else if (key === 'gastos') DataService.addFinGasto(record);
            return record;
        }
        const d = getData(key); record.id = genId(); record.created_at = new Date().toISOString(); d.unshift(record); setData(key, d); return record; 
    };
    const updateRecord = (key, id, updates) => { 
        const d = getData(key); const i = d.findIndex(r => r.id === id); 
        if (i !== -1) { d[i] = { ...d[i], ...updates, updated_at: new Date().toISOString() }; setData(key, d); } return d[i]; 
    };
    const deleteRecord = (key, id) => { const d = getData(key).filter(r => r.id !== id); setData(key, d); };

    // Inicializar categorías por defecto
    const initCategories = () => {
        if (getData('categorias').length === 0) {
            const cats = [
                { tipo: 'ingreso', nombre: 'Ventas de Servicios', color: '#10b981' },
                { tipo: 'ingreso', nombre: 'Ventas de Productos', color: '#3b82f6' },
                { tipo: 'ingreso', nombre: 'Reparaciones', color: '#8b5cf6' },
                { tipo: 'ingreso', nombre: 'Contratos de Mantenimiento', color: '#06b6d4' },
                { tipo: 'ingreso', nombre: 'Otros Ingresos', color: '#6366f1' },
                { tipo: 'gasto', nombre: 'Alquiler', color: '#ef4444' },
                { tipo: 'gasto', nombre: 'Servicios Básicos', color: '#f97316' },
                { tipo: 'gasto', nombre: 'Salarios', color: '#ec4899' },
                { tipo: 'gasto', nombre: 'Compra de Inventario', color: '#f59e0b' },
                { tipo: 'gasto', nombre: 'Transporte', color: '#84cc16' },
                { tipo: 'gasto', nombre: 'Impuestos', color: '#d97706' },
                { tipo: 'gasto', nombre: 'Otros Gastos', color: '#64748b' }
            ];
            cats.forEach(c => addRecord('categorias', c));
        }
    };

    // ========== HELPERS ==========
    const fmt = (n) => parseFloat(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-NI') : 'N/A';
    const now = new Date();
    const monthStart = () => new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = () => new Date(now.getFullYear(), 0, 1).toISOString();

    const getMetrics = () => {
        if (useDataService) {
            return DataService.getFinMetrics(selectedPeriod === 'mes' ? 'month' : selectedPeriod);
        }
        
        // Fallback localStorage
        const ingresos = getData('ingresos');
        const gastos = getData('gastos');
        const ms = monthStart();
        const ys = yearStart();

        const ingresosMes = ingresos.filter(i => i.fecha >= ms).reduce((s, i) => s + parseFloat(i.monto || 0), 0);
        const gastosMes = gastos.filter(g => g.fecha >= ms).reduce((s, g) => s + parseFloat(g.monto || 0), 0);
        const ingresosAnio = ingresos.filter(i => i.fecha >= ys).reduce((s, i) => s + parseFloat(i.monto || 0), 0);
        const gastosAnio = gastos.filter(g => g.fecha >= ys).reduce((s, g) => s + parseFloat(g.monto || 0), 0);
        const ivaMes = ingresos.filter(i => i.fecha >= ms && i.iva).reduce((s, i) => s + parseFloat(i.iva || 0), 0);
        const cxc = getData('cuentasCobrar').filter(c => c.estado === 'pendiente').reduce((s, c) => s + parseFloat(c.monto || 0), 0);
        const cxp = getData('cuentasPagar').filter(c => c.estado === 'pendiente').reduce((s, c) => s + parseFloat(c.monto || 0), 0);

        return { ingresosMes, gastosMes, utilidadMes: ingresosMes - gastosMes, ingresosAnio, gastosAnio, utilidadAnio: ingresosAnio - gastosAnio, ivaMes, cxc, cxp, balance: ingresosMes - gastosMes };
    };

    // ========== MAIN RENDER ==========
    const render = () => {
        initCategories();
        if (currentView === 'dashboard') return renderDashboard();
        if (currentView === 'ingresos') return renderIngresos();
        if (currentView === 'gastos') return renderGastos();
        if (currentView === 'flujo') return renderFlujo();
        if (currentView === 'cxc') return renderCuentasCobrar();
        if (currentView === 'cxp') return renderCuentasPagar();
        if (currentView === 'facturacion') return renderFacturacion();
        if (currentView === 'impuestos') return renderImpuestos();
        if (currentView === 'reportes') return renderReportes();
        if (currentView === 'presupuestos') return renderPresupuestos();
        if (currentView === 'vehiculos') return typeof GestionVehiculosModule !== 'undefined' ? GestionVehiculosModule.render() : renderDashboard();
        return renderDashboard();
    };

    const navigateTo = (view) => { currentView = view; App.render(); };

    // ========== DASHBOARD ==========
    const renderDashboard = () => {
        const m = getMetrics();
        const cxcCount = getData('cuentasCobrar').filter(c => c.estado === 'pendiente').length;
        const cxpCount = getData('cuentasPagar').filter(c => c.estado === 'pendiente').length;
        
        // Obtener alertas
        const alertas = useDataService ? GestionFinancieraModule.getAlertas() : [];

        // Obtener tendencias
        const tendencias = m.tendencias || {};

        return `
      <style>
        .fin-header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; padding: 1.8rem 2rem; color: white; margin-bottom: var(--spacing-lg); position: relative; overflow: hidden; }
        .fin-header::after { content: ''; position: absolute; right: -40px; top: -40px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%); border-radius: 50%; }
        .fin-header__title { display: flex; align-items: center; gap: 10px; font-size: 1.4rem; font-weight: 700; margin-bottom: 1.2rem; }
        .fin-header__title svg { width: 28px; height: 28px; }
        .fin-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .fin-kpi { background: rgba(255,255,255,0.08); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px 16px; transition: background .2s; }
        .fin-kpi:hover { background: rgba(255,255,255,0.14); }
        .fin-kpi__label { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; opacity: .7; margin-bottom: 4px; }
        .fin-kpi__value { font-size: 1.35rem; font-weight: 800; letter-spacing: -.5px; }
        .fin-kpi__sub { font-size: 10px; opacity: .5; margin-top: 2px; }
        .fin-kpi__trend { font-size: 11px; margin-top: 4px; padding: 2px 6px; border-radius: 4px; display: inline-block; }
        .fin-kpi__trend--up { background: rgba(52, 211, 153, 0.2); color: #34d399; }
        .fin-kpi__trend--down { background: rgba(248, 113, 113, 0.2); color: #f87171; }

        .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl); }
        @media (max-width: 900px) { .fin-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .fin-grid { grid-template-columns: 1fr; } }

        .fin-tile { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.4rem; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: all .25s ease; position: relative; overflow: hidden; }
        .fin-tile:hover { transform: translateY(-5px); box-shadow: 0 12px 28px rgba(0,0,0,0.1); }
        .fin-tile__icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; font-size: 0; }
        .fin-tile__icon svg { width: 26px; height: 26px; }
        .fin-tile__name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .fin-tile__desc { font-size: 11px; color: var(--text-muted); line-height: 1.3; margin-bottom: 8px; }
        .fin-tile__metric { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; display: inline-block; }

        .fin-alerts { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: var(--spacing-md); }
        .fin-alert { padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .fin-alert--danger { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; }
        .fin-alert--warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; }
        .fin-alert--success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; }

        .fin-quick-actions { display: flex; gap: 8px; margin-top: var(--spacing-sm); }
        .fin-quick-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; }
        .fin-quick-btn:hover { transform: scale(1.05); }
        .fin-quick-btn--income { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .fin-quick-btn--expense { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .fin-quick-btn--sync { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
      </style>

      <!-- Mini Dashboard Header -->
      <div class="fin-header">
        <div class="fin-header__title">
            ${Icons.wallet} Gestión Financiera
            <select onchange="selectedPeriod = this.value; App.render();" style="margin-left: auto; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px;">
                <option value="semana" ${selectedPeriod === 'semana' ? 'selected' : ''}>Esta Semana</option>
                <option value="mes" ${selectedPeriod === 'mes' ? 'selected' : ''}>Este Mes</option>
                <option value="trimestre" ${selectedPeriod === 'trimestre' ? 'selected' : ''}>Este Trimestre</option>
                <option value="año" ${selectedPeriod === 'año' ? 'selected' : ''}>Este Año</option>
            </select>
        </div>
        
        <!-- Quick Actions -->
        <div class="fin-quick-actions">
            <button class="fin-quick-btn fin-quick-btn--income" onclick="GestionFinancieraModule.openIncomeForm()">+ Ingreso</button>
            <button class="fin-quick-btn fin-quick-btn--expense" onclick="GestionFinancieraModule.openExpenseForm()">+ Gasto</button>
            ${useDataService ? `<button class="fin-quick-btn fin-quick-btn--sync" onclick="GestionFinancieraModule.syncFromModules()">🔄 Sincronizar</button>` : ''}
        </div>

        <!-- Alertas financieras -->
        ${alertas.length > 0 ? `
        <div class="fin-alerts" style="margin-top: 12px;">
            ${alertas.slice(0, 3).map(a => `<div class="fin-alert fin-alert--${a.tipo}">${a.tipo === 'danger' ? '⚠️' : a.tipo === 'warning' ? '⚡' : '✅'} ${a.titulo}: ${a.mensaje}</div>`).join('')}
        </div>
        ` : ''}

        <div class="fin-kpis">
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('ingresos')">
            <div class="fin-kpi__label">Ingresos</div>
            <div class="fin-kpi__value" style="color:#34d399;">C$${fmt(m.ingresos)}</div>
            ${tendencias.ingresos ? `<div class="fin-kpi__trend ${tendencias.ingresos.cambio >= 0 ? 'fin-kpi__trend--up' : 'fin-kpi__trend--down'}">${tendencias.ingresos.cambio >= 0 ? '↑' : '↓'} ${Math.abs(tendencias.ingresos.cambio)}%</div>` : `<div class="fin-kpi__sub">${Icons.trendingUp} Entradas</div>`}
          </div>
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('gastos')">
            <div class="fin-kpi__label">Gastos</div>
            <div class="fin-kpi__value" style="color:#f87171;">C$${fmt(m.gastos)}</div>
            ${tendencias.gastos ? `<div class="fin-kpi__trend ${tendencias.gastos.cambio >= 0 ? 'fin-kpi__trend--down' : 'fin-kpi__trend--up'}">${tendencias.gastos.cambio >= 0 ? '↑' : '↓'} ${Math.abs(tendencias.gastos.cambio)}%</div>` : `<div class="fin-kpi__sub">${Icons.trendingDown} Egresos</div>`}
          </div>
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('flujo')">
            <div class="fin-kpi__label">Utilidad Neta</div>
            <div class="fin-kpi__value" style="color:${m.utilidad >= 0 ? '#34d399' : '#f87171'};">C$${fmt(m.utilidad)}</div>
            <div class="fin-kpi__sub">${m.utilidad >= 0 ? '✅ Positivo' : '⚠️ Negativo'}</div>
          </div>
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('impuestos')">
            <div class="fin-kpi__label">IVA 15% (DGI)</div>
            <div class="fin-kpi__value" style="color:#fbbf24;">C$${fmt(m.ivaPorPagar || m.ivaMes)}</div>
            <div class="fin-kpi__sub">Declaración mensual</div>
          </div>
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('cxc')">
            <div class="fin-kpi__label">Cuentas x Cobrar</div>
            <div class="fin-kpi__value" style="color:#a78bfa;">C$${fmt(m.cuentasCobrar?.total || m.cxc)}</div>
            <div class="fin-kpi__sub">${m.cuentasCobrar?.count || cxcCount} pendientes</div>
          </div>
          <div class="fin-kpi" style="cursor:pointer;" onclick="GestionFinancieraModule.navigateTo('cxp')">
            <div class="fin-kpi__label">Cuentas x Pagar</div>
            <div class="fin-kpi__value" style="color:#f472b6;">C$${fmt(m.cuentasPagar?.total || m.cxp)}</div>
            <div class="fin-kpi__sub">${m.cuentasPagar?.count || cxpCount} pendientes</div>
          </div>
        </div>
      </div>

      <!-- Financial Reports Quick Access -->
      <div class="fin-grid" style="margin-bottom: var(--spacing-lg);">
        <div class="fin-tile" onclick="GestionFinancieraModule.openEstadoResultados()">
          <div class="fin-tile__icon" style="background:#eff6ff;color:#3b82f6;">${Icons.barChart}</div>
          <div class="fin-tile__name">Estado de Resultados</div>
          <div class="fin-tile__desc">Ganancias y pérdidas</div>
        </div>
        <div class="fin-tile" onclick="GestionFinancieraModule.openBalanceGeneral()">
          <div class="fin-tile__icon" style="background:#f5f3ff;color:#8b5cf6;">${Icons.fileText}</div>
          <div class="fin-tile__name">Balance General</div>
          <div class="fin-tile__desc">Activos y pasivos</div>
        </div>
        <div class="fin-tile" onclick="GestionFinancieraModule.openProyeccionFlujo()">
          <div class="fin-tile__icon" style="background:#f0f9ff;color:#0ea5e9;">${Icons.trendingUp}</div>
          <div class="fin-tile__name">Flujo de Caja</div>
          <div class="fin-tile__desc">Proyección 6 meses</div>
        </div>
        <div class="fin-tile" onclick="GestionFinancieraModule.openCentrosCosto()">
          <div class="fin-tile__icon" style="background:#f0fdfa;color:#14b8a6;">${Icons.users}</div>
          <div class="fin-tile__name">Centros de Costo</div>
          <div class="fin-tile__desc">Rentabilidad por cliente</div>
        </div>
        <div class="fin-tile" onclick="GestionFinancieraModule.exportFinanciero('estado_resultados')">
          <div class="fin-tile__icon" style="background:#fef2f2;color:#ef4444;">${Icons.download}</div>
          <div class="fin-tile__name">Exportar Reporte</div>
          <div class="fin-tile__desc">Excel / CSV</div>
        </div>
        <div class="fin-tile" onclick="App.setCurrentModule('configuracion')">
          <div class="fin-tile__icon" style="background:#fffbeb;color:#f59e0b;">${Icons.settings}</div>
          <div class="fin-tile__name">Configuración</div>
          <div class="fin-tile__desc">Impuestos y cuentas</div>
        </div>
      </div>

      <!-- 3x3 Grid of Functional Tiles -->
      <div class="fin-grid">
        ${renderTile('ingresos', Icons.arrowDownLeft, 'Ingresos', 'Registrar y gestionar entradas', '#10b981', '#ecfdf5', getData('ingresos').length + ' registros')}
        ${renderTile('gastos', Icons.arrowUpRight, 'Gastos', 'Control de egresos operativos', '#ef4444', '#fef2f2', getData('gastos').length + ' registros')}
        ${renderTile('flujo', Icons.activity, 'Flujo de Caja', 'Balance y movimientos', '#0ea5e9', '#f0f9ff', 'C$' + fmt(m.balance || m.utilidad))}
        ${renderTile('cxc', Icons.users, 'Cuentas por Cobrar', 'Facturas pendientes', '#8b5cf6', '#f5f3ff', (m.cuentasCobrar?.count || cxcCount) + ' pendientes')}
        ${renderTile('cxp', Icons.briefcase, 'Cuentas por Pagar', 'Deudas con proveedores', '#ec4899', '#fdf2f8', (m.cuentasPagar?.count || cxpCount) + ' pendientes')}
        ${renderTile('facturacion', Icons.fileText, 'Facturación', 'Facturas formato DGI', '#3b82f6', '#eff6ff', getData('facturas').length + ' facturas')}
        ${renderTile('impuestos', Icons.calculator, 'Impuestos', 'IVA e IR — DGI Nicaragua', '#f59e0b', '#fffbeb', 'C$' + fmt(m.ivaPorPagar || m.ivaMes))}
        ${renderTile('reportes', Icons.barChart, 'Reportes', 'Estados financieros', '#6366f1', '#eef2ff', 'PDF / Excel')}
        ${renderTile('presupuestos', Icons.piggyBank, 'Presupuestos', 'Planificación y control', '#14b8a6', '#f0fdfa', getData('presupuestos').length + ' activos')}
        ${renderTile('vehiculos', '🚗', 'Vehículos', 'Gestión financiera vehicular', '#0ea5e9', '#f0f9ff', typeof GestionVehiculosModule !== 'undefined' ? GestionVehiculosModule.getMetrics().total + ' vehículos' : '0 vehículos')}
      </div>

      <!-- Quick Transactions -->
      <div class="card">
        <div class="card__header"><h3 class="card__title">${Icons.clock} Últimas Transacciones</h3></div>
        <div class="card__body" style="padding:0;">
          ${renderRecentTransactions()}
        </div>
      </div>
    `;
    };

    const renderTile = (viewId, icon, title, desc, color, bgLight, metric) => `
    <div class="fin-tile" onclick="GestionFinancieraModule.navigateTo('${viewId}')">
      <div class="fin-tile__icon" style="background:${bgLight};color:${color};">${icon}</div>
      <div class="fin-tile__name">${title}</div>
      <div class="fin-tile__desc">${desc}</div>
      <div class="fin-tile__metric" style="background:${bgLight};color:${color};">${metric}</div>
    </div>`;


    const renderRecentTransactions = () => {
        const ingresos = getData('ingresos').slice(0, 5).map(i => ({ ...i, _type: 'ingreso' }));
        const gastos = getData('gastos').slice(0, 5).map(g => ({ ...g, _type: 'gasto' }));
        const all = [...ingresos, ...gastos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
        if (all.length === 0) return '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No hay transacciones registradas aún.</div>';
        return `<table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th style="text-align:right;">Monto</th></tr></thead><tbody class="data-table__body">${all.map(t => `<tr><td>${fmtDate(t.fecha)}</td><td><span class="badge badge--${t._type === 'ingreso' ? 'success' : 'danger'}" style="font-size:10px;">${t._type === 'ingreso' ? '↑ Ingreso' : '↓ Gasto'}</span></td><td>${t.categoria || 'Sin categoría'}</td><td>${t.descripcion || '-'}</td><td style="text-align:right;font-weight:700;color:${t._type === 'ingreso' ? 'var(--color-success)' : 'var(--color-danger)'};">${t._type === 'ingreso' ? '+' : '-'}C$${fmt(t.monto)}</td></tr>`).join('')}</tbody></table>`;
    };

    // ========== BACK BUTTON HELPER ==========
    const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="GestionFinancieraModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al Panel</button>`;

    // ========== INGRESOS ==========
    const renderIngresos = () => {
        const items = getData('ingresos');
        const cats = getData('categorias').filter(c => c.tipo === 'ingreso');
        const clientes = (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#10b981;">${Icons.arrowDownLeft} Ingresos</h2></div>
        <div class="module-header__actions"><button class="btn btn--primary" onclick="GestionFinancieraModule.openIncomeForm()">${Icons.plus} Nuevo Ingreso</button></div>
      </div>
      <div class="card card--no-padding">
        ${items.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay ingresos registrados.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Cliente</th><th>Método</th><th style="text-align:right;">Subtotal</th><th style="text-align:right;">IVA</th><th style="text-align:right;">Total</th><th>Acciones</th></tr></thead>
        <tbody class="data-table__body">${items.map(i => `<tr><td>${fmtDate(i.fecha)}</td><td><span class="badge badge--success" style="font-size:10px;">${i.categoria || '-'}</span></td><td>${i.descripcion || '-'}</td><td>${i.cliente || '-'}</td><td>${i.metodo_pago || '-'}</td><td style="text-align:right;">C$${fmt(i.subtotal || i.monto)}</td><td style="text-align:right;">C$${fmt(i.iva || 0)}</td><td style="text-align:right;font-weight:700;color:var(--color-success);">C$${fmt(i.monto)}</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteIncome('${i.id}')" style="color:var(--color-danger);">${Icons.trash}</button></td></tr>`).join('')}</tbody></table>`}
      </div>`;
    };

    // ========== GASTOS ==========
    const renderGastos = () => {
        const items = getData('gastos');
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#ef4444;">${Icons.arrowUpRight} Gastos</h2></div>
        <div class="module-header__actions"><button class="btn btn--primary" style="background:#ef4444;border-color:#ef4444;" onclick="GestionFinancieraModule.openExpenseForm()">${Icons.plus} Nuevo Gasto</button></div>
      </div>
      <div class="card card--no-padding">
        ${items.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay gastos registrados.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Comprobante</th><th style="text-align:right;">Monto</th><th>Acciones</th></tr></thead>
        <tbody class="data-table__body">${items.map(g => `<tr><td>${fmtDate(g.fecha)}</td><td><span class="badge badge--danger" style="font-size:10px;">${g.categoria || '-'}</span></td><td>${g.descripcion || '-'}</td><td>${g.proveedor || '-'}</td><td>${g.comprobante || '-'}</td><td style="text-align:right;font-weight:700;color:var(--color-danger);">C$${fmt(g.monto)}</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteExpense('${g.id}')" style="color:var(--color-danger);">${Icons.trash}</button></td></tr>`).join('')}</tbody></table>`}
      </div>`;
    };

    // ========== FLUJO DE CAJA ==========
    const renderFlujo = () => {
        const ingresos = getData('ingresos');
        const gastos = getData('gastos');
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ms = d.toISOString();
            const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();
            const ing = ingresos.filter(x => x.fecha >= ms && x.fecha <= me).reduce((s, x) => s + parseFloat(x.monto || 0), 0);
            const gas = gastos.filter(x => x.fecha >= ms && x.fecha <= me).reduce((s, x) => s + parseFloat(x.monto || 0), 0);
            months.push({ label: d.toLocaleDateString('es-NI', { month: 'short' }), ingresos: ing, gastos: gas, neto: ing - gas });
        }
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#0ea5e9;">${Icons.activity} Flujo de Caja</h2></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--spacing-md);margin-bottom:var(--spacing-lg);">
        ${months.map(m => `<div class="card"><div class="card__body" style="text-align:center;">
          <div style="font-weight:700;text-transform:uppercase;font-size:12px;color:var(--text-muted);margin-bottom:8px;">${m.label}</div>
          <div style="font-size:12px;color:var(--color-success);">↑ C$${fmt(m.ingresos)}</div>
          <div style="font-size:12px;color:var(--color-danger);">↓ C$${fmt(m.gastos)}</div>
          <div style="font-size:1.1rem;font-weight:800;color:${m.neto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};margin-top:6px;">C$${fmt(m.neto)}</div>
        </div></div>`).join('')}
      </div>`;
    };

    // ========== CUENTAS POR COBRAR ==========
    const renderCuentasCobrar = () => {
        const items = getData('cuentasCobrar');
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#8b5cf6;">${Icons.users} Cuentas por Cobrar</h2></div>
        <div class="module-header__actions"><button class="btn btn--primary" style="background:#8b5cf6;border-color:#8b5cf6;" onclick="GestionFinancieraModule.openCxcForm()">${Icons.plus} Nueva Cuenta</button></div>
      </div>
      <div class="card card--no-padding">
        ${items.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay cuentas por cobrar.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>Cliente</th><th>Concepto</th><th>Fecha Emisión</th><th>Vencimiento</th><th style="text-align:right;">Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody class="data-table__body">${items.map(c => `<tr><td class="font-bold">${c.cliente || '-'}</td><td>${c.concepto || '-'}</td><td>${fmtDate(c.fecha_emision)}</td><td>${fmtDate(c.fecha_vencimiento)}</td><td style="text-align:right;font-weight:700;">C$${fmt(c.monto)}</td><td><span class="badge badge--${c.estado === 'pagada' ? 'success' : c.estado === 'vencida' ? 'danger' : 'warning'}">${c.estado || 'pendiente'}</span></td><td><div style="display:flex;gap:4px;">${c.estado === 'pendiente' ? `<button class="btn btn--ghost btn--sm" onclick="GestionFinancieraModule.markCxcPaid('${c.id}')" title="Marcar pagada">${Icons.check}</button>` : ''}<button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteCxc('${c.id}')" style="color:var(--color-danger);">${Icons.trash}</button></div></td></tr>`).join('')}</tbody></table>`}
      </div>`;
    };

    // ========== CUENTAS POR PAGAR ==========
    const renderCuentasPagar = () => {
        const items = getData('cuentasPagar');
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#ec4899;">${Icons.briefcase} Cuentas por Pagar</h2></div>
        <div class="module-header__actions"><button class="btn btn--primary" style="background:#ec4899;border-color:#ec4899;" onclick="GestionFinancieraModule.openCxpForm()">${Icons.plus} Nueva Cuenta</button></div>
      </div>
      <div class="card card--no-padding">
        ${items.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay cuentas por pagar.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>Proveedor</th><th>Concepto</th><th>Vencimiento</th><th style="text-align:right;">Monto</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody class="data-table__body">${items.map(c => `<tr><td class="font-bold">${c.proveedor || '-'}</td><td>${c.concepto || '-'}</td><td>${fmtDate(c.fecha_vencimiento)}</td><td style="text-align:right;font-weight:700;">C$${fmt(c.monto)}</td><td><span class="badge badge--${c.estado === 'pagada' ? 'success' : c.estado === 'vencida' ? 'danger' : 'warning'}">${c.estado || 'pendiente'}</span></td><td><div style="display:flex;gap:4px;">${c.estado === 'pendiente' ? `<button class="btn btn--ghost btn--sm" onclick="GestionFinancieraModule.markCxpPaid('${c.id}')">${Icons.check}</button>` : ''}<button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteCxp('${c.id}')" style="color:var(--color-danger);">${Icons.trash}</button></div></td></tr>`).join('')}</tbody></table>`}
      </div>`;
    };

    // ========== FACTURACIÓN ==========
    const renderFacturacion = () => {
        const items = getData('facturas');
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#3b82f6;">${Icons.fileText} Facturación</h2><p class="module-header__subtitle">Formato DGI Nicaragua — IVA 15%</p></div>
        <div class="module-header__actions"><button class="btn btn--primary" onclick="GestionFinancieraModule.openInvoiceForm()">${Icons.plus} Nueva Factura</button></div>
      </div>
      <div class="card card--no-padding">
        ${items.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay facturas creadas.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>N° Factura</th><th>Fecha</th><th>Cliente</th><th style="text-align:right;">Subtotal</th><th style="text-align:right;">IVA 15%</th><th style="text-align:right;">Total</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody class="data-table__body">${items.map(f => `<tr><td class="font-bold">${f.numero || '-'}</td><td>${fmtDate(f.fecha)}</td><td>${f.cliente || '-'}</td><td style="text-align:right;">C$${fmt(f.subtotal)}</td><td style="text-align:right;">C$${fmt(f.iva)}</td><td style="text-align:right;font-weight:700;">C$${fmt(f.total)}</td><td><span class="badge badge--${f.estado === 'pagada' ? 'success' : 'warning'}">${f.estado || 'pendiente'}</span></td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteInvoice('${f.id}')" style="color:var(--color-danger);">${Icons.trash}</button></td></tr>`).join('')}</tbody></table>`}
      </div>`;
    };

    // ========== IMPUESTOS ==========
    const renderImpuestos = () => {
        const m = getMetrics();
        const ingresos = getData('ingresos');
        const ivaVentas = ingresos.reduce((s, i) => s + parseFloat(i.iva || 0), 0);
        const gastos = getData('gastos');
        const ivaCompras = gastos.filter(g => g.iva_credito).reduce((s, g) => s + parseFloat(g.iva_credito || 0), 0);

        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#f59e0b;">${Icons.calculator} Impuestos — DGI Nicaragua</h2></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:var(--spacing-md);margin-bottom:var(--spacing-lg);">
        <div class="card" style="border-left:4px solid #f59e0b;">
          <div class="card__body" style="text-align:center;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;">IVA por Pagar (Ventas)</div>
            <div style="font-size:2rem;font-weight:800;color:#f59e0b;">C$${fmt(ivaVentas)}</div>
          </div>
        </div>
        <div class="card" style="border-left:4px solid #10b981;">
          <div class="card__body" style="text-align:center;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;">Crédito Fiscal (Compras)</div>
            <div style="font-size:2rem;font-weight:800;color:#10b981;">C$${fmt(ivaCompras)}</div>
          </div>
        </div>
        <div class="card" style="border-left:4px solid #ef4444;">
          <div class="card__body" style="text-align:center;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;">IVA Neto a Declarar</div>
            <div style="font-size:2rem;font-weight:800;color:#ef4444;">C$${fmt(ivaVentas - ivaCompras)}</div>
          </div>
        </div>
      </div>
      <div class="card"><div class="card__body" style="color:var(--text-muted);font-size:13px;">
        <strong>📋 Referencia DGI Nicaragua:</strong><br>
        • IVA General: 15% sobre ventas de bienes y servicios gravados.<br>
        • Declaración mensual ante la Dirección General de Ingresos (DGI).<br>
        • Retención en la fuente IR: 2% sobre compras de bienes y 10% sobre servicios profesionales.<br>
        • Pago Mínimo Definitivo: 1% sobre ingresos brutos mensuales.
      </div></div>`;
    };

    // ========== REPORTES ==========
    const renderReportes = () => {
        const m = getMetrics();
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#6366f1;">${Icons.barChart} Reportes Financieros</h2></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-lg);">
        <div class="card"><div class="card__header"><h3 class="card__title">Estado de Resultados (Mensual)</h3></div>
          <div class="card__body">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>Ingresos Totales</span><span class="font-bold" style="color:var(--color-success);">C$${fmt(m.ingresosMes)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>(-) Gastos Totales</span><span class="font-bold" style="color:var(--color-danger);">C$${fmt(m.gastosMes)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>(-) IVA</span><span class="font-bold">C$${fmt(m.ivaMes)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:1.1rem;"><span class="font-bold">Utilidad Neta</span><span class="font-bold" style="color:${m.utilidadMes >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${fmt(m.utilidadMes)}</span></div>
          </div>
        </div>
        <div class="card"><div class="card__header"><h3 class="card__title">Resumen Anual</h3></div>
          <div class="card__body">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>Ingresos Anuales</span><span class="font-bold" style="color:var(--color-success);">C$${fmt(m.ingresosAnio)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>Gastos Anuales</span><span class="font-bold" style="color:var(--color-danger);">C$${fmt(m.gastosAnio)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>Cuentas por Cobrar</span><span class="font-bold">C$${fmt(m.cxc)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);"><span>Cuentas por Pagar</span><span class="font-bold">C$${fmt(m.cxp)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:1.1rem;"><span class="font-bold">Utilidad Anual</span><span class="font-bold" style="color:${m.utilidadAnio >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${fmt(m.utilidadAnio)}</span></div>
          </div>
        </div>
      </div>`;
    };

    // ========== PRESUPUESTOS ==========
    const renderPresupuestos = () => {
        const items = getData('presupuestos');
        const gastos = getData('gastos');
        return `${backBtn()}
      <div class="module-header" style="margin-bottom:var(--spacing-lg);">
        <div class="module-header__main"><h2 class="module-header__title" style="color:#14b8a6;">${Icons.piggyBank} Presupuestos</h2></div>
        <div class="module-header__actions"><button class="btn btn--primary" style="background:#14b8a6;border-color:#14b8a6;" onclick="GestionFinancieraModule.openBudgetForm()">${Icons.plus} Nuevo Presupuesto</button></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--spacing-md);">
        ${items.length === 0 ? '<div class="card"><div class="card__body" style="text-align:center;color:var(--text-muted);padding:3rem;">No hay presupuestos definidos.</div></div>' :
                items.map(p => {
                    const gastado = gastos.filter(g => g.categoria === p.categoria && g.fecha >= (p.fecha_inicio || yearStart())).reduce((s, g) => s + parseFloat(g.monto || 0), 0);
                    const pct = p.monto > 0 ? Math.min((gastado / p.monto) * 100, 100) : 0;
                    const overBudget = gastado > p.monto;
                    return `<div class="card" style="border-left:4px solid ${overBudget ? '#ef4444' : '#14b8a6'};"><div class="card__body">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h4 style="margin:0;">${p.categoria || p.nombre}</h4>
              <button class="btn btn--ghost btn--icon btn--sm" onclick="GestionFinancieraModule.deleteBudget('${p.id}')" style="color:var(--color-danger);">${Icons.trash}</button>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
              <span>Gastado: <strong style="color:${overBudget ? 'var(--color-danger)' : 'var(--text-primary)'};">C$${fmt(gastado)}</strong></span>
              <span>Presupuesto: <strong>C$${fmt(p.monto)}</strong></span>
            </div>
            <div style="width:100%;height:10px;background:var(--border-color);border-radius:8px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${overBudget ? '#ef4444' : '#14b8a6'};border-radius:8px;transition:width .3s;"></div>
            </div>
            <div style="text-align:right;font-size:11px;margin-top:4px;color:${overBudget ? 'var(--color-danger)' : 'var(--text-muted)'};">${pct.toFixed(0)}% utilizado ${overBudget ? '⚠️ Excedido' : ''}</div>
          </div></div>`;
                }).join('')}
      </div>`;
    };

    // ========== FORM MODALS ==========
    const openModal = (title, bodyHtml, onSave) => {
        const existing = document.getElementById('finModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay open" id="finModal" style="z-index:10001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;">
        <div class="modal modal--md" style="margin:0;max-height:90vh;overflow-y:auto;">
          <div class="modal__header"><h3 class="modal__title">${title}</h3><button class="modal__close" onclick="GestionFinancieraModule.closeModal()">&times;</button></div>
          <div class="modal__body">${bodyHtml}</div>
          <div class="modal__footer"><button class="btn btn--secondary" onclick="GestionFinancieraModule.closeModal()">Cancelar</button><button class="btn btn--primary" id="finModalSave">${Icons.save} Guardar</button></div>
        </div>
      </div>`);
        document.getElementById('finModalSave').onclick = onSave;
    };
    const closeModal = () => { const m = document.getElementById('finModal'); if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 200); } };

    const openIncomeForm = () => {
        const cats = getData('categorias').filter(c => c.tipo === 'ingreso');
        const clientes = (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];
        openModal('Registrar Ingreso', `
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="finFecha" class="form-input" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label class="form-label">Categoría</label><select id="finCat" class="form-input"><option value="">Seleccionar</option>${cats.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Descripción</label><input type="text" id="finDesc" class="form-input" placeholder="Detalle del ingreso"></div>
      <div class="form-group"><label class="form-label">Cliente</label><select id="finCliente" class="form-input"><option value="">Sin cliente</option>${clientes.map(c => `<option value="${c.empresa || c.nombreCliente}">${c.empresa || c.nombreCliente}</option>`).join('')}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);">
        <div class="form-group"><label class="form-label">Subtotal (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01" min="0" oninput="document.getElementById('finIVA').value=(this.value*0.15).toFixed(2);document.getElementById('finTotal').value=(this.value*1.15).toFixed(2);"></div>
        <div class="form-group"><label class="form-label">IVA 15%</label><input type="number" id="finIVA" class="form-input" step="0.01" readonly></div>
      </div>
      <div class="form-group"><label class="form-label">Total</label><input type="number" id="finTotal" class="form-input" step="0.01" readonly style="font-weight:700;font-size:1.1rem;"></div>
      <div class="form-group"><label class="form-label">Método de Pago</label><select id="finMetodo" class="form-input"><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta">Tarjeta</option><option value="Cheque">Cheque</option></select></div>
    `, () => {
            const subtotal = parseFloat(document.getElementById('finMonto').value);
            if (!subtotal) { alert('Ingrese el monto'); return; }
            addRecord('ingresos', { fecha: document.getElementById('finFecha').value, categoria: document.getElementById('finCat').value, descripcion: document.getElementById('finDesc').value, cliente: document.getElementById('finCliente').value, subtotal, iva: subtotal * IVA_RATE, monto: subtotal * (1 + IVA_RATE), metodo_pago: document.getElementById('finMetodo').value });
            closeModal(); App.render();
        });
    };

    const openExpenseForm = () => {
        const cats = getData('categorias').filter(c => c.tipo === 'gasto');
        openModal('Registrar Gasto', `
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" id="finFecha" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label class="form-label">Categoría</label><select id="finCat" class="form-input"><option value="">Seleccionar</option>${cats.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Descripción</label><input type="text" id="finDesc" class="form-input" placeholder="Detalle del gasto"></div>
      <div class="form-group"><label class="form-label">Proveedor</label><input type="text" id="finProv" class="form-input" placeholder="Nombre del proveedor"></div>
      <div class="form-group"><label class="form-label">Monto (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01" min="0"></div>
      <div class="form-group"><label class="form-label">N° Comprobante</label><input type="text" id="finComp" class="form-input" placeholder="Factura o recibo"></div>
      <div class="form-group"><label class="form-label">Crédito Fiscal IVA (si aplica)</label><input type="number" id="finIvaCred" class="form-input" step="0.01" value="0"></div>
    `, () => {
            const monto = parseFloat(document.getElementById('finMonto').value);
            if (!monto) { alert('Ingrese el monto'); return; }
            addRecord('gastos', { fecha: document.getElementById('finFecha').value, categoria: document.getElementById('finCat').value, descripcion: document.getElementById('finDesc').value, proveedor: document.getElementById('finProv').value, monto, comprobante: document.getElementById('finComp').value, iva_credito: parseFloat(document.getElementById('finIvaCred').value) || 0 });
            closeModal(); App.render();
        });
    };

    const openCxcForm = () => {
        const clientes = (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];
        openModal('Nueva Cuenta por Cobrar', `
      <div class="form-group"><label class="form-label">Cliente *</label><select id="finCliente" class="form-input"><option value="">Seleccionar</option>${clientes.map(c => `<option value="${c.empresa || c.nombreCliente}">${c.empresa || c.nombreCliente}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Concepto</label><input type="text" id="finConcepto" class="form-input"></div>
      <div class="form-group"><label class="form-label">Monto (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);">
        <div class="form-group"><label class="form-label">Fecha Emisión</label><input type="date" id="finEmision" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">Vencimiento</label><input type="date" id="finVenc" class="form-input"></div>
      </div>
    `, () => {
            addRecord('cuentasCobrar', { cliente: document.getElementById('finCliente').value, concepto: document.getElementById('finConcepto').value, monto: parseFloat(document.getElementById('finMonto').value), fecha_emision: document.getElementById('finEmision').value, fecha_vencimiento: document.getElementById('finVenc').value, estado: 'pendiente' });
            closeModal(); App.render();
        });
    };

    const openCxpForm = () => {
        openModal('Nueva Cuenta por Pagar', `
      <div class="form-group"><label class="form-label">Proveedor *</label><input type="text" id="finProv" class="form-input"></div>
      <div class="form-group"><label class="form-label">Concepto</label><input type="text" id="finConcepto" class="form-input"></div>
      <div class="form-group"><label class="form-label">Monto (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01"></div>
      <div class="form-group"><label class="form-label">Vencimiento</label><input type="date" id="finVenc" class="form-input"></div>
    `, () => {
            addRecord('cuentasPagar', { proveedor: document.getElementById('finProv').value, concepto: document.getElementById('finConcepto').value, monto: parseFloat(document.getElementById('finMonto').value), fecha_vencimiento: document.getElementById('finVenc').value, estado: 'pendiente' });
            closeModal(); App.render();
        });
    };

    const openInvoiceForm = () => {
        const clientes = (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];
        const nextNum = 'FAC-' + String(getData('facturas').length + 1).padStart(5, '0');
        openModal('Nueva Factura — DGI Nicaragua', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);">
        <div class="form-group"><label class="form-label">N° Factura</label><input type="text" id="finNum" class="form-input" value="${nextNum}" readonly></div>
        <div class="form-group"><label class="form-label">Fecha</label><input type="date" id="finFecha" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
      </div>
      <div class="form-group"><label class="form-label">Cliente *</label><select id="finCliente" class="form-input"><option value="">Seleccionar</option>${clientes.map(c => `<option value="${c.empresa || c.nombreCliente}">${c.empresa || c.nombreCliente}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Concepto</label><input type="text" id="finConcepto" class="form-input"></div>
      <div class="form-group"><label class="form-label">Subtotal (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01" oninput="document.getElementById('finIVA').value=(this.value*0.15).toFixed(2);document.getElementById('finTotal').value=(this.value*1.15).toFixed(2);"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);">
        <div class="form-group"><label class="form-label">IVA 15%</label><input type="number" id="finIVA" class="form-input" readonly></div>
        <div class="form-group"><label class="form-label">Total</label><input type="number" id="finTotal" class="form-input" readonly style="font-weight:700;"></div>
      </div>
    `, () => {
            const subtotal = parseFloat(document.getElementById('finMonto').value);
            if (!subtotal) { alert('Ingrese el subtotal'); return; }
            addRecord('facturas', { numero: document.getElementById('finNum').value, fecha: document.getElementById('finFecha').value, cliente: document.getElementById('finCliente').value, concepto: document.getElementById('finConcepto').value, subtotal, iva: subtotal * IVA_RATE, total: subtotal * (1 + IVA_RATE), estado: 'pendiente' });
            closeModal(); App.render();
        });
    };

    const openBudgetForm = () => {
        const cats = getData('categorias').filter(c => c.tipo === 'gasto');
        openModal('Nuevo Presupuesto', `
      <div class="form-group"><label class="form-label">Categoría *</label><select id="finCat" class="form-input"><option value="">Seleccionar</option>${cats.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Monto Presupuestado (C$) *</label><input type="number" id="finMonto" class="form-input" step="0.01"></div>
      <div class="form-group"><label class="form-label">Período desde</label><input type="date" id="finInicio" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
    `, () => {
            addRecord('presupuestos', { categoria: document.getElementById('finCat').value, monto: parseFloat(document.getElementById('finMonto').value), fecha_inicio: document.getElementById('finInicio').value });
            closeModal(); App.render();
        });
    };

    // ========== DELETE ACTIONS ==========
    const confirmDelete = (key, id) => { if (confirm('¿Eliminar este registro?')) { deleteRecord(key, id); App.render(); } };

    // ========== PUBLIC API ==========
    return {
        render, navigateTo, closeModal,
        openIncomeForm, openExpenseForm, openCxcForm, openCxpForm, openInvoiceForm, openBudgetForm,
        deleteIncome: (id) => confirmDelete('ingresos', id),
        deleteExpense: (id) => confirmDelete('gastos', id),
        deleteCxc: (id) => confirmDelete('cuentasCobrar', id),
        deleteCxp: (id) => confirmDelete('cuentasPagar', id),
        deleteInvoice: (id) => confirmDelete('facturas', id),
        deleteBudget: (id) => confirmDelete('presupuestos', id),
        markCxcPaid: (id) => { updateRecord('cuentasCobrar', id, { estado: 'pagada' }); App.render(); },
        markCxpPaid: (id) => { updateRecord('cuentasPagar', id, { estado: 'pagada' }); App.render(); },
        
        // ---- NUEVAS FUNCIONES QUICKBOOKS STYLE ----
        
        // Sincronizar datos desde otros módulos
        syncFromModules: () => {
            if (typeof DataService !== 'undefined') {
                const result = DataService.syncFinFromModules();
                alert(`Sincronizado: ${result.ingresosImportados} ingresos, ${result.gastosImportados} gastos`);
                App.render();
            }
        },

        // Obtener métricas financieras
        getMetrics: () => {
            if (typeof DataService !== 'undefined') {
                return DataService.getFinMetrics(selectedPeriod);
            }
            return getMetrics();
        },

        // Estado de resultados
        openEstadoResultados: () => {
            if (typeof DataService !== 'undefined') {
                const er = DataService.getEstadoResultados(selectedPeriod);
                const content = `
                    <div style="max-height: 70vh; overflow-y: auto;">
                        <h3 style="color: var(--color-primary-600); margin-bottom: 1rem;">📊 Estado de Resultados</h3>
                        <table class="data-table">
                            <thead><tr><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
                            <tbody>
                                <tr style="background: rgba(16,185,129,0.1);"><td><strong>INGRESOS</strong></td><td style="text-align:right;"><strong>C$${er.totalIngresos.toFixed(2)}</strong></td></tr>
                                ${Object.entries(er.ingresos).map(([cat, monto]) => `<tr><td style="padding-left: 20px;">${cat}</td><td style="text-align:right;">C$${monto.toFixed(2)}</td></tr>`).join('')}
                                <tr style="background: rgba(239,68,68,0.1);"><td><strong>GASTOS</strong></td><td style="text-align:right;"><strong>C$${er.totalGastos.toFixed(2)}</strong></td></tr>
                                ${Object.entries(er.gastos).map(([cat, monto]) => `<tr><td style="padding-left: 20px;">${cat}</td><td style="text-align:right;">C$${monto.toFixed(2)}</td></tr>`).join('')}
                                <tr style="background: rgba(245,158,11,0.1);"><td><strong>IVA</strong></td><td style="text-align:right;">C$${er.iva.toFixed(2)}</td></tr>
                                <tr style="background: rgba(99,102,241,0.2); font-size: 1.1rem;"><td><strong>UTILIDAD NETA</strong></td><td style="text-align:right;"><strong>C$${er.utilidadNeta.toFixed(2)}</strong></td></tr>
                            </tbody>
                        </table>
                        <div style="margin-top: 1rem; text-align: center;">
                            <span class="badge badge--${er.margenNeto > 0 ? 'success' : 'danger'}">Margen: ${er.margenNeto.toFixed(1)}%</span>
                        </div>
                    </div>
                `;
                alert(content.replace(/<[^>]*>/g, ''));
            }
        },

        // Balance general
        openBalanceGeneral: () => {
            if (typeof DataService !== 'undefined') {
                const bg = DataService.getBalanceGeneral();
                const content = `
                    <div style="max-height: 70vh; overflow-y: auto;">
                        <h3 style="color: var(--color-primary-600); margin-bottom: 1rem;">📋 Balance General</h3>
                        <table class="data-table">
                            <thead><tr><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
                            <tbody>
                                <tr style="background: rgba(16,185,129,0.1);"><td><strong>ACTIVOS</strong></td><td style="text-align:right;"><strong>C$${bg.activos.total.toFixed(2)}</strong></td></tr>
                                <tr><td style="padding-left: 20px;">Bancos</td><td style="text-align:right;">C$${bg.activos.bancos.toFixed(2)}</td></tr>
                                <tr><td style="padding-left: 20px;">Cuentas por Cobrar</td><td style="text-align:right;">C$${bg.activos.cuentasCobrar.toFixed(2)}</td></tr>
                                <tr style="background: rgba(239,68,68,0.1);"><td><strong>PASIVOS</strong></td><td style="text-align:right;"><strong>C$${bg.pasivos.total.toFixed(2)}</strong></td></tr>
                                <tr><td style="padding-left: 20px;">Cuentas por Pagar</td><td style="text-align:right;">C$${bg.pasivos.cuentasPagar.toFixed(2)}</td></tr>
                                <tr style="background: rgba(59,130,246,0.1);"><td><strong>PATRIMONIO</strong></td><td style="text-align:right;"><strong>C$${bg.patrimonio.total.toFixed(2)}</strong></td></tr>
                                <tr><td style="padding-left: 20px;">Utilidad Acumulada</td><td style="text-align:right;">C$${bg.patrimonio.utilidadAcumulada.toFixed(2)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                `;
                alert(content.replace(/<[^>]*>/g, ''));
            }
        },

        // Proyección de flujo de caja
        openProyeccionFlujo: () => {
            if (typeof DataService !== 'undefined') {
                const proy = DataService.getProyeccionFlujo(6);
                let html = '<div style="max-height: 70vh; overflow-y: auto;"><h3>📈 Proyección de Flujo de Caja</h3><table class="data-table"><thead><tr><th>Mes</th><th style="text-align:right;">Ingresos</th><th style="text-align:right;">Gastos</th><th style="text-align:right;">Neto</th></tr></thead><tbody>';
                proy.forEach(p => {
                    html += `<tr><td>${p.mes}</td><td style="text-align:right;color:var(--color-success);">C$${p.ingresos.toFixed(2)}</td><td style="text-align:right;color:var(--color-danger);">C$${p.gastos.toFixed(2)}</td><td style="text-align:right;font-weight:bold;color:${p.neto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${p.neto.toFixed(2)}</td></tr>`;
                });
                html += '</tbody></table></div>';
                alert(html.replace(/<[^>]*>/g, ''));
            }
        },

        // Centros de costo
        openCentrosCosto: () => {
            if (typeof DataService !== 'undefined') {
                const centros = DataService.getCentrosCosto();
                let html = '<div style="max-height: 70vh; overflow-y: auto;"><h3>🏢 Centros de Costo y Rentabilidad</h3><table class="data-table"><thead><tr><th>Centro</th><th style="text-align:right;">Servicios</th><th style="text-align:right;">Ingresos</th><th style="text-align:right;">Rentabilidad</th></tr></thead><tbody>';
                centros.slice(0, 10).forEach(c => {
                    html += `<tr><td>${c.nombre}</td><td style="text-align:right;">${c.servicios}</td><td style="text-align:right;">C$${c.ingresos.toFixed(2)}</td><td style="text-align:right;color:${c.rentabilidad >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${c.rentabilidad.toFixed(1)}%</td></tr>`;
                });
                html += '</tbody></table></div>';
                alert(html.replace(/<[^>]*>/g, ''));
            }
        },

        // Exportar reportes
        exportFinanciero: (tipo) => {
            if (typeof DataService !== 'undefined') {
                DataService.exportReporteFinanciero(tipo);
            }
        },

        // Ver alertas
        getAlertas: () => {
            if (typeof DataService !== 'undefined') {
                return DataService.getFinAlertas();
            }
            return [];
        },

        // Agregar ingreso rápido desde DataService
        addIngreso: (data) => {
            if (typeof DataService !== 'undefined') {
                DataService.addFinIngreso(data);
                App.render();
            }
        },

        // Agregar gasto rápido desde DataService
        addGasto: (data) => {
            if (typeof DataService !== 'undefined') {
                DataService.addFinGasto(data);
                App.render();
            }
        }
    };
})();

window.GestionFinancieraModule = GestionFinancieraModule;
console.log('✅ Módulo de Gestión Financiera cargado correctamente');
