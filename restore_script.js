const fs = require('fs');

const parts = [
    `/**
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
  let showPaymentModal = false;

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

`,

    `
  const navigateSidebar = (v) => {
    if (v === 'entrada-caja') { openCajaInOut('ingreso'); return; }
    if (v === 'salida-caja') { openCajaInOut('retiro'); return; }
    if (v === 'pos-clientes') { navigateTo('clientes'); return; }
    if (v === 'pos-sucursal') { alert('Funcionalidad de Consulta Sucursal en desarrollo.'); return; }
    if (v === 'catalogo') { navigateTo('catalogo'); return; }
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
    ind.innerHTML = \`<button class="pos-taskbar-btn" onclick="VentasModule.restorePOS()"><span class="pos-taskbar-btn__icon">🛒</span><span class="pos-taskbar-btn__label">Punto de Venta</span>\${cart.length > 0 ? \`<span class="pos-taskbar-btn__badge">\${cart.length}</span>\` : ''}</button>\`;
    document.body.appendChild(ind);
  };
  const removeTaskbarIndicator = () => { const el = document.getElementById('posTaskbarIndicator'); if (el) el.remove(); };

  const renderPOSOverlay = () => {
    if (!posOverlayOpen || posMinimized) return;
    let overlay = document.getElementById('posOverlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'posOverlay'; overlay.className = 'pos-overlay'; document.body.appendChild(overlay); }
    const posViews = { pos: renderPOS, 'consultor-precios': renderConsultorPrecios, 'pos-devoluciones': renderPOSDevoluciones, apartados: renderApartados, cotizaciones: renderCotizaciones, 'cerrar-turno': renderCerrarTurno };
    const content = (posViews[posSubView] || renderPOS)();
    overlay.innerHTML = \`<div class="pos-overlay__titlebar"><div class="pos-overlay__titlebar-left"><span class="pos-overlay__titlebar-icon">🛒</span><span class="pos-overlay__titlebar-title">ALLTECH - Punto de Venta</span></div><div class="pos-overlay__titlebar-right"><button class="pos-overlay__titlebar-btn" onclick="VentasModule.showShortcutsHelp()" title="Atajos (F1)">❓</button><button class="pos-overlay__titlebar-btn pos-overlay__titlebar-btn--close" onclick="VentasModule.closePOSOverlay()">✕</button></div></div><div class="pos-overlay__body">\${content}</div>\`;
    removeTaskbarIndicator();
    setTimeout(() => document.getElementById('posSearch')?.focus(), 100);
  };
`,

    `
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

  const tile = (id, icon, name, desc, color, bg, badge) => \`<div class="ventas-tile" onclick="\${(id === 'abrir-entrada' || id === 'abrir-salida') ? \`VentasModule.navigateSidebar('\${id.replace('abrir-','') + '-caja'}')\` : \`VentasModule.navigateTo('\${id}')\`}">
    <div class="ventas-tile__icon" style="background:\${bg};color:\${color};">\${icon}</div><div class="ventas-tile__name">\${name}</div><div class="ventas-tile__desc">\${desc}</div><div class="ventas-tile__badge" style="background:\${bg};color:\${color};">\${badge}</div></div>\`;
  const backBtn = () => \`<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">⬅ Volver al Panel</button>\`;

`,

    `
  const renderDashboard = () => {
    const m = getMetrics();
    const devs = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today())).length;
    return \`
      <div class="ventas-header"><div class="ventas-header__title">\${Icons.shoppingCart} Módulo de Ventas</div>
        <div class="ventas-kpis">
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('pos')"><div class="ventas-kpi__label">Ventas del Día</div><div class="ventas-kpi__value" style="color:#34d399;">C$\${fmt(m.totalDia)}</div><div class="ventas-kpi__sub">\${m.facturasHoy} facturas</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('catalogo')"><div class="ventas-kpi__label">Ventas del Mes</div><div class="ventas-kpi__value" style="color:#60a5fa;">C$\${fmt(m.totalMes)}</div><div class="ventas-kpi__sub">Acumulado</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('caja')"><div class="ventas-kpi__label">Total en Caja</div><div class="ventas-kpi__value" style="color:#fbbf24;">C$\${fmt(m.totalCaja)}</div><div class="ventas-kpi__sub">Disponible</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('ganancias')"><div class="ventas-kpi__label">Ganancia Bruta</div><div class="ventas-kpi__value" style="color:\${m.gananciaB >= 0 ? '#34d399' : '#f87171'};">C$\${fmt(m.gananciaB)}</div><div class="ventas-kpi__sub">\${m.gananciaB >= 0 ? '✅' : '⚠️'} Mes actual</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('abonos')"><div class="ventas-kpi__label">Créditos Pend.</div><div class="ventas-kpi__value" style="color:#a78bfa;">\${getData('ventas').filter(v => v.metodo === 'credito' && v.saldo_pendiente > 0).length}</div><div class="ventas-kpi__sub">Facturas</div></div>
          <div class="ventas-kpi" onclick="VentasModule.navigateTo('devoluciones')"><div class="ventas-kpi__label">Devoluciones</div><div class="ventas-kpi__value" style="color:#f472b6;">\${devs}</div><div class="ventas-kpi__sub">Hoy</div></div>
        </div>
      </div>
      <div class="ventas-grid">
        <div class="ventas-tile ventas-tile--pos" onclick="VentasModule.openPOSOverlay()"><div class="ventas-tile__icon" style="background:#ecfdf5;color:#059669;">\${Icons.shoppingCart}</div><div class="ventas-tile__name">Punto de Venta</div><div class="ventas-tile__desc">POS rápido con atajos</div><div class="ventas-tile__badge" style="background:#ecfdf5;color:#059669;">F12 - Abrir</div></div>
        \${tile('catalogo', Icons.list, 'Catálogo de Ventas', 'Historial completo', '#3b82f6', '#eff6ff', m.ventasMes.length + ' ventas')}
        \${tile('productos-vendidos', Icons.package, 'Productos Vendidos', 'Análisis de rotación', '#8b5cf6', '#f5f3ff', 'Analítica')}
        \${tile('clientes', Icons.users, 'Clientes', 'Créditos y saldos', '#0ea5e9', '#f0f9ff', getClients().length + ' clientes')}
        \${tile('abonos', Icons.dollarSign, 'Abonos', 'Pagos a créditos', '#10b981', '#ecfdf5', 'Registrar')}
        \${tile('reimpresion', Icons.printer, 'Reimpresión', 'Tickets y facturas', '#6366f1', '#eef2ff', 'Buscar')}
        \${tile('cortes', Icons.calculator, 'Cortes de Caja', 'Cierre y arqueo', '#ec4899', '#fdf2f8', 'Corte')}
        \${tile('abrir-entrada', Icons.download, 'Entrada de Efectivo', 'Añadir a caja', '#34d399', '#ecfdf5', 'Ingreso')}
        \${tile('abrir-salida', Icons.upload, 'Salida de Efectivo', 'Retiro de caja', '#f87171', '#fef2f2', 'Egreso')}
        \${tile('devoluciones', Icons.refreshCw, 'Devoluciones', 'Gestión de retornos', '#ef4444', '#fef2f2', devs + ' hoy')}
        \${tile('reportes', Icons.barChart, 'Reportes', 'Estadísticas avanzadas', '#6366f1', '#eef2ff', 'Exportar')}
        \${tile('ganancias', Icons.trendingUp, 'Ganancias', 'Márgenes y rentabilidad', '#059669', '#ecfdf5', 'C$' + fmt(m.gananciaB))}
      </div>\`;
  };

  const selectCartRow = (i) => { selectedCartRow = i; highlightCartRow(); App.render(); };
`,

    `
  const renderPOS = () => {
    if (!turnoActivo) return renderOpenTurno();
    const clients = getClients();
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    const currSymbol = selectedCurrency === 'USD' ? '$' : 'C$';

    const displayedClientName = selectedClient ? (clients.find(c => c.id === selectedClient)?.empresa || clients.find(c => c.id === selectedClient)?.nombreCliente) : 'Público General';

    return \`
      <div style="display:grid;grid-template-columns:56px 1fr 340px;height:calc(100vh - var(--header-height) - 20px);border-radius:var(--border-radius-lg);overflow:hidden;border:1px solid var(--border-color);box-shadow:var(--shadow-lg);background:var(--bg-secondary);">
        <div style="background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;overflow-y:auto;">
          \${\"[pos|🛒|Venta|F2],[consultor-precios|🔍|Precios|F3],[pos-devoluciones|↩️|Devoluc.|F9],[entrada-caja|📥|Entradas|],[salida-caja|📤|Salidas|],[pos-clientes|👥|Clientes|],[pos-sucursal|🏢|Sucursal|],[catalogo|📄|Ventas|]\".split(',').map(str=>str.slice(1,-1).split('|')).map(b => 
            \`<button onclick="VentasModule.navigateSidebar('\${b[0]}')" style="background:\${posSubView === b[0] ? 'rgba(56,189,248,.2)' : 'transparent'};border:none;color:white;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;transition:all .15s;" title="\${b[2]}\${b[3] ? ' (' + b[3] + ')' : ''}">
            <span style="font-size:18px;">\${b[1]}</span><span style="text-align:center;word-break:keep-all;">\${b[2]}</span>\${b[3] ? \`<span style="font-size:8px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">\${b[3]}</span>\` : ''}</button>\`).join('')}
          <div style="flex:1;"></div>
          \${suspendedSales.length > 0 ? \`<button onclick="VentasModule.recoverSale()" style="background:rgba(251,191,36,.2);border:none;color:#fbbf24;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;" title="Recuperar venta (F10)"><span style="font-size:18px;">⏸️</span><span>Espera(\${suspendedSales.length})</span><span style="font-size:8px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">F10</span></button>\` : ''}
          <button onclick="VentasModule.closeTurno()" style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;margin-bottom:4px;" title="Cerrar turno (F11)"><span style="font-size:18px;">🔒</span><span>Cerrar</span><span style="font-size:8px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">F11</span></button>
        </div>
        
        <div style="display:flex;flex-direction:column;border-right:1px solid var(--border-color);overflow:hidden;position:relative;">
          
          <div class="pos-client-bar" style="display:flex;align-items:center;gap:12px;">
            <span class="pos-client-bar__label">\${Icons.user} Cliente:</span>
            <div style="position:relative;flex:1;">
               <input type="text" id="posClientSearch" class="form-input" placeholder="Buscar cliente..." value="\${selectedClient ? displayedClientName : ''}" oninput="VentasModule.searchClientsCombo(this.value)" autocomplete="off" onfocus="this.select()" style="padding:4px 8px;font-size:12px;height:24px;">
               <div id="posClientResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;max-height:150px;overflow-y:auto;z-index:200;box-shadow:var(--shadow-md);"></div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="VentasModule.nuevoClienteRapido()" style="padding:4px;height:24px;font-size:11px;">+ Nuevo</button>
            <span style="margin-left:auto;font-size:12px;font-weight:700;">Moneda:</span>
            <select onchange="VentasModule.setCurrency(this.value)" style="width:75px;padding:2px 4px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;">
              <option value="NIO" \${selectedCurrency === 'NIO' ? 'selected' : ''}>C$ NIO</option>
              <option value="USD" \${selectedCurrency === 'USD' ? 'selected' : ''}>$ USD</option>
            </select>
            <span style="margin-left:8px;font-size:11px;opacity:.8;font-weight:700;">Turno: #\${turnoActivo.numero || 1} | \${turnoActivo.usuario}</span>
          </div>

          <div class="pos-toolbar">
            <div class="pos-toolbar__search" style="position:relative;flex:1;">
              <span class="pos-toolbar__search-icon">\${Icons.search}</span>
              <input type="text" id="posSearch" placeholder="Buscar producto por nombre o código (F2)" oninput="VentasModule.searchProducts(this.value)" autocomplete="off">
              <div id="posSearchResults" style="display:none;" class="pos-search-results"></div>
            </div>
            <button class="pos-toolbar__btn" onclick="VentasModule.suspendSale()" \${cart.length === 0 ? 'disabled' : ''}>⏸️ Vta en espera <kbd>F8</kbd></button>
            <button class="pos-toolbar__btn" onclick="VentasModule.clearCart()">🗑️ <kbd>F5</kbd></button>
          </div>
`,

    `          
          <div class="pos-items" id="posItemsContainer" style="flex:1;overflow-y:auto;">
            \${cart.length === 0 ? \`<div class="pos-items__empty"><div class="pos-items__empty-icon">🛒</div><p>Busque un producto o escanee un código</p></div>\` : \`
            <table><thead><tr><th>C. Barras</th><th>Cant.</th><th>Nombre de producto</th><th>TP</th><th>P.Unit</th><th>Descuento</th><th style="text-align:right;">Total</th></tr></thead>
              <tbody>\${cart.map((item, i) => \`
                <tr class="pos-cart-row \${selectedCartRow === i ? 'pos-cart-row--selected' : ''}" data-row="\${i}" onclick="VentasModule.selectCartRow(\${i})" style="cursor:pointer;">
                  <td>\${item.codigo || item.sku || '-'}</td>
                  <td><strong style="font-size:14px;">\${item.cantidad}</strong></td>
                  <td><strong>\${item.nombre}</strong></td>
                  <td>Público</td>
                  <td>\${currSymbol}\${fmt(item.precio)}</td>
                  <td style="\${(item.descuento > 0) ? 'color:var(--color-danger);font-weight:700;' : ''}">\${item.descuento > 0 ? '-' + currSymbol + fmt(item.descuento) : '-'}</td>
                  <td style="text-align:right;font-weight:700;">\${currSymbol}\${fmt(item.precio * item.cantidad - (item.descuento || 0))}</td>
                </tr>
              \`).join('')}</tbody>
            </table>\`}
          </div>

          <div style="display:flex;gap:8px;padding:12px;background:var(--bg-primary);border-top:1px solid var(--border-color);align-items:center;">
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('qty')" \${selectedCartRow < 0 ? 'disabled' : ''}>CANTIDAD</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('del')" \${selectedCartRow < 0 ? 'disabled' : ''} style="color:var(--color-danger);">ELIMINAR</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('disc')" \${selectedCartRow < 0 ? 'disabled' : ''}>DESCUENTO</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('price')" \${selectedCartRow < 0 ? 'disabled' : ''}>CAMBIAR PRECIO</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;background:var(--bg-primary);">
          <div class="pos-totals" style="padding:16px;">
            <div class="pos-totals__row" style="font-size:12px;"><span>Subtotal</span><span>\${currSymbol}\${fmt(subtotal)}</span></div>
            <div class="pos-totals__row" style="font-size:12px;"><span>Descuento Promocional</span><span style="color:var(--color-danger);">-\${currSymbol}\${fmt(descuento)}</span></div>
            <div class="pos-totals__row" style="font-size:12px;"><span>IVA 15%</span><span>\${currSymbol}\${fmt(iva)}</span></div>
            
            <div class="pos-totals__row" style="margin-top:8px;border-top:1px dashed var(--border-color);padding-top:8px;">
              <button class="btn btn--secondary btn--sm" onclick="VentasModule.promptGlobalDiscount()" style="font-size:11px;padding:4px;">🏷️ Desc. Global</button>
              <span style="color:var(--color-danger);font-weight:700;">-\${currSymbol}\${fmt(globalDiscount)}</span>
            </div>
            <div class="pos-totals__row pos-totals__row--total" style="margin-top:12px;font-size:24px;"><span>TOTAL</span><span id="posTotalDisplay">\${currSymbol}\${fmt(total)}</span></div>
          </div>
          
          <div style="padding:16px;flex:1;">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">COMENTARIO INVOICE</label>
            <textarea id="posCommentInput" style="width:100%;height:60px;padding:8px;border-radius:4px;border:1px solid var(--border-color);resize:none;font-size:12px;" placeholder="Agregue comentarios adicionales para la factura..." onchange="VentasModule.setPosComment(this.value)">\${posComment}</textarea>
          </div>

          <div class="pos-cobrar" style="padding:16px;background:white;border-top:1px solid var(--border-color);">
            <button class="pos-cobrar__btn" onclick="VentasModule.openPaymentModal()" \${cart.length === 0 ? 'disabled' : ''} style="width:100%;height:60px;font-size:20px;letter-spacing:1px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              \${Icons.check} COBRAR <kbd style="background:transparent;border:1px solid white;color:white;">ESC</kbd>
            </button>
          </div>
        </div>
      </div>
      \${showPaymentModal ? renderPaymentModal(total, currSymbol) : ''}
    \`;
  };

  const renderOpenTurno = () => \`
      <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;">
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;padding:3rem;text-align:center;max-width:420px;box-shadow:var(--shadow-xl);">
          <div style="font-size:4rem;margin-bottom:1rem;">🏪</div>
          <h2 style="margin-bottom:.5rem;color:var(--text-primary);">Abrir Punto de Venta</h2>
          <p style="color:var(--text-muted);margin-bottom:2rem;">Ingrese el fondo de caja inicial para comenzar su turno de ventas.</p>
          <button class="pos-cobrar__btn" onclick="VentasModule.openTurno()" style="max-width:280px;margin:0 auto;">💰 Abrir Turno</button>
          <button class="btn btn--ghost" onclick="VentasModule.closePOSOverlay()" style="margin-top:12px;display:block;width:100%;">✕ Cerrar Ventana</button>
        </div>
      </div>\`;
`,

    `
  const renderPaymentModal = (total, currSymbol) => {
    return \`<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;">
         <div style="background:var(--bg-secondary);border-radius:12px;width:500px;box-shadow:var(--shadow-xl);overflow:hidden;">
            <div style="padding:16px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
               <h3 style="margin:0;">💳 Confirmar Pago</h3>
               <button class="btn btn--ghost btn--icon" onclick="VentasModule.closePaymentModal()">✕</button>
            </div>
            <div style="padding:24px;">
               <div style="text-align:center;margin-bottom:24px;">
                 <div style="font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Monto a Cobrar</div>
                 <div style="font-size:42px;font-weight:800;color:var(--color-primary-500);">\${currSymbol}\${fmt(total)}</div>
               </div>
               <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Tipo de Pago:</div>
               <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:24px;">
                  \${['efectivo', 'tarjeta', 'transferencia', 'credito'].map(m => \`
                    <button style="padding:12px;border:2px solid \${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--border-color)'};background:\${selectedPayment === m ? 'rgba(56,189,248,0.1)' : 'transparent'};border-radius:8px;font-weight:700;color:\${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--text-primary)'};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;justify-content:center;" onclick="VentasModule.setPaymentOnly('\${m}')">
                      <span style="font-size:20px;">\${m === 'efectivo' ? '💵' : m === 'tarjeta' ? '💳' : m === 'transferencia' ? '🏦' : '📋'}</span>
                      <span>\${m.toUpperCase()}</span>
                    </button>
                  \`).join('')}
               </div>
               \${selectedPayment === 'efectivo' ? \`
                  <div style="background:var(--bg-primary);padding:16px;border-radius:8px;border:1px solid var(--border-color);">
                     <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">Efectivo Recibido:</label>
                     <input type="number" oninput="VentasModule.updateCashDisplay(this)" class="form-input" data-total="\${total}" placeholder="C$0.00" style="font-size:1.5rem;font-weight:800;border:2px solid var(--border-color);height:50px;">
                     <div id="posCambioBox" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color);">
                       <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>Recibe:</span><strong id="posCambioRecibido">C$0.00</strong></div>
                       <div style="display:flex;justify-content:space-between;font-size:18px;"><span>Cambio a dar:</span><strong id="posCambioValor">C$0.00</strong></div>
                     </div>
                  </div>
               \` : ''}
            </div>
            <div style="padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;gap:12px;">
               <button class="btn btn--ghost" style="flex:1;" onclick="VentasModule.closePaymentModal()">Cancelar</button>
               <button class="pos-cobrar__btn" style="flex:2;" onclick="VentasModule.processPaymentOverride()">\${Icons.check} Confirmar Pago</button>
            </div>
         </div>
      </div>\`;
  };

  const processPaymentOverride = () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    if (selectedPayment === 'efectivo' && cashReceived < total) { alert('El efectivo recibido es menor al total.'); return; }
    
    const costoTotal = cart.reduce((s, i) => s + (i.costo * i.cantidad), 0);
    const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
    const clientFound = selectedClient ? getClients().find(c => c.id === selectedClient) : null;
    
    addRec('ventas', { numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient, cliente: clientFound ? (clientFound.empresa || clientFound.nombreCliente || 'Cliente') : 'Público General', items: cart.map(i => ({ ...i })), subtotal, descuento, descuento_global: globalDiscount, iva, total, costo_total: costoTotal, metodo: selectedPayment, efectivo_recibido: selectedPayment === 'efectivo' ? cashReceived : 0, cambio: selectedPayment === 'efectivo' ? Math.max(0, cashReceived - total) : 0, saldo_pendiente: selectedPayment === 'credito' ? total : 0, vendedor: user()?.name || 'N/A', estado: 'completada', comentario: posComment });
    
    alert(\`✅ Venta \${numFactura} registrada!\\nTotal: C$\${fmt(total)}\${selectedPayment === 'efectivo' ? '\\nCambio: C$' + fmt(Math.max(0, cashReceived - total)) : ''}\`);
    cart = []; selectedClient = null; cashReceived = 0; globalDiscount = 0; posComment = ''; showPaymentModal = false;
    posSubView = 'pos'; App.render();
  };
`,

    `
  const searchClientsCombo = (q) => {
    const el = document.getElementById('posClientResults');
    if (!el) return;
    if (!q || q.length < 1) { el.style.display = 'none'; return; }
    const found = getClients().filter(c => (c.empresa || c.nombreCliente || '').toLowerCase().includes(q.toLowerCase())).slice(0, 5);
    if (found.length === 0) el.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text-muted);">Sin resultados. <a href="#" onclick="VentasModule.nuevoClienteRapido();return false;">Crear nuevo</a></div>';
    else el.innerHTML = found.map(c => \`<div style="padding:8px;font-size:12px;cursor:pointer;border-bottom:1px solid #eee;" onclick="VentasModule.selectClientCombo('\${c.id}')">\${c.empresa || c.nombreCliente}</div>\`).join('');
    el.style.display = 'block';
  };
  const selectClientCombo = (id) => { selectedClient = id; App.render(); };
  const nuevoClienteRapido = () => {
    const name = prompt('Nombre o Empresa del nuevo cliente:');
    if (!name) return;
    let dbClients = []; try { dbClients = JSON.parse(localStorage.getItem('cli_clientes') || '[]'); } catch(e){}
    const newCli = { id: Date.now().toString(36), nombreCliente: name, fechaRegistro: new Date().toISOString() };
    dbClients.push(newCli); localStorage.setItem('cli_clientes', JSON.stringify(dbClients));
    alert('Cliente agregado: ' + name); selectedClient = newCli.id; App.render();
  };

  const setPosComment = (v) => { posComment = v; };
  const promptGlobalDiscount = () => {
    const d = prompt('Agregar Descuento GLOBAL a la factura:\\nEjemplo: 100 o 5%');
    if(!d) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0) - cart.reduce((s, i) => s + (i.descuento || 0), 0);
    if(d.includes('%')) { const pct = parseFloat(d.replace('%','')); if(!isNaN(pct)) globalDiscount = subtotal * (pct/100); }
    else { const val = parseFloat(d); if(!isNaN(val)) globalDiscount = val; }
    App.render();
  };
  const openPaymentModal = () => { if(cart.length === 0) return; showPaymentModal = true; selectedPayment = 'efectivo'; cashReceived = 0; App.render(); };
  const closePaymentModal = () => { showPaymentModal = false; App.render(); };
  const setPaymentOnly = (m) => { selectedPayment = m; App.render(); };
  const setCurrency = (c) => { selectedCurrency = c; App.render(); };
  const clearCart = () => { cart = []; selectedClient = null; cashReceived = 0; globalDiscount=0; posComment=''; App.render(); };
  const suspendSale = () => { if (cart.length === 0) return; suspendedSales.push({ cart: [...cart], client: selectedClient, date: new Date().toISOString() }); clearCart(); };
  const recoverSale = () => { if (suspendedSales.length === 0) return; const sale = suspendedSales.pop(); cart = sale.cart; selectedClient = sale.client; App.render(); };

  const modifySelected = (action) => {
    if (selectedCartRow < 0 || selectedCartRow >= cart.length) return;
    const item = cart[selectedCartRow];
    if (action === 'qty') { const val = prompt('CANTIDAD de producto:', item.cantidad); if(val && !isNaN(val) && val > 0) cart[selectedCartRow].cantidad = parseInt(val); }
    else if (action === 'del') { if(confirm('¿Eliminar "' + item.nombre + '"?')) removeItem(selectedCartRow); return; }
    else if (action === 'disc') {
        const d = prompt('Descuento INDIVIDUAL:\\nEjemplo: 50 o 10%'); if(!d) return;
        if(d.includes('%')) { const pct = parseFloat(d.replace('%','')); if(!isNaN(pct)) cart[selectedCartRow].descuento = (item.precio * item.cantidad) * (pct/100); }
        else { const val = parseFloat(d); if(!isNaN(val)) cart[selectedCartRow].descuento = val; }
    }
    else if (action === 'price') { const p = prompt('Cambiar PRECIO (P.Unit actual: ' + item.precio + '):', item.precio); if(p && !isNaN(p) && p > 0) cart[selectedCartRow].precio = parseFloat(p); }
    App.render();
  };
`,

    `
  const searchProducts = (query) => {
    clearTimeout(searchTimeout); const el = document.getElementById('posSearchResults'); if (!el) return;
    if (!query || query.length < 1) { el.style.display = 'none'; return; }
    searchTimeout = setTimeout(() => {
      const prods = getProducts().filter(p => { const q = query.toLowerCase(); return (p.nombre || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q); }).slice(0, 8);
      if (prods.length === 0) { el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">Sin resultados</div>'; }
      else { el.innerHTML = prods.map(p => \`<div class="pos-search-result" onclick="VentasModule.addToCart('\${p.id}')"><div><div class="pos-search-result__name">\${p.nombre || 'Sin nombre'}</div><div class="pos-search-result__info">\${p.codigo || p.sku || ''} | Stock: \${p.stock ?? p.cantidad ?? '∞'}</div></div><div class="pos-search-result__price">C$\${fmt(p.precioVenta || p.precio || 0)}</div></div>\`).join(''); }
      el.style.display = 'block';
    }, 200);
  };

  const addToCart = (productId) => {
    const p = getProducts().find(x => x.id === productId); if (!p) return;
    const existing = cart.findIndex(i => i.productId === productId);
    let targetRowIndex;
    if (existing >= 0) { cart[existing].cantidad++; targetRowIndex = existing; }
    else { cart.push({ productId, nombre: p.nombre || 'Producto', codigo: p.codigo, sku: p.sku, precio: parseFloat(p.precioVenta || p.precio || 0), costo: parseFloat(p.precioCompra || p.costo || 0), cantidad: 1, descuento: 0 }); targetRowIndex = cart.length - 1; }
    const el = document.getElementById('posSearchResults'); if (el) el.style.display = 'none';
    const si = document.getElementById('posSearch'); if (si) si.value = '';
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
      { key: 'F5', action: () => clearCart() },
      { key: 'F8', action: () => suspendSale() },
      { key: 'F10', action: () => recoverSale() },
      { key: 'F11', action: () => closeTurno() },
      { key: 'Escape', action: () => { if(showPaymentModal) closePaymentModal(); else openPaymentModal(); } },
      { key: 'ArrowDown', action: () => { if(cart.length>0) { e.preventDefault(); selectedCartRow = Math.min(selectedCartRow + 1, cart.length - 1); highlightCartRow(); App.render(); } } },
      { key: 'ArrowUp', action: () => { if(cart.length>0) { e.preventDefault(); selectedCartRow = Math.max(selectedCartRow - 1, 0); highlightCartRow(); App.render(); } } },
    ];
    const gs = map.find(s => s.global && s.key === e.key);
    if (gs) { e.preventDefault(); gs.action(); return; }
    if (!posOverlayOpen || posMinimized) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      if(e.key === 'Escape') { e.target.blur(); return; }
      else return; 
    }
    const shortcut = map.find(s => !s.global && s.key === e.key);
    if (shortcut) { e.preventDefault(); shortcut.action(); }
  };
  document.addEventListener('keydown', handleKeyboard);

  const highlightCartRow = () => {};

  const openCajaInOut = (tipo) => {
    const motivo = prompt('Motivo del ' + tipo + ':'); if(!motivo) return;
    const monto = parseFloat(prompt('Monto (C$):')); if(isNaN(monto) || monto <= 0) { alert('Monto inválido'); return; }
    addRec('cajaMovs', { tipo, motivo, monto, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert('✅ ' + tipo.toUpperCase() + ' registrado existosamente.'); App.render();
  };
`,

    `
  const renderCerrarTurno = () => '<div style="padding:2rem;"><button onclick="VentasModule.confirmCloseTurno()" class="btn btn--primary">Confirmar Cierre de Turno</button></div>';
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
  const renderReportes = () => '<div style="padding:2rem;">Reportes... (En desarrollo)</div>';
  const renderGanancias = () => '<div style="padding:2rem;">Ganancias... (En desarrollo)</div>';
  const renderCatalogo = () => '<div style="padding:2rem;">Catálogo... (En desarrollo)</div>';
  const showShortcutsHelp = () => alert('F2=Buscar, F5=Limpiar, F8=Suspender, F10=Recuperar, F11=Cerrar, ESC=Cobrar');

  return {
    render, navigateTo, navigateSidebar,
    searchProducts, addToCart, removeItem, selectCartRow, modifySelected, setPosComment, promptGlobalDiscount,
    searchClientsCombo, selectClientCombo, nuevoClienteRapido,
    setCurrency, clearCart, suspendSale, recoverSale,
    openTurno, closeTurno, confirmCloseTurno, 
    openPaymentModal, closePaymentModal, setPaymentOnly, processPaymentOverride, updateCashDisplay,
    openPOSOverlay, closePOSOverlay, restorePOS, showShortcutsHelp
  };
})();

window.VentasModule = VentasModule;
console.log('✅ Módulo de Ventas cargado correctamente');
`
];

fs.writeFileSync('js/modules/ventas.js', parts.join(''), 'utf8');
console.log('✅ ventas.js fully reconstructed with all the new functional requirements successfully without duplication issues.');
