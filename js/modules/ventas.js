/**
 * ALLTECH - Módulo de Ventas (POS)
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
  let posOverlayOpen = false;
  let posMinimized = false;
  let posSubView = 'pos';
  let selectedCartRow = -1;
  let posComment = '';
  let globalDiscount = 0;
  let posOpenModal = null;
  let posActionModal = null; // For small action modals instead of prompts
  let posActionData = null;
  let posSelectedConfigIdx = 0;
  let posSelectedPriceList = '';
  let posTarjetaModo = 'cobrar'; // 'cobrar' o 'asumir'

  const getPosDataUncached = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };

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


  const navigateSidebar = (v) => {
    if (v === 'entrada-caja') { posActionModal = 'entrada'; posActionData = null; App.render(); return; }
    if (v === 'salida-caja') { posActionModal = 'salida'; posActionData = null; App.render(); return; }
    if (v === 'pos-clientes') { posOpenModal = 'clientes'; App.render(); return; }
    if (v === 'pos-sucursal') { alert('Funcionalidad de Consulta Sucursal en desarrollo.'); return; }
    if (v === 'catalogo') { posOpenModal = 'catalogo'; App.render(); return; }
    if (v === 'pos-devoluciones') { posOpenModal = 'devoluciones'; App.render(); return; }
    if (v === 'consultor-precios') { posOpenModal = 'consultor-precios'; App.render(); return; }
    if (v === 'pos') { posOpenModal = null; posSubView = 'pos'; App.render(); return; }
    navigateTo(v);
  };

  const navigateTo = (v) => {
    if (['pos', 'consultor-precios', 'pos-devoluciones', 'apartados', 'cotizaciones', 'cerrar-turno'].includes(v)) {
      posSubView = v;
      if (!posOverlayOpen) { posOverlayOpen = true; posMinimized = false; }
      renderPOSOverlay();
      return;
    }
    currentView = v;
    App.render();
  };

  const openPOSOverlay = () => { posOverlayOpen = true; posMinimized = false; posSubView = 'pos'; renderPOSOverlay(); };
  const closePOSOverlay = () => {
    if (cart.length > 0 && !confirm('¿Cerrar el Punto de Venta? Los productos en el carrito se mantendrán.')) return;
    posOverlayOpen = false; posMinimized = false; removePOSOverlay();
  };
  const restorePOS = () => { posMinimized = false; const overlay = document.getElementById('posOverlay'); if (overlay) overlay.classList.remove('pos-overlay--minimized'); removeTaskbarIndicator(); renderPOSOverlay(); };
  const removePOSOverlay = () => { const overlay = document.getElementById('posOverlay'); if (overlay) overlay.remove(); removeTaskbarIndicator(); };
  const renderTaskbarIndicator = () => {
    removeTaskbarIndicator();
    const ind = document.createElement('div'); ind.id = 'posTaskbarIndicator'; ind.className = 'pos-taskbar-indicator';
    ind.innerHTML = `<button class="pos-taskbar-btn" onclick="VentasModule.restorePOS()"><span class="pos-taskbar-btn__icon">🛒</span><span class="pos-taskbar-btn__label">Punto de Venta</span>${cart.length > 0 ? `<span class="pos-taskbar-btn__badge">${cart.length}</span>` : ''}</button>`;
    document.body.appendChild(ind);
  };
  const removeTaskbarIndicator = () => { const el = document.getElementById('posTaskbarIndicator'); if (el) el.remove(); };

  const renderPOSOverlay = () => {
    if (!posOverlayOpen || posMinimized) return;
    let overlay = document.getElementById('posOverlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'posOverlay'; overlay.className = 'pos-overlay'; document.body.appendChild(overlay); }

    const activeEl = document.activeElement;
    let focusData = null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      focusData = { id: activeEl.id, className: activeEl.className, s: activeEl.selectionStart, e: activeEl.selectionEnd };
    }

    const posViews = { pos: renderPOS, 'consultor-precios': renderConsultorPrecios, 'pos-devoluciones': renderPOSDevoluciones, apartados: renderApartados, cotizaciones: renderCotizaciones, 'cerrar-turno': renderCerrarTurno };
    const content = (posViews[posSubView] || renderPOS)();
    overlay.innerHTML = `<div class="pos-overlay__titlebar"><div class="pos-overlay__titlebar-left"><span class="pos-overlay__titlebar-icon">🛒</span><span class="pos-overlay__titlebar-title">ALLTECH - Punto de Venta</span></div><div class="pos-overlay__titlebar-right"><button class="pos-overlay__titlebar-btn" onclick="VentasModule.showShortcutsHelp()" title="Atajos (F1)">❓</button><button class="pos-overlay__titlebar-btn pos-overlay__titlebar-btn--close" onclick="VentasModule.closePOSOverlay()">✕</button></div></div><div class="pos-overlay__body">${content}</div>`;
    removeTaskbarIndicator();

    if (focusData) {
      let currEl = null;
      if (focusData.id) currEl = document.getElementById(focusData.id);
      else if (focusData.className && focusData.className.trim()) {
        try { currEl = overlay.querySelector('.' + focusData.className.trim().split(/\s+/).join('.')); } catch (e) { }
      }
      if (currEl) {
        setTimeout(() => {
          currEl.focus();
          if (focusData.s !== null && focusData.s !== undefined) {
            try { currEl.setSelectionRange(focusData.s, focusData.e); } catch (ex) { }
          }
        }, 50);
        return;
      }
    }

    if (!posOpenModal) setTimeout(() => document.getElementById('posSearch')?.focus(), 100);
  };

  const openTurno = () => {
    const fondo = prompt('💰 ¿Con cuánto efectivo inicia caja? (C$)');
    if (!fondo) return;
    const amount = parseFloat(fondo);
    if (isNaN(amount) || amount < 0) { alert('Monto inválido'); return; }
    const numTurno = getData('cortes').length + 1;
    turnoActivo = { numero: numTurno, fondoInicial: amount, apertura: new Date().toISOString(), usuario: user()?.name || 'N/A', ventas: 0, totalVentas: 0 };
    localStorage.setItem('vnt_turno', JSON.stringify(turnoActivo));
    posSubView = 'pos'; openPOSOverlay();
  };
  const closeTurno = () => { posSubView = 'cerrar-turno'; renderPOSOverlay(); };
  const confirmCloseTurno = () => {
    if (!turnoActivo) return;
    const m = getMetrics();
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const entradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const salidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    addRec('cortes', { fecha: new Date().toISOString(), fondo_inicial: turnoActivo.fondoInicial, total_ventas: m.totalDia, entradas, salidas, total_caja: turnoActivo.fondoInicial + m.totalDia + entradas - salidas, num_ventas: m.facturasHoy, usuario: turnoActivo.usuario });
    turnoActivo = null; localStorage.removeItem('vnt_turno'); cart = []; cashReceived = 0;
    alert('✅ Turno cerrado exitosamente');
    closePOSOverlay(); currentView = 'dashboard'; App.render();
  };

  const render = () => {
    const views = { dashboard: renderDashboard, catalogo: renderCatalogo, 'productos-vendidos': renderProductosVendidos, clientes: renderClientes, abonos: renderAbonos, reimpresion: renderReimpresion, cortes: renderCortes, devoluciones: renderDevoluciones, reportes: renderReportes, ganancias: renderGanancias };
    const html = (views[currentView] || renderDashboard)();
    if (posOverlayOpen && !posMinimized) setTimeout(() => renderPOSOverlay(), 50); else if (posOverlayOpen && posMinimized) setTimeout(() => renderTaskbarIndicator(), 50);
    return html;
  };

  const tile = (id, icon, name, desc, color, bg, badge) => `<div class="ventas-tile" onclick="${(id === 'abrir-entrada' || id === 'abrir-salida') ? `VentasModule.navigateSidebar('${id.replace('abrir-', '') + '-caja'}')` : `VentasModule.navigateTo('${id}')`}">
    <div class="ventas-tile__icon" style="background:${bg};color:${color};">${icon}</div><div class="ventas-tile__name">${name}</div><div class="ventas-tile__desc">${desc}</div><div class="ventas-tile__badge" style="background:${bg};color:${color};">${badge}</div></div>`;
  const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">⬅ Volver al Panel</button>`;


  const renderDashboard = () => {
    const m = getMetrics();
    const devs = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today())).length;
    return `
      <div class="ventas-header"><div class="ventas-header__title">${Icons.shoppingCart} Módulo de Ventas</div>
        <div class="ventas-kpis">
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('pos')"><div class="ventas-kpi__label">Ventas del Día</div><div class="ventas-kpi__value" style="color:#34d399;">C$${fmt(m.totalDia)}</div><div class="ventas-kpi__sub">${m.facturasHoy} facturas</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('catalogo')"><div class="ventas-kpi__label">Ventas del Mes</div><div class="ventas-kpi__value" style="color:#60a5fa;">C$${fmt(m.totalMes)}</div><div class="ventas-kpi__sub">Acumulado</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('caja')"><div class="ventas-kpi__label">Total en Caja</div><div class="ventas-kpi__value" style="color:#fbbf24;">C$${fmt(m.totalCaja)}</div><div class="ventas-kpi__sub">Disponible</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('ganancias')"><div class="ventas-kpi__label">Ganancia Bruta</div><div class="ventas-kpi__value" style="color:${m.gananciaB >= 0 ? '#34d399' : '#f87171'};">C$${fmt(m.gananciaB)}</div><div class="ventas-kpi__sub">${m.gananciaB >= 0 ? '✅' : '⚠️'} Mes actual</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('abonos')"><div class="ventas-kpi__label">Créditos Pend.</div><div class="ventas-kpi__value" style="color:#a78bfa;">${getData('ventas').filter(v => v.metodo === 'credito' && v.saldo_pendiente > 0).length}</div><div class="ventas-kpi__sub">Facturas</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('devoluciones')"><div class="ventas-kpi__label">Devoluciones</div><div class="ventas-kpi__value" style="color:#f472b6;">${devs}</div><div class="ventas-kpi__sub">Hoy</div></div>
        </div>
      </div>
      <div class="ventas-grid">
        <div class="ventas-tile ventas-tile--pos" onclick="VentasModule.openPOSOverlay()"><div class="ventas-tile__icon" style="background:#ecfdf5;color:#059669;">${Icons.shoppingCart}</div><div class="ventas-tile__name">Punto de Venta</div><div class="ventas-tile__desc">POS rápido con atajos</div><div class="ventas-tile__badge" style="background:#ecfdf5;color:#059669;">F12 - Abrir</div></div>
        ${tile('catalogo', Icons.list, 'Catálogo de Ventas', 'Historial completo', '#3b82f6', '#eff6ff', m.ventasMes.length + ' ventas')}
        ${tile('productos-vendidos', Icons.package, 'Productos Vendidos', 'Análisis de rotación', '#8b5cf6', '#f5f3ff', 'Analítica')}
        ${tile('clientes', Icons.users, 'Clientes', 'Créditos y saldos', '#0ea5e9', '#f0f9ff', getClients().length + ' clientes')}
        ${tile('abonos', Icons.dollarSign, 'Abonos', 'Pagos a créditos', '#10b981', '#ecfdf5', 'Registrar')}
        ${tile('reimpresion', Icons.printer, 'Reimpresión', 'Tickets y facturas', '#6366f1', '#eef2ff', 'Buscar')}
        ${tile('cortes', Icons.calculator, 'Cortes de Caja', 'Cierre y arqueo', '#ec4899', '#fdf2f8', 'Corte')}
        ${tile('abrir-entrada', Icons.download, 'Entrada de Efectivo', 'Añadir a caja', '#34d399', '#ecfdf5', 'Ingreso')}
        ${tile('abrir-salida', Icons.upload, 'Salida de Efectivo', 'Retiro de caja', '#f87171', '#fef2f2', 'Egreso')}
        ${tile('devoluciones', Icons.refreshCw, 'Devoluciones', 'Gestión de retornos', '#ef4444', '#fef2f2', devs + ' hoy')}
        ${tile('reportes', Icons.barChart, 'Reportes', 'Estadísticas avanzadas', '#6366f1', '#eef2ff', 'Exportar')}
        ${tile('ganancias', Icons.trendingUp, 'Ganancias', 'Márgenes y rentabilidad', '#059669', '#ecfdf5', 'C$' + fmt(m.gananciaB))}
      </div>`;
  };

  const selectCartRow = (i) => { selectedCartRow = i; highlightCartRow(); App.render(); };

  const renderPOS = () => {
    if (!turnoActivo) return renderOpenTurno();
    const clients = getClients();
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    const currSymbol = selectedCurrency === 'USD' ? '$' : 'C$';

    const displayedClientName = selectedClient ? (clients.find(c => c.id === selectedClient)?.empresa || clients.find(c => c.id === selectedClient)?.nombreCliente) : 'Público General';

    return `
      <div style="display:grid;grid-template-columns:64px 1fr 340px;grid-template-rows: auto 1fr;height:calc(100vh - var(--header-height) - 20px);border-radius:var(--border-radius-lg);overflow:hidden;border:1px solid var(--border-color);box-shadow:var(--shadow-lg);background:var(--bg-secondary);">
        
        <!-- Sidebar -->
        <div style="grid-column: 1; grid-row: 1 / 3; background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;overflow-y:auto;z-index:2;border-right:1px solid rgba(255,255,255,0.05);">
          ${[
        { id: 'pos-clientes', icon: '👥', label: 'Clientes', key: 'Alt+C' },
        { id: 'consultor-precios', icon: '🔍', label: 'Consultar', key: 'F3' },
        { id: 'pos-sucursal', icon: '🏢', label: 'P. Sucursal', key: 'Alt+U' },
        { id: '---' },
        { id: 'entrada-caja', icon: '📥', label: 'Entradas', key: 'Alt+E' },
        { id: 'salida-caja', icon: '📤', label: 'Salidas', key: 'Alt+S' },
        { id: '---' },
        { id: 'catalogo', icon: '📄', label: 'Ventas', key: 'Alt+V' },
        { id: 'cotizaciones', icon: '📋', label: 'Cotización', key: '' },
        { id: 'pos-devoluciones', icon: '↩️', label: 'Devolución', key: 'F9' },
      ].map(b => b.id === '---'
        ? '<div style="width:36px;height:1px;background:rgba(255,255,255,0.15);margin:4px 0;"></div>'
        : `<button onclick="VentasModule.navigateSidebar('${b.id}')" style="background:${posSubView === b.id ? 'rgba(56,189,248,.2)' : 'transparent'};border:none;color:white;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:56px;font-size:10px;transition:all .15s;" title="${b.label}${b.key ? ' (' + b.key + ')' : ''}">
            <span style="font-size:25px;">${b.icon}</span><span style="text-align:center;word-break:keep-all;font-size:10px;">${b.label}</span>${b.key ? `<span style="font-size:9px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;white-space:nowrap;">${b.key}</span>` : ''}</button>`
      ).join('')}
          <div style="flex:1;"></div>
          ${suspendedSales.length > 0 ? `<button onclick="VentasModule.recoverSale()" style="background:rgba(251,191,36,.2);border:none;color:#fbbf24;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:56px;font-size:10px;" title="Recuperar venta (F10)"><span style="font-size:25px;">⏸️</span><span>Espera(${suspendedSales.length})</span><span style="font-size:9px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">F10</span></button>` : ''}
          <button onclick="VentasModule.closeTurno()" style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:56px;font-size:10px;margin-bottom:4px;" title="Cerrar turno (F11)"><span style="font-size:25px;">🔒</span><span>Cerrar</span><span style="font-size:9px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">F11</span></button>
        </div>
        
        <!-- Client Bar (Spans Middle) -->
        <div class="pos-client-bar" style="grid-column: 2; grid-row: 1; display:flex;align-items:center;gap:12px;padding:8px 16px;height:48px;box-sizing:border-box;background:#0f172a;color:white;border-bottom:1px solid rgba(255,255,255,0.05);z-index:1;">
          <span class="pos-client-bar__label" style="color:#e2e8f0;font-weight:800;">${Icons.user} Cliente:</span>
          <div style="position:relative;flex:1;">
             <input type="text" id="posClientSearch" class="form-input" placeholder="Buscar cliente..." value="${selectedClient ? displayedClientName : ''}" oninput="VentasModule.searchClientsCombo(this.value)" autocomplete="off" onfocus="this.select()" style="padding:4px 8px;font-size:12px;height:24px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);">
             <div id="posClientResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;color:#333;border:1px solid var(--border-color);border-radius:4px;max-height:150px;overflow-y:auto;z-index:200;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>
          </div>
            <button class="btn btn--ghost btn--sm" onclick="VentasModule.openPosNewClientModal()" style="padding:4px;height:24px;font-size:11px;background:rgba(255,255,255,0.1);color:white;border:none;" title="Alt+N">+ Nuevo <kbd style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;">Alt+N</kbd></button>
            <span style="margin-left:auto;font-size:12px;font-weight:700;color:#e2e8f0;">Precio:</span>
            <select onchange="VentasModule.setPriceList(this.value)" style="width:100px;padding:2px 4px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:12px;background:#1e293b;color:white;">
              <option value="">Público</option>
              ${getPosDataUncached('pos_listas_precios').map(p => `<option value="${p.codigoPrecio}" ${posSelectedPriceList === p.codigoPrecio ? 'selected' : ''}>${p.nombrePrecio}</option>`).join('')}
            </select>
            <span style="margin-left:8px;font-size:12px;font-weight:700;color:#e2e8f0;">Moneda:</span>
            <select onchange="VentasModule.setCurrency(this.value)" style="width:75px;padding:2px 4px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:12px;background:#1e293b;color:white;">
              <option value="NIO" ${selectedCurrency === 'NIO' ? 'selected' : ''}>C$ NIO</option>
              <option value="USD" ${selectedCurrency === 'USD' ? 'selected' : ''}>$ USD</option>
            </select>
            <span style="margin-left:8px;font-size:11px;opacity:.8;font-weight:700;color:#e2e8f0;">Turno: #${turnoActivo.numero || 1} | ${turnoActivo.usuario}</span>
        </div>

        <!-- Middle Column -->
        <div style="grid-column: 2; grid-row: 2; display:flex;flex-direction:column;border-right:1px solid var(--border-color);overflow:hidden;position:relative;background:var(--bg-secondary);">
          <div class="pos-toolbar" style="height:54px;box-sizing:border-box;border-bottom:1px solid var(--border-color);padding:8px 12px;display:flex;align-items:center;gap:8px;">
            <div class="pos-toolbar__search" style="position:relative;flex:1;">
              <span class="pos-toolbar__search-icon">${Icons.search}</span>
              <input type="text" id="posSearch" placeholder="Buscar producto por nombre o código (F2)" oninput="VentasModule.searchProducts(this.value)" autocomplete="off">
              <div id="posSearchResults" style="display:none;" class="pos-search-results"></div>
            </div>
            <button onclick="VentasModule.suspendSale()" ${cart.length === 0 ? 'disabled' : ''} style="background:${cart.length === 0 ? '#f1f5f9' : '#fef3c7'}; color:${cart.length === 0 ? '#94a3b8' : '#d97706'}; font-weight:800; border-radius:8px; border:none; padding:8px 12px; font-size:12px; gap:8px; display:flex; align-items:center; transition:all 0.2s; cursor:${cart.length === 0 ? 'not-allowed' : 'pointer'};" onmouseover="${cart.length > 0 ? 'this.style.boxShadow=\\\'0 2px 4px rgba(217, 119, 6, 0.2)\\\'; this.style.transform=\\\'translateY(-1px)\\\'' : ''}" onmouseout="${cart.length > 0 ? 'this.style.boxShadow=\\\'none\\\'; this.style.transform=\\\'translateY(0)\\\'' : ''}">
              <span>⏸️ Espera</span> <kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:10px;">F8</kbd>
            </button>
            <button onclick="VentasModule.clearCart()" style="background:#fee2e2; color:#b91c1c; font-weight:800; border-radius:8px; border:none; padding:8px 12px; font-size:12px; display:flex; align-items:center; gap:8px; transition:all 0.2s; cursor:pointer;" onmouseover="this.style.boxShadow='0 2px 4px rgba(220, 38, 38, 0.2)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='none'; this.style.transform='translateY(0)'">
              <span>🗑️ Limpiar</span> <kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:10px;">F5</kbd>
            </button>
          </div>
          
          <div class="pos-items" id="posItemsContainer" style="flex:1;overflow-y:auto;position:relative;">
            <div style="position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center; z-index:0; opacity:0.15;">
               <img src="${(typeof State !== 'undefined' && State.get('companyConfig') && State.get('companyConfig').logoUrl) ? State.get('companyConfig').logoUrl : 'assets/logo.png'}" style="width:auto; max-width:60%; max-height:60%; object-fit:contain;" onerror="this.style.display='none'">
            </div>
            ${cart.length === 0 ? `<div class="pos-items__empty" style="position:relative; z-index:1;"><div class="pos-items__empty-icon">🛒</div><p>Busque un producto o escanee un código</p></div>` : `
            <table style="position:relative; z-index:1; background:transparent;"><thead><tr><th>C. Barras</th><th>Cant.</th><th>Nombre de producto</th><th>TP</th><th>P.Unit</th><th>Descuento</th><th style="text-align:right;">Total</th></tr></thead>
              <tbody>${cart.map((item, i) => `
                <tr class="pos-cart-row ${selectedCartRow === i ? 'pos-cart-row--selected' : ''}" data-row="${i}" onclick="VentasModule.selectCartRow(${i})" style="cursor:pointer;">
                  <td>${item.codigo || item.sku || '-'}</td>
                  <td><strong style="font-size:14px;">${item.cantidad}</strong></td>
                  <td style="line-height:1.2;"><strong>${item.nombre}</strong><div style="display:flex;gap:4px;margin-top:2px;">${item.saleGranel ? `<span style="background:#d1fae5;color:#059669;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">⚖ Granel</span>` : ''}${item.serial ? `<span style="background:#e0f2fe;color:#0284c7;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">S/N: ${item.serial}</span>` : ''}</div></td>
                  <td>${posSelectedPriceList || 'Público'}</td>
                  <td>${currSymbol}${fmt(item.precio)}</td>
                  <td style="${(item.descuento > 0) ? 'color:var(--color-danger);font-weight:700;' : ''}">${item.descuento > 0 ? '-' + currSymbol + fmt(item.descuento) : '-'}</td>
                  <td style="text-align:right;font-weight:700;">${currSymbol}${fmt(item.precio * item.cantidad - (item.descuento || 0))}</td>
                </tr>
              `).join('')}</tbody>
            </table>`}
          </div>

          ${suspendedSales.length > 0 ? `
          <div style="display:flex; gap:6px; padding:12px 16px 0 16px; overflow-x:auto; background:var(--bg-primary); border-top:1px solid var(--border-color); scrollbar-width:none;">
            ${suspendedSales.map((s, i) => `
              <div onclick="VentasModule.recoverSaleFromTab(${i})" style="cursor:pointer; padding:8px 16px; background:var(--bg-secondary); border:2px solid var(--color-primary-200); border-bottom:none; border-radius:8px 8px 0 0; font-size:11px; font-weight:800; color:var(--text-primary); white-space:nowrap; display:flex; align-items:center; gap:8px; transition:all 0.2s; box-shadow:0 -2px 6px rgba(0,0,0,0.02); margin-top:2px;" onmouseover="this.style.background='var(--color-primary-50)'" onmouseout="this.style.background='var(--bg-secondary)'">
                <span style="font-size:13px; color:var(--color-primary-600);">⏸️ Factura ${i + 1}</span>
                <span style="background:var(--bg-primary); color:var(--color-primary-700); border:1px solid var(--border-color); border-radius:12px; padding:2px 8px; font-size:10px; font-weight:900;">${s.cart.length} ítem${s.cart.length !== 1 ? 's' : ''}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div style="display:flex;gap:8px;padding:12px;background:var(--bg-primary);${suspendedSales.length === 0 ? 'border-top:1px solid var(--border-color);' : 'border-top:1px solid transparent; box-shadow:0 -1px 0 var(--border-color);'}align-items:center;">
            <button onclick="VentasModule.modifySelectedAction('qty')" ${selectedCartRow < 0 ? 'disabled' : ''} style="flex:1; border:none; background:${selectedCartRow < 0 ? '#f1f5f9' : '#e0f2fe'}; color:${selectedCartRow < 0 ? '#94a3b8' : '#0369a1'}; padding:10px 4px; border-radius:10px; font-weight:800; font-size:11px; cursor:${selectedCartRow < 0 ? 'not-allowed' : 'pointer'}; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all 0.2s;" onmouseover="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(-2px)\\\'; this.style.boxShadow=\\\'0 4px 6px -1px rgba(14, 165, 233, 0.2)\\\'' : ''}" onmouseout="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(0)\\\'; this.style.boxShadow=\\\'none\\\'' : ''}">
              <span>📏 CANTIDAD</span><kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:9px;">F4</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('del')" ${selectedCartRow < 0 ? 'disabled' : ''} style="flex:1; border:none; background:${selectedCartRow < 0 ? '#f1f5f9' : '#fee2e2'}; color:${selectedCartRow < 0 ? '#94a3b8' : '#b91c1c'}; padding:10px 4px; border-radius:10px; font-weight:800; font-size:11px; cursor:${selectedCartRow < 0 ? 'not-allowed' : 'pointer'}; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all 0.2s;" onmouseover="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(-2px)\\\'; this.style.boxShadow=\\\'0 4px 6px -1px rgba(220, 38, 38, 0.2)\\\'' : ''}" onmouseout="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(0)\\\'; this.style.boxShadow=\\\'none\\\'' : ''}">
              <span>🗑️ ELIMINAR</span><kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:9px;">Del</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('disc')" ${selectedCartRow < 0 ? 'disabled' : ''} style="flex:1; border:none; background:${selectedCartRow < 0 ? '#f1f5f9' : '#fae8ff'}; color:${selectedCartRow < 0 ? '#94a3b8' : '#86198f'}; padding:10px 4px; border-radius:10px; font-weight:800; font-size:11px; cursor:${selectedCartRow < 0 ? 'not-allowed' : 'pointer'}; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all 0.2s;" onmouseover="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(-2px)\\\'; this.style.boxShadow=\\\'0 4px 6px -1px rgba(168, 85, 247, 0.2)\\\'' : ''}" onmouseout="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(0)\\\'; this.style.boxShadow=\\\'none\\\'' : ''}">
              <span>🏷️ DESC.</span><kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:9px;">F6</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('price')" ${selectedCartRow < 0 ? 'disabled' : ''} style="flex:1; border:none; background:${selectedCartRow < 0 ? '#f1f5f9' : '#ffedd5'}; color:${selectedCartRow < 0 ? '#94a3b8' : '#c2410c'}; padding:10px 4px; border-radius:10px; font-weight:800; font-size:11px; cursor:${selectedCartRow < 0 ? 'not-allowed' : 'pointer'}; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all 0.2s;" onmouseover="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(-2px)\\\'; this.style.boxShadow=\\\'0 4px 6px -1px rgba(234, 88, 12, 0.2)\\\'' : ''}" onmouseout="${selectedCartRow >= 0 ? 'this.style.transform=\\\'translateY(0)\\\'; this.style.boxShadow=\\\'none\\\'' : ''}">
              <span>💵 PRECIO</span><kbd style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-size:9px;">F7</kbd>
            </button>
          </div>
        </div>
        <!-- Right Column (Sidebar) -->
        <div style="grid-column: 3; grid-row: 1 / 3; display:flex;flex-direction:column;background:var(--bg-primary);height:100%;overflow:hidden;border-left:1px solid rgba(255,255,255,0.05);">
          
          <!-- Top Scrollable Area: Logo and Carousel -->
          <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;">            
            <!-- Logo de la empresa en la parte superior derecha (igual a la altura de la bar de cliente 48px + busqueda 54px = 102px) -->
            <div id="posLogoContainer" style="height:102px;box-sizing:border-box;padding:8px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;flex-shrink:0;border-bottom:1px solid var(--border-color);">
              <img src="${(typeof State !== 'undefined' && State.get('companyConfig') && State.get('companyConfig').logoUrl) ? State.get('companyConfig').logoUrl : 'assets/logo.png'}" alt="" style="max-height:80px; width:auto; max-width:280px; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" onerror="this.style.display='none'">
            </div>
            <!-- Área del Carrusel de Imagen Central - CENTRADO MEJORADO -->
            <div style="padding:16px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.03);overflow:hidden;">
              <div style="width:100%;max-width:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                ${(() => {
        let allCartImages = cart.reduce((acc, item) => (item.imagenes && item.imagenes.length) ? acc.concat(item.imagenes) : acc, []);
        return (allCartImages.length > 0 && typeof ProductosModule !== 'undefined' && ProductosModule.renderProductImageCarousel)
          ? ProductosModule.renderProductImageCarousel(allCartImages, 'posProd')
          : '<div style="width:100%;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);border:2px dashed var(--border-color);border-radius:12px;font-size:12px;background:white;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);"><div style="font-size:32px;margin-bottom:12px;opacity:0.5;">🖼️</div><i style="font-weight:600;">Seleccione un producto</i></div>';
      })()}
              </div>
            </div>
          </div>

          <!-- Bottom Fixed Area: Comment, Totals, Cobrar -->
          <div style="background:var(--bg-secondary); border-top:1px solid var(--border-color); box-shadow:0 -4px 6px -1px rgba(0,0,0,0.05); display:flex; flex-direction:column; flex-shrink:0;">
            
            <!-- Comentarios arriba de los totales -->
            <div style="padding:12px 16px 8px;background:var(--bg-primary);">
              <label style="font-size:11px;font-weight:800;color:var(--text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Comentario de Factura</label>
              <textarea id="posCommentInput" style="width:100%;height:45px;padding:8px;border-radius:6px;border:1px solid var(--border-color);resize:none;font-size:13px;background:var(--bg-secondary);" placeholder="Notas internas..." onchange="VentasModule.setPosComment(this.value)">${posComment}</textarea>
            </div>

            <!-- Totales -->
            <div class="pos-totals" style="padding:8px 16px; background:var(--bg-primary);">
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:4px;"><span>Subtotal</span><span>${currSymbol}${fmt(subtotal)}</span></div>
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:4px;"><span>Descuento Promocional</span><span style="color:var(--color-danger);font-weight:600;">-${currSymbol}${fmt(descuento)}</span></div>
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:8px;"><span>IVA 15%</span><span>${currSymbol}${fmt(iva)}</span></div>
              
              <div class="pos-totals__row" style="padding:8px 0;border-top:1px dashed var(--border-color);margin-bottom:12px;">
                <button class="btn btn--secondary btn--sm" onclick="VentasModule.promptGlobalDiscountModal()" style="font-size:11px;padding:4px 8px;border-radius:4px;" title="Alt+D">🏷️ Desc. Global <kbd style="background:transparent;border:1px solid var(--border-color);margin-left:4px;">Alt+D</kbd></button>
                <span style="color:var(--color-danger);font-weight:700;">-${currSymbol}${fmt(globalDiscount)}</span>
              </div>
              <div class="pos-totals__row pos-totals__row--total" style="font-size:28px;color:var(--color-primary-600);"><span>TOTAL</span><span id="posTotalDisplay" style="font-weight:900;">${currSymbol}${fmt(total)}</span></div>
            </div>

            <!-- Botón Cobrar - FIJO AL FONDO -->
            <div class="pos-cobrar" style="padding:12px 16px 16px;background:var(--bg-primary);">
              <button class="pos-cobrar__btn" onclick="VentasModule.openPaymentModal()" ${cart.length === 0 ? 'disabled' : ''} style="width:100%;height:75px;font-size:24px;letter-spacing:2px;box-shadow:0 15px 25px -5px rgba(16, 185, 129, 0.4), 0 10px 10px -5px rgba(16, 185, 129, 0.2); border-radius:16px; display:flex; align-items:center; justify-content:center; gap:16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; transition:all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); ${cart.length === 0 ? 'opacity:0.6; filter:grayscale(0.8); cursor:not-allowed;' : 'cursor:pointer;'}" onmouseover="${cart.length > 0 ? 'this.style.transform=\\\'scale(1.02) translateY(-2px)\\\'' : ''}" onmouseout="${cart.length > 0 ? 'this.style.transform=\\\'scale(1) translateY(0)\\\'' : ''}">
                <span style="font-size:32px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${Icons.check}</span> <span style="font-weight:900; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">COBRAR</span> <kbd style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 10px;border-radius:6px;font-size:14px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,0.1);">ESC</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      ${posOpenModal === 'payment' ? renderPaymentModal(total, currSymbol) : ''}
      ${['clientes', 'devoluciones', 'catalogo', 'consultor-precios'].includes(posOpenModal) ? renderPosExternalModal(posOpenModal) : ''}
      ${posActionModal ? renderPosActionModal() : ''}
    `;
  };

  const modifySelectedAction = (act) => {
    if (selectedCartRow < 0 || selectedCartRow >= cart.length) return;
    posActionModal = act;
    posActionData = cart[selectedCartRow];
    App.render();
  };

  const openPosNewClientModal = (initName) => {
    if (typeof ClientesModule !== 'undefined' && ClientesModule.openCreateModal) {
      posOpenModal = 'clientes';
      App.render();
      setTimeout(() => {
        ClientesModule.openCreateModal();
        const inputs = document.querySelectorAll('#clienteModal input[name="nombreCliente"], #clienteModal input[name="empresa"]');
        inputs.forEach(inp => { if (initName && typeof initName === 'string') inp.value = initName; });
      }, 50);
    } else {
      posActionModal = 'newClient'; posActionData = { name: initName || '' }; App.render();
    }
  };
  const promptGlobalDiscountModal = () => { posActionModal = 'globalDisc'; posActionData = null; App.render(); };

  const submitPosActionModal = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const val = fd.get('actionVal');

    if (posActionModal === 'qty' && val && !isNaN(val) && val > 0) {
      cart[selectedCartRow].cantidad = cart[selectedCartRow].saleGranel ? parseFloat(val) : parseInt(val);
    }
    else if (posActionModal === 'del') { removeItem(selectedCartRow); }
    else if (posActionModal === 'disc' && val) {
      let pct = 0, num = 0;
      if (val.includes('%')) { pct = parseFloat(val); } else { num = parseFloat(val); }
      if (pct) cart[selectedCartRow].descuento = (cart[selectedCartRow].precio * cart[selectedCartRow].cantidad) * (pct / 100);
      else if (!isNaN(num)) cart[selectedCartRow].descuento = num;
    }
    else if (posActionModal === 'price' && val && !isNaN(val) && val > 0) { cart[selectedCartRow].precio = parseFloat(val); }
    else if (posActionModal === 'globalDisc' && val) {
      const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0) - cart.reduce((s, i) => s + (i.descuento || 0), 0);
      if (val.includes('%')) { const pct = parseFloat(val.replace('%', '')); if (!isNaN(pct)) globalDiscount = subtotal * (pct / 100); }
      else { const v = parseFloat(val); if (!isNaN(v)) globalDiscount = v; }
    }
    else if (posActionModal === 'newClient' && val && val.trim().length > 0) {
      const name = val.trim(); let dbClients = []; try { dbClients = JSON.parse(localStorage.getItem('cli_clientes') || '[]'); } catch (ex) { }
      const newCli = { id: Date.now().toString(36), nombreCliente: name, empresa: name, fechaRegistro: new Date().toISOString() };
      dbClients.push(newCli); localStorage.setItem('cli_clientes', JSON.stringify(dbClients));
      alert('Cliente agregado: ' + name); selectedClient = newCli.id;
    }
    else if (posActionModal === 'shortcuts') { }
    else if ((posActionModal === 'entrada' || posActionModal === 'salida') && val && !isNaN(val) && val > 0) {
      const motivo = fd.get('actionMotivo');
      if (!motivo) { alert('Debe indicar el motivo.'); return; }
      addRec('cajaMovs', { fecha: new Date().toISOString(), tipo: posActionModal === 'entrada' ? 'ingreso' : 'retiro', monto: parseFloat(val), motivo, usuario: user()?.name || 'Sistema', turno: turnoActivo?.numero });
      alert(`✅ ${posActionModal === 'entrada' ? 'Ingreso' : 'Retiro'} de C$${fmt(val)} registrado exitosamente.`);
    }

    posActionModal = null; posActionData = null; App.render();
  };

  const closeActionModal = () => { posActionModal = null; posActionData = null; App.render(); };

  const renderPosActionModal = () => {
    let mTitle = '', mBody = '';
    if (posActionModal === 'qty') {
      const isGranel = posActionData.saleGranel;
      mTitle = 'Modificar Cantidad';
      mBody = `<div style="margin-bottom:1rem;"><strong>Producto:</strong> ${posActionData.nombre}</div><input type="number" name="actionVal" id="posActionInput" class="form-input" value="${posActionData.cantidad}" min="${isGranel ? '0.01' : '1'}" step="${isGranel ? '0.01' : '1'}" required style="font-size:1.5rem;font-weight:bold;height:50px;">`;
    }
    else if (posActionModal === 'del') { mTitle = 'Eliminar Producto'; mBody = `<div style="margin-bottom:1rem;color:var(--color-danger);font-size:1.1rem;text-align:center;">¿Confirma eliminar <strong>${posActionData.nombre}</strong> de esta factura?</div><input type="hidden" name="actionVal" value="1">`; }
    else if (posActionModal === 'disc') { mTitle = 'Descuento Individual'; mBody = `<div style="margin-bottom:1rem;"><strong>Producto:</strong> ${posActionData.nombre}</div><p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Ejemplo: <strong>50</strong> o <strong>10%</strong></p><input type="text" name="actionVal" id="posActionInput" class="form-input" placeholder="0" autocomplete="off" required style="font-size:1.5rem;font-weight:bold;height:50px;">`; }
    else if (posActionModal === 'price') { mTitle = 'Cambiar Precio'; mBody = `<div style="margin-bottom:1rem;"><strong>Producto:</strong> ${posActionData.nombre}</div><p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Precio actual: C$${fmt(posActionData.precio)}</p><input type="number" name="actionVal" id="posActionInput" class="form-input" value="${posActionData.precio}" step="0.01" min="0" required style="font-size:1.5rem;font-weight:bold;height:50px;">`; }
    else if (posActionModal === 'globalDisc') { mTitle = 'Descuento Global'; mBody = `<p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Ejemplo de descuento: <strong>100</strong> o <strong>5%</strong></p><input type="text" name="actionVal" id="posActionInput" class="form-input" placeholder="0" autocomplete="off" required style="font-size:1.5rem;font-weight:bold;height:50px;">`; }
    else if (posActionModal === 'newClient') { mTitle = 'Nuevo Cliente'; mBody = `<p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Agregará rápidamente al catálogo</p><label style="display:block;margin-bottom:4px;font-weight:600;">Nombre o Empresa:</label><input type="text" name="actionVal" id="posActionInput" class="form-input" value="${posActionData ? posActionData.name || '' : ''}" placeholder="Ej: Juan Pérez" autocomplete="off" required style="height:44px;font-size:1rem;">`; }
    else if (posActionModal === 'shortcuts') {
      mTitle = 'Ayuda de Atajos'; mBody = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;font-size:0.95rem;font-family:monospace;margin-top:0.5rem;">
      <div><strong style="color:var(--color-primary-600)">F2</strong> - Buscar Producto</div>
      <div><strong style="color:var(--color-primary-600)">F4</strong> - Cantidad</div>
      <div><strong style="color:var(--color-primary-600)">F5</strong> - Limpiar POS</div>
      <div><strong style="color:var(--color-primary-600)">F6</strong> - Descuento Indv.</div>
      <div><strong style="color:var(--color-primary-600)">F7</strong> - Precio</div>
      <div><strong style="color:var(--color-primary-600)">F8</strong> - Suspender</div>
      <div><strong style="color:var(--color-primary-600)">F10</strong> - Recuperar</div>
      <div><strong style="color:var(--color-primary-600)">F11</strong> - Cerrar Turno</div>
      <div><strong style="color:var(--color-primary-600)">F12</strong> - Minimizar</div>
      <div><strong style="color:var(--color-primary-600)">Del</strong> - Borrar Ítem</div>
      <div><strong style="color:var(--color-primary-600)">Alt+C</strong> - Clientes</div>
      <div><strong style="color:var(--color-primary-600)">Alt+E</strong> - Entrada Caja</div>
      <div><strong style="color:var(--color-primary-600)">Alt+S</strong> - Salida Caja</div>
      <div><strong style="color:var(--color-primary-600)">Alt+N</strong> - Nuevo Cliente</div>
      <div><strong style="color:var(--color-primary-600)">Alt+D</strong> - Desc. Global</div>
      <div><strong style="color:var(--color-primary-600)">ESC</strong> - Opciones / Cobrar</div>
    </div><input type="hidden" name="actionVal" value="1">`;
    }
    else if (posActionModal === 'selectTracking') {
      mTitle = `Seleccionar ${posActionData.p.tipoSeguimiento.toUpperCase()} (${posActionData.p.nombre})`;
      const rows = posActionData.disponibles.map(d => {
        if (posActionData.p.tipoSeguimiento === 'lote') {
          return `<tr style="cursor:pointer;" onclick="VentasModule.addToCart('${posActionData.p.id}', 'LOTE: ${d.lote}', '${d.id}'); VentasModule.closeActionModal();"><td><strong>${d.lote}</strong></td><td>Cant: ${d.cantidad}</td><td>Cad: ${d.fechaCaducidad || '-'}</td></tr>`;
        } else {
          return `<tr style="cursor:pointer;" onclick="VentasModule.addToCart('${posActionData.p.id}', '${d.numero}', '${d.id}'); VentasModule.closeActionModal();"><td><strong>${d.numero}</strong></td><td colspan="2">Color: ${d.color || '-'}</td></tr>`;
        }
      }).join('');
      mBody = `<p style="margin-bottom:12px;font-size:0.9rem;color:var(--text-muted);">Seleccione el elemento a vender haciendo clic en la fila correspondiente:</p>
      <div style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <tbody class="data-table__body tr-hover">
            ${rows}
          </tbody>
        </table>
      </div><input type="hidden" name="actionVal" value="1"><style>.tr-hover tr:hover td { background: rgba(56,189,248,0.1); }</style>`;
    }
    else if (posActionModal === 'entrada' || posActionModal === 'salida') {
      mTitle = posActionModal === 'entrada' ? '📥 Entrada de Caja' : '📤 Salida de Caja';
      mBody = `<div style="margin-bottom:1rem;"><label style="display:block;margin-bottom:4px;font-weight:600;">Motivo:</label><input type="text" name="actionMotivo" id="posActionInput" class="form-input" placeholder="Razón del movimiento" autocomplete="off" required style="height:44px;"></div><div><label style="display:block;margin-bottom:4px;font-weight:600;">Monto (C$):</label><input type="number" name="actionVal" class="form-input" placeholder="0.00" step="0.01" min="0.01" required style="font-size:1.5rem;font-weight:bold;height:50px;"></div>`;
    }

    const noButtons = posActionModal === 'selectTracking' || posActionModal === 'shortcuts';

    return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
         <form onsubmit="VentasModule.submitPosActionModal(event)" style="background:var(--bg-secondary);border-radius:12px;width:${posActionModal === 'selectTracking' ? '500px' : '400px'};box-shadow:var(--shadow-xl);overflow:hidden;animation: fadeIn 0.1s ease-out;">
            <div style="padding:16px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
               <h3 style="margin:0;font-size:18px;">${mTitle}</h3>
               <button type="button" class="btn btn--ghost btn--icon" onclick="VentasModule.closeActionModal()">✕</button>
            </div>
            <div style="padding:24px;">
               ${mBody}
            </div>
            ${noButtons ? '' : `<div style="padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;gap:12px;">
               <button type="button" class="btn btn--ghost" style="flex:1;" onclick="VentasModule.closeActionModal()">Cancelar</button>
               <button type="submit" class="${posActionModal === 'del' ? 'btn btn--danger' : 'btn btn--primary'}" style="flex:1;">${posActionModal === 'del' ? 'Eliminar' : 'Aceptar'}</button>
            </div>`}
         </form>
      </div>`;
  };

  const renderPosExternalModal = (type) => {
    let title = '';
    let content = '';
    if (type === 'clientes') {
      title = '👥 Módulo de Clientes';
      content = typeof ClientesModule !== 'undefined' ? ClientesModule.render() : '<div style="padding:2rem;">Módulo de Clientes no encontrado.</div>';
    } else if (type === 'devoluciones') {
      title = '↩️ Devoluciones';
      content = renderDevoluciones();
    } else if (type === 'catalogo') {
      title = '📄 Catálogo de Ventas';
      content = renderCatalogo();
    } else if (type === 'consultor-precios') {
      title = '🔍 Consultor de Precios';
      content = renderConsultorPrecios();
    }

    return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;">
         <div style="background:var(--bg-secondary);border-radius:12px;width:95vw;height:90vh;max-width:1400px;box-shadow:var(--shadow-xl);overflow:hidden;display:flex;flex-direction:column;animation: fadeIn 0.15s ease-out;">
            <div style="padding:16px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
               <h3 style="margin:0;font-size:20px;">${title}</h3>
               <button class="btn btn--ghost btn--icon" onclick="VentasModule.closePosModal()">✕</button>
            </div>
            <div style="flex:1;overflow-y:auto;background:var(--bg-secondary);position:relative;">
               ${content}
               ${type === 'clientes' ? '<div id="clienteModal"></div>' : ''}
            </div>
         </div>
      </div>
     `;
  };

  const renderOpenTurno = () => `
      <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;">
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;padding:3rem;text-align:center;max-width:420px;box-shadow:var(--shadow-xl);">
          <div style="font-size:4rem;margin-bottom:1rem;">🏪</div>
          <h2 style="margin-bottom:.5rem;color:var(--text-primary);">Abrir Punto de Venta</h2>
          <p style="color:var(--text-muted);margin-bottom:2rem;">Ingrese el fondo de caja inicial para comenzar su turno de ventas.</p>
          <button class="pos-cobrar__btn" onclick="VentasModule.openTurno()" style="max-width:280px;margin:0 auto;">💰 Abrir Turno</button>
          <button class="btn btn--ghost" onclick="VentasModule.closePOSOverlay()" style="margin-top:12px;display:block;width:100%;">✕ Cerrar Ventana</button>
        </div>
      </div>`;

  const renderPaymentModal = (subTotalBase, currSymbol) => {
    let finalTotal = subTotalBase;
    let paymentConfigHtml = '';

    if (selectedPayment === 'transferencia') {
      const listas = getPosDataUncached('pos_transferencias');
      if (posSelectedConfigIdx >= listas.length) posSelectedConfigIdx = 0;
      paymentConfigHtml = `
        <div style="margin-top:16px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">Seleccionar Cuenta Banco:</label>
          <select id="posPaymentConfig" class="form-select" onchange="VentasModule.setPaymentConfig(this.value)" style="border:2px solid var(--border-color);font-size:14px;height:40px;">
            <option value="" disabled ${listas.length === 0 ? 'selected' : ''}>${listas.length === 0 ? 'No hay cuentas configuradas' : 'Seleccione...'}</option>
            ${listas.map((x, i) => `<option value="${i}" ${posSelectedConfigIdx == i ? 'selected' : ''}>${x.banco} - ${x.divisa} (${x.numeroCuenta})</option>`).join('')}
          </select>
        </div>
      `;
    } else if (selectedPayment === 'tarjeta' || selectedPayment === 'extrafinanciamiento') {
      let key = 'pos_extrafinanciamiento';
      if (selectedPayment === 'tarjeta') {
        key = posTarjetaModo === 'asumir' ? 'pos_tarjetas_asumir' : 'pos_tarjetas';
      }

      const listas = getPosDataUncached(key);
      if (posSelectedConfigIdx >= listas.length) posSelectedConfigIdx = 0;

      let extraImpuesto = 0;
      let asumidoHtml = '';

      if (listas.length > 0) {
        const item = listas[posSelectedConfigIdx];
        const pctBancario = parseFloat(item.porcentajeBancario) || 0;
        const pctIR = parseFloat(item.porcentajeIR) || 0;

        if (selectedPayment === 'tarjeta' && posTarjetaModo === 'asumir') {
          // Calculation won't be added to finalTotal
          const comisionBancariaAmt = subTotalBase * (pctBancario / 100);
          const baseIR = subTotalBase - comisionBancariaAmt;
          const irAmt = baseIR * (pctIR / 100);
          const totalDeducir = comisionBancariaAmt + irAmt;
          asumidoHtml = `<div style="margin-top:8px;font-size:13px;color:var(--text-muted);font-weight:700;">Deducción estimada en reportes: - ${currSymbol}${fmt(totalDeducir)} (Asumido por empresa)</div>`;
        } else {
          // Will be added to finalTotal
          const pct = pctBancario + pctIR;
          extraImpuesto = subTotalBase * (pct / 100);
          finalTotal += extraImpuesto;
        }
      }

      let toggleAsumirHtml = '';
      if (selectedPayment === 'tarjeta') {
        toggleAsumirHtml = `
          <div style="display:flex; gap:16px; margin-bottom:12px; background:rgba(0,0,0,0.03); padding:8px; border-radius:6px; border:1px solid var(--border-color);">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600;">
              <input type="radio" name="tjmodo" value="cobrar" ${posTarjetaModo === 'cobrar' ? 'checked' : ''} onchange="VentasModule.setTarjetaModo('cobrar')">
              Cobrar Comisión (+ Total)
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600;">
              <input type="radio" name="tjmodo" value="asumir" ${posTarjetaModo === 'asumir' ? 'checked' : ''} onchange="VentasModule.setTarjetaModo('asumir')">
              Asumir Comisión (Solo en reportes)
            </label>
          </div>
        `;
      }

      paymentConfigHtml = `
        <div style="margin-top:16px;">
          ${toggleAsumirHtml}
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">${selectedPayment === 'tarjeta' ? 'Seleccionar POS:' : 'Seleccionar Extrafinanciamiento:'}</label>
          <select id="posPaymentConfig" class="form-select" onchange="VentasModule.setPaymentConfig(this.value)" style="border:2px solid var(--border-color);font-size:14px;height:40px;">
            <option value="" disabled ${listas.length === 0 ? 'selected' : ''}>${listas.length === 0 ? 'No hay opciones configuradas' : 'Seleccione...'}</option>
            ${listas.map((x, i) => {
        const pct = (parseFloat(x.porcentajeBancario) || 0) + (parseFloat(x.porcentajeIR) || 0);
        const n = selectedPayment === 'tarjeta' ? x.posBanco : `${x.banco} (${x.plazoMeses}m)`;
        return `<option value="${i}" ${posSelectedConfigIdx == i ? 'selected' : ''}>${n} (+${pct}%)</option>`;
      }).join('')}
          </select>
          ${extraImpuesto > 0 ? `<div style="margin-top:8px;font-size:13px;color:var(--color-danger);font-weight:700;">+ ${currSymbol}${fmt(extraImpuesto)} (Impuesto de Tarjeta/Banco)</div>` : ''}
          ${asumidoHtml}
        </div>
      `;
    }

    return `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;">
         <div style="background:var(--bg-secondary);border-radius:12px;width:500px;box-shadow:var(--shadow-xl);overflow:hidden;">
            <div style="padding:16px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
               <h3 style="margin:0;">💳 Confirmar Pago</h3>
               <button class="btn btn--ghost btn--icon" onclick="VentasModule.closePaymentModal()">✕</button>
            </div>
            <div style="padding:24px;">
               <div style="text-align:center;margin-bottom:24px;">
                 <div style="font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Monto a Cobrar</div>
                 <div style="font-size:42px;font-weight:800;color:var(--color-primary-500);">${currSymbol}${fmt(finalTotal)}</div>
               </div>
               <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Tipo de Pago:</div>
               <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:24px;">
                  ${['efectivo', 'tarjeta', 'transferencia', 'extrafinanciamiento', 'credito'].map(m => `
                    <button style="padding:12px;border:2px solid ${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--border-color)'};background:${selectedPayment === m ? 'rgba(56,189,248,0.1)' : 'transparent'};border-radius:8px;font-weight:700;color:${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--text-primary)'};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:4px;justify-content:center;font-size:11px;" onclick="VentasModule.setPaymentOnly('${m}')">
                      <span style="font-size:18px;">${m === 'efectivo' ? '💵' : m === 'tarjeta' ? '💳' : m === 'transferencia' ? '🏦' : m === 'extrafinanciamiento' ? '📈' : '📋'}</span>
                      <span>${m.toUpperCase()}</span>
                    </button>
                  `).join('')}
               </div>
               ${paymentConfigHtml}
               ${selectedPayment === 'efectivo' ? `
                  <div style="background:var(--bg-primary);padding:16px;border-radius:8px;border:1px solid var(--border-color);">
                     <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">Efectivo Recibido:</label>
                     <input type="number" oninput="VentasModule.updateCashDisplay(this)" class="form-input" data-total="${finalTotal}" placeholder="C$0.00" style="font-size:1.5rem;font-weight:800;border:2px solid var(--border-color);height:50px;" id="posCashInput">
                     <div id="posCambioBox" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color);">
                       <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>Recibe:</span><strong id="posCambioRecibido">C$0.00</strong></div>
                       <div style="display:flex;justify-content:space-between;font-size:18px;"><span>Cambio a dar:</span><strong id="posCambioValor">C$0.00</strong></div>
                     </div>
                  </div>
                  <script>setTimeout(() => document.getElementById('posCashInput')?.focus(), 100);</script>
               ` : ''}
            </div>
            <div style="padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;gap:12px;">
               <button class="btn btn--ghost" style="flex:1;" onclick="VentasModule.closePaymentModal()">Cancelar</button>
               <button class="pos-cobrar__btn" style="flex:2;" onclick="VentasModule.processPaymentOverride()">${Icons.check} Confirmar Pago</button>
            </div>
         </div>
      </div>`;
  };

  const processPaymentOverride = () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    let finalTotal = total;
    let paymentDetails = null;

    if (selectedPayment === 'tarjeta' || selectedPayment === 'extrafinanciamiento') {
      let key = 'pos_extrafinanciamiento';
      if (selectedPayment === 'tarjeta') {
        key = posTarjetaModo === 'asumir' ? 'pos_tarjetas_asumir' : 'pos_tarjetas';
      }

      const listas = getPosDataUncached(key);
      if (listas.length === 0) { alert('No hay opciones configuradas. Vaya a Configuración > Punto de Venta.'); return; }
      const item = listas[posSelectedConfigIdx];
      if (!item) { alert('Seleccione una opción de la lista.'); return; }

      const pctBancario = parseFloat(item.porcentajeBancario) || 0;
      const pctIR = parseFloat(item.porcentajeIR) || 0;
      let extraImpuesto = 0;
      let asumido = false;
      let montoAsumidoBancario = 0;
      let montoAsumidoIR = 0;

      if (selectedPayment === 'tarjeta' && posTarjetaModo === 'asumir') {
        asumido = true;
        montoAsumidoBancario = total * (pctBancario / 100);
        const baseIR = total - montoAsumidoBancario;
        montoAsumidoIR = baseIR * (pctIR / 100);
        // finalTotal does NOT increase
      } else {
        const pct = pctBancario + pctIR;
        extraImpuesto = finalTotal * (pct / 100);
        finalTotal += extraImpuesto;
      }

      paymentDetails = {
        banco: item.banco || item.posBanco,
        plazoMeses: item.plazoMeses || null,
        impuestoAgregado: extraImpuesto,
        asumido,
        montoAsumidoBancario,
        montoAsumidoIR,
        totalImpuestoAsumido: montoAsumidoBancario + montoAsumidoIR,
        porcentajeBancario: item.porcentajeBancario,
        porcentajeIR: item.porcentajeIR
      };
    } else if (selectedPayment === 'transferencia') {
      const listas = getPosDataUncached('pos_transferencias');
      if (listas.length === 0) { alert('No hay cuentas de transferencia configuradas.'); return; }
      const item = listas[posSelectedConfigIdx];
      if (!item) { alert('Seleccione una cuenta.'); return; }
      paymentDetails = { banco: item.banco, numeroCuenta: item.numeroCuenta, divisa: item.divisa };
    }

    if (selectedPayment === 'efectivo' && cashReceived < finalTotal) { alert('El efectivo recibido es menor al total.'); return; }

    const costoTotal = cart.reduce((s, i) => s + (i.costo * i.cantidad), 0);
    const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
    const clientFound = selectedClient ? getClients().find(c => c.id === selectedClient) : null;

    addRec('ventas', { numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient, cliente: clientFound ? (clientFound.empresa || clientFound.nombreCliente || 'Cliente') : 'Público General', items: cart.map(i => ({ ...i })), subtotal, descuento, descuento_global: globalDiscount, iva, total: finalTotal, base_total: total, costo_total: costoTotal, metodo: selectedPayment, detalles_pago: paymentDetails, lista_precio: posSelectedPriceList, efectivo_recibido: selectedPayment === 'efectivo' ? cashReceived : 0, cambio: selectedPayment === 'efectivo' ? Math.max(0, cashReceived - finalTotal) : 0, saldo_pendiente: selectedPayment === 'credito' ? finalTotal : 0, vendedor: user()?.name || 'N/A', estado: 'completada', comentario: posComment });

    // Actualizar Tracking Lotes/Series/IMEI
    if (typeof ProductosModule !== 'undefined' && ProductosModule.marcarTrackingVendido) {
      cart.forEach(i => {
        if (i.trackingId && i.tipoSeguimiento) {
          ProductosModule.marcarTrackingVendido(i.productId, i.tipoSeguimiento, i.trackingId, numFactura, i.cantidad);
        }
      });
    }

    alert(`✅ Venta ${numFactura} registrada!\nTotal Pagado: C$${fmt(finalTotal)}${selectedPayment === 'efectivo' ? '\nCambio: C$' + fmt(Math.max(0, cashReceived - finalTotal)) : ''}`);
    cart = []; selectedClient = null; cashReceived = 0; globalDiscount = 0; posComment = ''; posOpenModal = null;
    posSubView = 'pos'; App.render();
  };

  let clientSearchTimeout = null;
  let currentProductSearchRes = [];
  let currentProductSearchIdx = -1;
  let currentClientSearchRes = [];
  let currentClientSearchIdx = -1;
  const searchClientsCombo = (q) => {
    const el = document.getElementById('posClientResults');
    if (!el) return;
    if (!q || q.length < 1) { el.style.display = 'none'; return; }

    clearTimeout(clientSearchTimeout);
    clientSearchTimeout = setTimeout(() => {
      const found = getClients().filter(c => (c.empresa || c.nombreCliente || '').toLowerCase().includes(q.toLowerCase())).slice(0, 5);
      if (found.length === 0) {
        el.style.display = 'none';
        posActionModal = 'newClient';
        posActionData = { name: q };
        App.render();
      } else {
        currentClientSearchRes = found;
        currentClientSearchIdx = -1;
        renderClientSearchResults();
      }
    }, 600);
  };
  const renderClientSearchResults = () => {
    const el = document.getElementById('posClientResults');
    if (!el) return;
    el.innerHTML = currentClientSearchRes.map((c, i) => `<div style="padding:8px;font-size:12px;cursor:pointer;border-bottom:1px solid #eee;${i === currentClientSearchIdx ? 'background:rgba(56,189,248,.15);' : ''}" onclick="VentasModule.selectClientCombo('${c.id}')">${c.empresa || c.nombreCliente}</div>`).join('');
    el.style.display = 'block';
  };
  const selectClientCombo = (id) => { selectedClient = id; App.render(); };
  const promptGlobalDiscount = () => { promptGlobalDiscountModal(); };
  const setPosComment = (v) => { posComment = v; };
  const openPaymentModal = () => { if (cart.length === 0) return; posOpenModal = 'payment'; selectedPayment = 'efectivo'; posSelectedConfigIdx = 0; cashReceived = 0; App.render(); };
  const closePaymentModal = () => { posOpenModal = null; App.render(); };
  const closePosModal = () => { posOpenModal = null; App.render(); };
  const setPaymentOnly = (m) => { selectedPayment = m; posSelectedConfigIdx = 0; App.render(); };
  const setTarjetaModo = (m) => { posTarjetaModo = m; posSelectedConfigIdx = 0; App.render(); };
  const setPaymentConfig = (idx) => { posSelectedConfigIdx = parseInt(idx); App.render(); };
  const setPriceList = (l) => { posSelectedPriceList = l; App.render(); };
  const setCurrency = (c) => { selectedCurrency = c; App.render(); };
  const clearCart = () => { cart = []; selectedClient = null; cashReceived = 0; globalDiscount = 0; posComment = ''; App.render(); };
  const suspendSale = () => { if (cart.length === 0) return; suspendedSales.push({ cart: [...cart], client: selectedClient, date: new Date().toISOString() }); clearCart(); };
  const recoverSale = () => { if (suspendedSales.length === 0) return; const sale = suspendedSales.pop(); cart = sale.cart; selectedClient = sale.client; App.render(); };
  const recoverSaleFromTab = (index) => {
    const saleToLoad = suspendedSales[index];
    if (cart.length > 0) {
      suspendedSales.push({ cart: [...cart], client: selectedClient, date: new Date().toISOString() });
    }
    suspendedSales.splice(index, 1);
    cart = saleToLoad.cart;
    selectedClient = saleToLoad.client;
    App.render();
  };

  const modifySelected = (action) => { modifySelectedAction(action); };

  const searchProducts = (query) => {
    clearTimeout(searchTimeout); const el = document.getElementById('posSearchResults'); if (!el) return;
    if (!query || query.length < 1) { el.style.display = 'none'; return; }
    searchTimeout = setTimeout(() => {
      const prods = getProducts().filter(p => { const q = query.toLowerCase(); return (p.nombre || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q); }).slice(0, 8);
      if (prods.length === 0) {
        el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">Sin resultados</div>';
        el.style.display = 'block';
      } else {
        currentProductSearchRes = prods;
        currentProductSearchIdx = -1;
        renderProductSearchResults();
      }
    }, 200);
  };
  const renderProductSearchResults = () => {
    const el = document.getElementById('posSearchResults');
    if (!el) return;
    el.innerHTML = currentProductSearchRes.map((p, i) => `<div class="pos-search-result" style="${i === currentProductSearchIdx ? 'background:rgba(56,189,248,.15);' : ''}" onclick="VentasModule.addToCart('${p.id}')"><div><div class="pos-search-result__name">${p.nombre || 'Sin nombre'}</div><div class="pos-search-result__info">${p.codigo || p.sku || ''} | Stock: ${p.stock ?? p.cantidad ?? '∞'} ${p.ventaGranel === 'true' ? '<span style="color:#059669;font-weight:700;">(Granel)</span>' : ''} ${p.usaSeriales === 'true' ? '<span style="color:#0284c7;font-weight:700;">(Serie/Lote)</span>' : ''}</div></div><div class="pos-search-result__price">C$${fmt(p.precioVenta || p.precio || 0)}</div></div>`).join('');
    el.style.display = 'block';
  };

  const addToCart = (productId, overrideSerial = null, overrideTrackingId = null) => {
    const p = getProducts().find(x => x.id === productId); if (!p) return;

    let serial = overrideSerial || '';
    if (p.usaSeriales === 'true' && p.tipoSeguimiento && !overrideSerial) {
      if (typeof ProductosModule !== 'undefined' && ProductosModule.getTrackingDisponibles) {
        const disponibles = ProductosModule.getTrackingDisponibles(productId, p.tipoSeguimiento);
        if (disponibles.length > 0) {
          posActionModal = 'selectTracking';
          posActionData = { p, disponibles };
          App.render();
          return;
        }
      }
    }

    if (p.usaSeriales === 'true' && !overrideSerial) {
      serial = prompt(`Este producto (${p.nombre}) requiere registrar un No. Serie, Lote o IMEI.\nIngrese el código correspondiente:`);
      if (serial === null || serial.trim() === '') return;
      serial = serial.trim();
    }

    let isGranel = p.ventaGranel === 'true';
    let qtyToAdd = 1;
    if (isGranel) {
      const q = prompt(`Este producto se vende a granel.\nIngrese la cantidad a facturar (ej. 0.5):`, "1");
      if (q === null) return;
      qtyToAdd = parseFloat(q);
      if (isNaN(qtyToAdd) || qtyToAdd <= 0) return;
    }

    const existing = cart.findIndex(i => i.productId === productId && (!serial || i.serial === serial));
    let targetRowIndex;
    if (existing >= 0 && !serial) { cart[existing].cantidad += qtyToAdd; targetRowIndex = existing; }
    else { cart.push({ productId, nombre: p.nombre, codigo: p.codigo, sku: p.sku, precio: parseFloat(p.precioVenta || p.precio || 0), costo: parseFloat(p.precioCompra || p.costo || 0), cantidad: qtyToAdd, descuento: 0, saleGranel: isGranel, serial, trackingId: overrideTrackingId, tipoSeguimiento: p.tipoSeguimiento, imagenes: p.imagenes || (p.imagenUrl ? [p.imagenUrl] : []) }); targetRowIndex = cart.length - 1; }

    const el = document.getElementById('posSearchResults'); if (el) el.style.display = 'none';
    const si = document.getElementById('posSearch'); if (si) si.value = '';
    currentProductSearchRes = [];
    currentProductSearchIdx = -1;
    selectedCartRow = targetRowIndex; App.render();
  };

  const removeItem = (i) => { cart.splice(i, 1); if (selectedCartRow >= cart.length) selectedCartRow = cart.length - 1; App.render(); };

  const updateCashDisplay = (input) => {
    const val = parseFloat(input.value) || 0; cashReceived = val;
    const total = parseFloat(input.dataset.total) || 0; const cambio = val - total;
    const box = document.getElementById('posCambioBox'); const recEl = document.getElementById('posCambioRecibido'); const camEl = document.getElementById('posCambioValor');
    if (box && recEl && camEl) { box.style.display = val > 0 ? 'block' : 'none'; recEl.textContent = 'C$' + fmt(val); camEl.textContent = 'C$' + fmt(cambio >= 0 ? cambio : 0); camEl.style.color = cambio >= 0 ? '#059669' : '#ef4444'; }
  };

  const handleKeyboard = (e) => {
    const map = [
      { key: 'F12', global: true, action: () => { if (!posOverlayOpen) openPOSOverlay(); else if (posMinimized) restorePOS(); } },
      { key: 'F2', action: () => document.getElementById('posSearch')?.focus() },
      { key: 'F4', action: () => modifySelected('qty') },
      { key: 'F5', action: () => clearCart() },
      { key: 'F6', action: () => modifySelected('disc') },
      { key: 'F7', action: () => modifySelected('price') },
      { key: 'F8', action: () => suspendSale() },
      { key: 'F10', action: () => recoverSale() },
      { key: 'F11', action: () => closeTurno() },
      { key: 'Delete', action: () => modifySelected('del') },
      { key: 'Tab', action: (e) => { e.preventDefault(); document.getElementById('posSearch')?.focus(); } },
      { key: 'Escape', action: () => { if (posOpenModal) closePosModal(); else openPaymentModal(); } },
      { key: 'ArrowDown', action: () => { if (cart.length > 0) { e.preventDefault(); selectedCartRow = Math.min(selectedCartRow + 1, cart.length - 1); highlightCartRow(); App.render(); } } },
      { key: 'ArrowUp', action: () => { if (cart.length > 0) { e.preventDefault(); selectedCartRow = Math.max(selectedCartRow - 1, 0); highlightCartRow(); App.render(); } } },
    ];

    if (e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); navigateSidebar('entrada-caja'); return; }
    if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); navigateSidebar('salida-caja'); return; }
    if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); navigateSidebar('pos-clientes'); return; }
    if (e.altKey && e.key.toLowerCase() === 'u') { e.preventDefault(); navigateSidebar('pos-sucursal'); return; }
    if (e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); navigateSidebar('catalogo'); return; }
    if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openPosNewClientModal(); return; }
    if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); promptGlobalDiscountModal(); return; }

    const gs = map.find(s => s.global && s.key === e.key);
    if (gs && !posActionModal && !posOpenModal) { e.preventDefault(); gs.action(e); return; }
    if (!posOverlayOpen || posMinimized) return;
    if (posActionModal && e.key === 'Escape') { e.preventDefault(); closeActionModal(); return; }

    // Permitir F-keys y Delete aunque haya un input enfocado (como el buscador de productos)
    if ((e.key.startsWith('F') && e.key.length <= 3) || e.key === 'Delete') {
      const sc = map.find(s => !s.global && s.key === e.key);
      if (sc && !posActionModal && !posOpenModal) { e.preventDefault(); sc.action(e); return; }
    }

    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Escape') {
        if (posActionModal) { closeActionModal(); return; }
        if (posOpenModal) { closePosModal(); return; }
        e.target.blur(); return;
      }
      else if (e.key === 'Tab') { e.preventDefault(); document.getElementById('posSearch')?.focus(); return; }

      if (e.target.id === 'posSearch') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentProductSearchRes && currentProductSearchRes.length > 0 && e.target.value.length > 0) { currentProductSearchIdx = Math.min(currentProductSearchIdx + 1, currentProductSearchRes.length - 1); renderProductSearchResults(); }
          else if (cart.length > 0) { selectedCartRow = Math.min(selectedCartRow + 1, cart.length - 1); highlightCartRow(); App.render(); }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentProductSearchRes && currentProductSearchRes.length > 0 && e.target.value.length > 0) { currentProductSearchIdx = Math.max(currentProductSearchIdx - 1, -1); renderProductSearchResults(); }
          else if (cart.length > 0) { selectedCartRow = Math.max(selectedCartRow - 1, 0); highlightCartRow(); App.render(); }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (currentProductSearchIdx >= 0 && currentProductSearchIdx < currentProductSearchRes.length) addToCart(currentProductSearchRes[currentProductSearchIdx].id);
          else if (currentProductSearchRes.length === 1) addToCart(currentProductSearchRes[0].id);
          return;
        }
      } else if (e.target.id === 'posClientSearch') {
        if (e.key === 'ArrowDown') { e.preventDefault(); currentClientSearchIdx = Math.min(currentClientSearchIdx + 1, currentClientSearchRes.length - 1); renderClientSearchResults(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); currentClientSearchIdx = Math.max(currentClientSearchIdx - 1, -1); renderClientSearchResults(); return; }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (currentClientSearchIdx >= 0 && currentClientSearchIdx < currentClientSearchRes.length) { selectClientCombo(currentClientSearchRes[currentClientSearchIdx].id); document.getElementById('posClientResults').style.display = 'none'; }
          else if (currentClientSearchRes.length === 1) { selectClientCombo(currentClientSearchRes[0].id); document.getElementById('posClientResults').style.display = 'none'; }
          return;
        }
      }
      return;
    }
    const shortcut = map.find(s => !s.global && s.key === e.key);
    if (shortcut) { e.preventDefault(); shortcut.action(e); }
  };
  document.addEventListener('keydown', handleKeyboard);

  const highlightCartRow = () => {
    setTimeout(() => {
      const row = document.querySelector('.pos-cart-row--selected');
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const openCajaInOut = (tipo) => {
    posActionModal = tipo === 'ingreso' ? 'entrada' : 'salida';
    posActionData = null;
    App.render();
  };

  const renderCerrarTurno = () => {
    if (!turnoActivo) return '<div style="padding:2rem;">No hay turno activo.</div>';

    // Obtenemos todos los datos para armar el panel
    const m = getMetrics();
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const totalEntradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const totalSalidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);

    // Ventas por forma de pago
    const ventasHoy = m.ventasDia;
    const vEfectivo = ventasHoy.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vTarjeta = ventasHoy.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vTransferencia = ventasHoy.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + parseFloat(v.total || 0), 0);
    const vCredito = ventasHoy.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.total || 0), 0);

    const abonos = getData('abonos').filter(a => (a.fecha || '').startsWith(today())).reduce((s, a) => s + parseFloat(a.monto || 0), 0);
    const devoluciones = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today())).reduce((s, d) => s + parseFloat(d.total || d.monto || 0), 0);

    // Caja calculada
    const fondoInicial = parseFloat(turnoActivo.fondoInicial || 0);
    const calculoTeorico = fondoInicial + totalEntradas + vEfectivo + abonos - devoluciones - totalSalidas;

    // Listados Detallados
    const ventasDetalle = ventasHoy.map(v => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-color);padding:6px 0;font-size:0.9rem;"><span>${v.numero} <br><span style="color:var(--text-muted);font-size:0.75rem;">${v.cliente || 'Público'}</span></span><strong>C$ ${fmt(v.total)}</strong></div>`).join('');
    const creditosDetalle = ventasHoy.filter(v => v.metodo === 'credito').map(v => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-color);padding:6px 0;font-size:0.9rem;"><span>${v.numero} <br><span style="color:var(--text-muted);font-size:0.75rem;">${v.cliente || 'Público'}</span></span><strong>C$ ${fmt(v.total)}</strong></div>`).join('');
    const entradasDetalle = movs.filter(x => x.tipo === 'ingreso').map(m => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(16,185,129,0.2);padding:6px 0;font-size:0.9rem;"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;">${m.motivo || 'Ingreso'}</span><strong style="color:#059669">+C$ ${fmt(m.monto)}</strong></div>`).join('');
    const salidasDetalle = movs.filter(x => x.tipo === 'retiro').map(m => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(239,68,68,0.2);padding:6px 0;font-size:0.9rem;"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;">${m.motivo || 'Retiro'}</span><strong style="color:#ef4444">-C$ ${fmt(m.monto)}</strong></div>`).join('');
    const devToday = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today()));
    const devolucionesDetalle = devToday.map(d => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(239,68,68,0.2);padding:6px 0;font-size:0.9rem;"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;">${d.numero || d.id || '*'} <br><span style="color:var(--text-muted);font-size:0.75rem;">${d.productoNombre || d.motivo || 'Artículo'}</span></span><strong style="color:#ef4444">-C$ ${fmt(d.total || d.monto || 0)}</strong></div>`).join('');

    return `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; width:100%; height:100%; max-width:100%; max-height:100%; margin:0; border-radius:0; background:var(--bg-secondary); z-index:9000; overflow:hidden;">
         <div style="background:var(--color-primary-600);color:white;padding:1.5rem;text-align:center;flex-shrink:0;">
             <h2 style="margin:0;font-size:1.5rem;font-weight:700;">📊 Resumen de Cierre de Turno</h2>
             <p style="margin:0.25rem 0 0;opacity:0.85;">Turno #${turnoActivo.numero} - Fecha Apertura: ${fmtD(turnoActivo.fechaHora)}</p>
         </div>
         <div style="padding:1.5rem 2rem;overflow-y:auto;flex:1;">
            <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:1.5rem;margin-bottom:2rem;">
               <div style="background:rgba(56,189,248,0.05);padding:1.5rem;border-radius:12px;border:1px solid var(--color-primary-200);">
                  <div style="color:var(--text-muted);font-size:0.85rem;font-weight:bold;text-transform:uppercase;">Fondo Inicial</div>
                  <div style="font-size:2rem;font-weight:800;color:var(--color-primary-600);">C$ ${fmt(fondoInicial)}</div>
               </div>
               <div style="background:var(--bg-primary);padding:1.5rem;border-radius:12px;border:1px solid var(--border-color);">
                  <div style="color:var(--text-muted);font-size:0.85rem;font-weight:bold;text-transform:uppercase;">Facturas Hoy (#${m.facturasHoy})</div>
                  <div style="font-size:2rem;font-weight:800;color:var(--text-primary);">C$ ${fmt(m.totalDia)}</div>
               </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
               <!-- DESGLOSE METODOS DE PAGO -->
               <div style="background:var(--bg-primary);border-radius:8px;padding:1.5rem;border:1px solid var(--border-color);">
                  <h4 style="margin-top:0;margin-bottom:1rem;color:var(--text-primary);border-bottom:2px solid var(--color-primary-200);padding-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;">${Icons.chart} Ventas por Forma de Pago</h4>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:1.05rem;"><span>💵 Efectivo:</span><strong>C$ ${fmt(vEfectivo)}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:1.05rem;"><span>💳 Tarjeta:</span><strong>C$ ${fmt(vTarjeta)}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:1.05rem;"><span>🏦 Transferencia:</span><strong>C$ ${fmt(vTransferencia)}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:1rem;color:var(--color-primary-500);font-size:1.05rem;"><span>📋 Ventas a Crédito:</span><strong>C$ ${fmt(vCredito)}</strong></div>
                  
                  <div style="display:flex;justify-content:space-between;margin-top:1.5rem;padding-top:1rem;border-top:1px dashed var(--border-color);color:#059669;font-weight:bold;font-size:1.05rem;"><span>💰 Abonos Recibidos:</span><strong>C$ ${fmt(abonos)}</strong></div>
               </div>

               <!-- MOVIMIENTOS CAJA -->
               <div style="background:var(--bg-primary);border-radius:8px;padding:1.5rem;border:1px solid var(--border-color);">
                  <h4 style="margin-top:0;margin-bottom:1rem;color:var(--text-primary);border-bottom:2px solid var(--color-primary-200);padding-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;">${Icons.layers} Movimientos de Caja Físicos</h4>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;color:#059669;font-size:1.05rem;"><span>📥 Entradas de Dinero:</span><strong>C$ ${fmt(totalEntradas)}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;color:#ef4444;font-size:1.05rem;"><span>📤 Salidas Expensas:</span><strong>C$ ${fmt(totalSalidas)}</strong></div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;color:#ef4444;font-size:1.05rem;"><span>↩️ Devoluciones Pagadas:</span><strong>C$ ${fmt(devoluciones)}</strong></div>
                  
                  <div style="background:rgba(56,189,248,0.1);border:2px dashed var(--color-primary-500);padding:1.25rem;border-radius:8px;margin-top:1.5rem;text-align:center;">
                     <div style="font-size:0.9rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Efectivo Teórico en Caja</div>
                     <div style="font-size:2.2rem;font-weight:900;color:var(--color-primary-600);">C$ ${fmt(calculoTeorico)}</div>
                  </div>
               </div>
            </div>
            
            <!-- LISTADOS DETALLADOS COMPACTOS -->
            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:1rem;margin-top:1.5rem;">
               <div style="background:var(--bg-primary);border-radius:8px;padding:1rem;border:1px solid var(--border-color);display:flex;flex-direction:column;">
                  <h5 style="margin-top:0;margin-bottom:0.75rem;color:var(--text-primary);border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;font-size:0.95rem;">📄 Facturas Hoy</h5>
                  <div style="overflow-y:auto;flex:1;min-height:120px;max-height:160px;padding-right:4px;">
                    ${ventasDetalle || '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem 0;">No hay facturas registradas</div>'}
                  </div>
               </div>
               <div style="background:var(--bg-primary);border-radius:8px;padding:1rem;border:1px solid var(--border-color);display:flex;flex-direction:column;">
                  <h5 style="margin-top:0;margin-bottom:0.75rem;color:var(--text-primary);border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;font-size:0.95rem;">📋 Créditos</h5>
                  <div style="overflow-y:auto;flex:1;min-height:120px;max-height:160px;padding-right:4px;">
                    ${creditosDetalle || '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem 0;">Sin créditos otorgados</div>'}
                  </div>
               </div>
               <div style="background:var(--bg-primary);border-radius:8px;padding:1rem;border:1px solid var(--border-color);display:flex;flex-direction:column;">
                  <h5 style="margin-top:0;margin-bottom:0.75rem;color:var(--text-primary);border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;font-size:0.95rem;">↕️ Caja (Movimientos)</h5>
                  <div style="overflow-y:auto;flex:1;min-height:120px;max-height:160px;padding-right:4px;">
                    <div style="font-size:0.8rem;text-transform:uppercase;color:#059669;font-weight:700;margin-bottom:4px;">Entradas</div>
                    ${entradasDetalle || '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;">Sin entradas</div>'}
                    <div style="font-size:0.8rem;text-transform:uppercase;color:#ef4444;font-weight:700;margin-top:10px;margin-bottom:4px;">Salidas</div>
                    ${salidasDetalle || '<div style="color:var(--text-muted);font-size:0.8rem;">Sin salidas</div>'}
                  </div>
               </div>
               <div style="background:var(--bg-primary);border-radius:8px;padding:1rem;border:1px solid var(--border-color);display:flex;flex-direction:column;">
                  <h5 style="margin-top:0;margin-bottom:0.75rem;color:var(--text-primary);border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;font-size:0.95rem;">↩️ Devoluciones</h5>
                  <div style="overflow-y:auto;flex:1;min-height:120px;max-height:160px;padding-right:4px;">
                    ${devolucionesDetalle || '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem 0;">No hubo devoluciones</div>'}
                  </div>
               </div>
            </div>
            
            <div style="background:var(--bg-primary);border-radius:8px;padding:1.5rem;border:1px solid var(--border-color);margin-top:1.5rem;">
               <h4 style="margin-top:0;margin-bottom:1rem;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;">${Icons.wallet} Conteo Físico de Divisas</h4>
               <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
                  <div>
                    <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:0.4rem;color:var(--text-muted);text-transform:uppercase;">Córdobas (C$ Físico)</label>
                    <input type="number" id="conteoCaja" class="form-input" placeholder="0.00" step="0.01" style="font-size:1.5rem;font-weight:bold;height:50px;">
                  </div>
                  <div>
                    <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:0.4rem;color:var(--text-muted);text-transform:uppercase;">Dólares (USA Físico)</label>
                    <input type="number" id="conteoDolares" class="form-input" placeholder="0.00" step="0.01" style="font-size:1.5rem;font-weight:bold;height:50px;">
                  </div>
               </div>
            </div>
         </div>
         <div style="background:var(--bg-primary);padding:1rem 2rem;display:flex;justify-content:flex-end;gap:1.5rem;border-top:1px solid var(--border-color);flex-shrink:0;">
             <button onclick="VentasModule.closePOSOverlay()" class="btn btn--ghost" style="font-size:1.1rem;padding:0.6rem 2rem;">Cancelar y Volver</button>
             <button onclick="VentasModule.confirmCloseTurno()" class="btn btn--danger" style="font-size:1.1rem;font-weight:700;padding:0.75rem 2rem;">Bloquear y Cerrar Turno</button>
         </div>
      </div>
    `;
  };
  const renderConsultorPrecios = () => '<div style="padding:2rem;">Consultor de precios... (En desarrollo)</div>';
  const renderPOSDevoluciones = () => '<div style="padding:2rem;">Devoluciones... (En desarrollo)</div>';
  const renderApartados = () => '<div style="padding:2rem;">Apartados... (En desarrollo)</div>';
  const renderCotizaciones = () => '<div style="padding:2rem;">Cotizaciones... (En desarrollo)</div>';
  const renderProductosVendidos = () => '<div style="padding:2rem;">Productos Vendidos (En desarrollo)</div>';
  const renderClientes = () => '<div style="padding:2rem;">Clientes... (En desarrollo)</div>';
  const renderAbonos = () => '<div style="padding:2rem;">Abonos... (En desarrollo)</div>';
  const renderReimpresion = () => '<div style="padding:2rem;">Reimpresión... (En desarrollo)</div>';
  const renderCortes = () => '<div style="padding:2rem;">Cortes de caja... (En desarrollo)</div>';
  const renderDevoluciones = () => '<div style="padding:2rem;">Devoluciones general... (En desarrollo)</div>';
  const renderReportes = () => {
    const ventasList = getData('ventas').filter(v => v.detalles_pago && v.detalles_pago.asumido === true);

    // Calculate totals
    const totalVentas = ventasList.reduce((s, v) => s + parseFloat(v.base_total || v.total), 0);
    const totalComision = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.montoAsumidoBancario || 0), 0);
    const totalIR = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.montoAsumidoIR || 0), 0);
    const totalDeducido = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.totalImpuestoAsumido || 0), 0);

    return `
      <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-primary); display:flex; align-items:center; gap:8px;">
          ${Icons.chart} Reporte: Impuesto sobre Comisión Bancaria
        </h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Total Ventas (Base)</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">C$ ${fmt(totalVentas)}</div>
          </div>
          <div style="background: rgba(239,68,68,0.05); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.2);">
            <div style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Costo Bancario Asumido</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #ef4444;">- C$ ${fmt(totalComision)}</div>
          </div>
          <div style="background: rgba(239,68,68,0.05); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.2);">
            <div style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">IR Asumido</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #ef4444;">- C$ ${fmt(totalIR)}</div>
          </div>
          <div style="background: rgba(16,185,129,0.05); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(16,185,129,0.2);">
            <div style="font-size: 0.85rem; color: #059669; text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Ganancia Neta (Deducida)</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #059669;">C$ ${fmt(totalVentas - totalDeducido)}</div>
          </div>
        </div>

        <div style="background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); text-align: left;">
              <tr>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">No. Factura</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">Fecha</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">POS Banco</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">Monto Base</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">Comisión Bancaria</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">IR</th>
                <th style="padding: 1rem; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">Ganancia Neta</th>
              </tr>
            </thead>
            <tbody>
              ${ventasList.length === 0 ? `<tr><td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No hay ventas registradas con comisión bancaria asumida.</td></tr>` :
        ventasList.map(v => {
          const base = parseFloat(v.base_total || v.total);
          const com_b = parseFloat(v.detalles_pago.montoAsumidoBancario || 0);
          const ir = parseFloat(v.detalles_pago.montoAsumidoIR || 0);
          const bank = v.detalles_pago.banco || 'N/A';
          return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                      <td style="padding: 1rem; font-weight: 600; color: var(--color-primary-600);">${v.numero}</td>
                      <td style="padding: 1rem; font-size: 0.9rem;">${fmtD(v.fecha)}</td>
                      <td style="padding: 1rem;">${bank}</td>
                      <td style="padding: 1rem; font-weight: 600;">C$ ${fmt(base)}</td>
                      <td style="padding: 1rem; color: #ef4444;">-C$ ${fmt(com_b)}</td>
                      <td style="padding: 1rem; color: #ef4444;">-C$ ${fmt(ir)}</td>
                      <td style="padding: 1rem; font-weight: 700; color: #059669;">C$ ${fmt(base - com_b - ir)}</td>
                    </tr>
                  `;
        }).join('')
      }
            </tbody>
          </table>
        </div>
      </div>
    `;
  };
  const renderGanancias = () => '<div style="padding:2rem;">Ganancias... (En desarrollo)</div>';
  const renderCatalogo = () => '<div style="padding:2rem;">Catálogo... (En desarrollo)</div>';
  const showShortcutsHelp = () => { posActionModal = 'shortcuts'; posActionData = null; App.render(); };

  return {
    render, navigateTo, navigateSidebar,
    searchProducts, addToCart, removeItem, selectCartRow, modifySelected, setPosComment, promptGlobalDiscount,
    searchClientsCombo, selectClientCombo,
    setCurrency, clearCart, suspendSale, recoverSale, recoverSaleFromTab,
    openTurno, closeTurno, confirmCloseTurno,
    openPaymentModal, closePaymentModal, closePosModal, setPaymentOnly, setPaymentConfig, setTarjetaModo, setPriceList, processPaymentOverride, updateCashDisplay,
    openPOSOverlay, closePOSOverlay, restorePOS, showShortcutsHelp, modifySelectedAction,
    submitPosActionModal, closeActionModal, promptGlobalDiscountModal, openPosNewClientModal
  };
})();

window.VentasModule = VentasModule;
console.log('✅ Módulo de Ventas cargado correctamente');
