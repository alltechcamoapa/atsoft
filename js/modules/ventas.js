const VentasModule = (() => {
  let currentView = 'dashboard';
  let cart = [];
  let selectedClient = null;
  let selectedPayment = 'efectivo';
  let cashReceived = 0;
  let suspendedSales = [];
  let searchTimeout = null;
  let turnoActivo = null; // Se carga lazy cuando hay empresa activa
  let selectedCurrency = 'NIO';
  let posOverlayOpen = false;
  let posMinimized = false;
  let consultorQuery = '';
  let consultorResult = null;
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
  let posPayInUSD = false;
  let posDocReference = '';
  let posSelectedBodegaRetiro = '';
  let posMultiplePayments = [{ metodo: 'efectivo', monto: 0, referencia: '', configIdx: 0 }];
  let cierreConteoNio = '';
  let cierreConteoUsd = '';

  // Multi-Empresa: suffix para aislar datos de ventas por empresa en localStorage
  const getEmpresaSuffix = () => {
    try {
      const user = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
      return user?.empresa_id ? '_' + user.empresa_id.substring(0, 8) : '';
    } catch { return ''; }
  };

  const getIvaRate = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        const regime = localStorage.getItem('regimen_fiscal' + getEmpresaSuffix()) || 'cuota_fija';
        if (regime === 'regimen_general') return 0.15;
      }
    } catch(e) {}
    return 0; // cuota fija = 0% IVA agregado en POS
  };

  const getPosDataUncached = (k) => {
    // Auto-append empresa suffix for POS config keys
    const actualKey = k.startsWith('pos_') ? k + getEmpresaSuffix() : k;
    try { return JSON.parse(localStorage.getItem(actualKey) || '[]'); } catch { return []; }
  };

  const getSK = () => {
    const suffix = getEmpresaSuffix();
    return {
      ventas: 'vnt_ventas' + suffix,
      items: 'vnt_items' + suffix,
      cajaMovs: 'vnt_caja_movs' + suffix,
      cortes: 'vnt_cortes' + suffix,
      devoluciones: 'vnt_devoluciones' + suffix,
      abonos: 'vnt_abonos' + suffix,
      suspended: 'vnt_suspended' + suffix,
      cotizaciones: 'vnt_cotizaciones' + suffix
    };
  };

  // Mantener SK como getter dinámico
  let SK = getSK();

  // Refrescar SK cuando cambie la empresa (al re-renderizar)
  const refreshSK = () => { SK = getSK(); };

  const getData = (k) => {
    refreshSK();
    try {
      // Read from Supabase-backed DataService cache instead of localStorage
      const cache = typeof DataService !== 'undefined' ? DataService.getCache() : null;
      if (cache) {
        switch(k) {
          case 'ventas': return [...(cache.ventas || [])];
          case 'items': {
            // venta_items are embedded in ventas via Supabase joins, flatten them
            const allItems = [];
            (cache.ventas || []).forEach(v => { if (v.items) allItems.push(...v.items); });
            return allItems;
          }
          case 'cajaMovs': return typeof DataService.getCajaMovimientosSync === 'function' ? [] : []; // loaded on demand
          case 'cortes': return typeof DataService.getTurnosCajaSync === 'function' ? [] : []; // loaded on demand
          case 'devoluciones': return [];  // loaded on demand
          case 'abonos': return []; // loaded on demand
          case 'suspended': return []; // loaded on demand
          case 'cotizaciones': return []; // loaded on demand
        }
      }
      // Fallback to localStorage for backward compatibility during migration
      return JSON.parse(localStorage.getItem(SK[k]) || '[]');
    } catch { return []; }
  };
  const setData = (k, d) => {
    refreshSK();
    // Write to localStorage as fallback backup, Supabase writes happen via DataService methods
    try { localStorage.setItem(SK[k], JSON.stringify(d)); } catch(e) { console.warn('localStorage write failed:', e); }
  };
  const genId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const addRec = async (k, r) => {
    r.id = genId();
    r.created_at = new Date().toISOString();
    try {
      // Route through DataService/Supabase based on record type
      switch(k) {
        case 'ventas': {
          const result = await DataService.createVenta(r);
          if (result) return result;
          break;
        }
        case 'cajaMovs': {
          const result = await DataService.createCajaMovimiento(r);
          if (result) return result;
          break;
        }
        case 'devoluciones': {
          const result = await DataService.createDevolucion(r);
          if (result) return result;
          break;
        }
        case 'abonos': {
          const result = await DataService.createAbonoCliente(r);
          if (result) return result;
          break;
        }
        case 'suspended':
        case 'cotizaciones': {
          const result = await DataService.createCotizacionPos(r);
          if (result) return result;
          break;
        }
      }
    } catch(e) { console.error(`Supabase addRec(${k}) error:`, e); }
    // Fallback: save to localStorage
    const d = getData(k); d.unshift(r); setData(k, d);
    return r;
  };
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

  const syncProductStock = async (id, newStock) => {
    try {
      if (typeof DataService !== 'undefined' && DataService.updateProducto) {
        await DataService.updateProducto(id, { stock: newStock });
      }
      const localProds = getPosDataUncached('productos');
      const idx = localProds.findIndex(p => p.id === id);
      if (idx >= 0) {
        localProds[idx].stock_actual = newStock;
        localProds[idx].stock = newStock;
        localStorage.setItem('productos', JSON.stringify(localProds));
      }
    } catch (e) {
      console.warn('Error syncing stock for ' + id + ':', e);
    }
  };

  const getProducts = () => {
    try {
      if (typeof DataService !== 'undefined' && DataService.getProductosSync) {
        const dsProds = DataService.getProductosSync();
        if (dsProds && dsProds.length > 0) return dsProds;
      }
      if (typeof ProductosModule !== 'undefined' && ProductosModule.getProducts) {
        const pmProds = ProductosModule.getProducts();
        if (pmProds && pmProds.length > 0) return pmProds;
      }
      // Último recurso: intentar leer del caché directo de localStorage o devolver []
      return JSON.parse(localStorage.getItem('productos') || '[]');
    } catch (e) {
      console.error('Error fetching products in VentasModule:', e);
      return [];
    }
  };
  const getClients = () => (typeof DataService !== 'undefined' && DataService.getClientesSync) ? DataService.getClientesSync() : [];


  const navigateSidebar = (v) => {
    if (v !== 'consultor-precios') { consultorQuery = ''; consultorResult = null; }
    if (v !== 'cotizaciones') { cotizacionQuery = ''; cotizacionSelected = null; }
    if (v !== 'pos-devoluciones') { devolucionQuery = ''; devolucionSelectedId = null; devolucionProdQuery = ''; devolucionSelectedItems = {}; }
    if (v === 'entrada-caja') { posActionModal = 'entrada'; posActionData = null; App.render(); return; }
    if (v === 'salida-caja') { posActionModal = 'salida'; posActionData = null; App.render(); return; }
    if (v === 'pos-clientes') { posOpenModal = 'clientes'; App.render(); return; }
    if (v === 'pos-sucursal') { posOpenModal = 'pos-sucursal'; App.render(); return; }
    if (v === 'catalogo') { posOpenModal = 'catalogo'; App.render(); return; }
    if (v === 'pos-devoluciones') { posOpenModal = 'devoluciones'; App.render(); return; }
    if (v === 'consultor-precios') { posOpenModal = 'consultor-precios'; App.render(); return; }
    if (v === 'cotizaciones') { posOpenModal = 'cotizaciones'; App.render(); return; }
    if (v === 'pos') { posOpenModal = null; posSubView = 'pos'; App.render(); return; }
    navigateTo(v);
  };

  const navigateTo = (v) => {
    if (['pos', 'pos-devoluciones', 'apartados', 'cerrar-turno'].includes(v)) {
      posSubView = v;
      if (!posOverlayOpen) { posOverlayOpen = true; posMinimized = false; }
      renderPOSOverlay();
      return;
    }
    currentView = v;
    App.render();
  };

  const openPOSOverlay = () => {
    posOverlayOpen = true; posMinimized = false; posSubView = 'pos'; renderPOSOverlay();
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } catch (e) { }
  };
  const closePOSOverlay = () => {
    if (cart.length > 0 && !confirm('¿Cerrar el Punto de Venta? Los productos en el carrito se mantendrán.')) return;
    posOverlayOpen = false; posMinimized = false; removePOSOverlay();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { }
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

    const posViews = { pos: renderPOS, 'pos-devoluciones': renderPOSDevoluciones, apartados: renderApartados, 'cerrar-turno': renderCerrarTurno };
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

    // Auto-focus: prioritize action modal input, then client search modal, then product search
    setTimeout(() => {
      const actionInput = document.getElementById('posActionInput');
      if (actionInput) {
        if (actionInput.type !== 'hidden') { actionInput.focus(); actionInput.select(); }
        else {
          // For delete modal (hidden input), focus the submit button instead
          const submitBtn = actionInput.closest('form')?.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.focus();
        }
        return;
      }

      if (posActionModal === 'contador-divisas') {
        const firstDivisaInput = overlay.querySelector('.pos-action-modal__body input[tabindex="1"]');
        if (firstDivisaInput) {
          firstDivisaInput.focus();
          firstDivisaInput.select();
          return;
        }
      }

      const clientModalInput = document.getElementById('posClientModalSearch');
      if (clientModalInput) { clientModalInput.focus(); return; }
      if (!posOpenModal) document.getElementById('posSearch')?.focus();
    }, 100);
  };

  const openTurno = () => {
    const fondo = prompt('💰 ¿Con cuánto efectivo inicia caja? (C$)');
    if (!fondo) return;
    const amount = parseFloat(fondo);
    if (isNaN(amount) || amount < 0) { alert('Monto inválido'); return; }
    const numTurno = getData('cortes').length + 1;
    turnoActivo = { numero: numTurno, fondoInicial: amount, apertura: new Date().toISOString(), usuario: user()?.name || 'N/A', ventas: 0, totalVentas: 0 };
    localStorage.setItem('vnt_turno' + getEmpresaSuffix(), JSON.stringify(turnoActivo));

    // Preguntar si desea actualizar la tasa de cambio
    const config = typeof DataService !== 'undefined' ? DataService.getConfig() : {};
    const currentRate = config?.tipoCambio || 36.85;
    const updateRate = confirm('Tasa de cambio actual: 1 USD = C$' + currentRate.toFixed(2) + '\n\nDesea actualizar la tasa de cambio?\n\nSi = Ingresara nueva tasa\nNo = Se mantiene la tasa actual');
    if (updateRate) {
      const newRate = prompt('Ingrese la nueva tasa de cambio (1 USD = C$):', currentRate);
      if (newRate && !isNaN(parseFloat(newRate)) && parseFloat(newRate) > 0) {
        const rate = parseFloat(newRate);
        if (typeof DataService !== 'undefined') DataService.updateConfig({ tipoCambio: rate });
        const suffix = typeof State !== 'undefined' && State.getCurrentUser()?.empresa_id ? '_' + State.getCurrentUser().empresa_id : '';
        localStorage.setItem('pos_tipoCambio' + suffix, JSON.stringify(rate));
        alert('Tasa actualizada: 1 USD = C$' + rate.toFixed(2));
      }
    }

    posSubView = 'pos'; openPOSOverlay();
  };
  const closeTurno = () => { posSubView = 'cerrar-turno'; renderPOSOverlay(); };
  const cancelCloseTurno = () => { posSubView = 'pos'; renderPOSOverlay(); };
  const updateConteoNio = (v) => { cierreConteoNio = v; };
  const updateConteoUsd = (v) => { cierreConteoUsd = v; };
  const promptContadorDivisas = () => { posActionModal = 'contador-divisas'; renderPOSOverlay(); };

  const liveCalcDivisas = () => {
    const form = document.getElementById('formContadorDivisas');
    if (!form) return;
    const formData = new FormData(form);
    let totalNio = 0;
    let totalUsd = 0;
    for (let [key, val] of formData.entries()) {
      if (key.startsWith('nio_')) {
        totalNio += (parseInt(val) || 0) * parseFloat(key.replace('nio_', ''));
      } else if (key.startsWith('usd_')) {
        totalUsd += (parseInt(val) || 0) * parseFloat(key.replace('usd_', ''));
      }
    }
    const nioTxt = document.getElementById('lblTotalDivisasNio');
    const usdTxt = document.getElementById('lblTotalDivisasUsd');
    if (nioTxt) nioTxt.innerText = `Total: C$ ${totalNio.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (usdTxt) usdTxt.innerText = `Total: $ ${totalUsd.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const submitContadorDivisas = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let totalNio = 0;
    let totalUsd = 0;
    for (let [key, val] of formData.entries()) {
      if (key.startsWith('nio_')) {
        const qty = parseInt(val) || 0;
        const valObj = parseFloat(key.replace('nio_', ''));
        totalNio += qty * valObj;
      } else if (key.startsWith('usd_')) {
        const qty = parseInt(val) || 0;
        const valObj = parseFloat(key.replace('usd_', ''));
        totalUsd += qty * valObj;
      }
    }
    cierreConteoNio = totalNio.toFixed(2);
    cierreConteoUsd = totalUsd.toFixed(2);
    posActionModal = null;
    renderPOSOverlay();
  };

  const confirmCloseTurno = () => {
    if (!turnoActivo) return;
    const m = getMetrics();
    const movs = getData('cajaMovs').filter(x => (x.fecha || '').startsWith(today()));
    const entradas = movs.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const salidas = movs.filter(x => x.tipo === 'retiro').reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    addRec('cortes', {
      fecha: new Date().toISOString(),
      numero: turnoActivo.numero,
      usuario: turnoActivo.usuario,
      dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'Dispositivo Móvil' : 'PC Escritorio',
      fondo_inicial: turnoActivo.fondoInicial,
      total_ventas: m.totalDia,
      entradas,
      salidas,
      total_caja: turnoActivo.fondoInicial + m.totalDia + entradas - salidas,
      num_ventas: m.facturasHoy
    });
    turnoActivo = null; localStorage.removeItem('vnt_turno' + getEmpresaSuffix()); cart = []; cashReceived = 0;
    cierreConteoNio = ''; cierreConteoUsd = '';
    alert('✅ Turno cerrado exitosamente');
    closePOSOverlay(); currentView = 'dashboard'; App.render();
  };

  const render = () => {
    // Lazy-load turno activo cuando hay empresa activa
    refreshSK();
    if (turnoActivo === null) {
      try { turnoActivo = JSON.parse(localStorage.getItem('vnt_turno' + getEmpresaSuffix()) || 'null'); } catch { turnoActivo = null; }
    }
    const views = { dashboard: renderDashboard, catalogo: renderCatalogo, 'productos-vendidos': renderProductosVendidos, clientes: renderClientes, abonos: renderAbonos, reimpresion: renderReimpresion, cortes: renderCortes, devoluciones: renderDevoluciones, reportes: renderReportes, ganancias: renderGanancias, 'turnos-abiertos': renderTurnosAbiertos };
    const html = (views[currentView] || renderDashboard)();
    if (posOverlayOpen && !posMinimized) setTimeout(() => renderPOSOverlay(), 50); else if (posOverlayOpen && posMinimized) setTimeout(() => renderTaskbarIndicator(), 50);
    return html;
  };

  const renderTurnosAbiertos = () => {
    return `
      <div class="ventas-header">
        <div class="ventas-header__title">${Icons.users} Turnos Abiertos</div>
        ${backBtn()}
      </div>
      <div style="background:var(--bg-primary);border-radius:12px;padding:24px;box-shadow:0 4px 6px rgba(0,0,0,0.05);min-height:500px;">
        ${renderActiveUsersPanel()}
      </div>
    `;
  };

  const tile = (id, icon, name, desc, color, bg, badge) => `<div class="ventas-tile" onclick="${(id === 'abrir-entrada' || id === 'abrir-salida') ? `VentasModule.navigateSidebar('${id.replace('abrir-', '') + '-caja'}')` : `VentasModule.navigateTo('${id}')`}">
    <div class="ventas-tile__icon" style="background:${bg};color:${color};">${icon}</div><div class="ventas-tile__name">${name}</div><div class="ventas-tile__desc">${desc}</div><div class="ventas-tile__badge" style="background:${bg};color:${color};">${badge}</div></div>`;
  const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="VentasModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">⬅ Volver al Panel</button>`;


  const getActiveShiftUsers = () => {
    // Recopilar turnos activos de todos los usuarios conectados
    const activeUsers = [];
    const currentUser = user();
    const allVentasHoy = getData('ventas').filter(v => (v.fecha || '').startsWith(today()));

    // Revisar turno activo del usuario actual
    if (turnoActivo) {
      const userVentas = allVentasHoy.filter(v => v.vendedor === turnoActivo.usuario);
      const ventasPorMetodo = {
        efectivo: userVentas.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0),
        tarjeta: userVentas.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0),
        transferencia: userVentas.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + parseFloat(v.total || 0), 0),
        credito: userVentas.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.total || 0), 0),
        extrafinanciamiento: userVentas.filter(v => v.metodo === 'extrafinanciamiento').reduce((s, v) => s + parseFloat(v.total || 0), 0)
      };
      const totalVentas = userVentas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
      const deviceName = detectDeviceName();
      activeUsers.push({
        nombre: turnoActivo.usuario || currentUser?.name || 'N/A',
        turnoNumero: turnoActivo.numero,
        horaApertura: turnoActivo.apertura,
        fondoInicial: turnoActivo.fondoInicial,
        dispositivo: deviceName,
        cantidadVentas: userVentas.length,
        totalVentas,
        ventasPorMetodo,
        isCurrentUser: true,
        estado: 'activo'
      });
    }

    // Intentar leer turnos de otros usuario almacenados (multi-sesión)
    try {
      const otherShifts = JSON.parse(localStorage.getItem('vnt_active_shifts' + getEmpresaSuffix()) || '[]');
      otherShifts.forEach(shift => {
        if (turnoActivo && shift.usuario === turnoActivo.usuario) return; // ignorar duplicado
        const shiftVentas = allVentasHoy.filter(v => v.vendedor === shift.usuario);
        const ventasPorMetodo = {
          efectivo: shiftVentas.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0),
          tarjeta: shiftVentas.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0),
          transferencia: shiftVentas.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + parseFloat(v.total || 0), 0),
          credito: shiftVentas.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.total || 0), 0),
          extrafinanciamiento: shiftVentas.filter(v => v.metodo === 'extrafinanciamiento').reduce((s, v) => s + parseFloat(v.total || 0), 0)
        };
        activeUsers.push({
          nombre: shift.usuario,
          turnoNumero: shift.numero,
          horaApertura: shift.apertura,
          fondoInicial: shift.fondoInicial,
          dispositivo: shift.dispositivo || 'Desconocido',
          cantidadVentas: shiftVentas.length,
          totalVentas: shiftVentas.reduce((s, v) => s + parseFloat(v.total || 0), 0),
          ventasPorMetodo,
          isCurrentUser: false,
          estado: 'activo'
        });
      });
    } catch (ignored) { /* no hay turnos de otros usuarios */ }

    return activeUsers;
  };

  const detectDeviceName = () => {
    const ua = navigator.userAgent;
    let deviceType = 'PC Escritorio';
    let browser = 'Navegador';
    let osName = 'Sistema';

    // Detectar SO
    if (/Windows NT/i.test(ua)) osName = 'Windows';
    else if (/Mac OS X/i.test(ua)) osName = 'macOS';
    else if (/Linux/i.test(ua)) osName = 'Linux';
    else if (/Android/i.test(ua)) osName = 'Android';
    else if (/iPhone|iPad/i.test(ua)) osName = 'iOS';

    // Detectar tipo de dispositivo
    if (/Mobi|Android|iPhone/i.test(ua)) deviceType = '📱 Móvil';
    else if (/iPad|Tablet/i.test(ua)) deviceType = '📲 Tablet';
    else deviceType = '🖥️ PC';

    // Detectar navegador
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua)) browser = 'Safari';

    return `${deviceType} · ${osName} · ${browser}`;
  };

  const syncActiveShift = () => {
    // Sincronizar turno activo en lista compartida para multi-sesión
    if (!turnoActivo) return;
    try {
      const shifts = JSON.parse(localStorage.getItem('vnt_active_shifts' + getEmpresaSuffix()) || '[]');
      const existingIdx = shifts.findIndex(s => s.usuario === turnoActivo.usuario);
      const shiftData = {
        usuario: turnoActivo.usuario,
        numero: turnoActivo.numero,
        apertura: turnoActivo.apertura,
        fondoInicial: turnoActivo.fondoInicial,
        dispositivo: detectDeviceName(),
        lastSeen: new Date().toISOString()
      };
      if (existingIdx >= 0) shifts[existingIdx] = shiftData;
      else shifts.push(shiftData);
      localStorage.setItem('vnt_active_shifts' + getEmpresaSuffix(), JSON.stringify(shifts));
    } catch (ignored) { /* error de sincronización ignorado */ }
  };

  // Sincronizar turno activo periódicamente
  if (turnoActivo) syncActiveShift();

  const renderActiveUsersPanel = () => {
    const activeUsers = getActiveShiftUsers();
    if (activeUsers.length === 0) {
      return `
        <div class="ventas-active-users-panel">
          <div class="ventas-active-users-panel__header">
            <span style="display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:800;">
              <span style="width:10px;height:10px;background:#94a3b8;border-radius:50%;display:inline-block;"></span>
              Usuarios en Línea — Turnos Abiertos
            </span>
          </div>
          <div style="padding:2rem;text-align:center;color:var(--text-muted);">
            <div style="font-size:3rem;margin-bottom:0.75rem;opacity:0.4;">👤</div>
            <p style="font-weight:600;margin:0;">No hay turnos abiertos actualmente</p>
            <p style="font-size:0.85rem;margin:0.25rem 0 0;">Abra un turno en Punto de Venta para comenzar.</p>
          </div>
        </div>`;
    }

    return `
      <div class="ventas-active-users-panel">
        <div class="ventas-active-users-panel__header">
          <span style="display:flex;align-items:center;gap:8px;font-size:1.1rem;font-weight:800;">
            <span class="ventas-pulse-dot"></span>
            Usuarios en Línea — ${activeUsers.length} Turno${activeUsers.length > 1 ? 's' : ''} Abierto${activeUsers.length > 1 ? 's' : ''}
          </span>
          <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">${new Date().toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="ventas-active-users-grid">
          ${activeUsers.map(usr => {
      const tiempoActivo = usr.horaApertura ? getTimeDifference(usr.horaApertura) : 'N/A';
      return `
            <div class="ventas-user-card ${usr.isCurrentUser ? 'ventas-user-card--current' : ''}">
              <div class="ventas-user-card__header">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="ventas-user-card__avatar" style="background:${usr.isCurrentUser ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'};">
                    ${usr.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:800;font-size:0.95rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                      ${usr.nombre}
                      ${usr.isCurrentUser ? '<span style="background:#10b981;color:white;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:700;">TÚ</span>' : ''}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Turno #${usr.turnoNumero}</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Tiempo activo</div>
                  <div style="font-size:0.9rem;font-weight:700;color:var(--color-primary-600);">${tiempoActivo}</div>
                </div>
              </div>
              
              <div class="ventas-user-card__device">
                <span style="opacity:0.7;">📍</span> ${usr.dispositivo}
              </div>

              <div class="ventas-user-card__stats">
                <div class="ventas-user-card__stat-item">
                  <div class="ventas-user-card__stat-value" style="color:#10b981;">${usr.cantidadVentas}</div>
                  <div class="ventas-user-card__stat-label">Ventas</div>
                </div>
                <div class="ventas-user-card__stat-item">
                  <div class="ventas-user-card__stat-value" style="color:#3b82f6;">C$${fmt(usr.totalVentas)}</div>
                  <div class="ventas-user-card__stat-label">Total Vendido</div>
                </div>
                <div class="ventas-user-card__stat-item">
                  <div class="ventas-user-card__stat-value" style="color:#f59e0b;">C$${fmt(usr.fondoInicial)}</div>
                  <div class="ventas-user-card__stat-label">Fondo Inicial</div>
                </div>
              </div>

              <div class="ventas-user-card__payments">
                <div style="font-size:0.7rem;text-transform:uppercase;font-weight:800;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:6px;">Formas de Pago</div>
                <div class="ventas-user-card__payment-grid">
                  ${usr.ventasPorMetodo.efectivo > 0 ? `<div class="ventas-payment-chip ventas-payment-chip--efectivo"><span>💵</span><span>C$${fmt(usr.ventasPorMetodo.efectivo)}</span></div>` : ''}
                  ${usr.ventasPorMetodo.tarjeta > 0 ? `<div class="ventas-payment-chip ventas-payment-chip--tarjeta"><span>💳</span><span>C$${fmt(usr.ventasPorMetodo.tarjeta)}</span></div>` : ''}
                  ${usr.ventasPorMetodo.transferencia > 0 ? `<div class="ventas-payment-chip ventas-payment-chip--transferencia"><span>🏦</span><span>C$${fmt(usr.ventasPorMetodo.transferencia)}</span></div>` : ''}
                  ${usr.ventasPorMetodo.credito > 0 ? `<div class="ventas-payment-chip ventas-payment-chip--credito"><span>📋</span><span>C$${fmt(usr.ventasPorMetodo.credito)}</span></div>` : ''}
                  ${usr.ventasPorMetodo.extrafinanciamiento > 0 ? `<div class="ventas-payment-chip ventas-payment-chip--extra"><span>📈</span><span>C$${fmt(usr.ventasPorMetodo.extrafinanciamiento)}</span></div>` : ''}
                  ${Object.values(usr.ventasPorMetodo).every(v => v === 0) ? '<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;">Sin ventas registradas</div>' : ''}
                </div>
              </div>
            </div>`;
    }).join('')}
        </div>
      </div>`;
  };

  const getTimeDifference = (isoDate) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const renderDashboard = () => {
    const m = getMetrics();
    const devs = getData('devoluciones').filter(d => (d.fecha || '').startsWith(today())).length;
    return `
      <div class="ventas-header"><div class="ventas-header__title">${Icons.shoppingCart} Gestión de Ventas</div>
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
        <div class="ventas-tile" onclick="VentasModule.navigateTo('turnos-abiertos')"><div class="ventas-tile__icon" style="background:#f0f9ff;color:#0ea5e9;">${Icons.users}</div><div class="ventas-tile__name">Turnos Abiertos</div><div class="ventas-tile__desc">Usuarios en línea</div><div class="ventas-tile__badge" style="background:#f0f9ff;color:#0ea5e9;">Operando</div></div>
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
    const tipoCambio = (() => { try { const cfg = DataService.getConfig(); return parseFloat(cfg.tipoCambio) || 36.62; } catch (e) { return 36.62; } })();
    const convertPrice = (precio) => selectedCurrency === 'USD' ? precio / tipoCambio : precio;
    const subtotalBase = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuentoBase = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const subtotal = convertPrice(subtotalBase);
    const descuento = convertPrice(descuentoBase);
    const globalDiscountConverted = convertPrice(globalDiscount);
    const iva = (subtotal - descuento - globalDiscountConverted) * getIvaRate();
    const retencion = (() => { const cl = selectedClient ? clients.find(c => c.id === selectedClient) : null; return (cl && (cl.retencion === true || cl.aplicaRetencion === true)) ? (subtotal - descuento - globalDiscountConverted) * 0.02 : 0; })();
    const total = subtotal - descuento - globalDiscountConverted + iva - retencion;
    const currSymbol = selectedCurrency === 'USD' ? '$' : 'C$';
    const tcLabel = selectedCurrency === 'USD' ? ` (TC: ${tipoCambio.toFixed(2)})` : '';

    const displayedClientName = selectedClient ? (clients.find(c => c.id === selectedClient)?.empresa || clients.find(c => c.id === selectedClient)?.nombreCliente) : 'Público General';

    return `
      <div style="display:grid;grid-template-columns:64px 1fr 340px;grid-template-rows: auto 1fr;height:100%;background:var(--bg-secondary);">
        
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
          ${selectedClient ? (() => {
        const cl = clients.find(c => c.id === selectedClient);
        if (!cl) return '';
        const nombre = cl.empresa || cl.nombreCliente || 'N/A';
        const cedula = cl.identificacion || cl.cedulaRuc || cl.cedula_ruc || '';
        const dir = cl.direccion || '';
        const tel = cl.telefono || cl.celular || '';
        const limCredito = parseFloat(cl.limiteCredito || cl.limite_credito || 0);
        const saldoPend = getData('ventas').filter(v => v.clienteId === selectedClient && v.metodo === 'credito' && parseFloat(v.saldo_pendiente || 0) > 0).reduce((s, v) => s + parseFloat(v.saldo_pendiente || 0), 0);
        const creditoDisp = limCredito - saldoPend;
        const tieneCredito = limCredito > 0;
        return `
              <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;font-weight:800;color:white;font-size:14px;flex-shrink:0;">${nombre.charAt(0).toUpperCase()}</div>
                <div style="flex:1;min-width:0;line-height:1.2;">
                  <div style="font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;">
                    ${nombre} ${cedula ? `<span style="font-size:10px;font-weight:600;color:#94a3b8;background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;">🪪 ${cedula}</span>` : ''}
                  </div>
                  <div style="font-size:10px;color:#94a3b8;display:flex;gap:8px;flex-wrap:nowrap;">
                    ${tel ? `<span>📞 ${tel}</span>` : ''}
                    ${dir ? `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px;">📍 ${dir}</span>` : ''}
                  </div>
                </div>
                ${tieneCredito ? `
                  <div style="text-align:right;flex-shrink:0;padding:4px 8px;border-radius:6px;background:${creditoDisp > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};">
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${creditoDisp > 0 ? '#34d399' : '#f87171'};">Crédito ${creditoDisp > 0 ? 'Disponible' : 'Agotado'}</div>
                    <div style="font-size:12px;font-weight:800;color:${creditoDisp > 0 ? '#10b981' : '#ef4444'};">C$${fmt(creditoDisp)} <span style="font-size:9px;color:#94a3b8;">/ C$${fmt(limCredito)}</span></div>
                  </div>
                ` : '<div style="padding:4px 8px;border-radius:6px;background:rgba(148,163,184,0.15);"><div style="font-size:9px;font-weight:700;color:#94a3b8;">SIN CRÉDITO</div></div>'}
                <button onclick="VentasModule.clearSelectedClient()" style="background:rgba(239,68,68,0.2);border:none;color:#f87171;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;" title="Quitar cliente">✕</button>
              </div>`;
      })() : `
            <span class="pos-client-bar__label" onclick="VentasModule.openClientSearchModal()" style="color:#e2e8f0;font-weight:800;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#e2e8f0'">${Icons.user} Cliente:</span>
            <span onclick="VentasModule.openClientSearchModal()" style="color:#94a3b8;font-size:12px;cursor:pointer;flex:1;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Público General — Clic para buscar cliente</span>
          `}
            <span style="margin-left:auto;font-size:12px;font-weight:700;color:#e2e8f0;">Precio:</span>
            ${(() => {
        const listas = getPosDataUncached('pos_lista_precios');
        const sorted = [...listas].sort((a, b) => {
          const cmp = (a.codigoPrecio || '').localeCompare(b.codigoPrecio || '');
          return cmp !== 0 ? cmp : (a.nombrePrecio || '').localeCompare(b.nombrePrecio || '');
        });
        if (sorted.length > 0 && !posSelectedPriceList) posSelectedPriceList = sorted[0].codigoPrecio;
        return `<select onchange="VentasModule.setPriceList(this.value)" style="width:140px;padding:2px 4px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:12px;background:#1e293b;color:white;">
                ${sorted.length > 0 ? sorted.map(p => `<option value="${p.codigoPrecio}" ${posSelectedPriceList === p.codigoPrecio ? 'selected' : ''}>${p.codigoPrecio} - ${p.nombrePrecio}</option>`).join('') : '<option value="">Sin listas</option>'}
              </select>`;
      })()}
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
                  <td>${currSymbol}${fmt(convertPrice(item.precio))}</td>
                  <td style="${(item.descuento > 0 || item.globalDiscountPart > 0) ? 'color:var(--color-danger);font-weight:700;' : ''}">
                    ${(item.descuento > 0 || item.globalDiscountPart > 0) ? 
                      (() => {
                        const sumDesc = (item.descuento || 0) + (item.globalDiscountPart || 0);
                        const pct = ((sumDesc / (item.precio * item.cantidad)) * 100).toFixed(1);
                        return '-' + currSymbol + fmt(convertPrice(sumDesc)) + ' (' + pct + '%)';
                      })() 
                    : '-'}
                  </td>
                  <td style="text-align:right;font-weight:700;">${currSymbol}${fmt(convertPrice((item.precio * item.cantidad) - (item.descuento || 0) - (item.globalDiscountPart || 0)))}</td>
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

          <div style="display:flex;gap:4px;padding:12px;background:var(--bg-primary);${suspendedSales.length === 0 ? 'border-top:1px solid var(--border-color);' : 'border-top:1px solid transparent; box-shadow:0 -1px 0 var(--border-color);'}align-items:center;">
            <button onclick="VentasModule.modifySelectedAction('qty')" ${selectedCartRow < 0 ? 'disabled' : ''} class="pos-action-btn ${selectedCartRow >= 0 ? 'pos-action-btn--active' : ''}" style="flex:1;padding:0.5rem 0.25rem;">
              <span>📏 CANTIDAD</span><kbd style="display:none;">F4</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('del')" ${selectedCartRow < 0 ? 'disabled' : ''} class="pos-action-btn ${selectedCartRow >= 0 ? 'pos-action-btn--active' : ''}" style="flex:1;padding:0.5rem 0.25rem;">
              <span>🗑️ ELIMINAR</span><kbd style="display:none;">Del</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('disc')" ${selectedCartRow < 0 ? 'disabled' : ''} class="pos-action-btn ${selectedCartRow >= 0 ? 'pos-action-btn--active' : ''}" style="flex:1;padding:0.5rem 0.25rem;">
              <span>🏷️ DESC.</span><kbd style="display:none;">F6</kbd>
            </button>
            <button onclick="VentasModule.modifySelectedAction('price')" ${selectedCartRow < 0 ? 'disabled' : ''} class="pos-action-btn ${selectedCartRow >= 0 ? 'pos-action-btn--active' : ''}" style="flex:1;padding:0.5rem 0.25rem;">
              <span>💵 PRECIO</span><kbd style="display:none;">F7</kbd>
            </button>
            <button onclick="VentasModule.showProductDescription()" ${selectedCartRow < 0 ? 'disabled' : ''} class="pos-action-btn ${selectedCartRow >= 0 ? 'pos-action-btn--active' : ''}" style="flex:1;padding:0.5rem 0.25rem;">
              <span>ℹ️ DETALLES</span><kbd style="display:none;"></kbd>
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
              ${tcLabel ? `<div class="pos-totals__row" style="font-size:11px;margin-bottom:6px;color:#3b82f6;font-weight:700;"><span>Moneda: USD${tcLabel}</span><span></span></div>` : ''}
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:4px;"><span>Subtotal</span><span>${currSymbol}${fmt(subtotal)}</span></div>
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:4px;"><span>Descuento Promocional</span><span style="color:var(--color-danger);font-weight:600;">-${currSymbol}${fmt(descuento)}</span></div>
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:4px;"><span>IVA 15%</span><span>${currSymbol}${fmt(iva)}</span></div>
              <div class="pos-totals__row" style="font-size:12px;margin-bottom:8px;${retencion > 0 ? 'color:#f59e0b;font-weight:600;' : 'color:var(--text-muted);'}"><span>Retención IR 2%</span><span>${retencion > 0 ? '-' + currSymbol + fmt(retencion) : currSymbol + '0.00'}</span></div>
              
              <div class="pos-totals__row" style="padding:8px 0;border-top:1px dashed var(--border-color);margin-bottom:12px;">
                <button class="btn btn--secondary btn--sm" onclick="VentasModule.promptGlobalDiscountModal()" style="font-size:11px;padding:4px 8px;border-radius:4px;" title="Alt+D">🏷️ Desc. Global <kbd style="background:transparent;border:1px solid var(--border-color);margin-left:4px;">Alt+D</kbd></button>
                <span style="color:var(--color-danger);font-weight:700;">-${currSymbol}${fmt(globalDiscountConverted)}${globalDiscountConverted > 0 ? ' (' + ((globalDiscountConverted / subtotal) * 100).toFixed(1) + '%)' : ''}</span>
              </div>
              <div class="pos-totals__row pos-totals__row--total" style="font-size:28px;color:var(--color-primary-600);"><span>TOTAL</span><span id="posTotalDisplay" style="font-weight:900;">${currSymbol}${fmt(total)}</span></div>
            </div>

            <!-- Botón Cobrar - FIJO AL FONDO -->
            <div class="pos-cobrar" style="padding:12px 16px 16px;background:var(--bg-primary);display:flex;flex-direction:column;gap:8px;">
              <button class="pos-cobrar__btn" onclick="VentasModule.openPaymentModal()" ${cart.length === 0 ? 'disabled' : ''} style="width:100%;height:75px;font-size:24px;letter-spacing:2px;box-shadow:0 15px 25px -5px rgba(16, 185, 129, 0.4), 0 10px 10px -5px rgba(16, 185, 129, 0.2); border-radius:16px; display:flex; align-items:center; justify-content:center; gap:16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; transition:all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); ${cart.length === 0 ? 'opacity:0.6; filter:grayscale(0.8); cursor:not-allowed;' : 'cursor:pointer;'}" onmouseover="${cart.length > 0 ? 'this.style.transform=\\\'scale(1.02) translateY(-2px)\\\'' : ''}" onmouseout="${cart.length > 0 ? 'this.style.transform=\\\'scale(1) translateY(0)\\\'' : ''}">
                <span style="font-size:32px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${Icons.check}</span> <span style="font-weight:900; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">COBRAR</span> <kbd style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 10px;border-radius:6px;font-size:14px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,0.1);">ESC</kbd>
              </button>
              <button onclick="VentasModule.crearCotizacionPrompt()" class="btn btn--secondary" ${cart.length === 0 ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : 'style="cursor:pointer;"'} style="width:100%;font-weight:700;padding:12px;border-radius:12px;">📝 Nueva Cotización</button>
            </div>
          </div>
        </div>
      </div>

      ${posOpenModal === 'payment' ? renderPaymentModal(total, currSymbol) : ''}
      ${['clientes', 'devoluciones', 'catalogo', 'consultor-precios', 'cotizaciones', 'pos-sucursal'].includes(posOpenModal) ? renderPosExternalModal(posOpenModal) : ''}
      ${posActionModal ? renderPosActionModal() : ''}
      ${renderClientSearchModalOverlay()}
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
      const item = cart[selectedCartRow];
      const origPrice = item.precioOriginal || item.precio;
      const lineTotal = origPrice * item.cantidad;
      let descApplied = 0;
      let pct = 0, num = 0;
      if (val.includes('%')) { pct = parseFloat(val); } else { num = parseFloat(val); }
      if (pct) descApplied = lineTotal * (pct / 100);
      else if (!isNaN(num)) descApplied = num;

      // Verificar descuento máximo del producto
      const prodRef = getProducts().find(p => p.id === item.productId);
      let descMaxFromStorage = null;
      try { descMaxFromStorage = JSON.parse(localStorage.getItem('prod_descMax_' + item.productId)); } catch(ex) {}
      const _dmVal = parseFloat(descMaxFromStorage?.valor ?? prodRef?.descMaxValor ?? prodRef?.descuento_max_valor ?? 0);
      const _dmTipo = descMaxFromStorage?.tipo || prodRef?.descMaxTipo || prodRef?.descuento_max_tipo || 'porcentaje';
      
      if (_dmVal > 0) {
        let maxDescMonto = 0;
        if (_dmTipo === 'porcentaje') {
          maxDescMonto = lineTotal * (_dmVal / 100);
        } else {
          maxDescMonto = _dmVal * item.cantidad;
        }
        if (descApplied > maxDescMonto) {
          descApplied = maxDescMonto;
          alert('⚠️ Descuento máximo permitido para ' + item.nombre + ': ' + (_dmTipo === 'porcentaje' ? _dmVal + '%' : 'C$' + fmt(_dmVal)) + '. Se ajustó al máximo.');
        }
      }
      cart[selectedCartRow].descuento = descApplied;
    }
    else if (posActionModal === 'price' && val && !isNaN(val) && val > 0) {
      const item = cart[selectedCartRow];
      let newPrice = parseFloat(val);
      const prodRef = getProducts().find(p => p.id === item.productId);
      
      let descMaxFromStorage = null;
      try { descMaxFromStorage = JSON.parse(localStorage.getItem('prod_descMax_' + item.productId)); } catch(ex) {}
      const _dmVal = parseFloat(descMaxFromStorage?.valor ?? prodRef?.descMaxValor ?? prodRef?.descuento_max_valor ?? 0);
      const _dmTipo = descMaxFromStorage?.tipo || prodRef?.descMaxTipo || prodRef?.descuento_max_tipo || 'porcentaje';
      
      if (_dmVal > 0) {
        const originalPrice = parseFloat(item.precioOriginal || prodRef?.precioVenta || prodRef?.precio_venta || prodRef?.precio || item.precio);
        const proposedDiscount = (originalPrice - newPrice) * item.cantidad;
        
        let maxDescMonto = 0;
        if (_dmTipo === 'porcentaje') {
          maxDescMonto = (originalPrice * item.cantidad) * (_dmVal / 100);
        } else {
          maxDescMonto = _dmVal * item.cantidad;
        }
        
        if (proposedDiscount > maxDescMonto) {
          newPrice = originalPrice - (maxDescMonto / item.cantidad);
          alert('⚠️ Descuento máximo permitido para ' + item.nombre + ' es ' + (_dmTipo === 'porcentaje' ? _dmVal + '%' : 'C$' + fmt(maxDescMonto)) + '. Precio mínimo ajustado a: C$' + fmt(newPrice));
        }
      }
      cart[selectedCartRow].precio = newPrice;
      cart[selectedCartRow].descuento = 0;
    }
    else if (posActionModal === 'globalDisc' && val) {
      let subtotalGlobal = 0;
      let availableForGlobalDisc = 0; // Suma del máximo descuento permitido que no se ha usado
      let totalMaxAllowedGlobal = 0;
      
      for (const item of cart) {
        const prodRef = getProducts().find(p => p.id === item.productId) || {};
        let dms = null;
        try { dms = JSON.parse(localStorage.getItem('prod_descMax_' + item.productId)); } catch(ex) {}
        const dmVal = parseFloat(dms?.valor ?? prodRef?.descMaxValor ?? prodRef?.descuento_max_valor ?? 0);
        const dmTipo = dms?.tipo || prodRef?.descMaxTipo || prodRef?.descuento_max_tipo || 'porcentaje';
        
        const lineTotal = (item.precioOriginal || item.precio) * item.cantidad;
        const currentIndvDisc = item.descuento || 0;
        subtotalGlobal += lineTotal - currentIndvDisc;
        
        let maxLineAllowed = lineTotal; // Por defecto todo puede ser descontable si no hay regla
        if (dmVal > 0) {
          if (dmTipo === 'porcentaje') maxLineAllowed = lineTotal * (dmVal / 100);
          else maxLineAllowed = dmVal * item.cantidad;
        }
        
        totalMaxAllowedGlobal += maxLineAllowed;
        availableForGlobalDisc += Math.max(0, maxLineAllowed - currentIndvDisc);
      }

      let proposedGlobalDisc = 0;
      if (val.includes('%')) { 
        const pct = parseFloat(val.replace('%', '')); 
        if (!isNaN(pct)) proposedGlobalDisc = subtotalGlobal * (pct / 100); 
      } else { 
        const v = parseFloat(val); 
        if (!isNaN(v)) proposedGlobalDisc = v; 
      }
      
      if (proposedGlobalDisc > availableForGlobalDisc) {
        proposedGlobalDisc = availableForGlobalDisc;
        alert('⚠️ Descuento global se ajustó a C$' + fmt(proposedGlobalDisc) + ' respetando las restricciones máximas por cada producto.');
      }
      
      globalDiscount = proposedGlobalDisc;

      // Distribuir el globalDiscount proporcionalmente entre los items según su monto descontable disponible
      if (globalDiscount > 0 && availableForGlobalDisc > 0) {
        let remainingGlobal = globalDiscount;
        for (let i = 0; i < cart.length; i++) {
          const item = cart[i];
          const prodRef = getProducts().find(p => p.id === item.productId) || {};
          let dms = null;
          try { dms = JSON.parse(localStorage.getItem('prod_descMax_' + item.productId)); } catch(ex) {}
          const dmVal = parseFloat(dms?.valor ?? prodRef?.descMaxValor ?? prodRef?.descuento_max_valor ?? 0);
          const dmTipo = dms?.tipo || prodRef?.descMaxTipo || prodRef?.descuento_max_tipo || 'porcentaje';
          
          const lineTotal = (item.precioOriginal || item.precio) * item.cantidad;
          let maxLineAllowed = lineTotal;
          if (dmVal > 0) {
            maxLineAllowed = (dmTipo === 'porcentaje') ? lineTotal * (dmVal / 100) : dmVal * item.cantidad;
          }
          const availableHere = Math.max(0, maxLineAllowed - (item.descuento || 0));
          
          if (availableHere > 0) {
            const fraction = availableHere / availableForGlobalDisc;
            let assigned = globalDiscount * fraction;
            // Redondeo de precaución
            if (i === cart.length - 1) assigned = remainingGlobal;
            item.globalDiscountPart = assigned;
            remainingGlobal -= assigned;
          } else {
            item.globalDiscountPart = 0;
          }
        }
      } else {
        cart.forEach(i => i.globalDiscountPart = 0);
      }
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
    else if (posActionModal === 'credito-setup') {
      const moraAplicar = fd.get('moraAplicar') === 'on';
      const moraPorcentaje = parseFloat(fd.get('moraPorcentaje')) || 0;
      const modalidadPago = fd.get('modalidadPago'); // 'unico' o 'cuotas'
      const numCuotas = parseInt(fd.get('numCuotas')) || 1;
      const periodicidad = fd.get('periodicidad') || 'Mensual';

      const paymentDetails = {
        tipo: 'credito',
        moraAplicar,
        moraPorcentaje,
        modalidadPago,
        numCuotas,
        periodicidad,
        fechaLimite: fd.get('fechaLimite') || null,
        fechaInicio: new Date().toISOString()
      };
      if (posActionData.actuallyPayInUSD) { paymentDetails.pagoEnUSD = true; paymentDetails.tipoCambioApicado = posActionData.tipoCambio; }

      const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
      addRec('ventas', { numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient, cliente: posActionData.cl ? (posActionData.cl.empresa || posActionData.cl.nombreCliente || 'Cliente') : 'Público General', items: cart.map(i => ({ ...i })), subtotal: posActionData.subtotal, descuento: posActionData.descuento, descuento_global: posActionData.globalDiscount, iva: posActionData.iva, total: posActionData.finalTotal, base_total: posActionData.total, costo_total: posActionData.costoTotal, metodo: 'credito', detalles_pago: paymentDetails, lista_precio: posSelectedPriceList, efectivo_recibido: 0, cambio: 0, saldo_pendiente: posActionData.finalTotal, vendedor: user()?.name || 'N/A', estado: 'completada', comentario: posComment });

      if (typeof ProductosModule !== 'undefined' && ProductosModule.marcarTrackingVendido) {
        cart.forEach(i => { if (i.trackingId && i.tipoSeguimiento) ProductosModule.marcarTrackingVendido(i.productId, i.tipoSeguimiento, i.trackingId, numFactura, i.cantidad); });
      }

      alert(`✅ Venta ${numFactura} registrada a Crédito!\nTotal: C$${fmt(posActionData.finalTotal)}`);
      cart = []; selectedClient = null; cashReceived = 0; globalDiscount = 0; posComment = ''; posOpenModal = null;
      posSubView = 'pos'; App.render();
      posActionModal = null; posActionData = null;
      return;
    }
    else if (posActionModal === 'cotizacion-setup') {
      const v = fd.get('fechaVencimiento');
      if (!v) { alert('Seleccione una fecha de vencimiento.'); return; }

      const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
      const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
      const iva = (subtotal - descuento - globalDiscount) * getIvaRate();
      const total = subtotal - descuento - globalDiscount + iva;
      const clientFound = getClients().find(c => c.id === selectedClient);

      const numCots = getData('cotizaciones').length + 1;
      const numero = 'COT-' + String(numCots).padStart(6, '0');

      const cotData = {
        numero,
        fecha: new Date().toISOString(),
        vencimiento: new Date(v).toISOString(),
        clienteId: selectedClient,
        cliente: clientFound ? (clientFound.empresa || clientFound.nombreCliente) : 'Público General',
        items: cart.map(i => ({ ...i })),
        subtotal, descuento, descuento_global: globalDiscount, iva, total,
        estado: 'vigente', divisa: selectedCurrency
      };

      addRec('cotizaciones', cotData);
      alert(`✅ Cotización ${numero} generada con éxito.\nTotal: ${selectedCurrency === 'USD' ? '$' : 'C$'}${fmt(total)}`);
      cart = []; selectedClient = null; globalDiscount = 0; posComment = ''; posOpenModal = null; posActionModal = null; posSubView = 'dashboard';
      clearCart();
      return;
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
    else if (posActionModal === 'disc') { let _discMaxInfo = ''; try { const _dms = JSON.parse(localStorage.getItem('prod_descMax_' + posActionData.productId)); if (_dms && _dms.valor > 0) _discMaxInfo = '<div style="background:rgba(239,68,68,0.1);color:#ef4444;padding:8px;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600;">🚫 Desc. máximo: ' + (_dms.tipo === 'porcentaje' ? _dms.valor + '%' : 'C$' + parseFloat(_dms.valor).toFixed(2)) + '</div>'; } catch(ex) {} const _prodRefDisc = getProducts().find(p => p.id === posActionData.productId); if (!_discMaxInfo && _prodRefDisc && parseFloat(_prodRefDisc.descMaxValor || 0) > 0) _discMaxInfo = '<div style="background:rgba(239,68,68,0.1);color:#ef4444;padding:8px;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600;">🚫 Desc. máximo: ' + (_prodRefDisc.descMaxTipo === 'porcentaje' ? _prodRefDisc.descMaxValor + '%' : 'C$' + parseFloat(_prodRefDisc.descMaxValor).toFixed(2)) + '</div>'; mTitle = 'Descuento Individual'; mBody = `<div style="margin-bottom:1rem;"><strong>Producto:</strong> ${posActionData.nombre}</div>${_discMaxInfo}<p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Ejemplo: <strong>50</strong> o <strong>10%</strong></p><input type="text" name="actionVal" id="posActionInput" class="form-input" placeholder="0" autocomplete="off" required style="font-size:1.5rem;font-weight:bold;height:50px;">`; }
    else if (posActionModal === 'price') { let _priceMaxInfo = ''; try { const _dms = JSON.parse(localStorage.getItem('prod_descMax_' + posActionData.productId)); if (_dms && _dms.valor > 0) { const _origP = posActionData.precioOriginal || posActionData.precio; let _minPrice = _origP; if (_dms.tipo === 'porcentaje') _minPrice = _origP - (_origP * _dms.valor / 100); else _minPrice = _origP - _dms.valor; _priceMaxInfo = '<div style="background:rgba(239,68,68,0.1);color:#ef4444;padding:8px;border-radius:6px;margin-bottom:8px;font-size:12px;font-weight:600;">🚫 Precio mín: C$' + _minPrice.toFixed(2) + '</div>'; } } catch(ex) {} mTitle = 'Cambiar Precio'; mBody = `<div style="margin-bottom:1rem;"><strong>Producto:</strong> ${posActionData.nombre}</div>${_priceMaxInfo}<p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Precio actual: C$${fmt(posActionData.precio)}</p><input type="number" name="actionVal" id="posActionInput" class="form-input" value="${posActionData.precio}" step="0.01" min="0" required style="font-size:1.5rem;font-weight:bold;height:50px;">`; }
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
    else if (posActionModal === 'cotizacion-setup') {
      mTitle = '📝 Nueva Cotización';
      const dNow = Date.now();
      const getD = (days) => new Date(dNow + days * 86400000).toISOString().substring(0, 10);
      mBody = `<p style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">Se generará una cotización con los productos actuales. Seleccione el vencimiento:</p>
               <label style="display:block;margin-bottom:8px;font-weight:600;">Opciones Rápidas:</label>
               <div style="display:flex;gap:8px;margin-bottom:12px;">
                 <button type="button" class="btn btn--secondary btn--sm" style="flex:1;" onclick="document.getElementById('posCotiDate').value='${getD(7)}'">7 Días</button>
                 <button type="button" class="btn btn--secondary btn--sm" style="flex:1;" onclick="document.getElementById('posCotiDate').value='${getD(15)}'">15 Días</button>
                 <button type="button" class="btn btn--secondary btn--sm" style="flex:1;" onclick="document.getElementById('posCotiDate').value='${getD(30)}'">30 Días</button>
               </div>
               <label style="display:block;margin-bottom:4px;font-weight:600;">Fecha de Vencimiento:</label>
               <input type="date" name="fechaVencimiento" id="posCotiDate" class="form-input" required style="height:44px;font-size:1rem;width:100%;" value="${getD(15)}">`;
    }
    else if (posActionModal === 'credito-setup') {
      mTitle = '🤝 Configuración de Crédito';
      const d = posActionData;
      mBody = `
        <div style="font-size:12px;margin-bottom:16px;background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-color);padding-bottom:6px;margin-bottom:6px;"><span>Crédito Disponible:</span><strong style="color:${d.creditoDisp >= d.finalTotal ? '#10b981' : '#ef4444'};font-size:14px;">C$${fmt(d.creditoDisp)}</strong></div>
          <div style="display:flex;justify-content:space-between;color:var(--text-primary);font-size:14px;margin-top:6px;align-items:center;"><span>Total a Facturar:</span><strong style="font-size:18px;">C$${fmt(d.finalTotal)}</strong></div>
        </div>
        <div style="margin-bottom:12px;">
           <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;margin-bottom:8px;cursor:pointer;">
             <input type="checkbox" name="moraAplicar" onchange="document.getElementById('pos_mora_pct').disabled = !this.checked;">
             Aplicar Cargos por Mora
           </label>
           <div style="display:flex;align-items:center;gap:8px;margin-left:24px;">
             <span style="font-size:12px;color:var(--text-muted);">% de Mora (mensual):</span>
             <input type="number" name="moraPorcentaje" id="pos_mora_pct" class="form-input" min="0" step="0.01" value="0" disabled style="width:100px;font-size:14px;">
           </div>
        </div>
        <div style="margin-bottom:12px;">
           <label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;">Fecha Límite de Crédito (Vencimiento):</label>
           <input type="date" name="fechaLimite" class="form-input" style="width:100%;font-size:14px;padding:8px;" required>
        </div>
        <div style="margin-bottom:12px;">
           <label style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;">Modalidad de Pago:</label>
           <select name="modalidadPago" class="form-select" onchange="const c = document.getElementById('pos_credito_cuotas_box'); if(this.value==='cuotas'){c.style.display='block';VentasModule.calcAmortizacionCredito();}else{c.style.display='none';document.getElementById('pos_credito_amortizacion').innerHTML='';}" style="font-size:14px;">
             <option value="unico">Un solo pago</option>
             <option value="cuotas">En cuotas</option>
           </select>
        </div>
        <div id="pos_credito_cuotas_box" style="display:none;background:rgba(0,0,0,0.03);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
           <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
             <div>
               <label style="font-size:11px;font-weight:700;display:block;margin-bottom:2px;">Número de cuotas</label>
               <input type="number" name="numCuotas" min="2" max="120" value="2" class="form-input" style="font-size:14px;" oninput="VentasModule.calcAmortizacionCredito()">
             </div>
             <div>
               <label style="font-size:11px;font-weight:700;display:block;margin-bottom:2px;">Periodicidad</label>
               <select name="periodicidad" class="form-select" style="font-size:14px;" onchange="VentasModule.calcAmortizacionCredito()">
                 <option value="Semanal">Semanal</option>
                 <option value="Quincenal">Quincenal</option>
                 <option value="Mensual" selected>Mensual</option>
               </select>
             </div>
           </div>
           <div id="pos_credito_amortizacion" style="max-height:180px;overflow-y:auto;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-primary);"></div>
        </div>
        <input type="hidden" name="actionVal" value="1">
      `;
    }

    if (posActionModal === 'newClientFull') {
      return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
        <div class="pos-action-modal" style="width: 800px; max-width: 95vw; background:var(--bg-secondary); border-radius:12px; box-shadow:var(--shadow-xl); overflow:hidden;">
          <div class="pos-action-modal__header" style="background:linear-gradient(135deg,#0ea5e9, #0284c7);color:white;border-bottom:none;padding:16px;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;color:white;display:flex;align-items:center;gap:8px;">${Icons.plus} Nuevo Cliente</h3>
            <button onclick="VentasModule.closeActionModal()" style="color:white;background:rgba(255,255,255,0.2);padding:6px;border-radius:6px;border:none;">${Icons.x}</button>
          </div>
          <form class="pos-action-modal__body" onsubmit="VentasModule.onClientCreatedFromPOS(event)" style="padding:20px;max-height:70vh;overflow-y:auto;background:var(--bg-primary);">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Tipo de Cliente</label>
                <select name="tipoRegistro" class="form-select" onchange="
                  const isEmpresa = this.value === 'Empresa';
                  document.getElementById('pos-lbl-ident').innerText = isEmpresa ? 'RUC:' : 'Cédula ID:';
                  document.getElementById('pos-input-ident').placeholder = 'xxx-xxxxxx-xxxxx';
                ">
                  <option value="Persona Natural" selected>Persona Natural</option>
                  <option value="Empresa">Empresa</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label form-label--required" id="pos-lbl-ident">Cédula ID:</label>
                <input type="text" id="pos-input-ident" name="identificacion" class="form-input" placeholder="xxx-xxxxxx-xxxxx" required 
                  oninput="if(ClientesModule && ClientesModule.formatIdentificacion) { ClientesModule.formatIdentificacion(this); }" maxlength="16">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required">Nombre de cliente:</label>
                <input type="text" name="nombreCliente" class="form-input" placeholder="Ej: Juan Pérez" required id="posNewClientNameInput">
              </div>
              <div class="form-group">
                <label class="form-label form-label--required">Teléfono</label>
                <input type="tel" name="telefono" class="form-input" placeholder="Ej: +505 8888-8888" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección</label>
              <textarea name="direccion" class="form-textarea" rows="2" placeholder="Ej: Managua, Nicaragua"></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Límite de Crédito</label>
                <input type="number" name="limiteCredito" class="form-input" value="0" step="0.01">
              </div>
              <div class="form-group">
                <label class="form-label">Porcentaje de descuento</label>
                <div style="position:relative;">
                  <input type="number" name="porcentajeDescuento" class="form-input" value="0" step="0.01">
                  <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);">%</span>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Lista de Precios</label>
                <select name="listaPrecios" class="form-select">
                  <option value="General" selected>General</option>
                  <option value="Mayorista">Mayorista</option>
                  <option value="VIP">VIP</option>
                  <option value="Credito">Crédito</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" name="correo" class="form-input" placeholder="Ej: correo@ejemplo.com">
              </div>
            </div>

            <div style="background:var(--bg-secondary);padding:1rem;border-radius:8px;margin-bottom:1rem;border:1px solid var(--border-color);">
              <h4 style="margin:0 0 1rem 0;font-size:0.95rem;color:var(--text-primary);">Impuestos</h4>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impSumarRetencion" onchange="document.getElementById('pos-val-sumar-ret').disabled = !this.checked">
                    Sumar Retención
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="pos-val-sumar-ret" name="valSumarRetencion" class="form-input" step="0.01" disabled placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impRetencion" onchange="document.getElementById('pos-val-ret').disabled = !this.checked">
                    Retención
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="pos-val-ret" name="valRetencion" class="form-input" step="0.01" disabled placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;cursor:pointer;">
                    <input type="checkbox" name="impIva" onchange="document.getElementById('pos-val-iva').disabled = !this.checked">
                    IVA
                  </label>
                  <div style="position:relative;">
                    <input type="number" id="pos-val-iva" name="valIva" class="form-input" step="0.01" disabled placeholder="0.00">
                    <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:0.8rem;">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="pos-action-modal__footer" style="margin:0 -20px -20px;padding:16px 20px;background:var(--bg-secondary);border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:12px;">
              <button type="button" class="btn btn--secondary" onclick="VentasModule.closeActionModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">${Icons.check} Crear Cliente y Seleccionar</button>
            </div>
          </form>
        </div>
      </div>`;
    }

    if (posActionModal === 'contador-divisas') {
      const divisas = getPosDataUncached('pos_divisas');

      const sortDivisas = (a, b) => {
        if (a.tipo === 'Billete' && b.tipo === 'Moneda') return -1;
        if (a.tipo === 'Moneda' && b.tipo === 'Billete') return 1;
        return parseFloat(b.valor) - parseFloat(a.valor);
      };

      const divisasNio = divisas.filter(d => d.divisa === 'NIO').sort(sortDivisas);
      const divisasUsd = divisas.filter(d => d.divisa === 'USD').sort(sortDivisas);

      // Create an array to manage tabindex properly so we can jump from NIO input to USD input nicely, or sequentially 
      let tabindexCount = 1;

      return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
        <div class="pos-action-modal" style="width: 700px; max-width: 95vw; background:var(--bg-secondary); border-radius:12px; box-shadow:var(--shadow-xl); overflow:hidden;">
          <div class="pos-action-modal__header" style="background:var(--bg-primary);border-bottom:1px solid var(--border-color);padding:16px;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;display:flex;align-items:center;gap:8px;">${Icons.wallet} Contador de Divisas</h3>
            <button onclick="VentasModule.closeActionModal()" type="button" class="btn btn--ghost btn--icon" tabindex="-1">${Icons.x}</button>
          </div>
          <form id="formContadorDivisas" class="pos-action-modal__body" onsubmit="VentasModule.submitContadorDivisas(event)" style="padding:24px;max-height:70vh;overflow-y:auto;background:var(--bg-primary);">
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
               <!-- Córdobas -->
               <div>
                  <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:1rem;border-bottom:2px solid var(--color-primary-200);padding-bottom:0.5rem;">
                     <h4 style="margin:0;color:var(--text-primary);">C$ - Córdobas</h4>
                     <strong id="lblTotalDivisasNio" style="color:var(--color-primary-600);font-size:1.1rem;">Total: C$ 0.00</strong>
                  </div>
                  ${divisasNio.length > 0 ? divisasNio.map(d => `
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
                       <span style="font-size:0.9rem;">${d.nombre}</span>
                       <div style="display:flex;align-items:center;gap:0.5rem;">
                         <span style="color:var(--text-muted);font-size:0.8rem;">x</span>
                         <input type="number" name="nio_${d.valor}" class="form-input" min="0" step="1" placeholder="0" style="width:70px;text-align:right;" tabindex="${tabindexCount++}" oninput="VentasModule.liveCalcDivisas()" onkeydown="if(event.key==='Enter'){event.preventDefault(); const next = document.querySelector('[tabindex=&quot;${tabindexCount}&quot;]'); if(next) next.focus(); else document.getElementById('btnSubmitDivisas').focus();}">
                       </div>
                    </div>
                  `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">No hay divisas C$ configuradas.</p>'}
               </div>

               <!-- Dólares -->
               <div>
                  <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:1rem;border-bottom:2px solid #10b981;padding-bottom:0.5rem;">
                     <h4 style="margin:0;color:var(--text-primary);">$ - Dólares</h4>
                     <strong id="lblTotalDivisasUsd" style="color:#10b981;font-size:1.1rem;">Total: $ 0.00</strong>
                  </div>
                  ${divisasUsd.length > 0 ? divisasUsd.map(d => `
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
                       <span style="font-size:0.9rem;">${d.nombre}</span>
                       <div style="display:flex;align-items:center;gap:0.5rem;">
                         <span style="color:var(--text-muted);font-size:0.8rem;">x</span>
                         <input type="number" name="usd_${d.valor}" class="form-input" min="0" step="1" placeholder="0" style="width:70px;text-align:right;" tabindex="${tabindexCount++}" oninput="VentasModule.liveCalcDivisas()" onkeydown="if(event.key==='Enter'){event.preventDefault(); const next = document.querySelector('[tabindex=&quot;${tabindexCount}&quot;]'); if(next) next.focus(); else document.getElementById('btnSubmitDivisas').focus();}">
                       </div>
                    </div>
                  `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;">No hay divisas USD configuradas.</p>'}
               </div>
            </div>

            <div class="pos-action-modal__footer" style="margin:24px -24px -24px;padding:16px 24px;background:var(--bg-secondary);border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:12px;">
              <button type="button" class="btn btn--ghost" tabindex="-1" onclick="VentasModule.closeActionModal()">Cancelar</button>
              <button type="submit" id="btnSubmitDivisas" tabindex="${tabindexCount++}" class="btn btn--primary">${Icons.check} Calcular y Aplicar</button>
            </div>
          </form>
        </div>
      </div>`;
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
    } else if (type === 'cotizaciones') {
      title = '📝 Historial Cotizaciones';
      content = renderCotizaciones();
    } else if (type === 'pos-sucursal') {
      title = '🏢 Buscador de Sucursales';
      content = renderPOSSucursal();
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

  const renderPaymentModal = (subTotalBase, originalSymbol) => {
    let tipoCambio = 36.62;
    try { const cfg = typeof DataService !== 'undefined' ? DataService.getConfig() : {}; tipoCambio = parseFloat(cfg.tipoCambio) || 36.62; } catch (e) { }

    const actuallyPayInUSD = posPayInUSD && selectedCurrency === 'NIO';
    const uiSubtotal = actuallyPayInUSD ? subTotalBase / tipoCambio : subTotalBase;
    const currSymbol = actuallyPayInUSD ? '$' : originalSymbol;

    let finalTotal = uiSubtotal;
    let paymentConfigHtml = '';

    if (selectedPayment === 'transferencia') {
      const listas = getPosDataUncached('pos_transferencias');
      if (posSelectedConfigIdx >= listas.length) posSelectedConfigIdx = 0;
      paymentConfigHtml = `
        <div style="margin-top:16px;">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">Seleccionar Cuenta Banco:</label>
          <select id="posPaymentConfig" class="form-select" onchange="VentasModule.setPaymentConfig(this.value)" style="border:2px solid var(--border-color);font-size:14px;height:40px;margin-bottom:12px;">
            <option value="" disabled ${listas.length === 0 ? 'selected' : ''}>${listas.length === 0 ? 'No hay cuentas configuradas' : 'Seleccione...'}</option>
            ${listas.map((x, i) => `<option value="${i}" ${posSelectedConfigIdx == i ? 'selected' : ''}>${x.banco} - ${x.divisa} (${x.numeroCuenta})</option>`).join('')}
          </select>
          <label style="font-size:12px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:8px;">Referencia / N° Transacción:</label>
          <input type="text" id="posDocReference" oninput="VentasModule.setDocReference(this.value)" value="${posDocReference}" class="form-input" placeholder="Opcional..." style="font-size:14px;border:2px solid var(--border-color);height:40px;width:100%;" autocomplete="off">
        </div>
      `;
    } else if (selectedPayment === 'multiple') {
      const getOpts = (list, isTj) => list.map(x => `<option value="${x}">${isTj ? (x.posBanco || x.banco) : x.banco}</option>`).join('');
      const sum = posMultiplePayments.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
      const eqNIO = actuallyPayInUSD ? sum * tipoCambio : sum;
      const remBase = Math.max(0, subTotalBase - eqNIO);
      const remShow = actuallyPayInUSD ? remBase / tipoCambio : remBase;

      paymentConfigHtml = `
        <div style="margin-top:16px;max-height:220px;overflow-y:auto;padding-right:8px;">
          <h4 style="font-size:12px;margin:0 0 8px;">Métodos de Pago:</h4>
          ${posMultiplePayments.map((p, i) => {
        let extraHtml = '';
        if (p.metodo === 'tarjeta') {
          const stAsumir = getPosDataUncached('pos_tarjetas_asumir');
          const stCobrar = getPosDataUncached('pos_tarjetas');
          extraHtml = `
                 <select class="form-select" style="width:90px;font-size:11px;padding:4px;" onchange="VentasModule.updatePosMultiple(${i}, 'tjmodo', this.value)">
                   <option value="cobrar" ${p.tjmodo === 'cobrar' ? 'selected' : ''}>Cobrar</option>
                   <option value="asumir" ${p.tjmodo === 'asumir' ? 'selected' : ''}>Asumir</option>
                 </select>
                 <select class="form-select" style="width:110px;font-size:11px;padding:4px;" onchange="VentasModule.updatePosMultiple(${i}, 'configIdx', this.value)">
                   <option value="" disabled selected>POS Banco...</option>
                   ${(p.tjmodo === 'asumir' ? stAsumir : stCobrar).map((x, j) => `<option value="${j}" ${p.configIdx == j ? 'selected' : ''}>${x.posBanco}</option>`).join('')}
                 </select>
               `;
        } else if (p.metodo === 'transferencia') {
          const st = getPosDataUncached('pos_transferencias');
          extraHtml = `
                 <select class="form-select" style="flex:1;min-width:110px;font-size:11px;padding:4px;" onchange="VentasModule.updatePosMultiple(${i}, 'configIdx', this.value)">
                   <option value="" disabled selected>Cuenta Banco...</option>
                   ${st.map((x, j) => `<option value="${j}" ${p.configIdx == j ? 'selected' : ''}>${x.banco} (${x.divisa || 'NIO'})</option>`).join('')}
                 </select>
               `;
        } else if (p.metodo === 'extrafinanciamiento') {
          const st = getPosDataUncached('pos_extrafinanciamiento');
          extraHtml = `
                 <select class="form-select" style="flex:1;min-width:110px;font-size:11px;padding:4px;" onchange="VentasModule.updatePosMultiple(${i}, 'configIdx', this.value)">
                   <option value="" disabled selected>Plan Banco...</option>
                   ${st.map((x, j) => `<option value="${j}" ${p.configIdx == j ? 'selected' : ''}>${x.banco} (${x.plazoMeses}m)</option>`).join('')}
                 </select>
               `;
        }
        return `
            <div style="background:var(--bg-primary);border:1px solid var(--border-color);padding:8px;border-radius:6px;margin-bottom:8px;display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
              <select class="form-select" style="width:100px;font-size:11px;padding:4px;" onchange="VentasModule.updatePosMultiple(${i}, 'metodo', this.value)">
                <option value="efectivo" ${p.metodo === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                <option value="tarjeta" ${p.metodo === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
                <option value="transferencia" ${p.metodo === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                <option value="extrafinanciamiento" ${p.metodo === 'extrafinanciamiento' ? 'selected' : ''}>Extra.</option>
                <option value="credito" ${p.metodo === 'credito' ? 'selected' : ''}>Crédito</option>
              </select>
              ${extraHtml}
              <input type="number" class="form-input" style="width:80px;font-size:11px;padding:4px;" placeholder="C$ Monto" value="${p.monto || ''}" onchange="VentasModule.updatePosMultiple(${i}, 'monto', parseFloat(this.value)||0)">
              <input type="text" class="form-input" style="flex:1;min-width:80px;font-size:11px;padding:4px;" placeholder="Ref..." value="${p.referencia || ''}" onchange="VentasModule.updatePosMultiple(${i}, 'referencia', this.value)">
              <button class="btn btn--danger btn--icon" style="flex-shrink:0;width:24px;height:24px;min-height:24px;padding:0;" onclick="VentasModule.removePosMultiple(${i})">✕</button>
            </div>
            `}).join('')}
          <button class="btn btn--ghost" style="width:100%;padding:4px;font-size:11px;margin-bottom:8px;" onclick="VentasModule.addPosMultiple()">+ Agregar Otro Pago</button>
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-primary);border-radius:6px;padding:8px 12px;border:1px solid var(--border-color);">
            <span style="font-size:13px;font-weight:700;color:var(--text-muted);">Restante:</span>
            <span style="font-size:15px;font-weight:800;color:${remShow <= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${currSymbol}${fmt(remShow)}</span>
          </div>
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
                 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                   <div style="font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;text-align:left;">Monto a Cobrar</div>
                   ${selectedCurrency === 'NIO' ? `
                     <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;background:rgba(16,185,129,0.1);color:#10b981;padding:6px 12px;border-radius:20px;">
                       <input type="checkbox" ${posPayInUSD ? 'checked' : ''} onchange="VentasModule.togglePayInUSD()">
                       Pagar en USD
                     </label>
                   ` : ''}
                 </div>
                 <div style="font-size:42px;font-weight:800;color:var(--color-primary-500);">${currSymbol}${fmt(finalTotal)}</div>
               </div>
               ${(() => {
                 const allBodegas = typeof DataService !== 'undefined' && DataService.getBodegasSync ? DataService.getBodegasSync() : [];
                 const u = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
                 const bodegasUser = allBodegas.filter(b => b.empresa_id === (u ? u.empresa_id : ''));
                 if (bodegasUser.length === 0) return '';
                 return `
                 <div style="margin-bottom:16px;">
                    <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">Bodega de Retiro:</label>
                    <select id="posBodegaSelect" class="form-select" onchange="VentasModule.setPosBodegaRetiro(this.value)" style="border:2px solid var(--border-color);font-size:14px;height:40px;">
                      ${bodegasUser.map(b => `<option value="${b.id}" ${b.id === posSelectedBodegaRetiro ? 'selected' : ''}>${b.nombre}</option>`).join('')}
                    </select>
                 </div>`;
               })()}
               <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Tipo de Pago:</div>
               <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:24px;">
                  ${['efectivo', 'tarjeta', 'transferencia', 'extrafinanciamiento', 'credito', 'multiple'].map(m => `
                    <button style="padding:10px 4px;border:2px solid ${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--border-color)'};background:${selectedPayment === m ? 'rgba(56,189,248,0.1)' : 'transparent'};border-radius:8px;font-weight:700;color:${selectedPayment === m ? 'var(--color-primary-500)' : 'var(--text-primary)'};cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;align-items:center;gap:4px;justify-content:center;font-size:10px;" onclick="VentasModule.setPaymentOnly('${m}')">
                      <span style="font-size:16px;">${m === 'efectivo' ? '💵' : m === 'tarjeta' ? '💳' : m === 'transferencia' ? '🏦' : m === 'extrafinanciamiento' ? '📈' : m === 'credito' ? '📋' : '🔀'}</span>
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

  const processPaymentOverride = async () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * getIvaRate();
    const total = subtotal - descuento - globalDiscount + iva;
    let finalTotal = total;
    let paymentDetails = null;
    const costoTotal = cart.reduce((s, i) => s + ((parseFloat(i.costo) || 0) * (parseFloat(i.cantidad) || 0)), 0);

    let tipoCambio = 36.62;
    try { const cfg = typeof DataService !== 'undefined' ? DataService.getConfig() : {}; tipoCambio = parseFloat(cfg.tipoCambio) || 36.62; } catch (e) { }
    const actuallyPayInUSD = posPayInUSD && selectedCurrency === 'NIO';

    if (selectedPayment === 'credito') {
      if (!selectedClient) {
        setTimeout(() => VentasModule.openClientSearchModal(), 100);
        return;
      }
      const cl = getClients().find(c => c.id === selectedClient);
      const limCredito = parseFloat(cl?.limiteCredito || cl?.limite_credito || 0);
      const saldoPend = getData('ventas').filter(v => v.clienteId === selectedClient && v.metodo === 'credito' && parseFloat(v.saldo_pendiente || 0) > 0).reduce((s, v) => s + parseFloat(v.saldo_pendiente || 0), 0);
      const creditoDisp = limCredito - saldoPend;

      if (posActionModal !== 'credito-setup') {
        posActionData = { finalTotal, total, subtotal, descuento, globalDiscount, iva, costoTotal, cl, limCredito, creditoDisp, actuallyPayInUSD, tipoCambio };
        posActionModal = 'credito-setup';
        App.render();
        return;
      }
    }

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
      paymentDetails = { banco: item.banco, numeroCuenta: item.numeroCuenta, divisa: item.divisa, referencia: posDocReference };
    } else if (selectedPayment === 'multiple') {
      const sum = posMultiplePayments.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
      const userCashNIO = actuallyPayInUSD ? sum * tipoCambio : sum;
      if (userCashNIO < finalTotal) { alert('La suma de los pagos múltiples es menor al total: C$' + fmt(finalTotal)); return; }
      paymentDetails = { pagos: posMultiplePayments };

      const hasCredito = posMultiplePayments.some(p => p.metodo === 'credito');
      if (hasCredito && posActionModal !== 'credito-setup') {
        if (!selectedClient) {
          setTimeout(() => VentasModule.openClientSearchModal(), 100);
          return;
        }
        const cl = getClients().find(c => c.id === selectedClient);
        const lim = parseFloat(cl?.limiteCredito || cl?.limite_credito || 0);
        const pend = getData('ventas').filter(v => v.clienteId === selectedClient && v.metodo === 'credito' && parseFloat(v.saldo_pendiente || 0) > 0).reduce((s, v) => s + parseFloat(v.saldo_pendiente || 0), 0);
        posActionData = { finalTotal, total, subtotal, descuento, globalDiscount, iva, costoTotal, cl, limCredito: lim, creditoDisp: lim - pend, actuallyPayInUSD, tipoCambio, isMultiple: true };
        posActionModal = 'credito-setup';
        App.render();
        return;
      }
    }

    const simpleCashNIO = actuallyPayInUSD ? cashReceived * tipoCambio : cashReceived;
    if (selectedPayment === 'efectivo' && simpleCashNIO < finalTotal) { alert('El efectivo recibido es menor al total.'); return; }

    const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
    const clientFound = selectedClient ? getClients().find(c => c.id === selectedClient) : null;

    if (actuallyPayInUSD) {
      paymentDetails = paymentDetails || {};
      paymentDetails.pagoEnUSD = true;
      paymentDetails.montoRecibidoUSD = cashReceived;
      paymentDetails.tipoCambioApicado = tipoCambio;
    }

    // Verificar Bodega de Retiro elegida
    let finalBodegaRetiro = posSelectedBodegaRetiro;
    if (!finalBodegaRetiro) {
      const allBodegas = typeof DataService !== 'undefined' && DataService.getBodegasSync ? DataService.getBodegasSync() : [];
      const userBodegas = allBodegas.filter(b => b.empresa_id === (typeof State !== 'undefined' ? State.getCurrentUser()?.empresa_id : ''));
      if (userBodegas.length > 0) finalBodegaRetiro = userBodegas[0].id;
    }

    // Actualizar stock de productos y Sincronizar Cache Local
    for (const item of cart) {
      if (item.productId && typeof DataService !== 'undefined' && DataService.updateProducto) {
        try {
          const prod = await DataService.getProductoById(item.productId);
          if (prod) {
            const currentStock = parseInt(prod.stock_actual || prod.stock || prod.cantidad || 0);
            await syncProductStock(item.productId, currentStock - item.cantidad);
            
            // Restar de la bodega de retiro seleccionada
            if (finalBodegaRetiro) {
              const bKey = 'prod_bodegas_' + finalBodegaRetiro + '_' + item.productId;
              const currentBStock = parseInt(localStorage.getItem(bKey) || '0');
              localStorage.setItem(bKey, Math.max(0, currentBStock - item.cantidad).toString());
            }
          }
        } catch (e) {
          console.warn('Error actualizando stock:', e);
        }
      }
    }

    addRec('ventas', { numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient, cliente: clientFound ? (clientFound.empresa || clientFound.nombreCliente || 'Cliente') : 'Público General', items: cart.map(i => ({ ...i })), subtotal, descuento, descuento_global: globalDiscount, iva, total: finalTotal, base_total: total, costo_total: costoTotal, metodo: selectedPayment, detalles_pago: paymentDetails, lista_precio: posSelectedPriceList, efectivo_recibido: selectedPayment === 'efectivo' ? simpleCashNIO : 0, cambio: selectedPayment === 'efectivo' ? Math.max(0, simpleCashNIO - finalTotal) : 0, saldo_pendiente: (selectedPayment === 'credito' || selectedPayment === 'multiple') ? finalTotal : 0, vendedor: user()?.name || 'N/A', estado: 'completada', comentario: posComment });

    if (posDocReference && posDocReference.startsWith('COT-')) {
      const db = JSON.parse(localStorage.getItem('vnt_cotizaciones') || '[]');
      const dbIdx = db.findIndex(c => c.numero === posDocReference);
      if (dbIdx >= 0) {
        db[dbIdx].estado = 'facturada';
        localStorage.setItem('vnt_cotizaciones', JSON.stringify(db));
      }
    }
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
  let clientSearchModalOpen = false;
  let clientSearchModalQuery = '';

  const clearSelectedClient = () => { selectedClient = null; App.render(); };

  const openClientSearchModal = () => {
    clientSearchModalOpen = true;
    clientSearchModalQuery = '';
    const allClients = getClients();
    currentClientSearchRes = allClients.slice(0, 50);
    currentClientSearchIdx = -1;
    App.render();
    setTimeout(() => {
      const input = document.getElementById('posClientModalSearch');
      if (input) input.focus();
    }, 100);
  };

  const closeClientSearchModal = () => {
    clientSearchModalOpen = false;
    clientSearchModalQuery = '';
    currentClientSearchRes = [];
    currentClientSearchIdx = -1;
    App.render();
  };

  const filterClientSearchModal = (q) => {
    clientSearchModalQuery = q;
    const allClients = getClients();
    if (!q || q.length < 1) {
      currentClientSearchRes = allClients.slice(0, 50);
    } else {
      const ql = q.toLowerCase();
      currentClientSearchRes = allClients.filter(c =>
        (c.empresa || '').toLowerCase().includes(ql) ||
        (c.nombreCliente || '').toLowerCase().includes(ql) ||
        (c.cedulaRuc || c.cedula_ruc || '').toLowerCase().includes(ql) ||
        (c.telefono || '').includes(ql)
      ).slice(0, 50);
    }
    currentClientSearchIdx = currentClientSearchRes.length > 0 ? 0 : -1;
    renderClientModalList();
  };

  const handleClientModalKeydown = (e) => {
    const input = document.getElementById('posClientModalSearch');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentClientSearchIdx = Math.min(currentClientSearchIdx + 1, currentClientSearchRes.length - 1);
      renderClientModalList();
      if (input) input.focus();
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentClientSearchIdx = Math.max(currentClientSearchIdx - 1, 0);
      renderClientModalList();
      if (input) input.focus();
      return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentClientSearchIdx >= 0 && currentClientSearchIdx < currentClientSearchRes.length) {
        selectClientFromModal(currentClientSearchRes[currentClientSearchIdx].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeClientSearchModal();
    }
  };

  const selectClientFromModal = (id) => {
    selectedClient = id;
    clientSearchModalOpen = false;
    App.render();
  };

  const renderClientModalList = () => {
    const el = document.getElementById('posClientModalList');
    if (!el) return;
    const allVentas = getData('ventas');
    const hoy = new Date();
    el.innerHTML = currentClientSearchRes.length === 0
      ? '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No se encontraron clientes</div>'
      : currentClientSearchRes.map((c, i) => {
        const nombre = c.empresa || c.nombreCliente || 'N/A';
        const cedula = c.cedulaRuc || c.cedula_ruc || '';
        const dir = c.direccion || '';
        const limCredito = parseFloat(c.limiteCredito || c.limite_credito || 0);
        const isSelected = i === currentClientSearchIdx;
        // Detect overdue invoices (credit invoices older than 30 days with pending balance)
        const facturasVencidas = limCredito > 0 ? allVentas.filter(v => v.clienteId === c.id && v.metodo === 'credito' && parseFloat(v.saldo_pendiente || 0) > 0 && v.fecha && ((hoy - new Date(v.fecha)) / 86400000) > 30) : [];
        const totalVencido = facturasVencidas.reduce((s, v) => s + parseFloat(v.saldo_pendiente || 0), 0);
        const hasOverdue = facturasVencidas.length > 0;
        const rowId = `client-row-${i}`;
        return `<div class="pos-client-modal-row ${isSelected ? 'pos-client-modal-row--active' : ''} ${hasOverdue ? 'pos-client-modal-row--overdue' : ''}" data-cidx="${i}">
          <div style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;" onclick="VentasModule.selectClientFromModal('${c.id}')">
            <div style="width:36px;height:36px;border-radius:8px;background:${isSelected ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : hasOverdue ? 'linear-gradient(135deg,#ef4444,#dc2626)' : '#e2e8f0'};color:${isSelected || hasOverdue ? 'white' : '#64748b'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${nombre.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13px;">${nombre}</div>
              <div style="font-size:11px;color:var(--text-muted);">${cedula || 'Sin cédula'} ${c.telefono ? '· 📞 ' + c.telefono : ''}${dir ? ` · 📍 ${dir}` : ''}</div>
            </div>
            ${limCredito > 0 ? `<div style="text-align:right;flex-shrink:0;"><div style="font-size:11px;font-weight:700;color:${hasOverdue ? '#ef4444' : '#10b981'};">Crédito: C$${fmt(limCredito)}</div>${hasOverdue ? `<div style="font-size:9px;color:#ef4444;font-weight:800;">⚠ ${facturasVencidas.length} fact. vencida${facturasVencidas.length > 1 ? 's' : ''}</div>` : ''}</div>` : ''}
          </div>
          ${hasOverdue ? `
            <div style="margin-top:8px;margin-left:48px;">
              <button type="button" onclick="event.stopPropagation();const d=document.getElementById('${rowId}');d.style.display=d.style.display==='none'?'block':'none';" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#dc2626;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">⚠ Ver ${facturasVencidas.length} factura${facturasVencidas.length > 1 ? 's' : ''} vencida${facturasVencidas.length > 1 ? 's' : ''} — Total: C$${fmt(totalVencido)}</button>
              <div id="${rowId}" style="display:none;margin-top:6px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:8px;max-height:120px;overflow-y:auto;">
                <table style="width:100%;font-size:10px;border-collapse:collapse;">
                  <thead><tr style="border-bottom:1px solid rgba(239,68,68,0.2);"><th style="text-align:left;padding:3px 6px;color:#dc2626;">Factura</th><th style="text-align:left;padding:3px 6px;color:#dc2626;">Fecha</th><th style="text-align:right;padding:3px 6px;color:#dc2626;">Pendiente</th><th style="text-align:right;padding:3px 6px;color:#dc2626;">Días</th></tr></thead>
                  <tbody>${facturasVencidas.map(v => `<tr><td style="padding:3px 6px;font-weight:600;">${v.numero || 'N/A'}</td><td style="padding:3px 6px;">${fmtD(v.fecha)}</td><td style="padding:3px 6px;text-align:right;font-weight:700;color:#dc2626;">C$${fmt(v.saldo_pendiente)}</td><td style="padding:3px 6px;text-align:right;">${Math.floor((hoy - new Date(v.fecha)) / 86400000)}d</td></tr>`).join('')}</tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>`;
      }).join('');
    // Scroll to active
    const activeRow = el.querySelector('.pos-client-modal-row--active');
    if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const renderClientSearchModalOverlay = () => {
    if (!clientSearchModalOpen) return '';
    return `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999992;display:flex;align-items:center;justify-content:center;" onclick="VentasModule.closeClientSearchModal()">
        <div style="background:var(--bg-primary);border-radius:12px;width:520px;max-height:70vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;" onclick="event.stopPropagation()">
          <div style="padding:16px 20px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;">
            <h3 style="margin:0;font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:8px;">${Icons.users} Buscar Cliente</h3>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.7;">Use ↑↓ para navegar, Enter para seleccionar, Esc para cerrar</p>
          </div>
          <div style="padding:12px 16px;border-bottom:1px solid var(--border-color);">
            <input type="text" id="posClientModalSearch" class="form-input" placeholder="Buscar por nombre, cédula, RUC o teléfono..." value="${clientSearchModalQuery}" oninput="VentasModule.filterClientSearchModal(this.value)" onkeydown="VentasModule.handleClientModalKeydown(event)" autocomplete="off" style="width:100%;font-size:14px;padding:10px 12px;">
          </div>
          <div id="posClientModalList" style="flex:1;overflow-y:auto;max-height:400px;padding:8px;">
            ${currentClientSearchRes.map((c, i) => {
      const nombre = c.empresa || c.nombreCliente || 'N/A';
      const cedula = c.identificacion || c.cedulaRuc || c.cedula_ruc || '';
      const limCredito = parseFloat(c.limiteCredito || c.limite_credito || 0);
      const isSelected = i === currentClientSearchIdx;
      return `<div onclick="VentasModule.selectClientFromModal('${c.id}')" class="pos-client-modal-row ${isSelected ? 'pos-client-modal-row--active' : ''}" data-cidx="${i}">
                <div style="width:36px;height:36px;border-radius:8px;background:${isSelected ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : '#e2e8f0'};color:${isSelected ? 'white' : '#64748b'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${nombre.charAt(0).toUpperCase()}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:700;font-size:13px;">${nombre}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${cedula || 'Sin cédula'} ${c.telefono ? '· 📞 ' + c.telefono : ''}</div>
                </div>
                ${limCredito > 0 ? `<div style="font-size:11px;font-weight:700;color:#10b981;">Crédito: C$${fmt(limCredito)}</div>` : ''}
              </div>`;
    }).join('')}
          </div>
          <div style="padding:10px 16px;background:var(--bg-secondary);border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
            <button type="button" onclick="VentasModule.openNewClientFromSearchModal()" class="btn btn--primary btn--sm" style="font-size:12px;">+ Nuevo Cliente</button>
            <button onclick="VentasModule.closeClientSearchModal()" class="btn btn--ghost btn--sm">Cancelar</button>
          </div>
        </div>
      </div>`;
  };

  const openNewClientFromSearchModal = () => {
    clientSearchModalOpen = false;
    clientSearchModalQuery = '';
    currentClientSearchRes = [];
    currentClientSearchIdx = -1;
    // Render the client create form directly in a POS overlay modal
    posActionModal = 'newClientFull';
    posActionData = null;
    App.render();
  };

  // Called after client is created from POS to refresh and select
  const onClientCreatedFromPOS = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const rawData = Object.fromEntries(formData.entries());
    const isEmpresa = rawData.tipoRegistro === 'Empresa';
    const data = {
      tipo_registro: rawData.tipoRegistro || 'Persona Natural',
      identificacion: rawData.identificacion || null,
      nombre_cliente: rawData.nombreCliente,
      empresa: isEmpresa ? rawData.nombreCliente : rawData.nombreCliente,
      telefono: rawData.telefono,
      correo: rawData.correo || null,
      direccion: rawData.direccion || null,
      limite_credito: parseFloat(rawData.limiteCredito) || 0,
      porcentaje_descuento: parseFloat(rawData.porcentajeDescuento) || 0,
      lista_precios: rawData.listaPrecios || 'General',
      nota: rawData.nota || null,
      imp_sumar_retencion: rawData.impSumarRetencion === 'on',
      val_sumar_retencion: rawData.impSumarRetencion === 'on' ? (parseFloat(rawData.valSumarRetencion) || 0) : 0,
      imp_retencion: rawData.impRetencion === 'on',
      val_retencion: rawData.impRetencion === 'on' ? (parseFloat(rawData.valRetencion) || 0) : 0,
      imp_iva: rawData.impIva === 'on',
      val_iva: rawData.impIva === 'on' ? (parseFloat(rawData.valIva) || 0) : 0,
      estado: rawData.estado || 'Activo'
    };
    try {
      await DataService.createCliente(data);
      alert('✅ Cliente creado exitosamente');
      posActionModal = null; posActionData = null;
      // Auto-select the new client from the refreshed list
      const allClients = getClients();
      const newClient = allClients.find(c => (c.nombreCliente || '').toLowerCase() === rawData.nombreCliente.toLowerCase());
      if (newClient) selectedClient = newClient.id;
      App.render();
    } catch (error) {
      alert('❌ Error al crear cliente: ' + (error.message || 'Error desconocido'));
    }
  };

  const searchClientsCombo = (q) => {
    // Legacy: kept for compatibility but primary use is now the modal
    const el = document.getElementById('posClientResults');
    if (!el) return;
    if (!q || q.length < 1) { el.style.display = 'none'; return; }
    clearTimeout(clientSearchTimeout);
    clientSearchTimeout = setTimeout(() => {
      const found = getClients().filter(c => (c.empresa || c.nombreCliente || '').toLowerCase().includes(q.toLowerCase())).slice(0, 5);
      if (found.length === 0) { el.style.display = 'none'; }
      else { currentClientSearchRes = found; currentClientSearchIdx = -1; renderClientSearchResults(); }
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
  const addPosMultiple = () => { posMultiplePayments.push({ metodo: 'efectivo', monto: 0, referencia: '', configIdx: 0, tjmodo: 'cobrar' }); App.render(); };
  const removePosMultiple = (i) => { posMultiplePayments.splice(i, 1); App.render(); };
  const updatePosMultiple = (i, field, val) => {
    posMultiplePayments[i][field] = val;
    if (field === 'metodo') posMultiplePayments[i].configIdx = 0;
    if (field === 'metodo' || field === 'tjmodo') App.render();
  };

  const openPaymentModal = () => { if (cart.length === 0) return; posOpenModal = 'payment'; selectedPayment = 'efectivo'; posMultiplePayments = [{ metodo: 'efectivo', monto: 0, referencia: '', configIdx: 0, tjmodo: 'cobrar' }]; posSelectedConfigIdx = 0; cashReceived = 0; posPayInUSD = false; posDocReference = ''; posSelectedBodegaRetiro = typeof localStorage !== 'undefined' ? (localStorage.getItem('bodega_activa') || '') : ''; App.render(); };
  const closePaymentModal = () => { posOpenModal = null; App.render(); };
  const closePosModal = () => { posOpenModal = null; consultorQuery = ''; consultorResult = null; cotizacionQuery = ''; cotizacionSelected = null; devolucionQuery = ''; devolucionSelectedId = null; devolucionProdQuery = ''; devolucionSelectedItems = {}; App.render(); };
  const setPaymentOnly = (m) => { selectedPayment = m; posSelectedConfigIdx = 0; App.render(); };
  const setTarjetaModo = (m) => { posTarjetaModo = m; posSelectedConfigIdx = 0; App.render(); };
  const setPaymentConfig = (idx) => { posSelectedConfigIdx = parseInt(idx); App.render(); };
  const setPriceList = (l) => { posSelectedPriceList = l; App.render(); };
  const setCurrency = (c) => { selectedCurrency = c; App.render(); };
  const setPosBodegaRetiro = (v) => { posSelectedBodegaRetiro = v; App.render(); };
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
      const prods = getProducts().filter(p => {
        const qArr = query.toLowerCase().split(' ').filter(x => x.length > 0);
        const nombre = String(p.nombre || '').toLowerCase();
        const codigo = String(p.codigo || '').toLowerCase();
        const sku = String(p.sku || p.codigo || '').toLowerCase();
        const codigoAlt = String(p.codigoAlt || p.codigo_alternativo || '').toLowerCase();

        return qArr.every(q => nombre.includes(q) || codigo.includes(q) || sku.includes(q) || codigoAlt.includes(q));
      }).slice(0, 8);
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
    else { cart.push({ productId, nombre: p.nombre, codigo: p.codigo, sku: p.sku, precio: parseFloat(p.precioVenta || p.precio || 0), precioOriginal: parseFloat(p.precioVenta || p.precio || 0), costo: parseFloat(p.precioCompra || p.costo || 0), cantidad: qtyToAdd, descuento: 0, saleGranel: isGranel, serial, trackingId: overrideTrackingId, tipoSeguimiento: p.tipoSeguimiento, imagenes: p.imagenes || (p.imagenUrl ? [p.imagenUrl] : []) }); targetRowIndex = cart.length - 1; }

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
    const symbol = (posPayInUSD && selectedCurrency === 'NIO') ? '$ ' : (selectedCurrency === 'USD' ? '$ ' : 'C$ ');
    if (box && recEl && camEl) { box.style.display = val > 0 ? 'block' : 'none'; recEl.textContent = symbol + fmt(val); camEl.textContent = symbol + fmt(cambio >= 0 ? cambio : 0); camEl.style.color = cambio >= 0 ? '#059669' : '#ef4444'; }
  };

  const calcAmortizacionCredito = () => {
    if (posActionModal !== 'credito-setup' || !posActionData) return;
    const forms = document.getElementsByTagName('form');
    let form = null;
    for (let f of forms) { if (f.querySelector('select[name="modalidadPago"]')) form = f; }
    if (!form) return;
    const fd = new FormData(form);
    const modalidadPago = fd.get('modalidadPago');
    const container = document.getElementById('pos_credito_amortizacion');
    if (!container) return;
    if (modalidadPago !== 'cuotas') { container.innerHTML = ''; return; }

    let numCuotas = parseInt(fd.get('numCuotas'));
    if (isNaN(numCuotas) || numCuotas < 2) numCuotas = 2;
    const periodicidad = fd.get('periodicidad') || 'Mensual';
    const total = posActionData.finalTotal;
    const cuotaMonto = total / numCuotas;

    let date = new Date();
    let daysAdd = periodicidad === 'Semanal' ? 7 : (periodicidad === 'Quincenal' ? 15 : 30);

    let rows = '';
    for (let i = 1; i <= numCuotas; i++) {
      date.setDate(date.getDate() + daysAdd);
      rows += `<tr><td style="padding:6px;border-bottom:1px solid var(--border-color);">${i}</td><td style="padding:6px;border-bottom:1px solid var(--border-color);">${date.toLocaleDateString('es-NI')}</td><td style="padding:6px;border-bottom:1px solid var(--border-color);text-align:right;font-weight:600;color:var(--text-primary);">C$${fmt(cuotaMonto)}</td></tr>`;
    }
    container.innerHTML = `<table style="width:100%;font-size:11px;text-align:left;border-collapse:collapse;">
        <thead><tr><th style="padding:6px;border-bottom:2px solid var(--border-color);position:sticky;top:0;background:var(--bg-primary);">No.</th><th style="padding:6px;border-bottom:2px solid var(--border-color);position:sticky;top:0;background:var(--bg-primary);">Vencimiento</th><th style="padding:6px;border-bottom:2px solid var(--border-color);text-align:right;position:sticky;top:0;background:var(--bg-primary);">Monto a Pagar</th></tr></thead>
        <tbody>${rows}</tbody>
     </table>`;
  };

  const togglePayInUSD = () => { posPayInUSD = !posPayInUSD; cashReceived = 0; posDocReference = ''; App.render(); };
  const setDocReference = (val) => { posDocReference = val; };

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
               <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                 <h4 style="margin:0;color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;">${Icons.wallet} Conteo Físico de Divisas</h4>
                 <button class="btn btn--sm btn--primary" onclick="VentasModule.promptContadorDivisas()">${Icons.calculator || '🧮'} Contador de Divisas</button>
               </div>
               <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;">
                  <div>
                    <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:0.4rem;color:var(--text-muted);text-transform:uppercase;">Córdobas (C$ Físico)</label>
                    <input type="number" id="conteoCaja" class="form-input" placeholder="0.00" step="0.01" value="${cierreConteoNio}" oninput="VentasModule.updateConteoNio(this.value)" style="font-size:1.5rem;font-weight:bold;height:50px;">
                  </div>
                  <div>
                    <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:0.4rem;color:var(--text-muted);text-transform:uppercase;">Dólares (USA Físico)</label>
                    <input type="number" id="conteoDolares" class="form-input" placeholder="0.00" step="0.01" value="${cierreConteoUsd}" oninput="VentasModule.updateConteoUsd(this.value)" style="font-size:1.5rem;font-weight:bold;height:50px;">
                  </div>
               </div>
            </div>
         </div>
         <div style="background:var(--bg-primary);padding:1rem 2rem;display:flex;justify-content:flex-end;gap:1.5rem;border-top:1px solid var(--border-color);flex-shrink:0;">
              <button onclick="VentasModule.cancelCloseTurno()" class="btn btn--ghost" style="font-size:1.1rem;padding:0.6rem 2rem;">Cancelar y Volver</button>
             <button onclick="VentasModule.confirmCloseTurno()" class="btn btn--danger" style="font-size:1.1rem;font-weight:700;padding:0.75rem 2rem;">Bloquear y Cerrar Turno</button>
         </div>
      </div>
      ${posActionModal === 'contador-divisas' ? renderPosActionModal() : ''}
    `;
  };
  const renderConsultorPrecios = () => {
    return `
      <div style="display:flex;flex-direction:column;height:100%;padding:1.5rem;background:var(--bg-secondary);">
         <div style="margin-bottom:1.5rem;display:flex;gap:12px;align-items:center;">
            <div style="position:relative;flex:1;">
               <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.5rem;color:var(--text-muted);">🔍</span>
               <input type="text" class="form-input" id="consultorSearchInput" placeholder="Escanee código de barras o busque por nombre..." style="width:100%;height:54px;font-size:1.1rem;padding-left:56px;border-radius:12px;border:2px solid var(--color-primary-300);" value="${consultorQuery}" oninput="VentasModule.searchConsultor(this.value)" autocomplete="off">
            </div>
         </div>
         <div style="flex:1;overflow-y:auto;background:var(--bg-primary);border-radius:12px;border:1px solid var(--border-color);padding:1.5rem;">
            ${!consultorResult ? '<div style="text-align:center;color:var(--text-muted);margin-top:2rem;"><div style="font-size:3rem;margin-bottom:1rem;">🛒</div><h2>Consultor de Precios</h2><p>Ingrese un producto para consultar detalles.</p></div>' :
        consultorResult.length === 0 ? '<div style="text-align:center;color:var(--text-muted);margin-top:2rem;"><h2>No se encontraron productos</h2></div>' :
          consultorResult.map(p => {
            const imgTag = p.fotoPromocional ? `<img src="${p.fotoPromocional}" style="max-width:100%;max-height:100%;object-fit:cover;border-radius:6px;">` : '<span style="font-size:2rem;color:#cbd5e1;">📦</span>';
            
            // Obtener stock por bodega localmente
            let stockBodegasHtml = '';
            const todasBodegas = (typeof DataService !== 'undefined' && DataService.getBodegasSync) ? DataService.getBodegasSync() : [];
            const empId = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser()?.empresa_id : '';
            const misBodegas = todasBodegas.filter(b => b.empresa_id === empId);
            if (misBodegas.length > 0) {
              stockBodegasHtml = misBodegas.map(b => {
                const bStock = p['stock_bodega_' + b.id] || 0;
                return `<span style="display:inline-block;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;padding:2px 6px;font-size:0.75rem;margin-right:4px;">${b.nombre}: <strong style="color:${bStock > 0 ? '#10b981' : '#ef4444'}">${bStock}</strong></span>`;
              }).join('');
            }
            
            return `
                <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border-color);">
                   <div style="width:60px;height:60px;background:white;border-radius:8px;border:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                      ${imgTag}
                   </div>
                   <div style="flex:1;">
                      <h2 style="margin:0 0 2px;font-size:1.1rem;color:var(--text-primary);">${p.nombre}</h2>
                      <div style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Código: ${p.codigo || p.sku || 'N/A'} &middot; Total Disp: <strong style="color:${(p.inventario || 0) > 0 ? '#10b981' : '#ef4444'};">${p.inventario || 0}</strong></div>
                      ${stockBodegasHtml ? `<div style="margin-bottom:8px;">${stockBodegasHtml}</div>` : ''}
                      <p style="font-size:0.8rem;color:var(--text-primary);margin-bottom:8px;line-height:1.2;max-height:30px;overflow:hidden;text-overflow:ellipsis;">${p.descripcion || 'Sin descripción agregada.'}</p>
                      
                      <div style="display:flex;gap:0.5rem;margin-bottom:8px;flex-wrap:wrap;">
                        <div style="background:var(--bg-secondary);padding:0.4rem;border-radius:6px;border:1px solid var(--border-color);">
                           <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:1px;font-weight:700;">PRECIO PÚBLICO</div>
                           <div style="font-size:1rem;font-weight:900;color:var(--color-primary-600);">C$${fmt(p.precioVentaA || p.precio_venta || 0)}</div>
                        </div>
                        ${p.masPrecios ? p.masPrecios.map(mp => `
                           <div style="background:var(--bg-secondary);padding:0.4rem;border-radius:6px;border:1px solid var(--border-color);">
                             <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:1px;font-weight:700;">${(mp.nombrePrecio || 'PRECIO').toUpperCase()}</div>
                             <div style="font-size:0.9rem;font-weight:800;color:var(--text-primary);">C$${fmt(mp.monto)}</div>
                           </div>
                        `).join('') : ''}
                      </div>
                      
                      <button onclick="VentasModule.navigateSidebar('pos'); VentasModule.addToCart('${p.id}');" class="btn btn--primary btn--sm" style="font-size:0.8rem;padding:4px 10px;">🛒 Agregar</button>
                   </div>
                </div>
              `}).join('')
      }
         </div>
      </div>
      <script>setTimeout(() => { const i = document.getElementById('consultorSearchInput'); if (i) setTimeout(() => i.focus(), 50); }, 50);</script>
    `;
  };

  let searchSucursalTimeout = null;
  const searchSucursalProds = async (q, empresaId) => {
    if (!empresaId) return;
    const bodyEl = document.getElementById('sucursalResultBody');
    if (!bodyEl) return;
    
    if (!q || q.length < 2) { 
        bodyEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:2rem;">Ingrese al menos 2 caracteres para buscar.</div>'; 
        return; 
    }
    
    bodyEl.innerHTML = '<div style="text-align:center;color:var(--color-primary-600);margin-top:2rem;font-weight:700;">Buscando en sucursal remota...</div>';
    
    try {
        const { data, error } = await SupabaseDataService.client
            .from('productos')
            .select('*')
            .eq('empresa_id', empresaId)
            .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,sku.ilike.%${q}%`)
            .limit(20);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            bodyEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:2rem;"><h2>No se encontraron productos en esta sucursal</h2></div>';
            return;
        }
        
        // Cargar bodegas de esta empresa
        const { data: bgData } = await SupabaseDataService.client
            .from('bodegas')
            .select('id, nombre')
            .eq('empresa_id', empresaId);
        
        const bMap = {};
        if (bgData) bgData.forEach(b => bMap[b.id] = b.nombre);
        
        bodyEl.innerHTML = data.map(p => {
            let invObj = {};
            try { invObj = p.inventario_bodegas ? JSON.parse(p.inventario_bodegas) : {}; } catch(e){}
            const bgHtml = Object.keys(invObj).map(bId => {
               if (invObj[bId] > 0) return `<span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:4px;">${bMap[bId] || 'Bodega '+bId.substring(0,4)}: <strong>${invObj[bId]}</strong></span>`;
               return '';
            }).join('');
            
            let phtml = '';
            let masP = [];
            try { masP = p.masPrecios ? JSON.parse(p.masPrecios) : []; } catch(e){}
            if (masP && masP.length > 0) {
               phtml = masP.map(mp => `<div style="background:var(--bg-secondary);padding:0.4rem;border-radius:6px;border:1px solid var(--border-color);"><div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:1px;font-weight:700;">${(mp.nombrePrecio||'PRECIO').toUpperCase()}</div><div style="font-size:0.9rem;font-weight:800;color:var(--text-primary);">C$${fmt(mp.monto)}</div></div>`).join('');
            }
            
            return `
               <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border-color);">
                   <div style="flex:1;">
                      <h2 style="margin:0 0 2px;font-size:1.1rem;color:var(--text-primary);">${p.nombre}</h2>
                      <div style="font-family:monospace;font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Código: ${p.codigo || p.sku || 'N/A'} &middot; Total Disp: <strong style="color:${(p.stock_actual || 0) > 0 ? '#10b981' : '#ef4444'};">${p.stock_actual || 0}</strong></div>
                      ${bgHtml ? `<div style="margin-bottom:8px;">${bgHtml}</div>` : ''}
                      
                      <div style="display:flex;gap:0.5rem;margin-bottom:4px;flex-wrap:wrap;">
                        <div style="background:var(--bg-secondary);padding:0.4rem;border-radius:6px;border:1px solid var(--border-color);">
                           <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:1px;font-weight:700;">PRECIO PÚBLICO</div>
                           <div style="font-size:1rem;font-weight:900;color:var(--color-primary-600);">C$${fmt(p.precio_venta || p.precio || 0)}</div>
                        </div>
                        ${phtml}
                      </div>
                   </div>
               </div>
            `;
        }).join('');
        
    } catch (error) {
       console.error("Error consultando sucursal:", error);
       bodyEl.innerHTML = `<div style="text-align:center;color:#ef4444;margin-top:2rem;">Error al buscar: ${error.message}</div>`;
    }
  };

  const renderPOSSucursal = () => {
    let empOpts = '<option value="">Seleccione una sucursal...</option>';
    if (typeof DataService !== 'undefined' && DataService.getEmpresasSync) {
        const empId = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser()?.empresa_id : '';
        const emps = DataService.getEmpresasSync().filter(e => e.id !== empId);
        empOpts += emps.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    }
    return `
      <div style="display:flex;flex-direction:column;height:100%;padding:1.5rem;background:var(--bg-secondary);">
         <div style="margin-bottom:1rem;display:flex;gap:12px;align-items:center;">
             <span style="font-size:1.5rem;color:var(--text-muted);">🏢</span>
             <h2 style="margin:0;color:var(--text-primary);">Consulta Inter-Sucursales</h2>
         </div>
         <div style="margin-bottom:1rem;display:flex;gap:12px;align-items:center;">
            <select id="sucursalSelectEmpresa" class="form-input" style="width:300px;font-weight:600;" onchange="const input = document.getElementById('sucursalSearchInput'); if(input.value) VentasModule.searchSucursalProds(input.value, this.value);">
                ${empOpts}
            </select>
         </div>
         <div style="margin-bottom:1.5rem;display:flex;gap:12px;align-items:center;">
            <div style="position:relative;flex:1;">
               <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.5rem;color:var(--text-muted);">🔍</span>
               <input type="text" class="form-input" id="sucursalSearchInput" placeholder="Escanee o busque por nombre en la sucursal remota..." style="width:100%;height:54px;font-size:1.1rem;padding-left:56px;border-radius:12px;border:2px solid var(--color-primary-300);" oninput="clearTimeout(VentasModule.searchSucursalTimeout); VentasModule.searchSucursalTimeout = setTimeout(()=>VentasModule.searchSucursalProds(this.value, document.getElementById('sucursalSelectEmpresa').value), 500);" autocomplete="off">
            </div>
         </div>
         <div id="sucursalResultBody" style="flex:1;overflow-y:auto;background:var(--bg-primary);border-radius:12px;border:1px solid var(--border-color);padding:1.5rem;">
            <div style="text-align:center;color:var(--text-muted);margin-top:2rem;">
               <div style="font-size:3rem;margin-bottom:1rem;">🏢</div>
               <p>Seleccione una empresa y realice una búsqueda.</p>
            </div>
         </div>
      </div>
    `;
  };

  const renderPOSDevoluciones = () => '<div style="padding:2rem;">Devoluciones... (En desarrollo)</div>';
  const renderApartados = () => '<div style="padding:2rem;">Apartados... (En desarrollo)</div>';

  let reportFilters = {
    type: 'mes', // 'mes', 'rango', 'todos'
    month: new Date().toISOString().substring(0, 7),
    dateFrom: new Date().toISOString().substring(0, 10),
    dateTo: new Date().toISOString().substring(0, 10)
  };
  const setReportFilterType = (t) => { reportFilters.type = t; App.render(); };
  const setReportFilterMonth = (m) => { reportFilters.month = m; App.render(); };
  const setReportFilterDate = (f, t) => { if (f) reportFilters.dateFrom = f; if (t) reportFilters.dateTo = t; App.render(); };

  const applyReportFilters = (arr) => {
    if (reportFilters.type === 'todos') return arr;
    return arr.filter(item => {
      if (!item.fecha) return false;
      if (reportFilters.type === 'mes') {
        return item.fecha.startsWith(reportFilters.month);
      } else if (reportFilters.type === 'rango') {
        const d = item.fecha.substring(0, 10);
        return d >= reportFilters.dateFrom && d <= reportFilters.dateTo;
      }
      return true;
    });
  };

  const renderReportesFilters = () => `
        <div style="background:var(--bg-secondary);padding:1rem;border-radius:12px;margin-bottom:1.5rem;display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center;box-shadow:var(--shadow-sm);border:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:0.5rem;">
             <strong style="color:var(--text-primary);font-size:0.9rem;">Periodo:</strong>
             <select class="form-input" style="width:180px;font-weight:600;" onchange="VentasModule.setReportFilterType(this.value)">
               <option value="mes" ${reportFilters.type === 'mes' ? 'selected' : ''}>📅 Por Mes</option>
               <option value="rango" ${reportFilters.type === 'rango' ? 'selected' : ''}>🗓️ Rango de Fechas</option>
               <option value="todos" ${reportFilters.type === 'todos' ? 'selected' : ''}>🌍 Histórico Completo</option>
             </select>
          </div>
          ${reportFilters.type === 'mes' ? `
             <div style="display:flex;align-items:center;gap:0.5rem;animation:fadeIn 0.2s ease;">
               <input type="month" class="form-input" value="${reportFilters.month}" onchange="VentasModule.setReportFilterMonth(this.value)">
             </div>
          ` : reportFilters.type === 'rango' ? `
             <div style="display:flex;align-items:center;gap:0.5rem;animation:fadeIn 0.2s ease;">
               <div style="color:var(--text-muted);font-size:0.85rem;font-weight:600;">Desde</div>
               <input type="date" class="form-input" value="${reportFilters.dateFrom}" onchange="VentasModule.setReportFilterDate(this.value, null)">
               <div style="color:var(--text-muted);font-size:0.85rem;font-weight:600;margin-left:0.5rem;">Hasta</div>
               <input type="date" class="form-input" value="${reportFilters.dateTo}" onchange="VentasModule.setReportFilterDate(null, this.value)">
             </div>
          ` : ''}
        </div>
  `;

  let cotizacionQuery = '';
  let cotizacionSelected = null;

  const searchCotizaciones = (q) => { cotizacionQuery = q; App.render(); };
  const selectCotizacion = (num) => { cotizacionSelected = num; App.render(); };

  const renderCotizaciones = () => {
    const rawData = getData('cotizaciones').reverse();
    let data = applyReportFilters(rawData);

    if (cotizacionQuery.trim()) {
      const q = cotizacionQuery.toLowerCase();
      data = data.filter(c => String(c.numero || '').toLowerCase().includes(q) || (c.cliente && String(c.cliente || '').toLowerCase().includes(q)));
    }

    const listHtml = data.length === 0 ? '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No hay cotizaciones registradas.</div>' :
      `<table class="data-table" style="width:100%;font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:12px;">Número</th><th style="text-align:left;padding:12px;">Fecha</th><th style="text-align:left;padding:12px;">Venc.</th><th style="text-align:left;padding:12px;">Cliente</th><th style="text-align:right;padding:12px;">Total</th><th style="text-align:center;padding:12px;">Estado</th>
          </tr>
        </thead>
        <tbody>
           ${data.map(c => `
             <tr style="border-bottom:1px solid var(--border-color); cursor:pointer; background:${cotizacionSelected === c.numero ? 'var(--color-primary-50)' : 'transparent'}; transition:background 0.2s;" onclick="VentasModule.selectCotizacion('${c.numero}')">
               <td style="padding:12px 8px; color:${cotizacionSelected === c.numero ? 'var(--color-primary-600)' : 'inherit'};"><strong>${c.numero}</strong></td>
               <td>${new Date(c.fecha).toLocaleDateString('es-NI')}</td>
               <td><span style="${new Date(c.vencimiento) < new Date() && c.estado === 'vigente' ? 'color:#ef4444;font-weight:bold;' : ''}">${new Date(c.vencimiento).toLocaleDateString('es-NI')}</span></td>
               <td><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${c.cliente || 'Público'}</div></td>
               <td style="font-weight:700;text-align:right;color:var(--color-primary-600);">${c.divisa === 'USD' ? '$' : 'C$'}${fmt(c.total)}</td>
               <td style="text-align:center;"><span style="border-radius:12px;padding:4px 8px;font-size:10px;font-weight:700;display:inline-block;background:${c.estado === 'vigente' ? 'rgba(56,189,248,0.1);color:#38bdf8;' : (c.estado === 'facturada' ? 'rgba(16,185,129,0.1);color:#10b981;' : 'rgba(148,163,184,0.1);color:#94a3b8;')}">${(c.estado || '').toUpperCase()}</span></td>
             </tr>
           `).join('')}
        </tbody>
      </table>`;

    let sidebarHtml = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;text-align:center;">Seleccione una cotización para ver detalles.</div>';

    if (cotizacionSelected) {
      const c = rawData.find(x => x.numero === cotizacionSelected);
      if (c) {
        sidebarHtml = `
            <div style="display:flex;flex-direction:column;height:100%;">
              <h3 style="margin:0 0 16px;font-size:1.6rem;color:var(--color-primary-600); border-bottom:1px solid var(--border-color); padding-bottom:12px; font-weight:800; display:flex; align-items:center; justify-content:space-between;">
                <span>Docs: ${c.numero}</span>
                <span style="font-size:1rem;color:var(--text-muted);font-weight:500;">${new Date(c.fecha).toLocaleDateString('es-NI')}</span>
              </h3>
              <div style="flex:1;overflow-y:auto;margin-bottom:16px;">
                <div style="margin-bottom:12px;background:var(--bg-secondary);padding:12px;border-radius:8px;">
                  <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;">CLIENTE</div>
                  <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">${c.cliente || 'Público General'}</div>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                   <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                     <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;">VENCE EL</div>
                     <div style="font-size:1rem;font-weight:700;color:${new Date(c.vencimiento) < new Date() && c.estado === 'vigente' ? '#ef4444' : 'var(--text-primary)'};">${new Date(c.vencimiento).toLocaleDateString('es-NI')}</div>
                   </div>
                   <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
                     <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;">ESTADO</div>
                     <div style="font-size:1rem;font-weight:700;color:${c.estado === 'vigente' ? '#38bdf8' : (c.estado === 'facturada' ? '#10b981' : '#94a3b8')}">${(c.estado || '').toUpperCase()}</div>
                   </div>
                </div>

                <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;font-weight:700;">CANTIDAD - LISTA DE PRODUCTOS</div>
                <div style="background:var(--bg-secondary);border-radius:8px;padding:8px;border:1px solid var(--border-color);">
                  <ul style="list-style:none;padding:0;margin:0;font-size:0.95rem;">
                    ${c.items.map(i => `<li style="padding:6px 4px;border-bottom:1px dashed var(--border-color);display:flex;justify-content:space-between;align-items:flex-start;">
                       <span style="flex:1;padding-right:8px;"><span style="color:var(--color-primary-600);font-weight:700;margin-right:4px;">${i.cantidad}x</span> <span>${i.nombre}</span></span> 
                       <span style="font-weight:700;flex-shrink:0;">${c.divisa === 'USD' ? '$' : 'C$'}${fmt(i.precio * i.cantidad)}</span>
                    </li>`).join('')}
                  </ul>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px 4px;margin-top:4px;border-top:1px solid var(--border-color);">
                    <span style="font-weight:700;color:var(--text-muted);">Total Cotizado</span>
                    <span style="font-weight:900;font-size:1.3rem;color:var(--color-primary-600);">${c.divisa === 'USD' ? '$' : 'C$'}${fmt(c.total)}</span>
                  </div>
                </div>
              </div>
              
              <div style="border-top:1px solid var(--border-color);padding-top:16px;display:flex;flex-direction:column;gap:12px;">
                 <div style="display:flex;gap:12px;">
                   <button onclick="alert('Funcionalidad de PDF en desarrollo');" class="btn btn--secondary" style="flex:1;font-weight:600;"><span style="margin-right:8px;">📄</span> Imprimir</button>
                   <button onclick="alert('Funcionalidad de correo en desarrollo');" class="btn btn--secondary" style="flex:1;font-weight:600;"><span style="margin-right:8px;">📧</span> Correo</button>
                 </div>
                 <button onclick="VentasModule.facturarCotizacion('${c.numero}')" class="btn btn--primary" style="width:100%;font-weight:800;font-size:1.15rem;padding:16px;letter-spacing:1px;" ${c.estado !== 'vigente' ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}><span style="margin-right:8px;">🛒</span> EFECTUAR VENTA</button>
              </div>
            </div>
          `;
      }
    }

    return `<div style="display:flex;height:100%;background:var(--bg-secondary);">
       <div style="flex:1;display:flex;flex-direction:column;padding:1.5rem;border-right:1px solid var(--border-color);max-width:calc(100% - 420px);">
           
           <div style="display:flex;gap:1.5rem;margin-bottom:1.5rem;">
              <div style="flex:1;position:relative;">
                 <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.2rem;">🔍</span>
                 <input type="text" class="form-input" placeholder="Buscar por cliente o número de proforma..." value="${cotizacionQuery}" oninput="VentasModule.searchCotizaciones(this.value)" style="width:100%;padding-left:48px;height:50px;font-size:1.1rem;border-width:2px;">
              </div>
           </div>
           
           ${renderReportesFilters()}
           
           <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column;">
              <div style="flex:1;overflow-y:auto;">
                 ${listHtml}
              </div>
           </div>
       </div>
       <div style="width:420px;background:var(--bg-primary);padding:1.5rem;display:flex;flex-direction:column;">
          ${sidebarHtml}
       </div>
    </div>`;
  };
  
  let viewPvGroup = 'none';

  const renderProductosVendidos = () => {
    const ventas = getData('ventas');
    const prods = typeof DataService !== 'undefined' ? DataService.getProductosSync() : [];
    
    // Flatten all sold items
    let soldItems = [];
    ventas.forEach(v => {
        if (!v.items) return;
        v.items.forEach(i => {
           soldItems.push({
               fecha: v.fecha,
               factura: v.numFactura,
               cliente: typeof DataService !== 'undefined' ? DataService.getClienteById(v.clienteId)?.nombre : v.clienteId,
               prodId: i.id || i.productoId,
               nombre: i.nombre,
               cantidad: i.cantidad,
               precio: i.precio,
               subtotal: i.cantidad * i.precio
           });
        });
    });

    let grouped = [];
    if (viewPvGroup === 'none') {
        grouped = soldItems.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    } else {
        const groups = {};
        soldItems.forEach(item => {
            const p = prods.find(x => x.id === item.prodId) || {};
            let key = 'Sin agrupar';
            if (viewPvGroup === 'departamento') key = p.departamento || p.categoria || 'Sin departamento';
            if (viewPvGroup === 'proveedor') {
                const provs = typeof DataService !== 'undefined' ? DataService.getProveedoresSync() : [];
                const pr = provs.find(x => x.id === p.proveedorId || x.razonSocial === p.proveedor);
                key = pr ? pr.razonSocial : (p.proveedor || 'Sin proveedor');
            }
            if (viewPvGroup === 'producto') {
                key = item.nombre;
            }

            if (!groups[key]) groups[key] = { key, cantidad: 0, subtotal: 0, items: [] };
            groups[key].cantidad += item.cantidad;
            groups[key].subtotal += item.subtotal;
            groups[key].items.push(item);
        });
        grouped = Object.values(groups).sort((a,b) => b.cantidad - a.cantidad);
    }

    const htmlTable = viewPvGroup === 'none' 
      ? `<table class="data-table" style="width:100%;font-size:12px;">
          <thead class="data-table__head"><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead>
          <tbody class="data-table__body">
            ${grouped.map(i => `<tr><td>${fmtD(i.fecha)}</td><td>${i.factura}</td><td>${i.cliente || '-'}</td><td>${i.nombre}</td><td>${i.cantidad}</td><td>C${fmt(i.subtotal)}</td></tr>`).join('')}
            ${grouped.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No hay productos vendidos</td></tr>' : ''}
          </tbody>
         </table>`
      : `<div style="display:flex;flex-direction:column;gap:1rem;">${grouped.map(g => `
          <div style="border:1px solid var(--border-color);border-radius:8px;padding:1rem;background:var(--bg-secondary);">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:8px;margin-bottom:8px;">
                <h5 style="margin:0;font-size:14px;color:var(--color-primary-600);">${g.key}</h5>
                <div style="font-weight:700;">Total Cant: ${g.cantidad} | Total: C${fmt(g.subtotal)}</div>
            </div>
            <table class="data-table" style="width:100%;font-size:11px;">
               <thead class="data-table__head"><tr><th>Fecha</th><th>Factura</th><th>Producto</th><th>Cant.</th><th>Subtotal</th></tr></thead>
               <tbody class="data-table__body">
                ${g.items.map(i => `<tr><td>${fmtD(i.fecha)}</td><td>${i.factura}</td><td>${i.nombre}</td><td>${i.cantidad}</td><td>C${fmt(i.subtotal)}</td></tr>`).join('')}
               </tbody>
            </table>
          </div>
         `).join('')}</div>`;

    return `
      <div class="ventas-header">
        <div class="ventas-header__title"><button class="btn btn--ghost btn--icon" onclick="VentasModule.navigateTo('dashboard')">🔙</button> ${Icons.package} Productos Vendidos</div>
      </div>
      <div style="padding:1rem;">
        <div style="display:flex;gap:1rem;margin-bottom:1rem;align-items:center;">
          <label style="font-weight:600;font-size:13px;">Agrupar por:</label>
          <select class="form-select" style="width:200px;" onchange="VentasModule.setPvGroup(this.value)">
             <option value="none" ${viewPvGroup === 'none' ? 'selected' : ''}>Sin Agrupar (Detallado)</option>
             <option value="producto" ${viewPvGroup === 'producto' ? 'selected' : ''}>Producto</option>
             <option value="departamento" ${viewPvGroup === 'departamento' ? 'selected' : ''}>Departamento</option>
             <option value="proveedor" ${viewPvGroup === 'proveedor' ? 'selected' : ''}>Proveedor</option>
          </select>
        </div>
        <div class="card" style="padding:0;">${htmlTable}</div>
      </div>
    `;
  };

  const setPvGroup = (val) => { viewPvGroup = val; App.refreshCurrentModule(); };

  // Instead of rewriting the whole Clientes UI here, just render it from ClientesModule
  const renderClientes = () => {
    return typeof ClientesModule !== 'undefined' ? `<div style="position:relative;">
      <button class="btn btn--secondary btn--sm" style="position:absolute;top:10px;right:25px;z-index:100;" onclick="VentasModule.navigateTo('dashboard')">🔙 Volver a Ventas</button>
      ${ClientesModule.render()}
    </div>` : '<div style="padding:2rem;">Módulo Clientes no disponible</div>';
  };
  const renderAbonos = () => '<div style="padding:2rem;">Abonos... (En desarrollo)</div>';
  const renderReimpresion = () => '<div style="padding:2rem;">Reimpresión... (En desarrollo)</div>';
  const renderCortes = () => { currentReportTab = 'cortes-caja'; return renderReportes(); };
  let devolucionQuery = '';
  let devolucionSelectedId = null;
  let devolucionProdQuery = '';
  let devolucionSelectedItems = {};

  const searchDevoluciones = (q) => { devolucionQuery = q; App.render(); };
  const selectDevolucion = (id) => { devolucionSelectedId = id; devolucionProdQuery = ''; devolucionSelectedItems = {}; App.render(); };
  const searchDevolucionProducts = (q) => { devolucionProdQuery = q; App.render(); };
  const toggleDevolucionItem = (idx) => { devolucionSelectedItems[idx] = !devolucionSelectedItems[idx]; App.render(); };

  const checkAllDevolucionItems = (totalItems) => {
    let allChecked = true;
    for (let i = 0; i < totalItems; i++) { if (!devolucionSelectedItems[i]) allChecked = false; }
    for (let i = 0; i < totalItems; i++) { devolucionSelectedItems[i] = !allChecked; }
    App.render();
  };

  const cancelarFacturaTotal = async (id) => {
    const vnt = getData('ventas');
    const vIdx = vnt.findIndex(x => x.id === id);
    if (vIdx < 0) return;
    const v = vnt[vIdx];
    if (v.estado === 'cancelada') { alert('Esta factura ya está cancelada.'); return; }
    if (!confirm('¿Desea CANCELAR TODA la factura #' + v.numero + '? Esta acción devolverá todo el stock.')) return;

    // Actualizar ventas
    vnt[vIdx].estado = 'cancelada';
    setData('ventas', vnt);

    // Guardar devolución
    addRec('devoluciones', {
      ventaId: id,
      numeroVenta: v.numero,
      tipo: 'total',
      monto: v.total,
      items: [...v.items],
      fecha: new Date().toISOString(),
      usuario: user()?.name || 'N/A'
    });

    // Actualizar stock de productos
    for (const itm of v.items) {
      if (itm.productId && typeof DataService !== 'undefined' && DataService.updateProducto) {
        try {
          const prod = await DataService.getProductoById(itm.productId);
          if (prod) {
            const currentStock = parseInt(prod.stock_actual || prod.stock || prod.cantidad || 0);
            await syncProductStock(itm.productId, currentStock + itm.cantidad);
          }
        } catch (e) {
          console.warn('Error al devolver stock:', e);
        }
      }
    }

    alert('✅ Factura cancelada y stock devuelto.');
    App.render();
  };

  const devolucionParcial = async (id) => {
    const vnt = getData('ventas');
    const vIdx = vnt.findIndex(x => x.id === id);
    if (vIdx < 0) return;
    const v = vnt[vIdx];

    const selectedIdxs = Object.keys(devolucionSelectedItems).filter(idx => devolucionSelectedItems[idx] === true);
    if (selectedIdxs.length === 0) { alert('Seleccione al menos un producto.'); return; }

    let itemsToDev = [];
    let totalDevocion = 0;

    for (const idx of selectedIdxs) {
      const item = v.items[idx];
      if (!item) continue;
      let cantDev = 1;
      if (item.cantidad > 1) {
        const promptVal = prompt('¿Cuántas unidades desea devolver de: ' + item.nombre + '? (Máx: ' + item.cantidad + ')', item.cantidad);
        if (promptVal === null) continue;
        const isGranel = (item.ventaGranel === 'true' || item.ventaGranel === true);
        cantDev = isGranel ? parseFloat(promptVal) : parseInt(promptVal);
        if (isNaN(cantDev) || cantDev <= 0) continue;
        if (cantDev > item.cantidad) cantDev = item.cantidad;
      } else {
        cantDev = 1;
      }

      itemsToDev.push({ ...item, cantidad: cantDev });
      totalDevocion += (item.precio * cantDev);

      // Actualizar stock y Sincronizar Cache Local
      if (item.productId && typeof DataService !== 'undefined' && DataService.updateProducto) {
        try {
          const prod = await DataService.getProductoById(item.productId);
          if (prod) {
            const currentStock = parseInt(prod.stock_actual || prod.stock || prod.cantidad || 0);
            await syncProductStock(item.productId, currentStock + cantDev);
          }
        } catch (e) { console.warn('Error devolviendo stock:', e); }
      }
    }

    if (itemsToDev.length === 0) return;

    // Guardar registro
    addRec('devoluciones', {
      ventaId: id,
      numeroVenta: v.numero,
      tipo: 'parcial',
      monto: totalDevocion,
      items: itemsToDev,
      fecha: new Date().toISOString(),
      usuario: user()?.name || 'N/A'
    });

    // Restar de la factura original
    itemsToDev.forEach(it => {
      const iIdx = vnt[vIdx].items.findIndex(orig => orig.id === it.id);
      if (iIdx >= 0) {
        vnt[vIdx].items[iIdx].cantidad -= it.cantidad;
        if (vnt[vIdx].items[iIdx].cantidad <= 0) vnt[vIdx].items.splice(iIdx, 1);
      }
    });

    vnt[vIdx].total -= totalDevocion;
    if (vnt[vIdx].items.length === 0) vnt[vIdx].estado = 'cancelada';

    setData('ventas', vnt);
    devolucionSelectedItems = {};
    alert('✅ Devolución parcial procesada!');
    App.render();
  };

  const renderDevoluciones = () => {
    const rawData = getData('ventas').reverse();
    let data = applyReportFilters(rawData);

    if (devolucionQuery.trim()) {
      const q = devolucionQuery.toLowerCase();
      data = data.filter(c => String(c.numero || '').toLowerCase().includes(q) || (c.cliente && String(c.cliente || '').toLowerCase().includes(q)));
    }

    const returnsHistory = getData('devoluciones').sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

    const listHtml = data.length === 0 ? '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No hay facturas registradas.</div>' :
      `<table class="data-table" style="width:100%;font-size:13px;">
        <thead>
          <tr>
            <th style="padding:12px;text-align:left;">Ticket N°</th>
            <th style="padding:12px;text-align:left;">Fecha</th>
            <th style="padding:12px;text-align:left;">Cliente</th>
            <th style="padding:12px;text-align:right;">Total Pagado</th>
            <th style="padding:12px;text-align:center;">Estado</th>
          </tr>
        </thead>
        <tbody>
           ${data.map(v => {
        const divisa = v.detalles_pago && v.detalles_pago.pagoEnUSD ? 'USD' : 'NIO';
        const cur = divisa === 'USD' ? '$' : 'C$';
        const isSel = devolucionSelectedId === v.id;
        return `<tr style="border-bottom:1px solid var(--border-color); cursor:pointer; background:${isSel ? 'var(--color-primary-50)' : 'transparent'}; transition:background 0.2s;" onclick="VentasModule.selectDevolucion('${v.id}')">
               <td style="padding:12px 8px; color:${isSel ? 'var(--color-primary-600)' : 'inherit'};"><strong>${v.numero}</strong></td>
               <td>${new Date(v.fecha).toLocaleDateString('es-NI')}</td>
               <td><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${v.cliente || 'Público'}</div></td>
               <td style="font-weight:700;text-align:right;color:var(--color-primary-600);">${cur}${fmt(v.total)}</td>
               <td style="text-align:center;"><span style="border-radius:12px;padding:4px 8px;font-size:10px;font-weight:700;display:inline-block;background:${v.estado === 'completada' ? 'rgba(16,185,129,0.1);color:#10b981;' : 'rgba(239,68,68,0.1);color:#ef4444;'}">${(v.estado || 'COMPLETADA').toUpperCase()}</span></td>
             </tr>`;
      }).join('')}
        </tbody>
      </table>`;

    const returnsHistoryHtml = returnsHistory.length === 0 ? '' : `
      <div style="margin-top:2rem;border-top:2px solid var(--border-color);padding-top:2rem;">
        <h3 style="margin-bottom:1rem;color:var(--color-primary-600);display:flex;align-items:center;gap:10px;">🕒 Historial de Devoluciones Realizadas</h3>
        <div style="background:var(--bg-primary);border-radius:10px;border:1px solid var(--border-color);overflow:hidden;">
          <table class="data-table" style="width:100%;font-size:12px;">
            <thead>
              <tr style="background:var(--bg-secondary);">
                <th style="padding:10px;">Fecha y Hora</th>
                <th style="padding:10px;">N° Factura</th>
                <th style="padding:10px;">Tipo</th>
                <th style="padding:10px;">Monto Dev.</th>
                <th style="padding:10px;">Usuario</th>
                <th style="padding:10px;">Items</th>
              </tr>
            </thead>
            <tbody>
              ${returnsHistory.map(h => `
                <tr style="border-bottom:1px solid var(--border-color);">
                  <td style="padding:8px;">${new Date(h.fecha).toLocaleString('es-NI')}</td>
                  <td><b>${h.numeroVenta || 'N/A'}</b></td>
                  <td><span style="border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;background:${h.tipo === 'total' ? '#fee2e2;color:#ef4444;' : '#fef3c7;color:#d97706;'}">${h.tipo === 'total' ? 'TOTAL' : 'PARCIAL'}</span></td>
                  <td style="font-weight:700;color:#ef4444;">C$${fmt(h.monto)}</td>
                  <td>${h.usuario || 'N/A'}</td>
                  <td><div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${(h.items || []).map(i => i.nombre).join(', ')}">${(h.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ')}</div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    let sidebarHtml = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;text-align:center;">Seleccione una factura para realizar una devolución.</div>';

    if (devolucionSelectedId) {
      const v = rawData.find(x => x.id === devolucionSelectedId);
      if (v) {
        let itemsFiltered = v.items || [];
        if (devolucionProdQuery.trim()) {
          const pq = devolucionProdQuery.toLowerCase();
          itemsFiltered = itemsFiltered.filter(i => (i.nombre && String(i.nombre || '').toLowerCase().includes(pq)) || (i.codigo && String(i.codigo || '').toLowerCase().includes(pq)));
        }

        const isCanceled = v.estado === 'cancelada';

        sidebarHtml = `
            <div style="display:flex;flex-direction:column;height:100%;">
              <h3 style="margin:0 0 16px;font-size:1.4rem;color:var(--color-primary-600); border-bottom:1px solid var(--border-color); padding-bottom:12px; font-weight:800; display:flex; align-items:center; justify:space-between;">
                <span>Venta: ${v.numero}</span>
                <span style="font-size:0.9rem;color:${isCanceled ? '#ef4444' : 'var(--text-muted)'};font-weight:500;">${isCanceled ? 'CANCELADA' : new Date(v.fecha).toLocaleDateString('es-NI')}</span>
              </h3>
              <div style="flex:1;overflow-y:auto;margin-bottom:16px;">
                <div style="margin-bottom:12px;display:flex;gap:12px;">
                  <div style="flex:1;background:var(--bg-secondary);padding:12px;border-radius:8px;">
                    <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;">CLIENTE</div>
                    <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">${v.cliente || 'Público General'}</div>
                  </div>
                  <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;text-align:right;">
                    <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;font-weight:700;">TOTAL PAGADO</div>
                    <div style="font-size:1.1rem;font-weight:700;color:var(--color-primary-600);">C$${fmt(v.total)}</div>
                  </div>
                </div>

                <div style="position:relative;margin-bottom:12px;">
                   <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1rem;">🔍</span>
                   <input type="text" class="form-input" placeholder="Buscar productos en la factura..." value="${devolucionProdQuery}" oninput="VentasModule.searchDevolucionProducts(this.value)" style="width:100%;padding-left:36px;height:40px;font-size:0.95rem;">
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                   <div style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">PRODUCTOS EFECTUADOS</div>
                   ${!isCanceled && (v.items && v.items.length > 0) ? `<button onclick="VentasModule.checkAllDevolucionItems(${v.items.length})" class="btn btn--secondary btn--sm" style="font-size:0.75rem;">Marcar Todo</button>` : ''}
                </div>
                
                <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color);overflow:hidden;">
                  <ul style="list-style:none;padding:0;margin:0;font-size:0.95rem;">
                    ${itemsFiltered.length === 0 ? '<li style="padding:1rem;text-align:center;color:var(--text-muted);">No se encontraron productos disponibles.</li>' : ''}
                    ${itemsFiltered.map((i, idx) => {
          const originalIdx = (v.items || []).findIndex(orig => orig.id === i.id);
          return `<li style="padding:8px 12px;border-bottom:1px dashed var(--border-color);display:flex;align-items:center;gap:12px;opacity:${isCanceled ? '0.6' : '1'};">
                         <div style="display:flex;align-items:center;justify-content:center;">
                           <input type="checkbox" ${isCanceled ? 'disabled' : ''} ${devolucionSelectedItems[originalIdx] ? 'checked' : ''} onchange="VentasModule.toggleDevolucionItem(${originalIdx})" style="width:18px;height:18px;cursor:pointer;">
                         </div>
                         <div style="flex:1;">
                           <div style="color:var(--text-primary);font-weight:600;font-size:0.9rem;line-height:1.2;margin-bottom:2px;">${i.nombre}</div>
                           <div style="color:var(--text-muted);font-size:0.75rem;">${i.codigo || 'S/N'}</div>
                         </div>
                         <div style="text-align:right;">
                           <div style="font-weight:700;color:var(--color-primary-600);"><span style="color:var(--text-muted);font-weight:600;">${i.cantidad}x</span> C$${fmt(i.precio)}</div>
                           <div style="font-weight:800;font-size:1.05rem;">C$${fmt(i.precio * i.cantidad)}</div>
                         </div>
                      </li>`
        }).join('')}
                  </ul>
                </div>
              </div>
              
              <div style="border-top:1px solid var(--border-color);padding-top:16px;display:flex;flex-direction:column;gap:12px;">
                 <button onclick="VentasModule.devolucionParcial('${v.id}')" class="btn btn--primary" style="width:100%;font-weight:800;font-size:1.05rem;padding:14px;letter-spacing:0.5px;background:#f59e0b;border-color:#f59e0b;" ${isCanceled || (v.items && v.items.length === 0) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}><span style="margin-right:8px;">↩️</span> DEVOLUCIÓN PARCIAL / MARCADOS</button>
                 <button onclick="VentasModule.cancelarFacturaTotal('${v.id}')" class="btn btn--danger" style="width:100%;font-weight:800;font-size:1.05rem;padding:14px;letter-spacing:0.5px;" ${isCanceled || (v.items && v.items.length === 0) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}><span style="margin-right:8px;">❌</span> CANCELAR FACTURA COMPLETA</button>
              </div>
            </div>`;
      }
    }

    return `<div style="display:flex;height:100%;background:var(--bg-secondary);">
       <div style="flex:1;display:flex;flex-direction:column;padding:1.5rem;border-right:1px solid var(--border-color);max-width:calc(100% - 460px);">
           <div style="display:flex;gap:1.5rem;margin-bottom:1.5rem;">
              <div style="flex:1;position:relative;">
                 <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.2rem;">🔍</span>
                 <input type="text" class="form-input" placeholder="Buscar factura por cliente o número de ticket..." value="${devolucionQuery}" oninput="VentasModule.searchDevoluciones(this.value)" style="width:100%;padding-left:48px;height:50px;font-size:1.1rem;border-width:2px;">
              </div>
           </div>
           
           <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column;">
              <div style="flex:1;overflow-y:auto;padding:1rem;">
                 ${listHtml}
                 ${returnsHistoryHtml}
              </div>
           </div>
       </div>
       <div style="width:460px;background:var(--bg-primary);padding:1.5rem;display:flex;flex-direction:column;">
          ${sidebarHtml}
       </div>
    </div>`;
  };

  const renderReportes = () => {
    const reporteActivo = currentReportTab || 'cortes-caja';

    const tabs = [
      { id: 'cortes-caja', icon: '🧾', label: 'Cortes de Caja' },
      { id: 'comision-bancaria', icon: '🏦', label: 'Impuesto Comisión Bancaria' },
      { id: 'iva-recaudado', icon: '🏛️', label: 'IVA Recaudado' },
      { id: 'ganancias-brutas', icon: '📊', label: 'Ganancias Brutas' },
      { id: 'ganancias-netas', icon: '💰', label: 'Ganancias Netas' }
    ];

    const reportContent = (() => {
      switch (reporteActivo) {
        case 'cortes-caja': return renderReporteCortesCaja();
        case 'comision-bancaria': return renderReporteComisionBancaria();
        case 'iva-recaudado': return renderReporteIvaRecaudado();
        case 'ganancias-brutas': return renderReporteGananciasBrutas();
        case 'ganancias-netas': return renderReporteGananciasNetas();
        default: return renderReporteCortesCaja();
      }
    })();

    return `
      <div style="padding: 1.5rem; max-width: 1400px; margin: 0 auto;">
        ${backBtn()}
        <div class="ventas-reportes-header">
          <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; display:flex; align-items:center; gap:10px; color: var(--text-primary);">
            ${Icons.barChart} Centro de Reportes
          </h2>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin: 4px 0 0;">Análisis financiero y operativo de ventas</p>
        </div>
        
        ${renderReportesFilters()}

        <div class="ventas-reportes-tabs">
          ${tabs.map(tab => `
            <button class="ventas-reportes-tab ${reporteActivo === tab.id ? 'ventas-reportes-tab--active' : ''}" 
                    onclick="VentasModule.setReportTab('${tab.id}')">
              <span style="font-size:1.2rem;">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </div>

        <div class="ventas-reporte-content" style="animation: fadeIn 0.2s ease-out;">
          ${reportContent}
        </div>
      </div>
  `;
  };

  let currentReportTab = 'cortes-caja';
  const setReportTab = (tab) => { currentReportTab = tab; App.render(); };

  // =========== REPORTE 1: CORTES DE CAJA ===========
  const renderReporteCortesCaja = () => {
    const cortesRaw = getData('cortes').sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const cortes = applyReportFilters(cortesRaw);
    const totalCortes = cortes.length;
    const totalVentasCortes = cortes.reduce((s, c) => s + parseFloat(c.total_ventas || 0), 0);
    const totalCajaCortes = cortes.reduce((s, c) => s + parseFloat(c.total_caja || 0), 0);
    const promedioVentasPorCorte = totalCortes > 0 ? totalVentasCortes / totalCortes : 0;

    return `
      <div class="ventas-reporte-kpis">
        <div class="ventas-reporte-kpi" style="border-left:4px solid #3b82f6;">
          <div class="ventas-reporte-kpi__label">Total Cortes</div>
          <div class="ventas-reporte-kpi__value" style="color:#3b82f6;">${totalCortes}</div>
          <div class="ventas-reporte-kpi__sub">Histórico</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #10b981;">
          <div class="ventas-reporte-kpi__label">Ventas Acumuladas</div>
          <div class="ventas-reporte-kpi__value" style="color:#10b981;">C$${fmt(totalVentasCortes)}</div>
          <div class="ventas-reporte-kpi__sub">Todos los turnos</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #f59e0b;">
          <div class="ventas-reporte-kpi__label">Caja Acumulada</div>
          <div class="ventas-reporte-kpi__value" style="color:#f59e0b;">C$${fmt(totalCajaCortes)}</div>
          <div class="ventas-reporte-kpi__sub">Total cerrado</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #8b5cf6;">
          <div class="ventas-reporte-kpi__label">Promedio Ventas/Turno</div>
          <div class="ventas-reporte-kpi__value" style="color:#8b5cf6;">C$${fmt(promedioVentasPorCorte)}</div>
          <div class="ventas-reporte-kpi__sub">Por corte</div>
        </div>
      </div >

  <div class="ventas-reporte-table-wrapper">
    <table class="ventas-reporte-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha y Hora</th>
          <th>Usuario y Disp.</th>
          <th>Fondo Inicial</th>
          <th>Facturas</th>
          <th>Total Ventas</th>
          <th>Entradas</th>
          <th>Salidas</th>
          <th>Total en Caja</th>
        </tr>
      </thead>
      <tbody>
        ${cortes.length === 0 ?
        '<tr><td colspan="9" style="padding:2rem;text-align:center;color:var(--text-muted);">No hay cortes de caja registrados aún en este periodo.</td></tr>' :
        cortes.map((c, i) => `
                <tr>
                  <td style="font-weight:700;color:var(--color-primary-600);">#${c.numero || (cortesRaw.length - i)}</td>
                  <td>${fmtD(c.fecha)} <span style="font-size:0.8rem;color:var(--text-muted);">${c.fecha ? new Date(c.fecha).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : ''}</span></td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:4px;">
                      <span style="width:24px;height:24px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${(c.usuario || 'N').charAt(0)}</span>
                      <div style="display:flex;flex-direction:column;line-height:1.2;">
                         <span>${c.usuario || 'N/A'}</span>
                         <span style="font-size:0.75rem;color:var(--text-muted);">${c.dispositivo || 'PC Escritorio'}</span>
                      </div>
                    </span>
                  </td>
                  <td style="color:var(--text-muted);">C$${fmt(c.fondo_inicial)}</td>
                  <td><span style="background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:10px;font-weight:700;font-size:0.85rem;">${c.num_ventas || 0}</span></td>
                  <td style="font-weight:700;color:#10b981;">C$${fmt(c.total_ventas)}</td>
                  <td style="color:#059669;">+C$${fmt(c.entradas || 0)}</td>
                  <td style="color:#ef4444;">-C$${fmt(c.salidas || 0)}</td>
                  <td style="font-weight:800;font-size:1.05rem;color:var(--text-primary);">C$${fmt(c.total_caja)}</td>
                </tr>
              `).join('')
      }
      </tbody>
    </table>
  </div>
`;
  };

  // =========== REPORTE 2: IMPUESTO SOBRE COMISIÓN BANCARIA ===========
  const renderReporteComisionBancaria = () => {
    const ventasListRaw = getData('ventas').filter(v => v.detalles_pago && v.detalles_pago.asumido === true);
    const ventasList = applyReportFilters(ventasListRaw);

    // Ventas con comisión cobrada al cliente
    const ventasCobradasRaw = getData('ventas').filter(v => v.detalles_pago && !v.detalles_pago.asumido && parseFloat(v.detalles_pago.impuestoAgregado || 0) > 0);
    const ventasCobradas = applyReportFilters(ventasCobradasRaw);

    const totalVentas = ventasList.reduce((s, v) => s + parseFloat(v.base_total || v.total), 0);
    const totalComision = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.montoAsumidoBancario || 0), 0);
    const totalIR = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.montoAsumidoIR || 0), 0);
    const totalDeducido = ventasList.reduce((s, v) => s + parseFloat(v.detalles_pago.totalImpuestoAsumido || 0), 0);

    const totalCobrado = ventasCobradas.reduce((s, v) => s + parseFloat(v.detalles_pago.impuestoAgregado || 0), 0);

    return `
      <div class="ventas-reporte-kpis">
        <div class="ventas-reporte-kpi" style="border-left:4px solid #3b82f6;">
          <div class="ventas-reporte-kpi__label">Total Ventas (Base)</div>
          <div class="ventas-reporte-kpi__value" style="color:#3b82f6;">C$${fmt(totalVentas)}</div>
          <div class="ventas-reporte-kpi__sub">${ventasList.length} transacciones asumidas</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #ef4444;">
          <div class="ventas-reporte-kpi__label">Comisión Bancaria Asumida</div>
          <div class="ventas-reporte-kpi__value" style="color:#ef4444;">-C$${fmt(totalComision)}</div>
          <div class="ventas-reporte-kpi__sub">Gasto absorbido por empresa</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #f59e0b;">
          <div class="ventas-reporte-kpi__label">IR Asumido</div>
          <div class="ventas-reporte-kpi__value" style="color:#f59e0b;">-C$${fmt(totalIR)}</div>
          <div class="ventas-reporte-kpi__sub">Impuesto sobre la renta</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #10b981;">
          <div class="ventas-reporte-kpi__label">Comisión Cobrada a Clientes</div>
          <div class="ventas-reporte-kpi__value" style="color:#10b981;">+C$${fmt(totalCobrado)}</div>
          <div class="ventas-reporte-kpi__sub">${ventasCobradas.length} transacciones</div>
        </div>
      </div>

  <div style="margin-bottom:1.5rem;">
    <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:8px;color:var(--text-primary);">
      <span style="color:#ef4444;">📉</span> Detalle — Comisiones Asumidas por la Empresa
    </h3>
    <div class="ventas-reporte-table-wrapper">
      <table class="ventas-reporte-table">
        <thead>
          <tr>
            <th>No. Factura</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>POS/Banco</th>
            <th>% Bancario</th>
            <th>% IR</th>
            <th>Monto Base</th>
            <th>Comisión</th>
            <th>IR</th>
            <th>Ganancia Neta</th>
          </tr>
        </thead>
        <tbody>
          ${ventasList.length === 0 ? '<tr><td colspan="10" style="padding:2rem;text-align:center;color:var(--text-muted);">No hay ventas con comisión bancaria asumida.</td></tr>' :
        ventasList.map(v => {
          const base = parseFloat(v.base_total || v.total);
          const com_b = parseFloat(v.detalles_pago.montoAsumidoBancario || 0);
          const ir = parseFloat(v.detalles_pago.montoAsumidoIR || 0);
          return `
                    <tr>
                      <td style="font-weight:600;color:var(--color-primary-600);">${v.numero}</td>
                      <td>${fmtD(v.fecha)}</td>
                      <td>${v.cliente || 'Público General'}</td>
                      <td>${v.detalles_pago.banco || 'N/A'}</td>
                      <td>${v.detalles_pago.porcentajeBancario || 0}%</td>
                      <td>${v.detalles_pago.porcentajeIR || 0}%</td>
                      <td style="font-weight:600;">C$${fmt(base)}</td>
                      <td style="color:#ef4444;">-C$${fmt(com_b)}</td>
                      <td style="color:#ef4444;">-C$${fmt(ir)}</td>
                      <td style="font-weight:700;color:#059669;">C$${fmt(base - com_b - ir)}</td>
                    </tr>`;
        }).join('')
      }
        </tbody>
        ${ventasList.length > 0 ? `
            <tfoot style="background:var(--bg-secondary);font-weight:800;">
              <tr>
                <td colspan="6" style="padding:1rem;text-align:right;font-size:0.95rem;">TOTALES:</td>
                <td style="padding:1rem;">C$${fmt(totalVentas)}</td>
                <td style="padding:1rem;color:#ef4444;">-C$${fmt(totalComision)}</td>
                <td style="padding:1rem;color:#ef4444;">-C$${fmt(totalIR)}</td>
                <td style="padding:1rem;color:#059669;">C$${fmt(totalVentas - totalDeducido)}</td>
              </tr>
            </tfoot>` : ''}
      </table>
    </div>
  </div>
`;
  };

  // =========== REPORTE EXTRA: IVA RECAUDADO ===========
  const renderReporteIvaRecaudado = () => {
    const ventasRaw = getData('ventas').filter(v => parseFloat(v.iva || 0) > 0).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const ventas = applyReportFilters(ventasRaw);

    const totalRecaudado = ventas.reduce((s, v) => s + parseFloat(v.iva || 0), 0);
    const totalVentasBase = ventas.reduce((s, v) => s + (parseFloat(v.total || 0) - parseFloat(v.iva || 0)), 0);

    return `
    <div class="ventas-reporte-kpis" style="margin-bottom:1.5rem;display:flex;gap:1rem;">
        <div class="ventas-reporte-kpi" style="border-left:4px solid #10b981;flex:1;">
          <div class="ventas-reporte-kpi__label">Total IVA Deducido</div>
          <div class="ventas-reporte-kpi__value" style="color:#10b981;">C$${fmt(totalRecaudado)}</div>
          <div class="ventas-reporte-kpi__sub">${ventas.length} Transacciones gravables</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #3b82f6;flex:1;">
          <div class="ventas-reporte-kpi__label">Total Ventas Base (Sin IVA)</div>
          <div class="ventas-reporte-kpi__value" style="color:#3b82f6;">C$${fmt(totalVentasBase)}</div>
          <div class="ventas-reporte-kpi__sub">Monto neto operado</div>
        </div>
      </div >
  <div class="ventas-reporte-table-wrapper">
    <table class="ventas-reporte-table">
      <thead>
        <tr>
          <th>Factura / Ref</th>
          <th>Fecha y Hora</th>
          <th>Cliente</th>
          <th>Subtotal Base</th>
          <th>IVA (Deducido)</th>
          <th>Total Cobrado</th>
        </tr>
      </thead>
      <tbody>
        ${ventas.length === 0 ? '<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--text-muted);">No hay registros de IVA en este periodo.</td></tr>' :
        ventas.map(v => `
              <tr>
                <td style="font-weight:700;">#${v.id.substring(0, 8).toUpperCase()}</td>
                <td>${fmtD(v.fecha)} <span style="font-size:0.8rem;opacity:.7">${v.fecha.substring(11, 16)}</span></td>
                <td>${(() => { const c = getData('clientes').find(x => x.id === v.clienteId); return c ? (c.empresa || c.nombreCliente || 'Público') : 'Público General'; })()}</td>
                <td style="color:#3b82f6;">C$${fmt(parseFloat(v.total || 0) - parseFloat(v.iva || 0))}</td>
                <td style="color:#10b981;font-weight:700;">C$${fmt(v.iva)}</td>
                <td style="font-weight:800;color:var(--text-primary);">C$${fmt(v.total)}</td>
              </tr>
            `).join('')}
      </tbody>
    </table>
  </div>
`;
  };

  // =========== REPORTE 3: GANANCIAS BRUTAS ===========
  const renderReporteGananciasBrutas = () => {
    const allVentas = getData('ventas');
    const td = today();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const ventasHoy = allVentas.filter(v => (v.fecha || '').startsWith(td));
    const ventasMes = allVentas.filter(v => v.fecha >= startOfMonth);
    const ventasAnio = allVentas.filter(v => v.fecha >= startOfYear);

    const calcGananciaBruta = (ventas) => {
      const ingresos = ventas.reduce((s, v) => s + parseFloat(v.base_total || v.total || 0), 0);
      const costos = ventas.reduce((s, v) => s + parseFloat(v.costo_total || 0), 0);
      return { ingresos, costos, ganancia: ingresos - costos, margen: ingresos > 0 ? ((ingresos - costos) / ingresos * 100) : 0 };
    };

    const hoy = calcGananciaBruta(ventasHoy);
    const mes = calcGananciaBruta(ventasMes);
    const anio = calcGananciaBruta(ventasAnio);

    // Productos más vendidos del mes
    const itemsVendidos = {};
    ventasMes.forEach(v => {
      (v.items || []).forEach(item => {
        const key = item.productId || item.nombre;
        if (!itemsVendidos[key]) itemsVendidos[key] = { nombre: item.nombre, cantidad: 0, ingresos: 0, costos: 0 };
        itemsVendidos[key].cantidad += item.cantidad;
        itemsVendidos[key].ingresos += item.precio * item.cantidad - (item.descuento || 0);
        itemsVendidos[key].costos += (item.costo || 0) * item.cantidad;
      });
    });
    const topProductos = Object.values(itemsVendidos).sort((a, b) => (b.ingresos - b.costos) - (a.ingresos - a.costos)).slice(0, 10);

    return `
      <div class="ventas-reporte-kpis">
        <div class="ventas-reporte-kpi" style="border-left:4px solid #10b981;">
          <div class="ventas-reporte-kpi__label">Ganancia Bruta Hoy</div>
          <div class="ventas-reporte-kpi__value" style="color:${hoy.ganancia >= 0 ? '#10b981' : '#ef4444'};">C$${fmt(hoy.ganancia)}</div>
          <div class="ventas-reporte-kpi__sub">Margen: ${hoy.margen.toFixed(1)}%</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #3b82f6;">
          <div class="ventas-reporte-kpi__label">Ganancia Bruta Mes</div>
          <div class="ventas-reporte-kpi__value" style="color:${mes.ganancia >= 0 ? '#3b82f6' : '#ef4444'};">C$${fmt(mes.ganancia)}</div>
          <div class="ventas-reporte-kpi__sub">Margen: ${mes.margen.toFixed(1)}% · ${ventasMes.length} facturas</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #8b5cf6;">
          <div class="ventas-reporte-kpi__label">Ganancia Bruta Año</div>
          <div class="ventas-reporte-kpi__value" style="color:${anio.ganancia >= 0 ? '#8b5cf6' : '#ef4444'};">C$${fmt(anio.ganancia)}</div>
          <div class="ventas-reporte-kpi__sub">Margen: ${anio.margen.toFixed(1)}%</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #f59e0b;">
          <div class="ventas-reporte-kpi__label">Costo Total Mes</div>
          <div class="ventas-reporte-kpi__value" style="color:#f59e0b;">C$${fmt(mes.costos)}</div>
          <div class="ventas-reporte-kpi__sub">Costo de mercancía</div>
        </div>
      </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
    <div style="background:var(--bg-secondary);border-radius:12px;padding:1.5rem;border:1px solid var(--border-color);">
      <h4 style="margin:0 0 1rem;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:8px;">📊 Resumen del Período</h4>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-primary);border-radius:8px;">
          <span style="font-weight:600;">Ingresos Brutos (Hoy)</span><strong style="color:#10b981;">C$${fmt(hoy.ingresos)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-primary);border-radius:8px;">
          <span style="font-weight:600;">Costo de Mercancía (Hoy)</span><strong style="color:#ef4444;">-C$${fmt(hoy.costos)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-primary);border-radius:8px;">
          <span style="font-weight:600;">Ingresos Brutos (Mes)</span><strong style="color:#3b82f6;">C$${fmt(mes.ingresos)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg-primary);border-radius:8px;">
          <span style="font-weight:600;">Costo de Mercancía (Mes)</span><strong style="color:#ef4444;">-C$${fmt(mes.costos)}</strong>
        </div>
      </div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:12px;padding:1.5rem;border:1px solid var(--border-color);">
      <h4 style="margin:0 0 1rem;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:8px;">🏆 Top Productos por Rentabilidad</h4>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
        ${topProductos.length === 0 ? '<div style="padding:1rem;text-align:center;color:var(--text-muted);">Sin datos disponibles</div>' :
        topProductos.map((p, i) => {
          const ganancia = p.ingresos - p.costos;
          const margen = p.ingresos > 0 ? (ganancia / p.ingresos * 100) : 0;
          return `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-color);">
                  <span style="width:24px;height:24px;background:${i < 3 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'var(--bg-secondary)'};color:${i < 3 ? 'white' : 'var(--text-muted)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${i + 1}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nombre}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${p.cantidad} uds · Margen: ${margen.toFixed(1)}%</div>
                  </div>
                  <strong style="color:${ganancia >= 0 ? '#10b981' : '#ef4444'};font-size:0.9rem;white-space:nowrap;">C$${fmt(ganancia)}</strong>
                </div>`;
        }).join('')
      }
      </div>
    </div>
  </div>
`;
  };

  // =========== REPORTE 4: GANANCIAS NETAS ===========
  const renderReporteGananciasNetas = () => {
    const allVentas = getData('ventas');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ventasMes = allVentas.filter(v => v.fecha >= startOfMonth);

    // Ingresos brutos del mes
    const ingresosBrutos = ventasMes.reduce((s, v) => s + parseFloat(v.base_total || v.total || 0), 0);
    const costoMercancia = ventasMes.reduce((s, v) => s + parseFloat(v.costo_total || 0), 0);
    const gananciaBruta = ingresosBrutos - costoMercancia;

    // Deducciones (comisiones bancarias asumidas)
    const comisionesAsumidas = ventasMes
      .filter(v => v.detalles_pago && v.detalles_pago.asumido)
      .reduce((s, v) => s + parseFloat(v.detalles_pago.totalImpuestoAsumido || 0), 0);

    // Descuentos otorgados
    const descuentosTotales = ventasMes.reduce((s, v) => s + parseFloat(v.descuento || 0) + parseFloat(v.descuento_global || 0), 0);

    // IVA generado
    const ivaTotalGenerado = ventasMes.reduce((s, v) => s + parseFloat(v.iva || 0), 0);

    // Devoluciones del mes
    const devolsMes = getData('devoluciones').filter(d => d.fecha >= startOfMonth);
    const totalDevoluciones = devolsMes.reduce((s, d) => s + parseFloat(d.total || d.monto || 0), 0);

    // Movimientos de caja (salidas / gastos operativos)
    const movsMes = getData('cajaMovs').filter(m => m.fecha >= startOfMonth);
    const gastosOperativos = movsMes.filter(m => m.tipo === 'retiro').reduce((s, m) => s + parseFloat(m.monto || 0), 0);

    // Cálculo de ganancia neta
    const totalDeducciones = costoMercancia + comisionesAsumidas + descuentosTotales + totalDevoluciones + gastosOperativos;
    const gananciaNeta = ingresosBrutos - totalDeducciones;
    const margenNeto = ingresosBrutos > 0 ? (gananciaNeta / ingresosBrutos * 100) : 0;

    // Ventas por método de pago del mes
    const porMetodo = {
      efectivo: ventasMes.filter(v => v.metodo === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0),
      tarjeta: ventasMes.filter(v => v.metodo === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0),
      transferencia: ventasMes.filter(v => v.metodo === 'transferencia').reduce((s, v) => s + parseFloat(v.total || 0), 0),
      credito: ventasMes.filter(v => v.metodo === 'credito').reduce((s, v) => s + parseFloat(v.total || 0), 0)
    };

    const mesNombre = now.toLocaleDateString('es-NI', { month: 'long', year: 'numeric' });

    return `
  <div style="margin-bottom:1.5rem;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:var(--text-primary);">💰 Estado de Resultados — ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}</h3>
      <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">${ventasMes.length} ventas</span>
    </div>
  </div>

      <div class="ventas-reporte-kpis">
        <div class="ventas-reporte-kpi" style="border-left:4px solid #3b82f6;">
          <div class="ventas-reporte-kpi__label">Ingresos Brutos</div>
          <div class="ventas-reporte-kpi__value" style="color:#3b82f6;">C$${fmt(ingresosBrutos)}</div>
          <div class="ventas-reporte-kpi__sub">Ventas totales del mes</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #10b981;">
          <div class="ventas-reporte-kpi__label">Ganancia Bruta</div>
          <div class="ventas-reporte-kpi__value" style="color:#10b981;">C$${fmt(gananciaBruta)}</div>
          <div class="ventas-reporte-kpi__sub">Ingresos - Costo Mercancía</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid ${gananciaNeta >= 0 ? '#059669' : '#ef4444'};">
          <div class="ventas-reporte-kpi__label">Ganancia Neta</div>
          <div class="ventas-reporte-kpi__value" style="color:${gananciaNeta >= 0 ? '#059669' : '#ef4444'};">C$${fmt(gananciaNeta)}</div>
          <div class="ventas-reporte-kpi__sub">Margen Neto: ${margenNeto.toFixed(1)}%</div>
        </div>
        <div class="ventas-reporte-kpi" style="border-left:4px solid #ef4444;">
          <div class="ventas-reporte-kpi__label">Total Deducciones</div>
          <div class="ventas-reporte-kpi__value" style="color:#ef4444;">-C$${fmt(totalDeducciones)}</div>
          <div class="ventas-reporte-kpi__sub">Costos + Gastos + Comisiones</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
        <!-- Estado de Resultados Detallado -->
        <div style="background:var(--bg-secondary);border-radius:12px;padding:1.5rem;border:1px solid var(--border-color);">
          <h4 style="margin:0 0 1rem;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text-primary);">📋 Estado de Resultados</h4>
          <div style="display:flex;flex-direction:column;gap:0;">
            <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(59,130,246,0.05);border-radius:8px 8px 0 0;">
              <span style="font-weight:700;color:#3b82f6;">Ingresos Brutos por Ventas</span><strong style="color:#3b82f6;">C$${fmt(ingresosBrutos)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 12px 8px 28px;border-left:2px solid #ef4444;">
              <span style="color:var(--text-secondary);">(-) Costo de Mercancía Vendida</span><span style="color:#ef4444;">-C$${fmt(costoMercancia)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(16,185,129,0.05);font-weight:700;border-top:1px solid var(--border-color);">
              <span style="color:#10b981;">= Ganancia Bruta</span><strong style="color:#10b981;">C$${fmt(gananciaBruta)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 12px 8px 28px;border-left:2px solid #ef4444;">
              <span style="color:var(--text-secondary);">(-) Comisiones Bancarias Asumidas</span><span style="color:#ef4444;">-C$${fmt(comisionesAsumidas)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 12px 8px 28px;border-left:2px solid #ef4444;">
              <span style="color:var(--text-secondary);">(-) Descuentos Otorgados</span><span style="color:#ef4444;">-C$${fmt(descuentosTotales)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 12px 8px 28px;border-left:2px solid #ef4444;">
              <span style="color:var(--text-secondary);">(-) Devoluciones</span><span style="color:#ef4444;">-C$${fmt(totalDevoluciones)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 12px 8px 28px;border-left:2px solid #ef4444;">
              <span style="color:var(--text-secondary);">(-) Gastos Operativos (Salidas de Caja)</span><span style="color:#ef4444;">-C$${fmt(gastosOperativos)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px;background:${gananciaNeta >= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(239,68,68,0.08)'};font-weight:800;font-size:1.1rem;border-radius:0 0 8px 8px;border-top:2px solid ${gananciaNeta >= 0 ? '#059669' : '#ef4444'};">
              <span style="color:${gananciaNeta >= 0 ? '#059669' : '#ef4444'};">= GANANCIA NETA</span><strong style="color:${gananciaNeta >= 0 ? '#059669' : '#ef4444'};">C$${fmt(gananciaNeta)}</strong>
            </div>
          </div>
        </div>

        <!-- Distribución por Forma de Pago -->
        <div style="background:var(--bg-secondary);border-radius:12px;padding:1.5rem;border:1px solid var(--border-color);">
          <h4 style="margin:0 0 1rem;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text-primary);">💳 Distribución por Forma de Pago</h4>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${Object.entries(porMetodo).map(([metodo, monto]) => {
      const pct = ingresosBrutos > 0 ? (monto / ingresosBrutos * 100) : 0;
      const icons = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦', credito: '📋' };
      const colors = { efectivo: '#10b981', tarjeta: '#3b82f6', transferencia: '#8b5cf6', credito: '#f59e0b' };
      return `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-weight:600;display:flex;align-items:center;gap:6px;">${icons[metodo]} ${metodo.charAt(0).toUpperCase() + metodo.slice(1)}</span>
                  <span style="font-weight:700;color:${colors[metodo]};">C$${fmt(monto)} <span style="font-size:0.8rem;color:var(--text-muted);">(${pct.toFixed(1)}%)</span></span>
                </div>
                <div style="width:100%;height:8px;border-radius:10px;background:var(--border-color);overflow:hidden;">
                  <div style="width:${Math.min(pct, 100)}%;height:100%;background:${colors[metodo]};border-radius:10px;transition:width 0.3s;"></div>
                </div>
              </div>`;
    }).join('')}
          </div>

          <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border-color);">
            <h4 style="margin:0 0 0.75rem;font-size:0.9rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">📊 Indicadores Fiscales</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--bg-primary);border-radius:6px;">
                <span style="font-weight:600;font-size:0.9rem;">IVA Generado (15%)</span><strong style="color:#f59e0b;">C$${fmt(ivaTotalGenerado)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--bg-primary);border-radius:6px;">
                <span style="font-weight:600;font-size:0.9rem;">Margen Bruto</span><strong style="color:#10b981;">${(ingresosBrutos > 0 ? (gananciaBruta / ingresosBrutos * 100) : 0).toFixed(1)}%</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--bg-primary);border-radius:6px;">
                <span style="font-weight:600;font-size:0.9rem;">Margen Neto</span><strong style="color:${margenNeto >= 0 ? '#059669' : '#ef4444'};">${margenNeto.toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
`;
  };

  const renderGanancias = () => '<div style="padding:2rem;">Ganancias... (En desarrollo)</div>';
  const renderCatalogo = () => {
    const rawData = getData('ventas').reverse();
    const data = applyReportFilters(rawData);

    const listHtml = data.length === 0 ? '<div style="padding:2rem;text-align:center;color:var(--text-muted);">No hay facturas registradas.</div>' :
      `<table class="data-table" style="width:100%;font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:12px;">Ticket N°</th>
            <th style="text-align:left;padding:12px;">Fecha/Hora</th>
            <th style="text-align:left;padding:12px;">Vendedor</th>
            <th style="text-align:left;padding:12px;">Cliente</th>
            <th style="text-align:right;padding:12px;">Dcto Total</th>
            <th style="text-align:right;padding:12px;">Total Pagado</th>
            <th style="text-align:center;padding:12px;">Moneda</th>
            <th style="text-align:center;padding:12px;">Método(s)</th>
            <th style="text-align:center;padding:12px;">Estado</th>
          </tr>
        </thead>
        <tbody>
           ${data.map(v => {
        const divisa = v.detalles_pago && v.detalles_pago.pagoEnUSD ? 'USD' : 'NIO';
        const isUSD = divisa === 'USD';
        const cur = isUSD ? '$' : 'C$';
        return `
             <tr style="border-bottom:1px solid var(--border-color);">
               <td style="padding:12px 8px;font-weight:bold;color:var(--color-primary-600);">${v.numero}</td>
               <td>${new Date(v.fecha).toLocaleString('es-NI')}</td>
               <td>${v.vendedor || 'N/A'}</td>
               <td><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${v.cliente || 'Público'}</div></td>
               <td style="text-align:right;color:#ef4444;">${((v.descuento || 0) + (v.descuento_global || 0)) > 0 ? '-' + cur + fmt((v.descuento || 0) + (v.descuento_global || 0)) : '-'}</td>
               <td style="text-align:right;font-weight:bold;">${cur}${fmt(v.total)}</td>
               <td style="text-align:center;font-weight:700;color:${isUSD ? '#10b981' : '#64748b'}">${divisa}</td>
               <td style="text-align:center;"><span style="border-radius:12px;padding:4px 8px;font-size:10px;font-weight:700;background:var(--bg-secondary);border:1px solid var(--border-color);">${(v.metodo || 'EFECTIVO').toUpperCase()}</span></td>
               <td style="text-align:center;"><span style="border-radius:12px;padding:4px 8px;font-size:10px;font-weight:700;display:inline-block;background:${v.estado === 'completada' ? 'rgba(16,185,129,0.1);color:#10b981;' : 'rgba(239,68,68,0.1);color:#ef4444;'}">${(v.estado || 'COMPLETADA').toUpperCase()}</span></td>
             </tr>`
      }).join('')}
        </tbody>
      </table>`;

    return `<div style="padding:2rem;height:100%;overflow-y:auto;background:var(--bg-primary);">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
          <h2 style="display:flex;align-items:center;gap:8px;margin:0;">📋 Historial de Facturas Registradas</h2>
          ${renderReportesFilters()}
       </div>
       <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;">
          ${listHtml}
       </div>
    </div>`;
  };
  const showShortcutsHelp = () => { posActionModal = 'shortcuts'; posActionData = null; App.render(); };

  const showProductDescription = () => {
    if (selectedCartRow < 0 || selectedCartRow >= cart.length) return;
    const item = cart[selectedCartRow];
    const desc = item.descripcion && item.descripcion.trim() !== '' ? item.descripcion : 'Sin comentario agregado.';
    alert(`Descripción de: ${item.nombre} \n\n${desc} `);
  };

  const searchConsultor = (q) => {
    consultorQuery = q;
    if (!q || q.length < 2) { consultorResult = null; App.render(); return; }
    const lc = q.toLowerCase();
    const qArr = lc.split(' ').filter(x => x.length > 0);
    const prods = getProducts();

    // Buscar coincidencia exacta por código o SKU primero
    const found = prods.find(p => (String(p.codigo || '').toLowerCase() === lc) || (String(p.sku || p.codigo || '').toLowerCase() === lc));

    if (found) {
      consultorResult = [found];
    } else {
      consultorResult = prods.filter(p => {
        const nombre = String(p.nombre || '').toLowerCase();
        const codigo = String(p.codigo || '').toLowerCase();
        const sku = String(p.sku || p.codigo || '').toLowerCase();
        const codigoAlt = String(p.codigoAlt || p.codigo_alternativo || '').toLowerCase();

        return qArr.every(qt => nombre.includes(qt) || codigo.includes(qt) || sku.includes(qt) || codigoAlt.includes(qt));
      }).slice(0, 50);
    }
    App.render();
  };

  const crearCotizacionPrompt = () => {
    if (cart.length === 0) { alert('El carrito está vacío, no se puede cotizar.'); return; }
    posActionModal = 'cotizacion-setup';
    App.render();
  };

  const facturarCotizacion = (num) => {
    if (cart.length > 0) {
      if (confirm('Tienes una venta en progreso. ¿Deseas enviarla a ESPERA para cargar esta cotización?')) {
        suspendSale();
      } else {
        return;
      }
    }

    const cots = getData('cotizaciones');
    const cotIdx = cots.findIndex(c => c.numero === num);
    if (cotIdx < 0) return;
    const cot = cots[cotIdx];
    cart = [...cot.items];
    selectedClient = cot.clienteId;
    globalDiscount = cot.descuento_global || 0;
    selectedCurrency = cot.divisa || 'NIO';
    posDocReference = num; // Link the quotation. It'll be updated automatically on success payment.
    cotizacionSelected = null;

    posSubView = 'pos';
    posOverlayOpen = true;
    navigateSidebar('pos'); // Return to POS explicitly
    App.render();
  };

  return {
    setPvGroup, render, navigateTo, navigateSidebar,
    searchSucursalProds, searchSucursalTimeout,
    searchProducts, addToCart, removeItem, selectCartRow, modifySelected, setPosComment, promptGlobalDiscount, searchConsultor, searchCotizaciones, selectCotizacion,
    searchClientsCombo, selectClientCombo,
    setCurrency, clearCart, suspendSale, recoverSale, recoverSaleFromTab,
    openTurno, closeTurno, confirmCloseTurno,
    openPaymentModal, closePaymentModal, closePosModal, setPaymentOnly, setPaymentConfig, setTarjetaModo, setPriceList, processPaymentOverride, updateCashDisplay, togglePayInUSD, setDocReference, setPosBodegaRetiro,
    openPOSOverlay, closePOSOverlay, restorePOS, showShortcutsHelp, modifySelectedAction, showProductDescription, crearCotizacionPrompt, facturarCotizacion,
    searchDevoluciones, selectDevolucion, searchDevolucionProducts, toggleDevolucionItem, checkAllDevolucionItems, cancelarFacturaTotal, devolucionParcial,
    submitPosActionModal, closeActionModal, promptGlobalDiscountModal, openPosNewClientModal, calcAmortizacionCredito,
    addPosMultiple, removePosMultiple, updatePosMultiple,
    setReportTab, updateConteoNio, updateConteoUsd, setReportFilterType, setReportFilterMonth, setReportFilterDate,
    openClientSearchModal, closeClientSearchModal, filterClientSearchModal, handleClientModalKeydown, selectClientFromModal, clearSelectedClient, openNewClientFromSearchModal, cancelCloseTurno, onClientCreatedFromPOS,
    promptContadorDivisas, submitContadorDivisas, liveCalcDivisas
  };
})();
