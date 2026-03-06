/**
 * ALLTECH - Módulo de Ventas (POS)
 * Sistema completo de punto de venta
 */
const VentasModule = (() => {
  const IVA_RATE = 0.15;
  let currentView = 'dashboard';
  let cart = [];
  let selectedClient = null;
  let selectedPayment = 'efectivo';
  let cashReceived = 0;
  let suspendedSales = [];
  let searchTimeout = null;
  let turnoActivo = JSON.parse(localStorage.getItem('vnt_turno') || 'null');
  let selectedCurrency = 'NIO';

  // ========== DATA LAYER ==========
  const SK = {
    ventas: 'vnt_ventas', items: 'vnt_items', cajaMovs: 'vnt_caja_movs',
    cortes: 'vnt_cortes', devoluciones: 'vnt_devoluciones', abonos: 'vnt_abonos',
    suspended: 'vnt_suspended', cotizaciones: 'vnt_cotizaciones'
  };
  const getData = (k) => { try { return JSON.parse(localStorage.getItem(SK[k]) || '[]'); } catch { return []; } };
  const setData = (k, d) => localStorage.setItem(SK[k], JSON.stringify(d));
  const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const addRec = (k, r) => { const d = getData(k); r.id = genId(); r.created_at = new Date().toISOString(); d.unshift(r); setData(k, d); return r; };
  const fmt = (n) => parseFloat(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('es-NI') : 'N/A';
  const today = () => new Date().toISOString().split('T')[0];
  const user = () => State.get('user');

  // ========== METRICS ==========
  const getMetrics = () => {
    const ventas = getData('ventas');
    const td = today();
    const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const ventasDia = ventas.filter(v => (v.fecha || '').startsWith(td));
    const ventasMes = ventas.filter(v => v.fecha >= ms);
    const totalDia = ventasDia.reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const totalMes = ventasMes.reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const facturasHoy = ventasDia.length;
    const movsCaja = getData('cajaMovs').filter(m => (m.fecha || '').startsWith(td));
    const ingresosCaja = movsCaja.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const retirosCaja = movsCaja.filter(m => m.tipo === 'retiro').reduce((s, m) => s + parseFloat(m.monto || 0), 0);
    const totalCaja = totalDia + ingresosCaja - retirosCaja;
    const costoTotal = ventasMes.reduce((s, v) => s + parseFloat(v.costo_total || 0), 0);
    return { totalDia, totalMes, facturasHoy, totalCaja, costoTotal, gananciaB: totalMes - costoTotal, ventasDia, ventasMes };
  };

  const getProducts = () => (typeof DataService !== 'undefined' && DataService.getProductosSync) ? DataService.getProductosSync() : [];
  const getClients = () => (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];

  // ========== NAVIGATION ==========
  const navigateTo = (v) => { currentView = v; App.render(); };

  // ========== TURNO / SHIFT ==========
  const openTurno = () => {
    const fondo = prompt('💰 ¿Con cuánto efectivo inicia caja? (C$)');
    if (!fondo) return;
    const amount = parseFloat(fondo);
    if (isNaN(amount) || amount < 0) { alert('Monto inválido'); return; }
    turnoActivo = { fondoInicial: amount, apertura: new Date().toISOString(), usuario: user()?.name || 'N/A', ventas: 0, totalVentas: 0 };
    localStorage.setItem('vnt_turno', JSON.stringify(turnoActivo));
    currentView = 'pos';
    App.render();
  };

  const closeTurno = () => { currentView = 'cerrar-turno'; App.render(); };

  const confirmCloseTurno = () => {
    if (!turnoActivo) return;
    const m = getMetrics();
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const entradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const salidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    addRec('cortes', { fecha: new Date().toISOString(), fondo_inicial: turnoActivo.fondoInicial, total_ventas: m.totalDia, entradas, salidas, total_caja: turnoActivo.fondoInicial + m.totalDia + entradas - salidas, num_ventas: m.facturasHoy, usuario: turnoActivo.usuario });
    turnoActivo = null;
    localStorage.removeItem('vnt_turno');
    cart = []; cashReceived = 0;
    alert('✅ Turno cerrado exitosamente');
    currentView = 'dashboard';
    App.render();
  };

  // ========== RENDER ==========
  const render = () => {
    const views = {
      dashboard: renderDashboard, pos: renderPOS, catalogo: renderCatalogo,
      'productos-vendidos': renderProductosVendidos, clientes: renderClientes,
      abonos: renderAbonos, caja: renderCaja, reimpresion: renderReimpresion,
      cotizaciones: renderCotizaciones, cortes: renderCortes,
      devoluciones: renderDevoluciones, reportes: renderReportes, ganancias: renderGanancias,
      'cerrar-turno': renderCerrarTurno, 'consultor-precios': renderConsultorPrecios,
      'pos-devoluciones': renderPOSDevoluciones, apartados: renderApartados
    };
    return (views[currentView] || renderDashboard)();
  };

  // ========== TILE HELPER ==========
  const tile = (id, icon, name, desc, color, bg, badge) => `
    <div class="ventas-tile" onclick="VentasModule.navigateTo('${id}')">
      <div class="ventas-tile__icon" style="background:${bg};color:${color};">${icon}</div>
      <div class="ventas-tile__name">${name}</div>
      <div class="ventas-tile__desc">${desc}</div>
      <div class="ventas-tile__badge" style="background:${bg};color:${color};">${badge}</div>
    </div>`;

  const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al Panel</button>`;

  // ========== DASHBOARD ==========
  const renderDashboard = () => {
    const m = getMetrics();
    const susp = suspendedSales.length;
    const devs = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today())).length;
    return `
      <div class="ventas-header">
        <div class="ventas-header__title">${Icons.shoppingCart} Módulo de Ventas</div>
        <div class="ventas-kpis">
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('pos')">
            <div class="ventas-kpi__label">Ventas del Día</div>
            <div class="ventas-kpi__value" style="color:#34d399;">C$${fmt(m.totalDia)}</div>
            <div class="ventas-kpi__sub">${Icons.trendingUp} ${m.facturasHoy} facturas</div>
          </div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('catalogo')">
            <div class="ventas-kpi__label">Ventas del Mes</div>
            <div class="ventas-kpi__value" style="color:#60a5fa;">C$${fmt(m.totalMes)}</div>
            <div class="ventas-kpi__sub">${Icons.barChart} Acumulado</div>
          </div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('caja')">
            <div class="ventas-kpi__label">Total en Caja</div>
            <div class="ventas-kpi__value" style="color:#fbbf24;">C$${fmt(m.totalCaja)}</div>
            <div class="ventas-kpi__sub">${Icons.wallet} Disponible</div>
          </div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('ganancias')">
            <div class="ventas-kpi__label">Ganancia Bruta</div>
            <div class="ventas-kpi__value" style="color:${m.gananciaB >= 0 ? '#34d399' : '#f87171'};">C$${fmt(m.gananciaB)}</div>
            <div class="ventas-kpi__sub">${m.gananciaB >= 0 ? '✅' : '⚠️'} Mes actual</div>
          </div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('abonos')">
            <div class="ventas-kpi__label">Créditos Pend.</div>
            <div class="ventas-kpi__value" style="color:#a78bfa;">${getData('ventas').filter(v => v.metodo === 'credito' && v.saldo_pendiente > 0).length}</div>
            <div class="ventas-kpi__sub">Facturas</div>
          </div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('devoluciones')">
            <div class="ventas-kpi__label">Devoluciones</div>
            <div class="ventas-kpi__value" style="color:#f472b6;">${devs}</div>
            <div class="ventas-kpi__sub">Hoy</div>
          </div>
        </div>
      </div>
      <div class="ventas-grid">
        ${tile('pos', Icons.shoppingCart, 'Punto de Venta', 'POS rápido con atajos', '#059669', '#ecfdf5', 'F2 - Iniciar')}
        ${tile('catalogo', Icons.list, 'Catálogo de Ventas', 'Historial completo', '#3b82f6', '#eff6ff', m.ventasMes.length + ' ventas')}
        ${tile('productos-vendidos', Icons.package, 'Productos Vendidos', 'Análisis de rotación', '#8b5cf6', '#f5f3ff', 'Analítica')}
        ${tile('clientes', Icons.users, 'Clientes', 'Créditos y saldos', '#0ea5e9', '#f0f9ff', getClients().length + ' clientes')}
        ${tile('abonos', Icons.dollarSign, 'Abonos', 'Pagos a créditos', '#10b981', '#ecfdf5', 'Registrar')}
        ${tile('caja', Icons.wallet, 'Entradas/Salidas Caja', 'Movimientos manuales', '#f59e0b', '#fffbeb', 'Control')}
        ${tile('reimpresion', Icons.printer, 'Reimpresión', 'Tickets y facturas', '#6366f1', '#eef2ff', 'Buscar')}
        ${tile('cotizaciones', Icons.fileText, 'Cotizaciones', 'Crear y convertir', '#14b8a6', '#f0fdfa', 'Proformas')}
        ${tile('cortes', Icons.calculator, 'Cortes de Caja', 'Cierre y arqueo', '#ec4899', '#fdf2f8', 'Corte')}
        ${tile('devoluciones', Icons.refreshCw, 'Devoluciones', 'Gestión de retornos', '#ef4444', '#fef2f2', devs + ' hoy')}
        ${tile('reportes', Icons.barChart, 'Reportes', 'Estadísticas avanzadas', '#6366f1', '#eef2ff', 'PDF/Excel')}
        ${tile('ganancias', Icons.trendingUp, 'Ganancias', 'Márgenes y rentabilidad', '#059669', '#ecfdf5', 'C$' + fmt(m.gananciaB))}
      </div>`;
  };

  // ========== POS ==========
  const renderPOS = () => {
    if (!turnoActivo) return renderOpenTurno();
    const clients = getClients();
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento) * IVA_RATE;
    const total = subtotal - descuento + iva;
    const currSymbol = selectedCurrency === 'USD' ? '$' : 'C$';
    return `
      <div style="display:grid;grid-template-columns:56px 1fr 380px;height:calc(100vh - var(--header-height) - 20px);border-radius:var(--border-radius-lg);overflow:hidden;border:1px solid var(--border-color);box-shadow:var(--shadow-lg);background:var(--bg-secondary);">
        <!-- POS SIDEBAR -->
        <div style="background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;overflow-y:auto;">
          ${[{ id: 'pos', ic: '🛒', lb: 'Venta' }, { id: 'consultor-precios', ic: '🔍', lb: 'Precios' }, { id: 'pos-devoluciones', ic: '↩️', lb: 'Devoluc.' }, { id: 'caja', ic: '💰', lb: 'Caja' }, { id: 'apartados', ic: '📦', lb: 'Apartados' }, { id: 'cotizaciones', ic: '📄', lb: 'Cotizar' }].map(b => `<button onclick="VentasModule.navigateTo('${b.id}')" style="background:${currentView === b.id ? 'rgba(56,189,248,.2)' : 'transparent'};border:none;color:white;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;transition:all .15s;" onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='${currentView === b.id ? 'rgba(56,189,248,.2)' : 'transparent'}'">
            <span style="font-size:18px;">${b.ic}</span><span>${b.lb}</span></button>`).join('')}
          <div style="flex:1;"></div>
          ${suspendedSales.length > 0 ? `<button onclick="VentasModule.recoverSale()" style="background:rgba(251,191,36,.2);border:none;color:#fbbf24;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;"><span style="font-size:18px;">⏸️</span><span>Espera(${suspendedSales.length})</span></button>` : ''}
          <button onclick="VentasModule.closeTurno()" style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;margin-bottom:4px;"><span style="font-size:18px;">🔒</span><span>Cerrar</span></button>
        </div>
        <!-- POS CENTER -->
        <div style="display:flex;flex-direction:column;border-right:1px solid var(--border-color);overflow:hidden;">
          <div class="pos-toolbar">
            <div class="pos-toolbar__search" style="position:relative;flex:1;">
              <span class="pos-toolbar__search-icon">${Icons.search}</span>
              <input type="text" id="posSearch" placeholder="Buscar producto por nombre o código (F2)" oninput="VentasModule.searchProducts(this.value)" autocomplete="off">
              <div id="posSearchResults" style="display:none;" class="pos-search-results"></div>
            </div>
            <button class="pos-toolbar__btn" onclick="VentasModule.suspendSale()" ${cart.length === 0 ? 'disabled' : ''}>⏸️ Suspender <kbd>F8</kbd></button>
            <button class="pos-toolbar__btn" onclick="VentasModule.clearCart()">🗑️ <kbd>F5</kbd></button>
            <span style="font-size:11px;opacity:.6;">Turno: ${turnoActivo.usuario} | Fondo: C$${fmt(turnoActivo.fondoInicial)}</span>
          </div>
          <div class="pos-client-bar">
            <span class="pos-client-bar__label">${Icons.user} Cliente:</span>
            <select id="posClient" onchange="VentasModule.selectClient(this.value)">
              <option value="">PÚBLICO EN GENERAL</option>
              ${clients.map(c => `<option value="${c.id}" ${selectedClient === c.id ? 'selected' : ''}>${c.empresa || c.nombreCliente || 'Sin nombre'}</option>`).join('')}
            </select>
            <span style="margin-left:auto;font-size:12px;font-weight:700;">Moneda:</span>
            <select onchange="VentasModule.setCurrency(this.value)" style="width:85px;padding:4px 6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;">
              <option value="NIO" ${selectedCurrency === 'NIO' ? 'selected' : ''}>C$ NIO</option>
              <option value="USD" ${selectedCurrency === 'USD' ? 'selected' : ''}>$ USD</option>
            </select>
          </div>
          <div class="pos-items" style="flex:1;overflow-y:auto;">
            ${cart.length === 0 ? `<div class="pos-items__empty"><div class="pos-items__empty-icon">🛒</div><p>Busque un producto o escanee un código</p><p style="font-size:11px;">Use <kbd>F2</kbd> para buscar | <kbd>ESC</kbd> para cobrar</p></div>` : `
            <table><thead><tr><th>#</th><th>Producto</th><th>Cant.</th><th>P.Unit</th><th>Desc.</th><th style="text-align:right;">Total</th><th></th></tr></thead>
            <tbody>${cart.map((item, i) => `<tr><td>${i + 1}</td><td><strong>${item.nombre}</strong></td><td><input type="number" class="pos-qty-input" value="${item.cantidad}" min="1" onchange="VentasModule.updateQty(${i},this.value)"></td><td>${currSymbol}${fmt(item.precio)}</td><td><input type="number" class="pos-qty-input" value="${item.descuento || 0}" min="0" step="0.01" onchange="VentasModule.updateDiscount(${i},this.value)" style="width:65px;"></td><td style="text-align:right;font-weight:700;">${currSymbol}${fmt(item.precio * item.cantidad - (item.descuento || 0))}</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="VentasModule.removeItem(${i})" style="color:var(--color-danger);">${Icons.trash}</button></td></tr>`).join('')}</tbody></table>`}
          </div>
          <div class="pos-shortcuts">
            <button class="pos-shortcut-btn" onclick="document.getElementById('posSearch').focus()"><kbd>F2</kbd> Buscar</button>
            <button class="pos-shortcut-btn" onclick="VentasModule.clearCart()"><kbd>F5</kbd> Limpiar</button>
            <button class="pos-shortcut-btn" onclick="VentasModule.suspendSale()"><kbd>F8</kbd> Suspender</button>
            <button class="pos-shortcut-btn" onclick="VentasModule.processPayment()"><kbd>ESC</kbd> Cobrar</button>
            <button class="pos-shortcut-btn" onclick="VentasModule.navigateTo('consultor-precios')"><kbd>F3</kbd> Precios</button>
            <button class="pos-shortcut-btn" onclick="VentasModule.navigateTo('pos-devoluciones')"><kbd>F9</kbd> Devolver</button>
          </div>
        </div>
        <!-- POS RIGHT -->
        <div style="display:flex;flex-direction:column;background:var(--bg-primary);">
          <div class="pos-totals">
            <div class="pos-totals__row"><span>Subtotal</span><span>${currSymbol}${fmt(subtotal)}</span></div>
            <div class="pos-totals__row"><span>Descuento</span><span style="color:var(--color-danger);">-${currSymbol}${fmt(descuento)}</span></div>
            <div class="pos-totals__row"><span>IVA 15%</span><span>${currSymbol}${fmt(iva)}</span></div>
            <div class="pos-totals__row pos-totals__row--total"><span>TOTAL</span><span id="posTotalDisplay">${currSymbol}${fmt(total)}</span></div>
          </div>
          <div class="pos-payment">
            <div class="pos-payment__title">Método de Pago</div>
            <div class="pos-payment__methods">
              ${['efectivo', 'tarjeta', 'transferencia', 'credito'].map(m => `<button class="pos-pay-btn ${selectedPayment === m ? 'active' : ''}" onclick="VentasModule.setPayment('${m}')"><div class="pos-pay-btn__icon">${m === 'efectivo' ? '💵' : m === 'tarjeta' ? '💳' : m === 'transferencia' ? '🏦' : '📋'}</div><div class="pos-pay-btn__label">${m.charAt(0).toUpperCase() + m.slice(1)}</div></button>`).join('')}
            </div>
            ${selectedPayment === 'efectivo' ? `
              <div style="margin-top:10px;">
                <label style="font-size:12px;font-weight:700;color:var(--text-muted);">Efectivo recibido:</label>
                <input type="number" id="posCash" class="form-input" step="0.01" data-total="${total}"
                  oninput="VentasModule.updateCashDisplay(this)" placeholder="C$0.00" style="font-size:1.2rem;font-weight:800;margin-top:4px;">
              </div>
              <div id="posCambioBox" class="pos-change" style="display:none;">
                <div class="pos-change__row"><span>Recibido:</span><span id="posCambioRecibido">C$0.00</span></div>
                <div class="pos-change__row pos-change__row--cambio"><span>Cambio:</span><span id="posCambioValor">C$0.00</span></div>
              </div>`: ''}
          </div>
          <div class="pos-cobrar">
            <button class="pos-cobrar__btn" onclick="VentasModule.processPayment()" ${cart.length === 0 ? 'disabled' : ''}>
              ${Icons.check} COBRAR ${currSymbol}${fmt(total)} <kbd>ESC</kbd>
            </button>
          </div>
        </div>
      </div>`;
  };

  const renderOpenTurno = () => `
      <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;">
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;padding:3rem;text-align:center;max-width:420px;box-shadow:var(--shadow-xl);">
          <div style="font-size:4rem;margin-bottom:1rem;">🏪</div>
          <h2 style="margin-bottom:.5rem;color:var(--text-primary);">Abrir Punto de Venta</h2>
          <p style="color:var(--text-muted);margin-bottom:2rem;">Ingrese el fondo de caja inicial para comenzar su turno de ventas.</p>
          <button class="pos-cobrar__btn" onclick="VentasModule.openTurno()" style="max-width:280px;margin:0 auto;">💰 Abrir Turno</button>
          <button class="btn btn--ghost" onclick="VentasModule.navigateTo('dashboard')" style="margin-top:12px;display:block;width:100%;">← Volver al Panel</button>
        </div>
      </div>`;

  // ========== CERRAR TURNO ==========
  const renderCerrarTurno = () => {
    if (!turnoActivo) { currentView = 'dashboard'; return render(); }
    const m = getMetrics();
    const ventas = getData('ventas').filter(v => (v.fecha || '').startsWith(today()));
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const entradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const salidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const vEfectivo = ventas.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vTarjeta = ventas.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vTransf = ventas.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vCredito = ventas.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const totalEsperado = turnoActivo.fondoInicial + vEfectivo + entradas - salidas;
    const bills = [{ v: 1000, l: 'C$1,000' }, { v: 500, l: 'C$500' }, { v: 200, l: 'C$200' }, { v: 100, l: 'C$100' }, { v: 50, l: 'C$50' }, { v: 20, l: 'C$20' }, { v: 10, l: 'C$10' }, { v: 5, l: 'C$5' }, { v: 1, l: 'C$1' }, { v: 0.5, l: 'C$0.50' }];
    return `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('pos')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al POS</button>
        <div class="ventas-window"><div class="ventas-window__titlebar">🔒 Cerrar Turno — ${turnoActivo.usuario}</div>
        <div class="ventas-window__body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-lg);">
            <div>
              <h4 style="margin-bottom:12px;">📊 Resumen del Turno</h4>
              <div class="corte-summary" style="margin-bottom:16px;">
                <div class="corte-summary__item"><div class="corte-summary__label">Fondo Inicial</div><div class="corte-summary__value">C$${fmt(turnoActivo.fondoInicial)}</div></div>
                <div class="corte-summary__item"><div class="corte-summary__label">Total Ventas</div><div class="corte-summary__value" style="color:var(--color-success);">C$${fmt(m.totalDia)}</div></div>
                <div class="corte-summary__item"><div class="corte-summary__label">Facturas</div><div class="corte-summary__value">${m.facturasHoy}</div></div>
                <div class="corte-summary__item"><div class="corte-summary__label">Entradas Caja</div><div class="corte-summary__value" style="color:var(--color-success);">+C$${fmt(entradas)}</div></div>
                <div class="corte-summary__item"><div class="corte-summary__label">Salidas Caja</div><div class="corte-summary__value" style="color:var(--color-danger);">-C$${fmt(salidas)}</div></div>
                <div class="corte-summary__item" style="border:2px solid var(--color-primary-500);"><div class="corte-summary__label">Efectivo Esperado</div><div class="corte-summary__value" style="color:var(--color-primary-500);font-size:1.5rem;">C$${fmt(totalEsperado)}</div></div>
              </div>
              <h4 style="margin-bottom:8px;">💳 Desglose por Forma de Pago</h4>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-primary);border-radius:8px;"><span>💵 Efectivo</span><strong>C$${fmt(vEfectivo)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-primary);border-radius:8px;"><span>💳 Tarjeta</span><strong>C$${fmt(vTarjeta)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-primary);border-radius:8px;"><span>🏦 Transferencia</span><strong>C$${fmt(vTransf)}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-primary);border-radius:8px;"><span>📋 Crédito</span><strong>C$${fmt(vCredito)}</strong></div>
              </div>
            </div>
            <div>
              <h4 style="margin-bottom:12px;">🪙 Contador de Divisas</h4>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${bills.map(b => `<div style="display:flex;align-items:center;gap:8px;"><span style="width:70px;font-weight:700;font-size:13px;">${b.l}</span><span style="color:var(--text-muted);font-size:11px;">×</span><input type="number" min="0" value="0" oninput="VentasModule.updateContador()" data-billval="${b.v}" class="pos-qty-input" style="width:70px;"><span style="color:var(--text-muted);">=</span><span class="bill-subtotal" style="font-weight:700;font-size:13px;min-width:80px;">C$0.00</span></div>`).join('')}
              </div>
              <div style="margin-top:12px;padding:12px;background:var(--bg-primary);border-radius:10px;border:2px solid var(--border-color);">
                <div style="display:flex;justify-content:space-between;font-size:14px;"><span>Conteo Real:</span><strong id="conteoReal" style="font-size:1.3rem;">C$0.00</strong></div>
                <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px;"><span>Diferencia:</span><strong id="conteoDiff" style="font-size:1.3rem;">C$0.00</strong></div>
              </div>
            </div>
          </div>
          <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;">
            <button class="btn btn--ghost" onclick="VentasModule.navigateTo('pos')">← Volver al POS</button>
            <button class="pos-cobrar__btn" onclick="VentasModule.confirmCloseTurno()" style="max-width:300px;">🔒 Confirmar Cierre de Turno</button>
          </div>
        </div></div>`;
  };

  // ========== CONSULTOR DE PRECIOS ==========
  const renderConsultorPrecios = () => {
    const prods = getProducts();
    return `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('pos')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al POS</button>
        <div class="ventas-window"><div class="ventas-window__titlebar">🔍 Consultor de Precios</div>
        <div class="ventas-window__body">
          <input type="text" class="form-input" placeholder="Buscar producto por nombre o código..." oninput="VentasModule.filterPriceList(this.value)" style="margin-bottom:16px;font-size:1.1rem;" autofocus>
          <div id="priceListResults" class="card card--no-padding">
            <table class="data-table"><thead class="data-table__head"><tr><th>Producto</th><th>Código</th><th>Stock</th><th style="text-align:right;">P. Compra</th><th style="text-align:right;">P. Venta</th></tr></thead>
            <tbody class="data-table__body">${prods.slice(0, 30).map(p => `<tr><td><strong>${p.nombre || '-'}</strong></td><td>${p.codigo || p.sku || '-'}</td><td>${p.stock ?? p.cantidad ?? '∞'}</td><td style="text-align:right;">C$${fmt(p.precioCompra || p.costo || 0)}</td><td style="text-align:right;font-weight:700;color:var(--color-success);">C$${fmt(p.precioVenta || p.precio || 0)}</td></tr>`).join('')}</tbody></table>
          </div>
        </div></div>`;
  };

  const filterPriceList = (q) => {
    const el = document.getElementById('priceListResults');
    if (!el) return;
    const prods = getProducts().filter(p => !q || (p.nombre || '').toLowerCase().includes(q.toLowerCase()) || (p.codigo || '').toLowerCase().includes(q.toLowerCase()));
    el.innerHTML = `<table class="data-table"><thead class="data-table__head"><tr><th>Producto</th><th>Código</th><th>Stock</th><th style="text-align:right;">P. Compra</th><th style="text-align:right;">P. Venta</th></tr></thead><tbody class="data-table__body">${prods.slice(0, 30).map(p => `<tr><td><strong>${p.nombre || '-'}</strong></td><td>${p.codigo || p.sku || '-'}</td><td>${p.stock ?? p.cantidad ?? '∞'}</td><td style="text-align:right;">C$${fmt(p.precioCompra || p.costo || 0)}</td><td style="text-align:right;font-weight:700;color:var(--color-success);">C$${fmt(p.precioVenta || p.precio || 0)}</td></tr>`).join('')}</tbody></table>`;
  };

  // ========== POS DEVOLUCIONES ==========
  const renderPOSDevoluciones = () => {
    const ventas = getData('ventas');
    const devs = getData('devoluciones');
    return `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('pos')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al POS</button>
        <div class="ventas-window"><div class="ventas-window__titlebar">↩️ Devoluciones desde POS</div>
        <div class="ventas-window__body">
          <div class="ventas-filter-bar"><input type="text" placeholder="Buscar por N° factura o nombre de cliente..." id="devSearch" oninput="VentasModule.filterDevSearch(this.value)" style="flex:1;"><button class="btn btn--primary btn--sm" onclick="VentasModule.openDevolucionForm()">+ Nueva Devolución</button></div>
          <h4 style="margin:12px 0 8px;">Últimas Ventas (seleccione para devolver)</h4>
          <div id="devVentasList" class="card card--no-padding" style="max-height:300px;overflow-y:auto;">
            <table class="data-table"><thead class="data-table__head"><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th style="text-align:right;">Total</th><th>Acción</th></tr></thead>
            <tbody class="data-table__body">${ventas.slice(0, 20).map(v => `<tr><td><strong>${v.numero}</strong></td><td>${fmtD(v.fecha)}</td><td>${v.cliente || '-'}</td><td style="text-align:right;">C$${fmt(v.total)}</td><td><button class="btn btn--ghost btn--sm" style="color:var(--color-danger);" onclick="VentasModule.devFromVenta('${v.id}')">↩️ Devolver</button></td></tr>`).join('')}</tbody></table>
          </div>
          ${devs.length > 0 ? `<h4 style="margin:16px 0 8px;">Historial de Devoluciones</h4><div class="card card--no-padding"><table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Factura</th><th>Producto</th><th>Motivo</th><th style="text-align:right;">Monto</th></tr></thead><tbody class="data-table__body">${devs.slice(0, 15).map(d => `<tr><td>${fmtD(d.fecha)}</td><td>${d.factura || '-'}</td><td>${d.producto || '-'}</td><td>${d.motivo || '-'}</td><td style="text-align:right;color:var(--color-danger);font-weight:700;">C$${fmt(d.monto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        </div></div>`;
  };

  const devFromVenta = (ventaId) => {
    const v = getData('ventas').find(x => x.id === ventaId);
    if (!v || !v.items || v.items.length === 0) { alert('Venta sin productos'); return; }
    const itemList = v.items.map((it, i) => `${i + 1}. ${it.nombre} (x${it.cantidad}) - C$${fmt(it.precio * it.cantidad)}`).join('\n');
    const idx = prompt(`Factura: ${v.numero}\nProductos:\n${itemList}\n\n¿Cuál producto devolver? (número):`);
    if (!idx) return;
    const item = v.items[parseInt(idx) - 1];
    if (!item) { alert('Producto no encontrado'); return; }
    const motivo = prompt('Motivo de la devolución:') || 'Sin especificar';
    addRec('devoluciones', { factura: v.numero, producto: item.nombre, motivo, monto: item.precio * item.cantidad, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert(`✅ Devolución de "${item.nombre}" registrada`); App.render();
  };

  const filterDevSearch = (q) => {
    const el = document.getElementById('devVentasList');
    if (!el) return;
    const ventas = getData('ventas').filter(v => !q || (v.numero || '').toLowerCase().includes(q.toLowerCase()) || (v.cliente || '').toLowerCase().includes(q.toLowerCase()));
    el.innerHTML = `<table class="data-table"><thead class="data-table__head"><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th style="text-align:right;">Total</th><th>Acción</th></tr></thead><tbody class="data-table__body">${ventas.slice(0, 20).map(v => `<tr><td><strong>${v.numero}</strong></td><td>${fmtD(v.fecha)}</td><td>${v.cliente || '-'}</td><td style="text-align:right;">C$${fmt(v.total)}</td><td><button class="btn btn--ghost btn--sm" style="color:var(--color-danger);" onclick="VentasModule.devFromVenta('${v.id}')">↩️ Devolver</button></td></tr>`).join('')}</tbody></table>`;
  };

  // ========== APARTADOS ==========
  const renderApartados = () => `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('pos')" style="margin-bottom:var(--spacing-md);">${Icons.arrowLeft} Volver al POS</button>
      <div class="ventas-window"><div class="ventas-window__titlebar">📦 Productos Apartados</div>
      <div class="ventas-window__body"><div style="padding:3rem;text-align:center;color:var(--text-muted);"><div style="font-size:3rem;margin-bottom:1rem;">📦</div><h3>Productos Apartados</h3><p>Funcionalidad para apartar productos con anticipo. Próximamente disponible.</p></div></div></div>`;

  // ========== POS ACTIONS ==========
  const searchProducts = (query) => {
    clearTimeout(searchTimeout);
    const el = document.getElementById('posSearchResults');
    if (!el) return;
    if (!query || query.length < 1) { el.style.display = 'none'; return; }
    searchTimeout = setTimeout(() => {
      const prods = getProducts().filter(p => {
        const q = query.toLowerCase();
        return (p.nombre || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
      }).slice(0, 8);
      if (prods.length === 0) { el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">Sin resultados</div>'; }
      else { el.innerHTML = prods.map(p => `<div class="pos-search-result" onclick="VentasModule.addToCart('${p.id}')"><div><div class="pos-search-result__name">${p.nombre || 'Sin nombre'}</div><div class="pos-search-result__info">${p.codigo || p.sku || ''} | Stock: ${p.stock ?? p.cantidad ?? '∞'}</div></div><div class="pos-search-result__price">C$${fmt(p.precioVenta || p.precio || 0)}</div></div>`).join(''); }
      el.style.display = 'block';
    }, 200);
  };

  const addToCart = (productId) => {
    const p = getProducts().find(x => x.id === productId);
    if (!p) return;
    const existing = cart.findIndex(i => i.productId === productId);
    if (existing >= 0) { cart[existing].cantidad++; }
    else { cart.push({ productId, nombre: p.nombre || 'Producto', precio: parseFloat(p.precioVenta || p.precio || 0), costo: parseFloat(p.precioCompra || p.costo || 0), cantidad: 1, descuento: 0 }); }
    const el = document.getElementById('posSearchResults');
    if (el) el.style.display = 'none';
    const si = document.getElementById('posSearch');
    if (si) si.value = '';
    App.render();
  };

  const removeItem = (i) => { cart.splice(i, 1); App.render(); };
  const updateQty = (i, v) => { const q = parseInt(v); if (q > 0) { cart[i].cantidad = q; App.render(); } };
  const updateDiscount = (i, v) => { cart[i].descuento = parseFloat(v) || 0; App.render(); };
  const selectClient = (id) => { selectedClient = id || null; };
  const setPayment = (m) => { selectedPayment = m; App.render(); };
  const setCurrency = (c) => { selectedCurrency = c; App.render(); };
  // Fluid cash input — NO re-render, just update DOM
  const updateCashDisplay = (input) => {
    const val = parseFloat(input.value) || 0;
    cashReceived = val;
    const total = parseFloat(input.dataset.total) || 0;
    const cambio = val - total;
    const box = document.getElementById('posCambioBox');
    const recEl = document.getElementById('posCambioRecibido');
    const camEl = document.getElementById('posCambioValor');
    if (box && recEl && camEl) {
      box.style.display = val > 0 ? 'block' : 'none';
      recEl.textContent = 'C$' + fmt(val);
      camEl.textContent = 'C$' + fmt(cambio >= 0 ? cambio : 0);
      camEl.style.color = cambio >= 0 ? '#059669' : '#ef4444';
    }
  };
  // Currency counter for close-shift
  const updateContador = () => {
    const inputs = document.querySelectorAll('[data-billval]');
    const subtotals = document.querySelectorAll('.bill-subtotal');
    let totalConteo = 0;
    inputs.forEach((inp, i) => {
      const qty = parseInt(inp.value) || 0;
      const val = parseFloat(inp.dataset.billval);
      const sub = qty * val;
      totalConteo += sub;
      if (subtotals[i]) subtotals[i].textContent = 'C$' + fmt(sub);
    });
    const m = getMetrics();
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const entradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const salidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const vEfectivo = getData('ventas').filter(v => (v.fecha || '').startsWith(today()) && v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const esperado = (turnoActivo?.fondoInicial || 0) + vEfectivo + entradas - salidas;
    const diff = totalConteo - esperado;
    const realEl = document.getElementById('conteoReal');
    const diffEl = document.getElementById('conteoDiff');
    if (realEl) realEl.textContent = 'C$' + fmt(totalConteo);
    if (diffEl) { diffEl.textContent = (diff >= 0 ? '+' : '') + 'C$' + fmt(diff); diffEl.style.color = Math.abs(diff) < 0.01 ? 'var(--color-success)' : diff > 0 ? 'var(--color-warning)' : 'var(--color-danger)'; }
  };
  const clearCart = () => { cart = []; selectedClient = null; cashReceived = 0; App.render(); };

  const suspendSale = () => {
    if (cart.length === 0) return;
    suspendedSales.push({ cart: [...cart], client: selectedClient, date: new Date().toISOString() });
    cart = []; selectedClient = null; cashReceived = 0; App.render();
  };

  const recoverSale = () => {
    if (suspendedSales.length === 0) return;
    const sale = suspendedSales.pop();
    cart = sale.cart; selectedClient = sale.client; App.render();
  };

  const processPayment = () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento) * IVA_RATE;
    const total = subtotal - descuento + iva;
    if (selectedPayment === 'efectivo' && cashReceived < total) { alert('El efectivo recibido es menor al total.'); return; }
    const costoTotal = cart.reduce((s, i) => s + (i.costo * i.cantidad), 0);
    const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
    const venta = addRec('ventas', {
      numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient,
      cliente: selectedClient ? (getClients().find(c => c.id === selectedClient)?.empresa || getClients().find(c => c.id === selectedClient)?.nombreCliente || 'Cliente') : 'Público General',
      items: cart.map(i => ({ ...i })), subtotal, descuento, iva, total, costo_total: costoTotal,
      metodo: selectedPayment, efectivo_recibido: selectedPayment === 'efectivo' ? cashReceived : 0,
      cambio: selectedPayment === 'efectivo' ? Math.max(0, cashReceived - total) : 0,
      saldo_pendiente: selectedPayment === 'credito' ? total : 0,
      vendedor: user()?.name || 'N/A', estado: 'completada'
    });
    alert(`✅ Venta ${numFactura} registrada!\nTotal: C$${fmt(total)}${selectedPayment === 'efectivo' ? '\nCambio: C$' + fmt(Math.max(0, cashReceived - total)) : ''}`);
    cart = []; selectedClient = null; cashReceived = 0; App.render();
  };

  // ========== CATALOGO ==========
  const renderCatalogo = () => {
    const ventas = getData('ventas');
    return `${backBtn()}
      <div class="ventas-window"><div class="ventas-window__titlebar">${Icons.list} Catálogo de Ventas</div>
      <div class="ventas-window__body">
        <div class="ventas-filter-bar">
          <input type="date" id="filtFechaDesde" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}">
          <input type="date" id="filtFechaHasta" value="${today()}">
          <select id="filtMetodo"><option value="">Todos los métodos</option><option>efectivo</option><option>tarjeta</option><option>transferencia</option><option>credito</option></select>
          <button class="btn btn--primary btn--sm" onclick="App.render()">Filtrar</button>
        </div>
        <div class="card card--no-padding">
          ${ventas.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay ventas registradas.</div>' : `
          <table class="data-table"><thead class="data-table__head"><tr><th>N° Factura</th><th>Fecha</th><th>Cliente</th><th>Método</th><th>Vendedor</th><th style="text-align:right;">Total</th><th>Estado</th></tr></thead>
          <tbody class="data-table__body">${ventas.slice(0, 50).map(v => `<tr>
            <td><strong>${v.numero || '-'}</strong></td><td>${fmtD(v.fecha)}</td><td>${v.cliente || '-'}</td>
            <td><span class="badge badge--${v.metodo === 'efectivo' ? 'success' : v.metodo === 'credito' ? 'warning' : 'info'}" style="font-size:10px;">${v.metodo || '-'}</span></td>
            <td>${v.vendedor || '-'}</td>
            <td style="text-align:right;font-weight:700;color:var(--color-success);">C$${fmt(v.total)}</td>
            <td><span class="badge badge--${v.estado === 'completada' ? 'success' : 'warning'}">${v.estado || 'completada'}</span></td>
          </tr>`).join('')}</tbody></table>`}
        </div>
      </div></div>`;
  };

  // ========== STUB VIEWS ==========
  const stubView = (title, icon, desc) => `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${icon} ${title}</div><div class="ventas-window__body"><div style="padding:2rem;text-align:center;color:var(--text-muted);"><div style="font-size:3rem;margin-bottom:1rem;opacity:.4;">🚧</div><h3>${title}</h3><p>${desc}</p></div></div></div>`;

  const renderProductosVendidos = () => {
    const ventas = getData('ventas');
    const prodMap = {};
    ventas.forEach(v => (v.items || []).forEach(i => {
      if (!prodMap[i.nombre]) prodMap[i.nombre] = { nombre: i.nombre, cantidad: 0, total: 0, costo: 0 };
      prodMap[i.nombre].cantidad += i.cantidad;
      prodMap[i.nombre].total += i.precio * i.cantidad;
      prodMap[i.nombre].costo += (i.costo || 0) * i.cantidad;
    }));
    const prods = Object.values(prodMap).sort((a, b) => b.total - a.total);
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.package} Productos Vendidos</div>
      <div class="ventas-window__body"><div class="card card--no-padding">
        ${prods.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay datos.</div>' : `
        <table class="data-table"><thead class="data-table__head"><tr><th>Producto</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Total Venta</th><th style="text-align:right;">Costo</th><th style="text-align:right;">Ganancia</th></tr></thead>
        <tbody class="data-table__body">${prods.map(p => `<tr><td><strong>${p.nombre}</strong></td><td style="text-align:right;">${p.cantidad}</td><td style="text-align:right;">C$${fmt(p.total)}</td><td style="text-align:right;">C$${fmt(p.costo)}</td><td style="text-align:right;font-weight:700;color:${p.total - p.costo >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${fmt(p.total - p.costo)}</td></tr>`).join('')}</tbody></table>`}
      </div></div></div>`;
  };

  const renderClientes = () => {
    const clients = getClients();
    const ventas = getData('ventas');
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.users} Clientes - Información Financiera</div>
      <div class="ventas-window__body"><div class="card card--no-padding">
        <table class="data-table"><thead class="data-table__head"><tr><th>Cliente</th><th style="text-align:right;">Total Compras</th><th style="text-align:right;">Crédito Pend.</th><th>Frecuencia</th></tr></thead>
        <tbody class="data-table__body">${clients.slice(0, 30).map(c => {
      const cv = ventas.filter(v => v.clienteId === c.id);
      const totalCompras = cv.reduce((s, v) => s + parseFloat(v.total || 0), 0);
      const pendiente = cv.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.saldo_pendiente || 0), 0);
      return `<tr><td><strong>${c.empresa || c.nombreCliente || '-'}</strong></td><td style="text-align:right;">C$${fmt(totalCompras)}</td><td style="text-align:right;color:${pendiente > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">C$${fmt(pendiente)}</td><td>${cv.length} compras</td></tr>`;
    }).join('')}</tbody></table>
      </div></div></div>`;
  };

  const renderAbonos = () => {
    const creditSales = getData('ventas').filter(v => v.metodo === 'credito' && (v.saldo_pendiente || 0) > 0);
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.dollarSign} Abonos a Créditos</div>
      <div class="ventas-window__body">
        ${creditSales.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">No hay facturas con saldo pendiente.</div>' : `
        <div class="card card--no-padding"><table class="data-table"><thead class="data-table__head"><tr><th>Factura</th><th>Cliente</th><th style="text-align:right;">Total</th><th style="text-align:right;">Saldo</th><th>Progreso</th><th>Acción</th></tr></thead>
        <tbody class="data-table__body">${creditSales.map(v => {
      const pagado = parseFloat(v.total || 0) - parseFloat(v.saldo_pendiente || 0);
      const pct = v.total > 0 ? (pagado / v.total * 100) : 0;
      return `<tr><td><strong>${v.numero}</strong></td><td>${v.cliente}</td><td style="text-align:right;">C$${fmt(v.total)}</td><td style="text-align:right;color:var(--color-danger);font-weight:700;">C$${fmt(v.saldo_pendiente)}</td><td style="min-width:120px;"><div class="abono-progress"><div class="abono-progress__fill" style="width:${pct}%;background:${pct > 75 ? 'var(--color-success)' : pct > 40 ? 'var(--color-warning)' : 'var(--color-danger)'};"></div></div><span style="font-size:10px;color:var(--text-muted);">${pct.toFixed(0)}% pagado</span></td><td><button class="btn btn--primary btn--sm" onclick="VentasModule.openAbonoForm('${v.id}')">Abonar</button></td></tr>`;
    }).join('')}</tbody></table></div>`}
      </div></div>`;
  };

  const openAbonoForm = (ventaId) => {
    const v = getData('ventas').find(x => x.id === ventaId);
    if (!v) return;
    const monto = prompt(`Abonar a factura ${v.numero}\nSaldo pendiente: C$${fmt(v.saldo_pendiente)}\n\nMonto del abono:`);
    if (!monto) return;
    const amount = parseFloat(monto);
    if (isNaN(amount) || amount <= 0) { alert('Monto inválido'); return; }
    if (amount > v.saldo_pendiente) { alert('El abono excede el saldo pendiente'); return; }
    const allV = getData('ventas');
    const idx = allV.findIndex(x => x.id === ventaId);
    if (idx >= 0) { allV[idx].saldo_pendiente = (allV[idx].saldo_pendiente || 0) - amount; setData('ventas', allV); }
    addRec('abonos', { ventaId, numero: v.numero, cliente: v.cliente, monto: amount, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert(`✅ Abono de C$${fmt(amount)} registrado`); App.render();
  };

  const renderCaja = () => {
    const movs = getData('cajaMovs');
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.wallet} Entradas y Salidas de Caja</div>
      <div class="ventas-window__body">
        <button class="btn btn--primary" onclick="VentasModule.openCajaForm()" style="margin-bottom:var(--spacing-md);">${Icons.plus} Nuevo Movimiento</button>
        <div class="card card--no-padding">
          ${movs.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">Sin movimientos.</div>' : `
          <table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Tipo</th><th>Motivo</th><th>Usuario</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody class="data-table__body">${movs.slice(0, 30).map(m => `<tr><td>${fmtD(m.fecha)}</td><td><span class="badge badge--${m.tipo === 'ingreso' ? 'success' : m.tipo === 'retiro' ? 'danger' : 'warning'}">${m.tipo}</span></td><td>${m.motivo || '-'}</td><td>${m.usuario || '-'}</td><td style="text-align:right;font-weight:700;color:${m.tipo === 'ingreso' ? 'var(--color-success)' : 'var(--color-danger)'};">${m.tipo === 'ingreso' ? '+' : '-'}C$${fmt(m.monto)}</td></tr>`).join('')}</tbody></table>`}
        </div>
      </div></div>`;
  };

  const openCajaForm = () => {
    const tipo = prompt('Tipo de movimiento:\n1 = Ingreso\n2 = Retiro\n3 = Ajuste');
    if (!tipo) return;
    const tipos = { '1': 'ingreso', '2': 'retiro', '3': 'ajuste' };
    const t = tipos[tipo];
    if (!t) { alert('Opción inválida'); return; }
    const motivo = prompt('Motivo del movimiento:');
    const monto = parseFloat(prompt('Monto (C$):'));
    if (isNaN(monto) || monto <= 0) { alert('Monto inválido'); return; }
    addRec('cajaMovs', { tipo: t, motivo, monto, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert('✅ Movimiento registrado'); App.render();
  };

  const renderReimpresion = () => {
    const ventas = getData('ventas');
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.printer} Reimpresión de Documentos</div>
      <div class="ventas-window__body">
        <div class="ventas-filter-bar"><input type="text" placeholder="Buscar por N° factura o cliente..." id="reimpSearch" oninput="App.render()"></div>
        <div class="card card--no-padding">
          <table class="data-table"><thead class="data-table__head"><tr><th>N° Factura</th><th>Fecha</th><th>Cliente</th><th style="text-align:right;">Total</th><th>Acción</th></tr></thead>
          <tbody class="data-table__body">${ventas.slice(0, 20).map(v => `<tr><td><strong>${v.numero}</strong></td><td>${fmtD(v.fecha)}</td><td>${v.cliente}</td><td style="text-align:right;">C$${fmt(v.total)}</td><td><button class="btn btn--ghost btn--sm" onclick="alert('Imprimiendo ${v.numero}...')">${Icons.printer} Reimprimir</button></td></tr>`).join('')}</tbody></table>
        </div></div></div>`;
  };

  const renderCotizaciones = () => stubView('Cotizaciones / Proformas', Icons.fileText, 'Cree cotizaciones y conviértalas en ventas. Administre desde el módulo de Proformas.');

  const renderCortes = () => {
    const m = getMetrics();
    const cortes = getData('cortes');
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.calculator} Cortes de Caja</div>
      <div class="ventas-window__body">
        <div class="corte-summary" style="margin-bottom:var(--spacing-lg);">
          <div class="corte-summary__item"><div class="corte-summary__label">Ventas del Día</div><div class="corte-summary__value" style="color:var(--color-success);">C$${fmt(m.totalDia)}</div></div>
          <div class="corte-summary__item"><div class="corte-summary__label">Total en Caja</div><div class="corte-summary__value" style="color:var(--color-primary-500);">C$${fmt(m.totalCaja)}</div></div>
          <div class="corte-summary__item"><div class="corte-summary__label">Facturas Emitidas</div><div class="corte-summary__value">${m.facturasHoy}</div></div>
          <div class="corte-summary__item"><div class="corte-summary__label">Ganancia del Día</div><div class="corte-summary__value" style="color:${m.totalDia - (m.ventasDia || []).reduce((s, v) => s + parseFloat(v.costo_total || 0), 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${fmt(m.totalDia - (m.ventasDia || []).reduce((s, v) => s + parseFloat(v.costo_total || 0), 0))}</div></div>
        </div>
        <button class="btn btn--primary" onclick="VentasModule.doCorteCaja()" style="margin-bottom:var(--spacing-md);">${Icons.check} Realizar Corte de Caja</button>
        ${cortes.length > 0 ? `<div class="card card--no-padding"><table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Ventas</th><th style="text-align:right;">Total</th><th>Usuario</th></tr></thead><tbody class="data-table__body">${cortes.slice(0, 10).map(c => `<tr><td>${fmtD(c.fecha)}</td><td>${c.num_ventas}</td><td style="text-align:right;font-weight:700;">C$${fmt(c.total)}</td><td>${c.usuario}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div></div>`;
  };

  const doCorteCaja = () => {
    const m = getMetrics();
    if (confirm(`¿Realizar corte de caja?\nTotal ventas: C$${fmt(m.totalDia)}\nFacturas: ${m.facturasHoy}`)) {
      addRec('cortes', { fecha: new Date().toISOString(), total: m.totalDia, num_ventas: m.facturasHoy, total_caja: m.totalCaja, usuario: user()?.name || 'N/A' });
      alert('✅ Corte de caja realizado'); App.render();
    }
  };

  const renderDevoluciones = () => {
    const devs = getData('devoluciones');
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.refreshCw} Devoluciones</div>
      <div class="ventas-window__body">
        <button class="btn btn--primary" style="background:var(--color-danger);border-color:var(--color-danger);margin-bottom:var(--spacing-md);" onclick="VentasModule.openDevolucionForm()">${Icons.plus} Nueva Devolución</button>
        <div class="card card--no-padding">
          ${devs.length === 0 ? '<div style="padding:3rem;text-align:center;color:var(--text-muted);">Sin devoluciones.</div>' : `
          <table class="data-table"><thead class="data-table__head"><tr><th>Fecha</th><th>Factura</th><th>Producto</th><th>Motivo</th><th>Usuario</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody class="data-table__body">${devs.map(d => `<tr><td>${fmtD(d.fecha)}</td><td>${d.factura || '-'}</td><td>${d.producto || '-'}</td><td>${d.motivo || '-'}</td><td>${d.usuario || '-'}</td><td style="text-align:right;color:var(--color-danger);font-weight:700;">C$${fmt(d.monto)}</td></tr>`).join('')}</tbody></table>`}
        </div></div></div>`;
  };

  const openDevolucionForm = () => {
    const factura = prompt('N° de factura original:');
    if (!factura) return;
    const producto = prompt('Producto devuelto:');
    const motivo = prompt('Motivo de la devolución:');
    const monto = parseFloat(prompt('Monto de devolución (C$):'));
    if (isNaN(monto) || monto <= 0) { alert('Monto inválido'); return; }
    addRec('devoluciones', { factura, producto, motivo, monto, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert('✅ Devolución registrada'); App.render();
  };

  const renderReportes = () => {
    const m = getMetrics();
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.barChart} Reportes de Ventas</div>
      <div class="ventas-window__body">
        <div class="ventas-stats-row">
          <div class="ventas-stat-card"><div class="ventas-stat-card__label">Ventas Hoy</div><div class="ventas-stat-card__value" style="color:var(--color-success);">C$${fmt(m.totalDia)}</div></div>
          <div class="ventas-stat-card"><div class="ventas-stat-card__label">Ventas Mes</div><div class="ventas-stat-card__value" style="color:var(--color-primary-500);">C$${fmt(m.totalMes)}</div></div>
          <div class="ventas-stat-card"><div class="ventas-stat-card__label">Facturas Hoy</div><div class="ventas-stat-card__value">${m.facturasHoy}</div></div>
          <div class="ventas-stat-card"><div class="ventas-stat-card__label">Ganancia Bruta</div><div class="ventas-stat-card__value" style="color:${m.gananciaB >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">C$${fmt(m.gananciaB)}</div></div>
        </div>
        <div class="card"><div class="card__body" style="color:var(--text-muted);text-align:center;padding:2rem;">📊 Los reportes detallados con exportación a PDF/Excel estarán disponibles próximamente.</div></div>
      </div></div>`;
  };

  const renderGanancias = () => {
    const m = getMetrics();
    const margen = m.totalMes > 0 ? ((m.gananciaB / m.totalMes) * 100) : 0;
    return `${backBtn()}<div class="ventas-window"><div class="ventas-window__titlebar">${Icons.trendingUp} Análisis de Ganancias</div>
      <div class="ventas-window__body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--spacing-md);margin-bottom:var(--spacing-lg);">
          <div class="ganancia-card" style="border-left-color:var(--color-primary-500);"><div class="ganancia-card__title">Ingresos por Ventas</div><div class="ganancia-card__value" style="color:var(--color-primary-500);">C$${fmt(m.totalMes)}</div></div>
          <div class="ganancia-card" style="border-left-color:var(--color-danger);"><div class="ganancia-card__title">Costo de Productos</div><div class="ganancia-card__value" style="color:var(--color-danger);">C$${fmt(m.costoTotal)}</div></div>
          <div class="ganancia-card" style="border-left-color:var(--color-success);"><div class="ganancia-card__title">Ganancia Bruta</div><div class="ganancia-card__value" style="color:var(--color-success);">C$${fmt(m.gananciaB)}</div></div>
          <div class="ganancia-card" style="border-left-color:var(--color-warning);"><div class="ganancia-card__title">Margen de Ganancia</div><div class="ganancia-card__value" style="color:var(--color-warning);">${margen.toFixed(1)}%</div></div>
        </div>
      </div></div>`;
  };

  // ========== KEYBOARD SHORTCUTS ==========
  const handleKeyboard = (e) => {
    if (currentView !== 'pos') return;
    if (e.key === 'F2') { e.preventDefault(); document.getElementById('posSearch')?.focus(); }
    if (e.key === 'F3') { e.preventDefault(); navigateTo('consultor-precios'); }
    if (e.key === 'F5') { e.preventDefault(); clearCart(); }
    if (e.key === 'F8') { e.preventDefault(); suspendSale(); }
    if (e.key === 'F9') { e.preventDefault(); navigateTo('pos-devoluciones'); }
    if (e.key === 'Escape') { e.preventDefault(); processPayment(); }
  };

  document.addEventListener('keydown', handleKeyboard);

  // ========== PUBLIC API ==========
  return {
    render, navigateTo, searchProducts, addToCart, removeItem, updateQty, updateDiscount,
    selectClient, setPayment, updateCashDisplay, setCurrency, clearCart, suspendSale, recoverSale, processPayment,
    openAbonoForm, openCajaForm, doCorteCaja, openDevolucionForm,
    openTurno, closeTurno, confirmCloseTurno, updateContador,
    filterPriceList, devFromVenta, filterDevSearch
  };
})();

window.VentasModule = VentasModule;
console.log('✅ Módulo de Ventas cargado correctamente');
