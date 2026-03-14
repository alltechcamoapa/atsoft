/**
 * ALLTECH - Módulo Gestión de Compras (Completo)
 * Dashboard con submódulos: Productos, Compras, Historial, Proveedores, Cuentas por Pagar, Promociones, Inventario, Reportes
 */
const ProductosModule = (() => {
  let currentView = 'dashboard';
  let filterState = { search: '', tipo: 'all', estado: 'all', depto: 'all', proveedor: 'all', bajoStock: false };
  let selectedRow = -1;
  let pageSize = 25;
  let currentPage = 0;
  let compraCart = [];
  let compraProveedor = null;
  let compraMetodo = 'efectivo';
  let compraFecha = new Date().toISOString().split('T')[0];
  let compraComentarios = '';
  let compraNumFactura = '';
  let compraDescGlobal = 0;
  let compraSelectedItem = -1;
  let compraTransfBanco = '';
  let compraTransfRef = '';
  let compraFechaVenc = '';
  let compraSearchSelectedIdx = -1;
  let compraSearchResultIds = [];
  let histFiltro = { deuda: 'all', proveedor: 'all', desde: '', hasta: '' };
  let provSelectedRow = -1;
  
  // Traslados state
  let trasladosCart = [];
  let trasladoEmpresaDestino = '';
  let trasladoBodegaDestino = '';
  let trasladoSearchSelectedIdx = -1;
  let trasladoSearchResultIds = [];
  
  let modalContent = '';

  // Multi-Empresa: suffix para aislar datos por empresa en localStorage
  const getEmpresaSuffix = () => {
    try {
      const u = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
      return u?.empresa_id ? '_' + u.empresa_id.substring(0, 8) : '';
    } catch { return ''; }
  };

  const getSK = () => {
    const suffix = getEmpresaSuffix();
    return {
      compras: 'prod_compras' + suffix, proveedores: 'prod_proveedores' + suffix, cxp: 'prod_cxp' + suffix,
      abonos_cxp: 'prod_abonos_cxp' + suffix, prov_tipos: 'prod_prov_tipos' + suffix
    };
  };

  let SK = getSK();
  const refreshSK = () => { SK = getSK(); };

  const getData = (k) => { 
      refreshSK(); 
      // Route through DataService/Supabase cache when available
      if (typeof DataService !== 'undefined') {
          const cache = DataService.getCache();
          if (k === 'proveedores') {
              const cloudProvs = DataService.getProveedoresSync ? DataService.getProveedoresSync() : [];
              if (cloudProvs && cloudProvs.length > 0) return cloudProvs;
          }
          if (k === 'compras' && cache.compras) return [...cache.compras];
          if (k === 'cxp' && cache.finCuentasPagar) return [...cache.finCuentasPagar];
          if (k === 'abonos_cxp') return []; // loaded on demand via DataService.getAbonosProveedoresSync
          if (k === 'prov_tipos') {
              // Try Supabase first, then fall back
              const tipos = cache.proveedorTipos || [];
              if (tipos.length > 0) return tipos;
          }
      }
      try { return JSON.parse(localStorage.getItem(SK[k]) || '[]'); } catch { return []; } 
  };
  const setData = (k, d) => { 
      refreshSK(); 
      // Keep localStorage as fallback backup, primary writes go through DataService
      try { localStorage.setItem(SK[k], JSON.stringify(d)); } catch(e) { console.warn('localStorage write failed:', e); }
  };
  const genId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const addRec = async (k, r) => { 
      r.id = genId(); 
      r.created_at = new Date().toISOString();
      try {
          if (typeof DataService !== 'undefined') {
              switch(k) {
                  case 'compras': {
                      const result = await DataService.createCompra(r);
                      if (result) return result;
                      break;
                  }
                  case 'cxp': {
                      const result = await DataService.createCuentaPagar(r);
                      if (result) return result;
                      break;
                  }
                  case 'abonos_cxp': {
                      const result = await DataService.createAbonoProveedor(r);
                      if (result) return result;
                      break;
                  }
                  case 'prov_tipos': {
                      const result = await DataService.createProveedorTipo(r);
                      if (result) return result;
                      break;
                  }
              }
          }
      } catch(e) { console.error(`Supabase addRec(${k}) error:`, e); }
      // Fallback: save to localStorage
      const d = getData(k); d.unshift(r); setData(k, d); return r; 
  };
  const fmt = (n) => parseFloat(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('es-NI') : 'N/A';
  const getProducts = () => (typeof DataService !== 'undefined' && DataService.getProductosSync) ? DataService.getProductosSync() : [];

  // Calcular stock total sumando todas las bodegas
  const getTotalStock = (prodId) => {
    try {
      const allBodes = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
      const empActiva = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
      const bodes = empActiva ? allBodes.filter(b => b.empresa_id === empActiva) : allBodes;
      let total = 0;
      bodes.forEach(b => {
        try { total += parseInt(JSON.parse(localStorage.getItem('prod_bodegas_' + b.id + '_' + prodId)) || 0); } catch(e) {}
      });
      return total;
    } catch(e) { return 0; }
  };

  // SINCRONIZACIÓN DE PROVEEDORES LOCALES A SUPABASE (UNA VEZ)
  const syncLocalProveedoresToSupabase = async () => {
    if (typeof DataService === 'undefined' || !DataService.createProveedor || !DataService.getProveedoresSync) return;
    refreshSK();
    try {
        const localProvs = JSON.parse(localStorage.getItem(SK['proveedores']) || '[]');
        if (localProvs.length === 0) return;
        
        const cloudProvs = DataService.getProveedoresSync();
        const pendingSync = localProvs.filter(lp => !cloudProvs.some(cp => cp.id === lp.id || cp.ruc === lp.ruc && lp.ruc));
        
        if (pendingSync.length > 0) {
            console.log(`Syncing ${pendingSync.length} unsaved local providers to Supabase...`);
            for (const p of pendingSync) {
                // Delete id so Supabase generates a new one, or keep if UUID
                const provData = {
                    razonSocial: p.razonSocial || p.razon_social,
                    ruc: p.ruc,
                    tipoProveedor: p.tipoProveedor || p.tipo_proveedor || p.tipo,
                    telefono: p.telefono,
                    ciudad: p.ciudad,
                    direccion: p.direccion
                };
                await DataService.createProveedor(provData);
            }
            console.log('Local providers synced successfully.');
            App.refreshCurrentModule();
        }
    } catch(e) { console.error('Error syncing local providers:', e); }
  };
  
  // Ejecutar sincronización al cargar
  setTimeout(syncLocalProveedoresToSupabase, 2000);
  const getPosData = (k) => {
    const actualKey = k.startsWith('pos_') || k.startsWith('prod_') ? k + getEmpresaSuffix() : k;
    try { return JSON.parse(localStorage.getItem(actualKey) || '[]'); } catch { return []; }
  };
  const user = () => State.get('user');

  // ========== NAVIGATION ==========
  const navigateTo = (v) => { currentView = v; selectedRow = -1; provSelectedRow = -1; currentPage = 0; App.render(); };

  const tile = (id, icon, name, desc, color, bg, badge) => `<div class="ventas-tile" onclick="ProductosModule.navigateTo('${id}')"><div class="ventas-tile__icon" style="background:${bg};color:${color};">${icon}</div><div class="ventas-tile__name">${name}</div><div class="ventas-tile__desc">${desc}</div><div class="ventas-tile__badge" style="background:${bg};color:${color};">${badge}</div></div>`;
  const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="ProductosModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">⬅ Volver al Panel</button>`;

  // ========== RENDER ==========
  const render = () => {
    const views = {
      dashboard: renderDashboard, productos: renderProductos, compras: renderCompras,
      'historial-compras': renderHistorialCompras, proveedores: renderProveedores,
      'cuentas-pagar': renderCuentasPagar, promociones: renderPromociones,
      'cuentas-pagar': renderCuentasPagar, promociones: renderPromociones,
      inventario: renderInventario, reportes: renderReportesProductos,
      traslados: renderTraslados
    };
    const html = (views[currentView] || renderDashboard)();
    if (currentView === 'productos' || currentView === 'proveedores') setTimeout(() => setupKeyboardNav(), 100);
    if (currentView === 'traslados') setTimeout(() => setupTrasladosInit(), 100);
    return html;
  };
  const setupKeyboardNav = () => {
    if (window._prodKeyNav) return; window._prodKeyNav = true;
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (currentView === 'productos') {
        const allProds = getProducts(); const total = allProds.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedRow = Math.min(selectedRow + 1, total - 1); App.refreshCurrentModule(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedRow = Math.max(selectedRow - 1, 0); App.refreshCurrentModule(); }
        else if (e.key === 'Enter' && selectedRow >= 0 && allProds[selectedRow]) { e.preventDefault(); openEditModal(allProds[selectedRow].id); }
        else if (e.key === 'Delete' && selectedRow >= 0 && allProds[selectedRow]) { e.preventDefault(); deleteItem(allProds[selectedRow].id); }
      } else if (currentView === 'proveedores') {
        let provs = getData('proveedores');
        if (provFiltro.tipo !== 'all') provs = provs.filter(p => (p.tipoProveedor || p.tipo_proveedor || p.tipo || '') === provFiltro.tipo);
        if (provFiltro.search) {
            const q = provFiltro.search.toLowerCase();
            provs = provs.filter(p => (p.razonSocial || p.razon_social || '').toLowerCase().includes(q) || (p.ruc || '').toLowerCase().includes(q) || (p.numero_proveedor || '').toLowerCase().includes(q));
        }
        const total = provs.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); provSelectedRow = Math.min(provSelectedRow + 1, total - 1); App.refreshCurrentModule(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); provSelectedRow = Math.max(provSelectedRow - 1, 0); App.refreshCurrentModule(); }
        else if (e.key === 'Enter' && provSelectedRow >= 0 && provs[provSelectedRow]) { e.preventDefault(); openProveedorModal(provs[provSelectedRow].id); }
      }
    });
  };

  // ========== DASHBOARD ==========
  const renderDashboard = () => {
    const prods = getProducts();
    const provs = getData('proveedores');
    const compras = getData('compras');
    const bajoStock = prods.filter(p => p && p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo).length;
    const totalInv = prods.reduce((s, p) => s + (p ? (parseFloat(p.precioCompra || p.costo || 0) * (p.stock || p.cantidad || 0)) : 0), 0);
    return `
      <div class="ventas-header"><div class="ventas-header__title">${Icons.package} Productos y Servicios</div>
        <div class="ventas-kpis">
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('productos')"><div class="ventas-kpi__label">Productos</div><div class="ventas-kpi__value" style="color:#3b82f6;">${prods.length}</div><div class="ventas-kpi__sub">Registrados</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('productos')"><div class="ventas-kpi__label">Bajo Stock</div><div class="ventas-kpi__value" style="color:#ef4444;">${bajoStock}</div><div class="ventas-kpi__sub">⚠️ Alertas</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('proveedores')"><div class="ventas-kpi__label">Proveedores</div><div class="ventas-kpi__value" style="color:#8b5cf6;">${provs.length}</div><div class="ventas-kpi__sub">Activos</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('compras')"><div class="ventas-kpi__label">Compras (Mes)</div><div class="ventas-kpi__value" style="color:#38bdf8;">${compras.length}</div><div class="ventas-kpi__sub">Facturas</div></div>
          <div class="ventas-kpi"><div class="ventas-kpi__label">Valor Inventario</div><div class="ventas-kpi__value" style="color:#10b981;">C$${fmt(totalInv)}</div><div class="ventas-kpi__sub">Estimado</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('cuentas-pagar')"><div class="ventas-kpi__label">Ctas. Por Pagar</div><div class="ventas-kpi__value" style="color:#ec4899;">${getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0).length}</div><div class="ventas-kpi__sub">Pendientes</div></div>
        </div>
      </div>
      <div class="ventas-grid">
        ${tile('productos', Icons.package, 'Productos', 'Catalogo completo', '#3b82f6', '#eff6ff', prods.length + ' items')}
        ${tile('compras', Icons.shoppingCart, 'Compras', 'Compras a proveedores', '#38bdf8', '#f0f9ff', 'Nueva Compra')}
        ${tile('historial-compras', Icons.fileText, 'Historial Facts. Compra', 'Facturas guardadas', '#6366f1', '#eef2ff', compras.length + ' facts.')}
        ${tile('proveedores', Icons.users, 'Proveedores', 'Lista y gestión', '#8b5cf6', '#f5f3ff', provs.length + ' provs.')}
        ${tile('cuentas-pagar', Icons.dollarSign, 'Cuentas por Pagar', 'Estado de cuenta', '#ec4899', '#fdf2f8', 'Saldos')}
        ${tile('promociones', '🏷️', 'Promociones', 'Ofertas y descuentos', '#14b8a6', '#f0fdfa', 'Gestionar')}
        ${tile('inventario', Icons.layers, 'Inventario', 'Control de stock', '#0ea5e9', '#f0f9ff', 'Ajustes')}
        ${tile('traslados', '🚚', 'Traslados', 'Mover entre bodegas', '#38bdf8', '#f0f9ff', 'Trasladar')}
        ${tile('reportes', Icons.barChart, 'Reportes', 'Estadísticas', '#6366f1', '#eef2ff', 'Exportar')}
      </div>`;
  };

  // ========== SUB: PRODUCTOS ==========
  const getMovimientos = (prodId, nombre) => {
    const movs = [];
    const compras = getData('compras');
    compras.forEach(c => (c.items || []).forEach(it => {
      if (it.productId === prodId || it.nombre === nombre) movs.push({ tipo: 'Compra', fecha: c.fecha, cant: it.cantidad, ref: c.numFactura });
    }));
    const ventas = JSON.parse(localStorage.getItem('alltech_ventas') || '[]');
    ventas.forEach(v => (v.items || []).forEach(it => {
      if (it.id === prodId || it.nombre === nombre) movs.push({ tipo: 'Venta', fecha: v.fecha || v.created_at, cant: it.cantidad || it.qty, ref: v.numero || v.factura || '' });
    }));
    movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return movs.slice(0, 5);
  };

  const renderProductImageCarousel = (imagenes, idPrefix = 'prod') => {
    if (!imagenes || !imagenes.length) return `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px;border:1px dashed var(--border-color);border-radius:8px;margin-bottom:8px;">Sin imágenes</div>`;
    const escapedImages = escape(JSON.stringify(imagenes));
    return `
      <div style="margin-bottom: 8px; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: #000; position: relative; height: 160px; width: 100%;">
        <div id="${idPrefix}ImageCarousel" data-images='${escapedImages}' data-current="0" style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
          <img src="${imagenes[0]}" style="max-width:100%; max-height:100%; object-fit:contain; cursor:pointer;" onclick="ProductosModule.openImageFullscreen(this.src)">
          ${imagenes.length > 1 ? `
            <button class="btn btn--icon" style="position:absolute; left:0; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:white; border:none; padding:8px 4px; cursor:pointer;" onclick="ProductosModule.nextImage(-1, '${idPrefix}')">◀</button>
            <button class="btn btn--icon" style="position:absolute; right:0; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:white; border:none; padding:8px 4px; cursor:pointer;" onclick="ProductosModule.nextImage(1, '${idPrefix}')">▶</button>
            <div style="position:absolute; bottom:4px; left:0; right:0; text-align:center; color:white; font-size:10px; text-shadow:1px 1px 2px black;" id="${idPrefix}CarouselCounter">1 / ${imagenes.length}</div>
          ` : ''}
        </div>
      </div>
    `;
  };

  const nextImage = (dir, idPrefix) => {
    const carousel = document.getElementById(idPrefix + 'ImageCarousel');
    if (!carousel) return;
    const images = JSON.parse(unescape(carousel.getAttribute('data-images') || '[]'));
    let current = parseInt(carousel.getAttribute('data-current') || '0');
    current += dir;
    if (current < 0) current = images.length - 1;
    if (current >= images.length) current = 0;
    carousel.setAttribute('data-current', current);
    carousel.querySelector('img').src = images[current];
    const counter = document.getElementById(idPrefix + 'CarouselCounter');
    if (counter) counter.innerText = (current + 1) + ' / ' + images.length;
  };

  const openImageFullscreen = (src) => {
    let modal = document.getElementById('imageFullscreenModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'imageFullscreenModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="modal-overlay open" style="z-index:99999999; background:rgba(0,0,0,0.85);" onclick="this.parentElement.innerHTML=''">
        <div style="position:relative; width:90vw; height:90vh; display:flex; align-items:center; justify-content:center;" onclick="event.stopPropagation()">
          <img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <button style="position:absolute; top: -10px; right: -10px; background:var(--color-danger); color:white; border:none; font-size:24px; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" onclick="this.closest('.modal-overlay').click()">×</button>
        </div>
      </div>
    `;
  };

  
  const renderProductos = () => {
    const allProds = getProducts();
    const deptos = [...new Set(allProds.map(p => p.categoria || p.departamento).filter(Boolean))];
    const provs = getData('proveedores');
    let filtered = allProds.filter(p => {
      let m = true;
      if (filterState.search) { const q = filterState.search.toLowerCase(); m = ['nombre', 'codigo', 'codigoAlt', 'sku', 'descripcion', 'marca', 'departamento', 'categoria', 'proveedor'].some(k => (p[k] || '').toLowerCase().includes(q)); }
      if (filterState.tipo !== 'all') m = m && p.tipo === filterState.tipo;
      if (filterState.estado !== 'all') m = m && p.estado === filterState.estado;
      if (filterState.depto !== 'all') m = m && (p.categoria === filterState.depto || p.departamento === filterState.depto);
      if (filterState.proveedor !== 'all') m = m && p.proveedor === filterState.proveedor;
      if (filterState.bajoStock) m = m && p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo;
      return m;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    const selProd = selectedRow >= 0 ? allProds[selectedRow] : null;
    const movs = selProd ? getMovimientos(selProd.id, selProd.nombre) : [];

    const rightPanelContent = `
      <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
        ${selProd ? ProductosModule.renderProductImageCarousel(selProd.imagenes, 'prodList') : ''}
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border-color);margin-bottom:4px;">Acciones</div>
        ${[['openCreateModal', '➕', 'Nuevo Producto'], ['viewDetalles', '👁️', 'Ver Detalles'], ['editSelected', '✏️', 'Editar'], ['deleteSelected', '🗑️', 'Eliminar'], ['importModal', '📥', 'Importar'], ['historialModal', '📋', 'Historial'], ['statsModal', '📊', 'Estadísticas'], ['etiquetasModal', '🏷️', 'Etiquetas'], ['pedidoModal', '📦', 'Pedido']].map(([fn, ic, lb]) => `<button class="btn btn--ghost slide-btn" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;transition: transform 0.1s ease, background 0.2s ease;" onclick="ProductosModule.${fn}()">${ic} ${lb}</button>`).join('')}
        
        ${selProd ? `
        <div class="fade-in-right" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);max-height:200px;overflow-y:auto;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Últimos Movimientos</div>
            ${movs.length === 0 ? '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">Sin movimientos</div>' : movs.map(m => `<div style="display:flex;flex-direction:column;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border-color);"><span><span class="badge ${m.tipo === 'Venta' ? 'badge--success' : 'badge--primary'}" style="font-size:9px;padding:1px 5px;">${m.tipo}</span> ${m.ref}</span><span style="color:var(--text-muted);margin-top:2px;">${m.cant} uds - ${fmtD(m.fecha)}</span></div>`).join('')}
        </div>` : ''}
      </div>`;

    return `${backBtn()}
    <style>
      .fade-in-right { animation: fadeInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      @keyframes fadeInRight { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
      .data-table__body tr { transition: background-color 0.15s ease, transform 0.1s ease; }
      .data-table__body tr:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 10; position: relative; }
      .slide-btn:active { transform: scale(0.97); }
    </style>
    <div style="display:flex;gap:0;height:calc(100vh - 160px);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:12px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div style="position:relative;flex:1;min-width:200px;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.5;">${Icons.search}</span><input type="text" class="form-input" style="padding-left:36px;height:36px;transition:all 0.2s;" placeholder="Buscar nombre, código, descripción..." value="${filterState.search}" oninput="ProductosModule.handleSearch(this.value)" id="prodSearchInput"></div>
          <select class="form-select" style="width:130px;height:36px;transition:all 0.2s;" onchange="ProductosModule.setFilter('depto',this.value)"><option value="all">Departamento</option>${deptos.map(d => `<option value="${d}" ${filterState.depto === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <button class="btn btn--ghost btn--sm slide-btn" onclick="ProductosModule.openDeptosModal()" title="Gestionar Departamentos" style="height:36px;">⚙ Deptos</button>
          <select class="form-select" style="width:140px;height:36px;transition:all 0.2s;" onchange="ProductosModule.setFilter('proveedor',this.value)"><option value="all">Proveedor</option>${provs.map(p => `<option value="${p.razonSocial}" ${filterState.proveedor === p.razonSocial ? 'selected' : ''}>${p.razonSocial}</option>`).join('')}</select>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;cursor:pointer;"><input type="checkbox" ${filterState.bajoStock ? 'checked' : ''} onchange="ProductosModule.toggleBajoStock()"> Bajo Stock</label>
          <select class="form-select" style="width:80px;height:36px;" onchange="ProductosModule.setPageSize(this.value)"><option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option><option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option><option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option></select>
        </div>
        <div style="flex:1;overflow-y:auto;scroll-behavior: smooth;">
          <table class="data-table" style="width:100%;font-size:12px;border-collapse: separate;border-spacing: 0;">
            <thead class="data-table__head" style="position: sticky; top: 0; z-index: 20; background: var(--bg-body);"><tr>
              <th style="width:30px;">#</th><th>Cod. Barras</th><th>Cod. Alt.</th><th>Nombre</th><th>Existencia</th><th>Inv. Mín.</th><th>P. Costo</th><th>P. Venta</th><th>Departamento</th><th>Proveedor</th>
            </tr></thead>
            <tbody class="data-table__body">
              ${paged.length === 0 ? '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">Sin resultados</td></tr>' :
        paged.map((p, i) => {
          const idx = currentPage * pageSize + i;
          const low = p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo;
          return `<tr style="cursor:pointer;${selectedRow === idx ? 'background:rgba(56,189,248,0.15); border-left: 3px solid #38bdf8;' : 'border-left: 3px solid transparent;'}${low ? 'color:#ef4444;' : ''}" onclick="ProductosModule.selectRow(${idx})" ondblclick="ProductosModule.openEditModal('${p.id}')">
                    <td>${idx + 1}</td><td style="font-family:monospace;">${p.codigo || p.sku || '-'}</td><td style="font-family:monospace;font-size:10px;">${p.codigoAlt || '-'}</td>
                    <td style="line-height:1.2;"><strong>${p.nombre || ''}</strong><div style="display:flex;gap:4px;margin-top:2px;">${p.unidad ? `<span style="background:var(--color-primary-100);color:var(--color-primary-700);font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">${p.unidad}</span>` : ''}${p.ventaGranel === 'true' ? `<span style="background:#d1fae5;color:#059669;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">⚖ Granel</span>` : ''}${p.usaSeriales === 'true' ? `<span style="background:#e0f2fe;color:#0284c7;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">🔢 Serie/Lote</span>` : ''}</div></td>
                    <td style="font-weight:700;${low ? 'color:#ef4444;' : ''}">${(() => { const ts = getTotalStock(p.id); return ts > 0 ? ts : (p.stock ?? p.cantidad ?? '∞'); })()}</td><td>${p.inventarioMinimo ?? '-'}</td>
                    <td>C${fmt(p.precioCompra || p.costo || 0)}</td><td style="font-weight:700;">C${fmt(p.precioVenta || p.precio || 0)}</td>
                    <td>${p.categoria || p.departamento || '-'}</td><td>${p.proveedor || '-'}</td>
                  </tr>`;
        }).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding:8px 12px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:12px;">
          <span>${filtered.length} productos | Página ${currentPage + 1}/${totalPages}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn--ghost btn--sm slide-btn" onclick="ProductosModule.prevPage()" ${currentPage === 0 ? 'disabled' : ''}>◀</button>
            <button class="btn btn--ghost btn--sm slide-btn" onclick="ProductosModule.nextPage()" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        </div>
      </div>
      <div id="prodRightActionPanel" class="${selProd ? 'fade-in-right' : ''}" style="width:220px;background:var(--bg-primary);border-left:1px solid var(--border-color);display:flex;flex-direction:column;gap:6px;padding:12px;transition: all 0.2s ease-in-out;">
        ${rightPanelContent}
      </div>
    </div>
    <div id="productosModal">${modalContent}</div>`;
  };

  // ========== SUB: COMPRAS ==========
  const renderCompras = () => {
    const provs = getData('proveedores').filter(p => {
        const t = (p.tipoProveedor || p.tipo_proveedor || p.tipo || '').toLowerCase();
        return t !== 'servicios' && t !== 'servicio';
    });
    const transferencias = getPosData('pos_transferencias');
    const subtotal = compraCart.reduce((s, i) => s + (i.precioCompra * i.cantidad), 0);
    const descTotal = compraCart.reduce((s, i) => s + (i.descuento || 0), 0) + compraDescGlobal;
    const total = subtotal - descTotal;
    const selIt = compraSelectedItem >= 0 ? compraCart[compraSelectedItem] : null;
    return `${backBtn()}
    <div style="display:flex;gap:0;border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);height:calc(100vh - 120px);">
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#38bdf8,#0284c7);color:white;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:1.1rem;">${Icons.shoppingCart} Nueva Compra a Proveedor</h3>
          <span style="font-size:12px;opacity:0.8;">Usuario: ${user()?.name || 'N/A'}</span>
        </div>
        <div style="padding:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;border-bottom:1px solid var(--border-color);">
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">No. Factura</label><input type="text" class="form-input" style="height:32px;" value="${compraNumFactura}" onchange="ProductosModule.setCompraField('numFactura',this.value)" placeholder="Auto si vacío"></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Proveedor *</label>
            <div style="display:flex;gap:4px;"><select class="form-select" style="height:32px;flex:1;" onchange="ProductosModule.setCompraField('proveedor',this.value)">
              <option value="">Seleccionar...</option>${provs.map(p => `<option value="${p.id}" ${compraProveedor === p.id ? 'selected' : ''}>${p.razonSocial}</option>`).join('')}
            </select><button type="button" class="btn btn--ghost btn--sm" style="height:32px;padding:0 8px;font-size:16px;" onclick="ProductosModule.openProveedorModal()" title="Nuevo Proveedor">+</button></div></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Método de Pago</label>
            <select class="form-select" style="height:32px;" onchange="ProductosModule.setCompraField('metodo',this.value)">
              ${['efectivo', 'transferencia', 'tarjeta', 'credito'].map(m => `<option value="${m}" ${compraMetodo === m ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
            </select></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Fecha Compra</label><input type="date" class="form-input" style="height:32px;" value="${compraFecha}" onchange="ProductosModule.setCompraField('fecha',this.value)"></div>
          ${compraMetodo === 'transferencia' ? `<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Banco / Cuenta</label><select class="form-select" style="height:32px;" onchange="ProductosModule.setCompraField('transfBanco',this.value)"><option value="">Seleccionar...</option>${transferencias.map(t => `<option value="${t.banco + ' - ' + t.numeroCuenta + ' - ' + t.divisa}" ${compraTransfBanco === (t.banco + ' - ' + t.numeroCuenta + ' - ' + t.divisa) ? 'selected' : ''}>${t.banco} - ${t.numeroCuenta} - ${t.divisa}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">No. Referencia</label><input type="text" class="form-input" style="height:32px;" value="${compraTransfRef}" onchange="ProductosModule.setCompraField('transfRef',this.value)" placeholder="Ref. transferencia"></div>` : ''}
          ${compraMetodo === 'credito' ? `<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Fecha Vencimiento *</label><input type="date" class="form-input" style="height:32px;" value="${compraFechaVenc}" onchange="ProductosModule.setCompraField('fechaVenc',this.value)"></div>` : ''}
          <div class="form-group" style="margin:0;${compraMetodo === 'efectivo' || compraMetodo === 'tarjeta' ? 'grid-column:span 2;' : ''}"><label class="form-label" style="font-size:11px;">Comentarios</label><input type="text" class="form-input" style="height:32px;" value="${compraComentarios}" onchange="ProductosModule.setCompraField('comentarios',this.value)" placeholder="Notas..."></div>
        </div>
        <div style="padding:8px 12px;border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:center;">
          <div style="position:relative;flex:1;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.5;">${Icons.search}</span><input type="text" class="form-input" style="padding-left:36px;height:34px;" placeholder="Buscar producto por nombre, código, marca..." oninput="ProductosModule.searchCompraProduct(this.value)" onkeydown="ProductosModule.handleCompraSearchKeydown(event)" id="compraSearchInput"><div id="compraSearchResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;max-height:200px;overflow-y:auto;z-index:200;box-shadow:var(--shadow-md);"></div></div>
          <button class="btn btn--primary btn--sm" style="height:34px;white-space:nowrap;font-size:12px;" onclick="ProductosModule.openCreateModal()">➕ Nuevo Producto</button>
        </div>
        <div style="flex:1;overflow-y:auto;">
          <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>#</th><th>Producto</th><th>Cant</th><th>P.Compra</th><th>Desc</th><th>Total</th></tr></thead>
          <tbody class="data-table__body">${compraCart.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Agregue productos con la barra de búsqueda</td></tr>' : compraCart.map((it, i) => `<tr style="cursor:pointer;${compraSelectedItem === i ? 'background:rgba(56,189,248,0.15);' : ''}" onclick="ProductosModule.selectCompraItem(${i})" ondblclick="ProductosModule.editCompraItem(${i})"><td>${i + 1}</td><td><strong>${it.nombre}</strong><br><span style="font-size:10px;color:var(--text-muted);">${it.codigo || ''}${it.serial ? ' | S/N: ' + it.serial : ''}</span></td><td style="font-weight:700;">${it.cantidad}</td><td>C$${fmt(it.precioCompra)}</td><td>${it.descuento ? 'C$' + fmt(it.descuento) : '-'}</td><td style="font-weight:700;">C$${fmt(it.precioCompra * it.cantidad - (it.descuento || 0))}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div style="padding:12px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn--ghost btn--sm" onclick="ProductosModule.setCompraDescGlobal()">💲 Desc. Global</button>
          <div style="text-align:right;">
            <div style="font-size:12px;color:var(--text-muted);">Subtotal: C$${fmt(subtotal)} ${descTotal > 0 ? ' | Desc: -C$' + fmt(descTotal) : ''}</div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--color-primary-600);">Total: C$${fmt(total)}</div>
            <button class="btn btn--primary" style="margin-top:6px;" onclick="ProductosModule.saveCompra()">💾 Guardar Compra</button>
          </div>
        </div>
      </div>
      <div style="width:200px;background:var(--bg-primary);border-left:1px solid var(--border-color);display:flex;flex-direction:column;gap:6px;padding:10px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border-color);margin-bottom:4px;">Acciones</div>
        <button class="btn btn--ghost" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;" onclick="ProductosModule.editCompraItem(${compraSelectedItem})" ${selIt ? '' : 'disabled'}>✏️ Editar Producto</button>
        <button class="btn btn--ghost" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;" onclick="ProductosModule.removeCompraItem(${compraSelectedItem})" ${selIt ? '' : 'disabled'}>🗑️ Eliminar Producto</button>
        <div style="border-top:1px solid var(--border-color);margin:4px 0;"></div>
        <button class="btn btn--ghost" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;" onclick="ProductosModule.setCompraDescGlobal()">💲 Desc. Global</button>
        ${selIt ? `<div style="margin-top:auto;padding-top:8px;border-top:1px solid var(--border-color);font-size:11px;"><div style="font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Seleccionado</div><div style="font-weight:600;">${selIt.nombre}</div><div>Cant: ${selIt.cantidad} | C$${fmt(selIt.precioCompra)}</div></div>` : ''}
      </div>
    </div><div id="productosModal">${modalContent}</div>`;
  };

  // ========== SUB: HISTORIAL COMPRAS ==========
  const renderHistorialCompras = () => {
    let compras = getData('compras');
    const provs = getData('proveedores');
    if (histFiltro.deuda === 'pendiente') compras = compras.filter(c => (c.saldoPendiente || 0) > 0);
    if (histFiltro.deuda === 'pagada') compras = compras.filter(c => (c.saldoPendiente || 0) === 0);
    if (histFiltro.proveedor !== 'all') compras = compras.filter(c => c.proveedorId === histFiltro.proveedor);
    if (histFiltro.desde) compras = compras.filter(c => (c.fecha || '') >= histFiltro.desde);
    if (histFiltro.hasta) compras = compras.filter(c => (c.fecha || '') <= histFiltro.hasta);
    return `${backBtn()}<div class="card"><div class="card__header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><h4 class="card__title">${Icons.fileText} Historial de Facturas de Compra</h4>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <select class="form-select" style="height:32px;font-size:12px;width:120px;" onchange="ProductosModule.setHistFiltro('deuda',this.value)"><option value="all">Todas</option><option value="pendiente" ${histFiltro.deuda === 'pendiente' ? 'selected' : ''}>Con Deuda</option><option value="pagada" ${histFiltro.deuda === 'pagada' ? 'selected' : ''}>Pagadas</option></select>
        <select class="form-select" style="height:32px;font-size:12px;width:140px;" onchange="ProductosModule.setHistFiltro('proveedor',this.value)"><option value="all">Proveedor</option>${provs.map(p => `<option value="${p.id}" ${histFiltro.proveedor === p.id ? 'selected' : ''}>${p.razonSocial}</option>`).join('')}</select>
        <input type="date" class="form-input" style="height:32px;font-size:11px;width:130px;" value="${histFiltro.desde}" onchange="ProductosModule.setHistFiltro('desde',this.value)" title="Desde">
        <input type="date" class="form-input" style="height:32px;font-size:11px;width:130px;" value="${histFiltro.hasta}" onchange="ProductosModule.setHistFiltro('hasta',this.value)" title="Hasta">
      </div></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>No. Factura</th><th>Proveedor</th><th>Fecha</th><th>Método</th><th>Total</th><th>Saldo</th><th>Estado</th><th>Acc</th></tr></thead>
      <tbody class="data-table__body">${compras.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay compras registradas</td></tr>' : compras.map(c => { const prov = provs.find(p => p.id === c.proveedorId); const saldo = c.saldoPendiente || 0; return `<tr><td style="font-weight:600;color:var(--color-primary-600);">${c.numFactura}</td><td>${prov ? prov.razonSocial : c.proveedorNombre || 'N/A'}</td><td>${fmtD(c.fecha)}</td><td><span class="badge badge--primary">${c.metodo}</span></td><td style="font-weight:700;">C$${fmt(c.total)}</td><td style="color:${saldo > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${saldo > 0 ? 'C$' + fmt(saldo) : 'Pagado'}</td><td><span class="badge ${saldo > 0 ? 'badge--warning' : 'badge--success'}">${saldo > 0 ? 'Pendiente' : 'Pagada'}</span></td><td style="display:flex;gap:2px;"><button class="btn btn--ghost btn--icon btn--sm" onclick="ProductosModule.viewCompraDetail('${c.id}')">👁️</button>${saldo > 0 ? `<button class="btn btn--ghost btn--icon btn--sm" onclick="ProductosModule.registrarPagoCompra('${c.id}')">💰</button>` : ''}<button class="btn btn--ghost btn--icon btn--sm" onclick="ProductosModule.editCompraFactura('${c.id}')">✏️</button></td></tr>`; }).join('')}</tbody></table></div></div><div id="productosModal">${modalContent}</div>`;
  };
  const setHistFiltro = (k, v) => { histFiltro[k] = v; App.refreshCurrentModule(); };

  // ========== SUB: HISTORIAL POR PROVEEDOR ==========
  const showProveedorHistorial = (provId) => {
    const provs = getData('proveedores');
    const prov = provs.find(p => p.id === provId) || provs.find(p => p.razonSocial === provId);
    if (!prov) return;
    
    // Set custom filter object for this modal
    window._provHistFiltro = window._provHistFiltro || { mes: 'all', data: '' };
    
    // Render Modal Overlay
    const renderContent = () => {
        let compras = getData('compras').filter(c => c.proveedorId === prov.id || c.proveedor === prov.id);
        const currentM = window._provHistFiltro.mes;
        const currentD = window._provHistFiltro.data;
        
        if (currentM && currentM !== 'all') {
            compras = compras.filter(c => {
                const dateParts = (c.fecha || '').split('-');
                if (dateParts.length >= 2) return dateParts[1] === currentM;
                return false;
            });
        }
        if (currentD) {
            compras = compras.filter(c => (c.fecha || '').includes(currentD));
        }

        const totalRow = compras.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No existen facturas con este filtro</td></tr>' :
            compras.map(c => {
                const saldo = c.saldoPendiente || 0;
                return `<tr><td style="font-weight:600;">${c.numFactura}</td><td>${fmtD(c.fecha)}</td><td><span class="badge badge--primary">${c.metodo}</span></td><td style="font-weight:700;">C$${fmt(c.total)}</td><td style="color:${saldo > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${saldo > 0 ? 'C$' + fmt(saldo) : 'Pagado'}</td><td><span class="badge ${saldo > 0 ? 'badge--warning' : 'badge--success'}">${saldo > 0 ? 'Pendiente' : 'Pagada'}</span></td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ProductosModule.viewCompraDetail('${c.id}')">👁️</button></td></tr>`;
            }).join('');

        const modal = document.getElementById('productosModal');
        modal.innerHTML = `<div class="modal-overlay open"><div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">📋 Historial: ${prov.razonSocial || prov.razon_social}</h3>
            <button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body" style="padding:16px;">
             <div style="display:flex;gap:8px;margin-bottom:12px;">
                 <select class="form-select" id="provFilMsgSel" onchange="window._provHistFiltro.mes=this.value; ProductosModule.showProveedorHistorial('${prov.id}')">
                     <option value="all">Cualquier Mes</option>
                     <option value="01" ${currentM==='01'?'selected':''}>Enero</option>
                     <option value="02" ${currentM==='02'?'selected':''}>Febrero</option>
                     <option value="03" ${currentM==='03'?'selected':''}>Marzo</option>
                     <option value="04" ${currentM==='04'?'selected':''}>Abril</option>
                     <option value="05" ${currentM==='05'?'selected':''}>Mayo</option>
                     <option value="06" ${currentM==='06'?'selected':''}>Junio</option>
                     <option value="07" ${currentM==='07'?'selected':''}>Julio</option>
                     <option value="08" ${currentM==='08'?'selected':''}>Agosto</option>
                     <option value="09" ${currentM==='09'?'selected':''}>Septiembre</option>
                     <option value="10" ${currentM==='10'?'selected':''}>Octubre</option>
                     <option value="11" ${currentM==='11'?'selected':''}>Noviembre</option>
                     <option value="12" ${currentM==='12'?'selected':''}>Diciembre</option>
                 </select>
                 <input type="month" id="provFilData" class="form-input" value="${currentD}" onchange="window._provHistFiltro.data=this.value; ProductosModule.showProveedorHistorial('${prov.id}')" title="Filtrar por Fecha Específica">
             </div>
             <table class="data-table" style="width:100%;font-size:12px;">
               <thead class="data-table__head"><tr><th>Factura</th><th>Fecha</th><th>Método</th><th>Total</th><th>Saldo</th><th>Estado</th><th>Acc</th></tr></thead>
               <tbody class="data-table__body">${totalRow}</tbody>
             </table>
          </div>
        </div></div>`;
    };
    renderContent();
  };

  // ========== SUB: PROVEEDORES ==========
  let provFiltro = { search: '', tipo: 'all' };
  const setProvFiltro = (key, val) => { provFiltro[key] = val; provSelectedRow = -1; App.refreshCurrentModule(); };
  const selectProvRow = (idx) => { provSelectedRow = idx; App.refreshCurrentModule(); };

  const renderProveedores = () => {
    let provs = getData('proveedores');
    const compras = getData('compras');
    
    // Calcular historial y mejores proveedores
    const statsP = {};
    provs.forEach(p => {
        statsP[p.id] = { comprosNum: 0, total: 0 };
    });
    compras.forEach(c => {
        const pId = c.proveedorId || c.proveedor;
        if(pId && statsP[pId]) {
            statsP[pId].comprosNum += 1;
            statsP[pId].total += (c.total || 0);
        }
    });

    // Encontrar mejor proveedor (mayor total de compras)
    let mejorProvId = null;
    let maxTotal = 0;
    Object.keys(statsP).forEach(pid => {
        if(statsP[pid].total > maxTotal) { maxTotal = statsP[pid].total; mejorProvId = pid; }
    });

    // Filtros
    if (provFiltro.tipo !== 'all') {
        provs = provs.filter(p => (p.tipoProveedor || p.tipo_proveedor || p.tipo || '') === provFiltro.tipo);
    }
    if (provFiltro.search) {
        const q = provFiltro.search.toLowerCase();
        provs = provs.filter(p => 
            (p.razonSocial || p.razon_social || '').toLowerCase().includes(q) ||
            (p.ruc || '').toLowerCase().includes(q) ||
            (p.numero_proveedor || '').toLowerCase().includes(q)
        );
    }
    
    const selProv = provSelectedRow >= 0 && provSelectedRow < provs.length ? provs[provSelectedRow] : null;

    const rightPanelContent = `
      <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border-color);margin-bottom:4px;">Acciones</div>
        ${[['openProveedorModal()','➕','Nuevo Proveedor'], 
           [`openProveedorModal('${selProv?.id||''}')`,'✏️','Editar Proveedor'], 
           [`deleteProveedor('${selProv?.id||''}')`,'🗑️','Eliminar Proveedor'], 
           [`showProveedorHistorial('${selProv?.id||''}')`,'📋','Historial de Compras']].map(([fn, ic, lb], i) => `<button class="btn btn--ghost slide-btn" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;transition: transform 0.1s ease, background 0.2s ease;" onclick="ProductosModule.${fn}" ${(i>0 && !selProv)?'disabled':''}>${ic} ${lb}</button>`).join('')}
        
        ${selProv ? `
        <div class="fade-in-right" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
            <div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">Detalles Rápidos</div>
                <div style="font-size:11px;margin-bottom:4px;"><strong>RUC:</strong> ${selProv.ruc || 'N/A'}</div>
                <div style="font-size:11px;margin-bottom:4px;"><strong>Teléfono:</strong> ${selProv.telefono || 'N/A'}</div>
                <div style="font-size:11px;margin-bottom:4px;"><strong>Ciudad:</strong> ${selProv.ciudad || 'N/A'}</div>
                <div style="padding-top:8px;border-top:1px dashed var(--border-color);font-size:11px;color:var(--color-primary-600);font-weight:700;">
                   Compras: ${statsP[selProv.id]?.comprosNum || 0}
                   <br>Gastado: C$${_fmtNum(statsP[selProv.id]?.total || 0)}
                </div>
            </div>
            <div style="border-top:1px solid var(--border-color);padding-top:8px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Últimas 5 Facturas</div>
                ${(() => {
                    const facturas = getData('compras')
                        .filter(c => c.proveedorId === selProv.id || c.proveedor === selProv.id)
                        .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
                        .slice(0, 5);
                    if(facturas.length === 0) return '<div style="font-size:10px;color:var(--text-muted);">Sin facturas recientes</div>';
                    return facturas.map(f => {
                        const s = f.saldoPendiente || 0;
                        return `<div style="font-size:10px;padding:6px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;margin-bottom:4px;">
                            <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:2px;"><span>${f.numFactura}</span><span>C$${_fmtNum(f.total)}</span></div>
                            <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:9px;"><span>${fmtD(f.fecha)}</span><span style="color:${s>0?'#ef4444':'#10b981'};${s>0?'font-weight:700;':''} ">${s>0?'Pendiente':'Pagada'}</span></div>
                        </div>`;
                    }).join('');
                })()}
            </div>
        </div>` : ''}
      </div>`;

    const unicosTipos = [...new Set(getData('proveedores').map(p => p.tipoProveedor || p.tipo_proveedor || p.tipo || ''))].filter(Boolean);

    return `${backBtn()}
    <style>
      .fade-in-right { animation: fadeInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      @keyframes fadeInRight { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
      .data-table__body tr { transition: background-color 0.15s ease, transform 0.1s ease; }
      .data-table__body tr:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 10; position: relative; }
      .slide-btn:active { transform: scale(0.97); }
    </style>
    
    <div style="margin-bottom:1rem;display:flex;gap:1rem;">
      <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:white;padding:1.2rem;border-radius:8px;flex:1;box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:0.8rem;color:rgba(255,255,255,0.8);font-weight:700;letter-spacing:1px;margin-bottom:4px;">🌟 MEJOR PROVEEDOR</div>
          <div style="font-size:1.3rem;font-weight:800;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.1);">
            ${mejorProvId ? (getData('proveedores').find(x=>x.id===mejorProvId)?.razonSocial || 'N/A') : 'Aún sin compras'} 
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.2);padding:10px 16px;border-radius:8px;text-align:right;">
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.9);text-transform:uppercase;font-weight:600;">Total Compras</div>
            <div style="font-size:1.2rem;font-weight:800;color:white;">C$${_fmtNum(maxTotal)}</div>
        </div>
      </div>
    </div>
    
    <div style="display:flex;gap:0;height:calc(100vh - 220px);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:12px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
                <div style="display:flex; gap:0.5rem; flex:1;">
                    <div style="position:relative;flex:1;min-width:200px;max-width:350px;">
                      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.5;">${Icons.search}</span>
                      <input type="text" class="form-input" style="padding-left:36px;height:36px;transition:all 0.2s;" placeholder="Buscar RUC, Nombre o No." value="${provFiltro.search}" oninput="ProductosModule.setProvFiltro('search', this.value)">
                    </div>
                    <select class="form-select" style="height:36px;" onchange="ProductosModule.setProvFiltro('tipo', this.value)">
                        <option value="all">Todos los Tipos</option>
                        ${unicosTipos.map(t => `<option value="${t}" ${provFiltro.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div style="flex:1;overflow-y:auto;scroll-behavior: smooth;">
               <table class="data-table" style="width:100%;font-size:12px;border-collapse: separate;border-spacing: 0;">
                  <thead class="data-table__head" style="position: sticky; top: 0; z-index: 20; background: var(--bg-body);">
                     <tr><th>No.</th><th>Tipo</th><th>RUC</th><th>Razón Social</th><th>Compras</th><th>Total Gastado</th><th>Ciudad</th></tr>
                  </thead>
                  <tbody class="data-table__body">
                     ${provs.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay proveedores aquí</td></tr>' : provs.map((p, i) => { 
                         const bestBadge = (p.id === mejorProvId && maxTotal > 0) ? '<span class="badge badge--success" style="margin-left:4px;">⭐ Mejor</span>' : '';
                         return `<tr style="cursor:pointer;${provSelectedRow === i ? 'background:rgba(56,189,248,0.15); border-left: 3px solid #38bdf8;' : 'border-left: 3px solid transparent;'}" onclick="ProductosModule.selectProvRow(${i})" ondblclick="ProductosModule.openProveedorModal('${p.id}')">
                            <td style="font-weight:700;color:var(--color-primary-600);">${p.numero_proveedor || p.numeroProveedor || p.codigo_proveedor || '-'}</td>
                            <td><span class="badge badge--neutral">${p.tipoProveedor || p.tipo_proveedor || p.tipo || '-'}</span></td>
                            <td style="font-family:monospace;">${p.ruc || '-'}</td>
                            <td style="font-weight:600;">${p.razonSocial || p.razon_social || '-'}${bestBadge}</td>
                            <td onclick="ProductosModule.showProveedorHistorial('${p.id}'); event.stopPropagation()"><span class="badge badge--info" style="cursor:pointer;">${statsP[p.id]?.comprosNum || 0} compras</span></td>
                            <td style="font-weight:700;">C$${_fmtNum(statsP[p.id]?.total || 0)}</td>
                            <td>${p.ciudad || '-'}</td>
                         </tr>`;
                     }).join('')}
                  </tbody>
               </table>
            </div>
        </div>
        <div style="width:220px;padding:12px;border-left:1px solid var(--border-color);background:var(--bg-primary);display:flex;flex-direction:column;">
            ${rightPanelContent}
        </div>
    </div>
    <div id="productosModal">${modalContent}</div>`;
  };

  // ========== SUB: CUENTAS POR PAGAR ==========
  // Estado local de filtros para CxP
  let cxpFiltros = { search: '', fechaTipo: 'emision', fechaInicio: '', fechaFin: '', vistaAgrupada: false };

  const renderCuentasPagar = () => {
    let compras = getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0);
    const provs = getData('proveedores');

    // Aplicar búsqueda por factura
    if (cxpFiltros.search) {
      const q = cxpFiltros.search.toLowerCase();
      compras = compras.filter(c =>
        (c.numFactura || '').toLowerCase().includes(q) ||
        (c.proveedorNombre || '').toLowerCase().includes(q)
      );
    }
    // Aplicar filtro de período
    if (cxpFiltros.fechaInicio || cxpFiltros.fechaFin) {
      compras = compras.filter(c => {
        const campo = cxpFiltros.fechaTipo === 'vencimiento' ? c.fechaVencimiento : c.fecha;
        if (!campo) return true;
        const d = new Date(campo);
        if (cxpFiltros.fechaInicio && d < new Date(cxpFiltros.fechaInicio)) return false;
        if (cxpFiltros.fechaFin && d > new Date(cxpFiltros.fechaFin + 'T23:59:59')) return false;
        return true;
      });
    }

    const totalDeuda = compras.reduce((s, c) => s + (c.saldoPendiente || 0), 0);
    const totalFacturado = compras.reduce((s, c) => s + (c.total || 0), 0);
    const totalAbonado = totalFacturado - totalDeuda;

    // Vista agrupada por proveedor
    const proveedorMap = {};
    compras.forEach(c => {
      const pid = c.proveedorId || 'sin_proveedor';
      const pNom = c.proveedorNombre || (provs.find(p => p.id === c.proveedorId)?.razonSocial) || 'Sin Proveedor';
      if (!proveedorMap[pid]) proveedorMap[pid] = { nombre: pNom, facturas: [], totalDeuda: 0, totalFacturado: 0 };
      proveedorMap[pid].facturas.push(c);
      proveedorMap[pid].totalDeuda += c.saldoPendiente || 0;
      proveedorMap[pid].totalFacturado += c.total || 0;
    });

    const tablaFilas = cxpFiltros.vistaAgrupada
      ? Object.values(proveedorMap).map(grp => `
          <tr style="background:var(--bg-primary);font-weight:700;">
            <td colspan="2" style="padding:10px 12px;color:var(--color-primary-700);">📦 ${grp.nombre} <span class="badge badge--primary" style="font-size:10px;margin-left:6px;">${grp.facturas.length} facturas</span></td>
            <td style="color:#6b7280;">C$${fmt(grp.totalFacturado)}</td>
            <td style="color:#10b981;">C$${fmt(grp.totalFacturado - grp.totalDeuda)}</td>
            <td style="color:#ef4444;font-size:1.05em;">C$${fmt(grp.totalDeuda)}</td>
            <td colspan="2"></td>
          </tr>
          ${grp.facturas.map(c => {
            const abonado = (c.total || 0) - (c.saldoPendiente || 0);
            const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
            const vencido = venc && venc < new Date();
            return `<tr style="font-size:12px;background:${vencido ? 'rgba(239,68,68,0.04)' : ''};">
              <td style="padding-left:28px;font-weight:600;">${c.numFactura}</td>
              <td style="font-size:11px;color:var(--text-muted);">${fmtD(c.fecha)}</td>
              <td>C$${fmt(c.total)}</td>
              <td style="color:#10b981;">C$${fmt(abonado)}</td>
              <td style="color:#ef4444;font-weight:700;">C$${fmt(c.saldoPendiente)}</td>
              <td>${venc ? `<span style="color:${vencido ? '#ef4444' : '#f59e0b'};font-weight:600;">${fmtD(c.fechaVencimiento)}</span>` : '-'}</td>
              <td><button class="btn btn--primary btn--sm" onclick="ProductosModule.registrarPagoCompra('${c.id}')">💰 Abonar</button></td>
            </tr>`;
          }).join('')}`
      ).join('')
      : compras.length === 0
        ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay cuentas pendientes con los filtros aplicados</td></tr>'
        : compras.map(c => {
            const prov = provs.find(p => p.id === c.proveedorId);
            const abonado = (c.total || 0) - (c.saldoPendiente || 0);
            const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
            const vencido = venc && venc < new Date();
            return `<tr style="${vencido ? 'background:rgba(239,68,68,0.04);' : ''}">
              <td style="font-weight:600;">${c.numFactura}</td>
              <td>${prov ? prov.razonSocial : (c.proveedorNombre || 'N/A')}</td>
              <td>C$${fmt(c.total)}</td>
              <td style="color:#10b981;">C$${fmt(abonado)}</td>
              <td style="color:#ef4444;font-weight:700;">C$${fmt(c.saldoPendiente)}</td>
              <td>${venc ? `<span style="color:${vencido ? '#ef4444' : '#f59e0b'};font-weight:600;">${fmtD(c.fechaVencimiento)}</span>` : '-'}</td>
              <td><button class="btn btn--primary btn--sm" onclick="ProductosModule.registrarPagoCompra('${c.id}')">💰 Abonar</button></td>
            </tr>`;
          }).join('');

    return `${backBtn()}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1rem;">
      <div style="background:rgba(239,68,68,0.05);padding:1.2rem;border-radius:8px;border:1px solid rgba(239,68,68,0.2);">
        <div style="font-size:.8rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Deuda Total</div>
        <div style="font-size:1.6rem;font-weight:800;color:#ef4444;">C$${fmt(totalDeuda)}</div>
      </div>
      <div style="background:var(--bg-primary);padding:1.2rem;border-radius:8px;border:1px solid var(--border-color);">
        <div style="font-size:.8rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Facturas</div>
        <div style="font-size:1.6rem;font-weight:800;">${compras.length}</div>
      </div>
      <div style="background:rgba(16,185,129,0.05);padding:1.2rem;border-radius:8px;border:1px solid rgba(16,185,129,0.2);">
        <div style="font-size:.8rem;color:#059669;text-transform:uppercase;font-weight:700;">Total Abonado</div>
        <div style="font-size:1.6rem;font-weight:800;color:#10b981;">C$${fmt(totalAbonado)}</div>
      </div>
      <div style="background:var(--bg-primary);padding:1.2rem;border-radius:8px;border:1px solid var(--border-color);">
        <div style="font-size:.8rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Proveedores</div>
        <div style="font-size:1.6rem;font-weight:800;">${Object.keys(proveedorMap).length}</div>
      </div>
    </div>

    <div class="card">
      <div class="card__header" style="flex-wrap:wrap;gap:8px;">
        <h4 class="card__title">${Icons.dollarSign} Facturas con Saldo Pendiente</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-left:auto;">
          <button class="btn btn--sm ${cxpFiltros.vistaAgrupada ? 'btn--primary' : 'btn--ghost'}" onclick="ProductosModule.cxpToggleAgrupada()" title="Agrupar por proveedor">📦 Agrupar</button>
          <button class="btn btn--sm btn--ghost" onclick="ProductosModule.cxpExportarExcel()" title="Exportar Excel">📊 Excel</button>
          <button class="btn btn--sm btn--ghost" onclick="ProductosModule.cxpExportarPDF()" title="Exportar PDF">📄 PDF</button>
        </div>
      </div>

      <!-- Filtros -->
      <div style="padding:10px 16px;border-bottom:1px solid var(--border-color);display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:180px;">
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:3px;">Buscar Factura / Proveedor</label>
          <input type="text" class="form-input" style="height:32px;" placeholder="No. Factura, proveedor..." value="${cxpFiltros.search}" oninput="ProductosModule.cxpSetFiltro('search', this.value)">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:3px;">Filtrar por</label>
          <select class="form-select" style="height:32px;" onchange="ProductosModule.cxpSetFiltro('fechaTipo', this.value)">
            <option value="emision" ${cxpFiltros.fechaTipo === 'emision' ? 'selected' : ''}>Fecha Emisión</option>
            <option value="vencimiento" ${cxpFiltros.fechaTipo === 'vencimiento' ? 'selected' : ''}>Fecha Vencimiento</option>
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:3px;">Desde</label>
          <input type="date" class="form-input" style="height:32px;" value="${cxpFiltros.fechaInicio}" onchange="ProductosModule.cxpSetFiltro('fechaInicio', this.value)">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:3px;">Hasta</label>
          <input type="date" class="form-input" style="height:32px;" value="${cxpFiltros.fechaFin}" onchange="ProductosModule.cxpSetFiltro('fechaFin', this.value)">
        </div>
        ${(cxpFiltros.search || cxpFiltros.fechaInicio || cxpFiltros.fechaFin) ? `<button class="btn btn--ghost btn--sm" onclick="ProductosModule.cxpLimpiarFiltros()" style="height:32px;margin-top:16px;">✕ Limpiar</button>` : ''}
      </div>

      <div class="card__body" style="padding:0;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <thead class="data-table__head">
            <tr><th>Factura</th><th>Proveedor</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Vencimiento</th><th>Acc</th></tr>
          </thead>
          <tbody class="data-table__body">${tablaFilas}</tbody>
        </table>
      </div>

      <!-- Pie con subtotal -->
      <div style="padding:12px 16px;background:var(--bg-primary);border-top:2px solid var(--border-color);display:flex;justify-content:flex-end;gap:24px;font-size:13px;">
        <span>Total Facturado: <strong>C$${fmt(totalFacturado)}</strong></span>
        <span style="color:#10b981;">Abonado: <strong>C$${fmt(totalAbonado)}</strong></span>
        <span style="color:#ef4444;">Subtotal Saldo Insoluto: <strong style="font-size:15px;">C$${fmt(totalDeuda)}</strong></span>
      </div>
    </div>
    <div id="productosModal">${modalContent}</div>`;
  };


  // ========== HELPERS CUENTAS POR PAGAR ==========
  const cxpSetFiltro = (k, v) => { cxpFiltros[k] = v; App.refreshCurrentModule(); };
  const cxpLimpiarFiltros = () => { cxpFiltros.search = ''; cxpFiltros.fechaInicio = ''; cxpFiltros.fechaFin = ''; App.refreshCurrentModule(); };
  const cxpToggleAgrupada = () => { cxpFiltros.vistaAgrupada = !cxpFiltros.vistaAgrupada; App.refreshCurrentModule(); };

  const cxpExportarExcel = () => {
    const compras = getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0);
    const provs = getData('proveedores');
    const headers = ['No. Factura','Proveedor','Fecha Emisión','Fecha Vencimiento','Total','Abonado','Saldo Pendiente'];
    const rows = compras.map(c => {
      const prov = provs.find(p => p.id === c.proveedorId);
      const abonado = (c.total || 0) - (c.saldoPendiente || 0);
      return [`"${c.numFactura}"`, `"${prov?.razonSocial || c.proveedorNombre || 'N/A'}"`, c.fecha ? c.fecha.split('T')[0] : '', c.fechaVencimiento || '', c.total, abonado, c.saldoPendiente].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `cuentas_por_pagar_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const cxpExportarPDF = () => {
    const compras = getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0);
    const provs = getData('proveedores');
    const totalDeuda = compras.reduce((s, c) => s + (c.saldoPendiente || 0), 0);
    const fecha = new Date().toLocaleDateString('es-NI');
    const filas = compras.map(c => {
      const prov = provs.find(p => p.id === c.proveedorId);
      const abonado = (c.total || 0) - (c.saldoPendiente || 0);
      const vencido = c.fechaVencimiento && new Date(c.fechaVencimiento) < new Date();
      return `<tr style="color:${vencido ? '#ef4444' : 'inherit'}">
        <td>${c.numFactura}</td><td>${prov?.razonSocial || c.proveedorNombre || 'N/A'}</td>
        <td>${c.fecha ? c.fecha.split('T')[0] : ''}</td><td>${c.fechaVencimiento || '-'}</td>
        <td style="text-align:right">C$ ${fmt(c.total)}</td>
        <td style="text-align:right">C$ ${fmt(abonado)}</td>
        <td style="text-align:right;font-weight:700">C$ ${fmt(c.saldoPendiente)}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuentas por Pagar</title><style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
      h1{font-size:16px;color:#1e293b;margin-bottom:4px;} p{font-size:10px;color:#64748b;margin-bottom:12px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#1e293b;color:white;padding:6px 8px;text-align:left;}
      td{padding:5px 8px;border-bottom:1px solid #e2e8f0;}
      tr:nth-child(even){background:#f8fafc;}
      .footer{margin-top:12px;text-align:right;font-size:13px;font-weight:700;padding:10px;background:#fee2e2;border-radius:4px;color:#dc2626;}
    </style></head><body>
    <h1>Reporte — Cuentas por Pagar</h1>
    <p>Generado: ${fecha} &nbsp;|&nbsp; Total facturas: ${compras.length}</p>
    <table><thead><tr><th>Factura</th><th>Proveedor</th><th>F. Emisión</th><th>F. Vencim.</th><th>Total</th><th>Abonado</th><th>Saldo</th></tr></thead>
    <tbody>${filas}</tbody></table>
    <div class="footer">Subtotal Saldo Insoluto: C$ ${fmt(totalDeuda)}</div>
    </body></html>`;
    const w = window.open('', '_blank'); w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // ========== SUB: PROMOCIONES ==========
  const renderPromociones = () => {

    const promos = getPosData('prod_promociones');
    return `${backBtn()}<div class="card"><div class="card__header" style="display:flex;justify-content:space-between;align-items:center;"><h4 class="card__title">🏷️ Promociones y Ofertas</h4><button class="btn btn--primary btn--sm" onclick="ProductosModule.openPromoModal()">➕ Nueva Promoción</button></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>Nombre</th><th>Tipo</th><th>Valor</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acc</th></tr></thead>
      <tbody class="data-table__body">${promos.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay promociones</td></tr>' : promos.map(p => { const activa = new Date(p.fin) >= new Date(); return `<tr><td style="font-weight:600;">${p.nombre}</td><td><span class="badge badge--primary">${p.tipo}</span></td><td style="font-weight:700;">${p.tipo === 'porcentaje' ? p.valor + '%' : 'C$' + fmt(p.valor)}</td><td>${fmtD(p.inicio)}</td><td>${fmtD(p.fin)}</td><td><span class="badge ${activa ? 'badge--success' : 'badge--warning'}">${activa ? 'Activa' : 'Vencida'}</span></td><td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.deletePromo('${p.id}')">🗑️</button></td></tr>`; }).join('')}</tbody></table></div></div><div id="productosModal"></div>`;
  };
  const openPromoModal = () => {
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:450px;"><div class="modal__header"><h3 class="modal__title">Nueva Promoción</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.savePromo(event)">
      <div class="form-group"><label class="form-label form-label--required">Nombre</label><input type="text" name="nombre" class="form-input" required placeholder="Ej: Descuento Navideño"></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Tipo</label><select name="tipo" class="form-select"><option value="porcentaje">Porcentaje (%)</option><option value="monto">Monto Fijo (C$)</option></select></div>
      <div class="form-group"><label class="form-label">Valor</label><input type="number" step="0.01" name="valor" class="form-input" required></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Fecha Inicio</label><input type="date" name="inicio" class="form-input" required></div>
      <div class="form-group"><label class="form-label">Fecha Fin</label><input type="date" name="fin" class="form-input" required></div></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div>
    </form></div></div>`;
  };
  const savePromo = (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); fd.id = genId(); fd.valor = parseFloat(fd.valor); const promos = getPosData('prod_promociones'); promos.unshift(fd); localStorage.setItem('prod_promociones', JSON.stringify(promos)); closeModal(); App.refreshCurrentModule(); };
  const deletePromo = (id) => { if (!confirm('¿Eliminar?')) return; const promos = getPosData('prod_promociones').filter(p => p.id !== id); localStorage.setItem('prod_promociones', JSON.stringify(promos)); App.refreshCurrentModule(); };

  // ========== SUB: INVENTARIO ==========
  const renderInventario = () => {
    const prods = getProducts();
    const totalStock = prods.reduce((s, p) => s + (p.stock || p.cantidad || 0), 0);
    const bajoStock = prods.filter(p => p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo);
    const valorInv = prods.reduce((s, p) => s + (parseFloat(p.precioCompra || p.costo || 0) * (p.stock || p.cantidad || 0)), 0);
    return `${backBtn()}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">
      <div style="background:var(--bg-primary);padding:1.5rem;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Total Unidades</div><div style="font-size:1.8rem;font-weight:800;color:var(--text-primary);">${totalStock}</div></div>
      <div style="background:rgba(239,68,68,0.05);padding:1.5rem;border-radius:8px;border:1px solid rgba(239,68,68,0.2);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Bajo Stock</div><div style="font-size:1.8rem;font-weight:800;color:#ef4444;">${bajoStock.length}</div></div>
      <div style="background:rgba(16,185,129,0.05);padding:1.5rem;border-radius:8px;border:1px solid rgba(16,185,129,0.2);"><div style="font-size:.85rem;color:#059669;text-transform:uppercase;font-weight:700;">Valor Inventario</div><div style="font-size:1.8rem;font-weight:800;color:#059669;">C$${fmt(valorInv)}</div></div>
    </div>
    <div class="card"><div class="card__header"><h4 class="card__title">${Icons.layers} Productos con Bajo Stock</h4></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>Código</th><th>Nombre</th><th>Stock Actual</th><th>Inv. Mínimo</th><th>Diferencia</th><th>P. Costo</th></tr></thead>
      <tbody class="data-table__body">${bajoStock.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Todos los productos tienen stock suficiente ✅</td></tr>' : bajoStock.map(p => { const diff = (p.stock || 0) - (p.inventarioMinimo || 0); return `<tr style="color:#ef4444;"><td style="font-family:monospace;">${p.codigo || '-'}</td><td style="font-weight:600;">${p.nombre}</td><td style="font-weight:700;">${p.stock || 0}</td><td>${p.inventarioMinimo || 0}</td><td style="font-weight:800;">${diff}</td><td>C$${fmt(p.precioCompra || p.costo || 0)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  };

  // ========== SUB: REPORTES ==========
  const renderReportesProductos = () => {
    const prods = getProducts();
    const compras = getData('compras');
    const totalCompras = compras.reduce((s, c) => s + (c.total || 0), 0);
    const totalItems = compras.reduce((s, c) => s + (c.items || []).reduce((ss, it) => ss + it.cantidad, 0), 0);
    const topProds = {}; compras.forEach(c => (c.items || []).forEach(it => { topProds[it.nombre] = (topProds[it.nombre] || 0) + it.cantidad; }));
    const ranking = Object.entries(topProds).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return `${backBtn()}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">
      <div style="background:var(--bg-primary);padding:1.5rem;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Total Compras</div><div style="font-size:1.8rem;font-weight:800;">C$${fmt(totalCompras)}</div></div>
      <div style="background:var(--bg-primary);padding:1.5rem;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Items Comprados</div><div style="font-size:1.8rem;font-weight:800;">${totalItems}</div></div>
      <div style="background:var(--bg-primary);padding:1.5rem;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Facturas</div><div style="font-size:1.8rem;font-weight:800;">${compras.length}</div></div>
    </div>
    <div class="card"><div class="card__header"><h4 class="card__title">${Icons.barChart} Top 10 Productos Más Comprados</h4></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>#</th><th>Producto</th><th>Unidades Compradas</th><th>Barra</th></tr></thead>
      <tbody class="data-table__body">${ranking.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">Sin datos de compras</td></tr>' : ranking.map(([n, q], i) => { const maxQ = ranking[0][1]; return `<tr><td style="font-weight:700;">${i + 1}</td><td style="font-weight:600;">${n}</td><td>${q}</td><td><div style="background:var(--color-primary-100);border-radius:4px;height:16px;width:100%;"><div style="background:var(--color-primary-500);border-radius:4px;height:100%;width:${Math.round(q / maxQ * 100)}%;"></div></div></td></tr>`; }).join('')}</tbody></table></div></div>`;
  };

  // ========== HANDLERS ==========
  let searchTimeout;
  const handleSearch = (v) => { filterState.search = v; clearTimeout(searchTimeout); searchTimeout = setTimeout(() => App.refreshCurrentModule(), 250); };
  const setFilter = (k, v) => { filterState[k] = v; currentPage = 0; App.refreshCurrentModule(); };
  const toggleBajoStock = () => { filterState.bajoStock = !filterState.bajoStock; currentPage = 0; App.refreshCurrentModule(); };
  const setPageSize = (v) => { pageSize = parseInt(v); currentPage = 0; App.refreshCurrentModule(); };
  const selectRow = (i) => { selectedRow = i; App.refreshCurrentModule(); };
  const prevPage = () => { if (currentPage > 0) { currentPage--; App.refreshCurrentModule(); } };
  const nextPage = () => { currentPage++; App.refreshCurrentModule(); };

  // Product CRUD
  const openCreateModal = () => { const el = document.getElementById('productosModal'); if (el) el.innerHTML = renderProductFormModal(); };
  const openEditModal = (id) => { const p = DataService.getProductoById(id); if (p) { const el = document.getElementById('productosModal'); if (el) el.innerHTML = renderProductFormModal(p); } };
  const viewDetalles = () => {
    const prods = getProducts();
    if (selectedRow < 0 || !prods[selectedRow]) { alert('Seleccione un producto.'); return; }
    const p = prods[selectedRow];
    const el = document.getElementById('productosModal');
    if (el) el.innerHTML = `<div class="modal-overlay open" style="z-index:999999;"><div class="modal modal--detail" onclick="event.stopPropagation()">
      <div class="modal__header">
        <h3 class="modal__title">Detalles del Producto</h3>
        <button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button>
      </div>
      <div class="modal__body" style="padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;">
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Nombre</strong><div style="font-weight:600;">${p.nombre}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Código</strong><div>${p.codigo || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Código Alt.</strong><div>${p.codigoAlt || p.codigo_alternativo || '-'}</div></div>
          
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Departamento</strong><div>${p.categoria || p.departamento || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Proveedor</strong><div>${p.proveedor || '-'}</div></div>
          <div style="grid-column:1/-1;">
            <strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;margin-bottom:8px;display:block;">Inventario por Bodega</strong>
            <div style="background:var(--bg-body);padding:8px;border-radius:6px;font-size:12px;">
              ${(() => {
                const _allBodes = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
                const _empActiva = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
                const bodes = _empActiva ? _allBodes.filter(b => b.empresa_id === _empActiva) : _allBodes;
                let stockT = 0;
                let det = bodes.map(b => {
                   let bst = 0;
                   try { bst = JSON.parse(localStorage.getItem('prod_bodegas_' + b.id + '_' + p?.id)) || 0; } catch (e) {}
                   stockT += bst;
                   return `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--border-color);padding:2px 0;"><span>${b.nombre}</span> <strong style="color:${bst > 0 ? 'var(--color-primary-600)' : 'var(--text-muted)'};">${bst}</strong></div>`;
                }).filter(x=>x).join('');
                if(bodes.length === 0) det = '<div style="color:var(--text-muted);text-align:center;">Sin bodegas configuradas</div>';
                
                let trackDet = '';
                if(p?.usaSeriales === 'true' || p?.usaSeriales === true || p?.usa_seriales || p?.tipoSeguimiento) {
                   try {
                     const ts = p?.tipoSeguimiento || 'serie';
                     const tList = JSON.parse(localStorage.getItem('prod_tracking_' + ts + '_' + p.id)) || [];
                     const disp = tList.filter(x => x.estado === 'disponible' || !x.vendido);
                     if(disp.length > 0) {
                         trackDet = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);font-size:11px;">
                         <strong style="color:var(--text-muted);">${ts.toUpperCase()} DISPONIBLES:</strong>
                         <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                           ${disp.map(t => `<span style="background:var(--color-primary-100);color:var(--color-primary-700);padding:2px 6px;border-radius:4px;border:1px solid var(--color-primary-300);">${t.valor || t.numero || t.lote || '-'}</span>`).join('')}
                         </div></div>`;
                     }
                   }catch(e){}
                }
                
                return det + `<div style="display:flex;justify-content:space-between;padding-top:4px;margin-top:4px;font-weight:700;font-size:13px;"><span>Total:</span> <span>${stockT > 0 ? stockT : (p.stock??p.cantidad??0)}</span></div>` + trackDet;
              })()}
            </div>
          </div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Inv. Mínimo</strong><div>${p.inventarioMinimo || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Precio Costo</strong><div>C$${fmt(p.precioCompra || p.costo || 0)}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Precio Venta</strong><div style="font-weight:700;">C$${fmt(p.precioVenta || p.precio || 0)}</div></div>
          ${(() => {
            const ep = getPosData('prod_extra_precios_' + p.id);
            if (!ep || ep.length === 0) return '';
            return ep.map(lp => '<div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">' + (lp.nombre || lp.codigo) + '</strong><div style="font-weight:600;color:var(--color-primary-600);">C' + String.fromCharCode(36) + fmt(lp.precio) + '</div></div>').join('');
          })()}
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Desc. Máximo</strong><div>${(p.descMaxValor > 0) ? ((p.descMaxTipo === 'porcentaje' ? p.descMaxValor + '%' : 'C' + String.fromCharCode(36) + fmt(p.descMaxValor))) : 'Sin límite'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Unidad</strong><div>${p.unidad || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Venta a Granel</strong><div>${p.ventaGranel === 'true' || p.venta_granel ? 'Sí' : 'No'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Seguimiento</strong><div>${p.usaSeriales === 'true' || p.usa_seriales ? ((p.tipoSeguimiento || '').toUpperCase() || 'Sí') : 'No'}</div></div>
          <div style="grid-column:1/-1;"><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Descripción</strong><div>${p.descripcion || '-'}</div></div>
        </div>
        ${(p.imagenes && p.imagenes.length > 0) ? `
        <div style="margin-top:16px;border-top:1px solid var(--border-color);padding-top:16px;">
          <strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;display:block;margin-bottom:8px;">Imágenes (${p.imagenes.length})</strong>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;">
            ${p.imagenes.map(img => `<img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;" onclick="window.open('${img}', '_blank')">`).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div></div>`;
  };
  const editSelected = () => { const prods = getProducts(); if (selectedRow >= 0 && prods[selectedRow]) openEditModal(prods[selectedRow].id); else alert('Seleccione un producto.'); };
  const deleteSelected = () => { const prods = getProducts(); if (selectedRow >= 0 && prods[selectedRow]) deleteItem(prods[selectedRow].id); else alert('Seleccione un producto.'); };
  const deleteItem = async (id) => { if (confirm('¿Eliminar este producto?')) { try { await DataService.deleteProducto(id); App.refreshCurrentModule(); } catch (e) { alert('Error: ' + e.message); } } };
  const closeModal = () => { modalContent = ''; const el = document.getElementById('productosModal'); if (el) el.innerHTML = ''; };

  const renderProductFormModal = (p = null) => {
    const isEdit = p !== null;
    const deptos = getPosData('prod_departamentos');
    const provs = getData('proveedores');
    const unidades = getPosData('prod_unidades');
    const listaPrecios = getPosData('pos_lista_precios');
    const costo = parseFloat(p?.precioCompra || p?.precio_costo || p?.costo || 0);
    const venta = parseFloat(p?.precioVenta || p?.precio_venta || p?.precio || 0);
    const ganancia = costo > 0 ? ((venta - costo) / costo * 100).toFixed(2) : 0;
    return `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:680px;">
    <div class="modal__header" style="background:linear-gradient(135deg,var(--color-primary-500),var(--color-primary-700));color:white;border-radius:12px 12px 0 0;">
      <h3 class="modal__title" style="color:white;">${isEdit ? '✏️ Editar' : '➕ Nuevo'} Producto</h3>
      <button class="modal__close" onclick="ProductosModule.closeModal()" style="color:white;">${Icons.x}</button>
    </div>
    <form class="modal__body" onsubmit="ProductosModule.handleSubmit(event)" style="padding:16px;max-height:75vh;overflow-y:auto;">
      <input type="hidden" name="id" value="${p?.id || ''}">
      <input type="hidden" name="ganancia" value="${ganancia}">
      <input type="hidden" name="ventaGranel" value="${p?.ventaGranel || 'false'}">
      <input type="hidden" name="usaSeriales" value="${p?.usaSeriales || 'false'}">
      <input type="hidden" name="tipoSeguimiento" value="${p?.tipoSeguimiento || ''}">

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">📋 Información General</div>
      <div class="form-row"><div class="form-group"><label class="form-label form-label--required">Nombre</label><input type="text" name="nombre" class="form-input" value="${p?.nombre || ''}" required placeholder="Nombre del producto"></div>
      <div class="form-group" style="max-width:140px;"><label class="form-label">Tipo</label><select name="tipo" class="form-select"><option value="Producto" ${p?.tipo === 'Producto' ? 'selected' : ''}>Producto</option><option value="Servicio" ${p?.tipo === 'Servicio' ? 'selected' : ''}>Servicio</option></select></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Código / Barras</label><input type="text" name="codigo" class="form-input" value="${p?.codigo || p?.sku || ''}" placeholder="Escanear o escribir"></div>
      <div class="form-group"><label class="form-label">Código Alternativo</label><input type="text" name="codigoAlt" class="form-input" value="${p?.codigoAlt || ''}"></div>
      </div>
      <div class="form-row"><div class="form-group"><label class="form-label">Departamento</label><div style="display:flex;gap:4px;"><select name="categoria" class="form-select" style="flex:1;"><option value="">Seleccionar...</option>${deptos.map(d => `<option value="${d}" ${(p?.categoria === d || p?.departamento === d) ? 'selected' : ''}>${d}</option>`).join('')}</select><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.addDepto()" title="Nuevo Depto">+</button></div></div>
      <div class="form-group"><label class="form-label">Proveedor</label><div style="display:flex;gap:4px;"><select name="proveedor" class="form-select" style="flex:1;"><option value="">Seleccionar...</option>${provs.map(pr => `<option value="${pr.razonSocial}" ${p?.proveedor === pr.razonSocial ? 'selected' : ''}>${pr.razonSocial}</option>`).join('')}</select><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.addProveedorModal()" title="Nuevo Proveedor">+</button></div></div>
      <div class="form-group"><label class="form-label">Unidad</label><div style="display:flex;gap:4px;"><select name="unidad" class="form-select" style="flex:1;"><option value="">Seleccionar...</option>${unidades.map(u => `<option value="${u.clave}" ${p?.unidad === u.clave ? 'selected' : ''}>${u.clave} - ${u.nombre}</option>`).join('')}</select><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.openUnidadesModal()" title="Gestionar Unidades">⚙</button></div></div></div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">📸 Imágenes del Producto</div>
      <div style="margin-bottom:14px;">
        <input type="file" id="prodFotosUpload" multiple accept="image/*" style="display:none;" onchange="ProductosModule.handleFotosUpload(event)">
        <button type="button" class="btn" style="width:100%;border:1px dashed var(--color-primary-400);background:rgba(56,189,248,0.05);color:var(--color-primary-600);padding:12px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" onclick="document.getElementById('prodFotosUpload').click()">
          <span style="font-size:1.5rem;">📥</span><span style="font-weight:600;">Haz clic aquí para subir fotos</span>
          <span style="font-size:10px;color:var(--text-muted);">Formatos soportados: JPG, PNG, WEBP</span>
        </button>
        <div id="prodFotosLoading" style="display:none;font-size:10px;color:var(--color-primary-600);font-weight:600;margin-top:4px;text-align:center;">Subiendo imágenes... ⏳</div>
        <div id="prodFotosPreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          ${(p?.imagenes || []).map(img => `<div class="prod-foto" style="position:relative;width:60px;height:60px;border-radius:4px;border:1px solid var(--border-color);overflow:hidden;"><img src="${img}" style="width:100%;height:100%;object-fit:cover;"><button type="button" style="position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;" onclick="ProductosModule.removeFoto(this, '${img}')">×</button></div>`).join('')}
        </div>
        <input type="hidden" name="imagenes" id="prodImagenesData" value='${escape(JSON.stringify(p?.imagenes || []))}'>
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">💰 Precios y Márgenes</div>
      <div class="form-row"><div class="form-group"><label class="form-label">P. Costo</label><input type="number" step="0.01" name="precioCompra" id="precioCostoInput" class="form-input" value="${costo}" oninput="ProductosModule.calcGanancia()"></div>
      <div class="form-group"><label class="form-label">% Ganancia</label><input type="number" step="0.01" name="gananciaInput" id="gananciaInput" class="form-input" value="${ganancia}" oninput="ProductosModule.calcPrecioVenta()" style="border-color:var(--color-primary-400);"></div>
      <div class="form-group"><label class="form-label form-label--required">P. Venta</label><input type="number" step="0.01" name="precio" id="precioVentaInput" class="form-input" value="${venta}" required oninput="ProductosModule.calcGanancia()" style="font-weight:700;"></div></div>
      <div style="margin-bottom:8px;"><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.openMasPreciosModal('${p?.id || ''}')" style="font-size:12px;">📊 Más Precios${listaPrecios.length > 0 ? ' (' + listaPrecios.length + ' listas)' : ''}</button></div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">📦 Inventario</div>
      <div class="form-row"><div class="form-group"><label class="form-label">Stock ${isEdit ? '(Total Bodegas)' : ''}</label>
        <input type="number" name="stock" class="form-input" value="${(() => {
            if(!isEdit) return 0;
            const _allBodes = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
            const _empAct = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
            const bodes = _empAct ? _allBodes.filter(b => b.empresa_id === _empAct) : _allBodes;
            let stockT = 0;
            bodes.forEach(b => { try { stockT += JSON.parse(localStorage.getItem('prod_bodegas_' + b.id + '_' + p?.id)) || 0; } catch (e) {} });
            return stockT > 0 ? stockT : (p?.stock ?? p?.cantidad ?? 0);
        })()}" readonly style="background:var(--bg-body);opacity:0.7;" title="Controlado por módulo de compras y traslados">
        ${isEdit ? `<div style="margin-top:4px;font-size:11px;border:1px solid var(--border-color);border-radius:6px;padding:6px;background:var(--bg-body);">
          ${(() => {
            const _allBodes2 = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
            const _empAct2 = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
            const bodes2 = _empAct2 ? _allBodes2.filter(b => b.empresa_id === _empAct2) : _allBodes2;
            return bodes2.map(b => {
              let bst = 0;
              try { bst = JSON.parse(localStorage.getItem('prod_bodegas_' + b.id + '_' + p?.id)) || 0; } catch(e) {}
              return '<div style="display:flex;justify-content:space-between;padding:1px 0;"><span>' + b.nombre + '</span><strong style="color:' + (bst > 0 ? 'var(--color-primary-600)' : 'var(--text-muted)') + ';">' + bst + '</strong></div>';
            }).join('') || '<div style="color:var(--text-muted);text-align:center;">Sin bodegas</div>';
          })()}
        </div>` : ''}
      </div>
      <div class="form-group"><label class="form-label">Inv. Mínimo</label><input type="number" name="inventarioMinimo" class="form-input" value="${p?.inventarioMinimo || p?.stock_minimo || 0}"></div>
      <div class="form-group"><label class="form-label">Inv. Máximo</label><input type="number" name="inventarioMaximo" class="form-input" value="${p?.inventarioMaximo || p?.stock_maximo || 0}" placeholder="0 = sin límite"></div>
      <div class="form-group" style="max-width:120px;"><label class="form-label">Estado</label><select name="estado" class="form-select"><option value="Activo" ${p?.estado === 'Activo' ? 'selected' : ''}>Activo</option><option value="Inactivo" ${p?.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></div></div>


      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">🔒 Descuento Máximo Permitido</div>
      <div class="form-row"><div class="form-group"><label class="form-label">Tipo</label><select name="descMaxTipo" class="form-select"><option value="porcentaje" ${(p?.descMaxTipo === 'porcentaje' || !p?.descMaxTipo) ? 'selected' : ''}>Porcentaje (%)</option><option value="monto" ${p?.descMaxTipo === 'monto' ? 'selected' : ''}>Monto Fijo (C$)</option></select></div>
      <div class="form-group"><label class="form-label">Valor Máximo</label><input type="number" step="0.01" name="descMaxValor" class="form-input" value="${p?.descMaxValor || p?.descuento_max_valor || 0}" placeholder="0 = sin límite"></div></div>
      <p style="font-size:10px;color:var(--text-muted);margin:-4px 0 8px;">Si el descuento en POS supera este límite, se aplicará el máximo permitido automáticamente.</p>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--color-primary-200);">⚙ Opciones Avanzadas</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:${p?.ventaGranel === 'true' ? 'rgba(16,185,129,0.1)' : 'transparent'};"><input type="checkbox" onchange="this.form.ventaGranel.value=this.checked;this.parentElement.style.background=this.checked?'rgba(16,185,129,0.1)':'transparent';" ${p?.ventaGranel === 'true' ? 'checked' : ''}> ⚖️ Venta a Granel <span style="font-size:10px;color:var(--text-muted);">(decimales)</span></label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:${p?.usaSeriales === 'true' ? 'rgba(56,189,248,0.1)' : 'transparent'};"><input type="checkbox" id="chkUsaSeriales" onchange="ProductosModule.toggleSerialesPanel(this)" ${p?.usaSeriales === 'true' ? 'checked' : ''}> 🔢 Lotes / Serie / IMEI</label>
      </div>
      <div id="serialesPanelConfig" style="display:${p?.usaSeriales === 'true' ? 'block' : 'none'};margin-bottom:10px;padding:12px;border-radius:8px;border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.05);">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">¿Qué tipo de seguimiento desea usar?</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:8px 14px;border-radius:8px;border:2px solid ${(p?.tipoSeguimiento || '') === 'lote' ? 'var(--color-primary-500)' : 'var(--border-color)'};background:${(p?.tipoSeguimiento || '') === 'lote' ? 'rgba(56,189,248,0.12)' : 'var(--bg-primary)'};transition:all 0.2s;"><input type="radio" name="tipoSeguimientoRadio" value="lote" ${(p?.tipoSeguimiento || '') === 'lote' ? 'checked' : ''} onchange="ProductosModule.setTipoSeguimiento(this.value)"> 📦 <strong>Lote</strong> <span style="font-size:10px;color:var(--text-muted);">(con fecha de caducidad)</span></label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:8px 14px;border-radius:8px;border:2px solid ${(p?.tipoSeguimiento || '') === 'serie' ? 'var(--color-primary-500)' : 'var(--border-color)'};background:${(p?.tipoSeguimiento || '') === 'serie' ? 'rgba(56,189,248,0.12)' : 'var(--bg-primary)'};transition:all 0.2s;"><input type="radio" name="tipoSeguimientoRadio" value="serie" ${(p?.tipoSeguimiento || '') === 'serie' ? 'checked' : ''} onchange="ProductosModule.setTipoSeguimiento(this.value)"> 🔢 <strong>No. Serie</strong></label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:8px 14px;border-radius:8px;border:2px solid ${(p?.tipoSeguimiento || '') === 'imei' ? 'var(--color-primary-500)' : 'var(--border-color)'};background:${(p?.tipoSeguimiento || '') === 'imei' ? 'rgba(56,189,248,0.12)' : 'var(--bg-primary)'};transition:all 0.2s;"><input type="radio" name="tipoSeguimientoRadio" value="imei" ${(p?.tipoSeguimiento || '') === 'imei' ? 'checked' : ''} onchange="ProductosModule.setTipoSeguimiento(this.value)"> 📱 <strong>IMEI</strong></label>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Descripción</label><textarea name="descripcion" class="form-textarea" rows="2" placeholder="Descripción del producto...">${p?.descripcion || ''}</textarea></div>

      <div class="modal__footer" style="border-top:2px solid var(--border-color);padding-top:12px;"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary" style="min-width:120px;">${isEdit ? '💾 Guardar' : '➕ Crear'}</button></div>
    </form></div></div>`;
  };

  const calcGanancia = () => {
    const costo = parseFloat(document.getElementById('precioCostoInput')?.value) || 0;
    const venta = parseFloat(document.getElementById('precioVentaInput')?.value) || 0;
    const ganInput = document.getElementById('gananciaInput');
    if (ganInput && costo > 0) ganInput.value = ((venta - costo) / costo * 100).toFixed(2);
  };
  const calcPrecioVenta = () => {
    const costo = parseFloat(document.getElementById('precioCostoInput')?.value) || 0;
    const gan = parseFloat(document.getElementById('gananciaInput')?.value) || 0;
    const ventaInput = document.getElementById('precioVentaInput');
    if (ventaInput && costo > 0) ventaInput.value = (costo + (costo * gan / 100)).toFixed(2);
  };
  const toggleSerialesPanel = (checkbox) => {
    const panel = document.getElementById('serialesPanelConfig');
    const form = checkbox.form;
    if (checkbox.checked) {
      form.usaSeriales.value = 'true';
      checkbox.parentElement.style.background = 'rgba(56,189,248,0.1)';
      if (panel) panel.style.display = 'block';
    } else {
      form.usaSeriales.value = 'false';
      form.tipoSeguimiento.value = '';
      checkbox.parentElement.style.background = 'transparent';
      if (panel) panel.style.display = 'none';
      const radios = document.querySelectorAll('[name=tipoSeguimientoRadio]');
      radios.forEach(r => { r.checked = false; r.parentElement.style.borderColor = 'var(--border-color)'; r.parentElement.style.background = 'var(--bg-primary)'; });
    }
  };
  const setTipoSeguimiento = (tipo) => {
    const hiddenField = document.querySelector('#productosModal [name=tipoSeguimiento]');
    if (hiddenField) hiddenField.value = tipo;
    const radios = document.querySelectorAll('#productosModal [name=tipoSeguimientoRadio]');
    radios.forEach(r => {
      const isSelected = r.value === tipo;
      r.parentElement.style.borderColor = isSelected ? 'var(--color-primary-500)' : 'var(--border-color)';
      r.parentElement.style.background = isSelected ? 'rgba(56,189,248,0.12)' : 'var(--bg-primary)';
    });
    let prodId = document.querySelector('#productosModal [name=id]')?.value || '';
    if (!prodId) prodId = 'temp_' + Date.now();
    setTimeout(() => {
      if (tipo === 'lote') openLotesModal(prodId);
      else if (tipo === 'serie' || tipo === 'imei') openSerialesModal(prodId, tipo);
    }, 10);
  };
  const getTrackingData = (prodId, tipo) => { try { return JSON.parse(localStorage.getItem('prod_tracking_' + tipo + '_' + prodId) || '[]'); } catch (e) { return []; } };
  const saveTrackingData = (prodId, tipo, data) => { localStorage.setItem('prod_tracking_' + tipo + '_' + prodId, JSON.stringify(data)); };
  const openLotesModal = (prodId) => {
    const lotes = getTrackingData(prodId, 'lote');
    let modal = document.getElementById('productosTrackingModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'productosTrackingModal';
      document.body.appendChild(modal);
    }
    const rows = lotes.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Sin lotes registrados</td></tr>' :
      lotes.map((l, i) => {
        const exp = l.fechaCaducidad && new Date(l.fechaCaducidad) < new Date(); const sc = l.vendido ? '#94a3b8' : exp ? '#ef4444' : '#10b981'; const st = l.vendido ? 'Vendido' : exp ? 'Vencido' : 'Activo';
        return '<tr style="' + (l.vendido ? 'opacity:0.5;' : '') + '"><td style="font-weight:600;">' + l.lote + '</td><td>' + l.cantidad + '</td><td>' + (l.fechaCaducidad || '-') + '</td><td><span style="color:' + sc + ';font-weight:700;font-size:10px;">' + st + '</span></td><td>' + (!l.vendido ? '<button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeTracking(\'' + prodId + '\',\'lote\',' + i + ')">🗑️</button>' : '') + '</td></tr>';
      }).join('');
    modal.innerHTML = '<div class="modal-overlay open" style="z-index:9999999;background:rgba(0,0,0,0.6);"><div class="modal" onclick="event.stopPropagation()" style="max-width:580px;z-index:99999999;position:relative;"><div class="modal__header" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:white;"><h3 class="modal__title" style="color:white;">📦 Gestión de Lotes</h3><button type="button" class="modal__close" onclick="ProductosModule.closeTrackingModal()" style="color:white;cursor:pointer;">' + Icons.x + '</button></div><div class="modal__body" style="padding:16px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Agregue lotes con su número y fecha de caducidad.</p><div style="display:flex;gap:8px;margin-bottom:16px;align-items:flex-end;"><div class="form-group" style="flex:1;margin:0;"><label class="form-label" style="font-size:11px;">No. Lote *</label><input type="text" class="form-input" id="trackLoteNumero" placeholder="LOT-2026-001" style="height:32px;"></div><div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Cantidad</label><input type="number" class="form-input" id="trackLoteCantidad" value="1" min="1" style="height:32px;width:80px;"></div><div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">F. Caducidad *</label><input type="date" class="form-input" id="trackLoteFecha" style="height:32px;"></div><button type="button" class="btn btn--primary btn--sm" onclick="ProductosModule.addLote(\'' + prodId + '\')" style="height:32px;cursor:pointer;">+ Agregar</button></div><div style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;"><table class="data-table" style="width:100%;font-size:11px;"><thead class="data-table__head"><tr><th>Lote</th><th>Cant</th><th>F. Caducidad</th><th>Estado</th><th></th></tr></thead><tbody class="data-table__body">' + rows + '</tbody></table></div><div style="margin-top:12px;text-align:right;font-size:11px;color:var(--text-muted);">Activos: <strong>' + lotes.filter(l => !l.vendido).length + '</strong> | Cantidad: <strong>' + lotes.filter(l => !l.vendido).reduce((s, l) => s + (l.cantidad || 0), 0) + '</strong></div></div></div></div>';
    setTimeout(() => document.getElementById('trackLoteNumero')?.focus(), 100);
  };
  const addLote = (prodId) => {
    const lote = document.getElementById('trackLoteNumero')?.value?.trim();
    const cantidad = parseInt(document.getElementById('trackLoteCantidad')?.value) || 1;
    const fecha = document.getElementById('trackLoteFecha')?.value;
    if (!lote) { alert('Ingrese el número de lote.'); return; }
    if (!fecha) { alert('Ingrese la fecha de caducidad.'); return; }
    const lotes = getTrackingData(prodId, 'lote');
    lotes.push({ id: Date.now().toString(), lote, cantidad, fechaCaducidad: fecha, vendido: false, fechaRegistro: new Date().toISOString() });
    saveTrackingData(prodId, 'lote', lotes);
    openLotesModal(prodId);
  };
  const openSerialesModal = (prodId, tipo) => {
    const entries = getTrackingData(prodId, tipo);
    const titulo = tipo === 'serie' ? '🔢 Números de Serie' : '📱 Números IMEI';
    const lbl = tipo === 'serie' ? 'No. Serie' : 'No. IMEI';
    const grad = tipo === 'serie' ? 'linear-gradient(135deg,#0ea5e9,#0284c7)' : 'linear-gradient(135deg,#f59e0b,#d97706)';
    const colCount = tipo === 'imei' ? 6 : 5;
    const rows = entries.length === 0 ? '<tr><td colspan="' + colCount + '" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Sin registros</td></tr>' :
      entries.map((s, i) => {
        const sc = s.vendido ? '#94a3b8' : '#10b981'; const st = s.vendido ? 'Vendido' : 'Disponible';
        return '<tr style="' + (s.vendido ? 'opacity:0.5;' : '') + '"><td>' + (s.cantidad || 1) + '</td><td style="font-weight:600;font-family:monospace;">' + s.numero + '</td>' + (tipo === 'imei' ? '<td>' + (s.color || '-') + '</td>' : '') + '<td><span style="color:' + sc + ';font-weight:700;font-size:10px;">' + st + '</span></td><td style="font-size:10px;">' + (s.facturaId || '-') + '</td><td>' + (!s.vendido ? '<button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeTracking(\'' + prodId + '\',\'' + tipo + '\',' + i + ')">🗑️</button>' : '') + '</td></tr>';
      }).join('');
    
    // Build input fields based on type
    let inputFields = '<div class="form-group" style="flex:1;margin:0;"><label class="form-label" style="font-size:11px;">' + lbl + ' *</label><input type="text" class="form-input" id="trackSerialNumero" placeholder="Ingrese ' + lbl + '..." style="height:32px;"></div>';
    if (tipo === 'imei') {
      inputFields += '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Color</label><input type="text" class="form-input" id="trackSerialColor" placeholder="Ej: Negro" style="height:32px;width:100px;"></div>';
    }
    inputFields += '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Cant.</label><input type="number" class="form-input" id="trackSerialCant" value="1" min="1" style="height:32px;width:60px;"></div>';
    inputFields += '<button type="button" class="btn btn--primary btn--sm" onclick="ProductosModule.addSerial(\'' + prodId + '\',\'' + tipo + '\')" style="height:32px;cursor:pointer;">+ Agregar</button>';
    
    // Build table headers based on type
    let tableHeaders = '<th>Cant.</th><th>' + lbl + '</th>' + (tipo === 'imei' ? '<th>Color</th>' : '') + '<th>Estado</th><th>Factura</th><th></th>';
    
    let modal = document.getElementById('productosTrackingModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'productosTrackingModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div class="modal-overlay open" style="z-index:9999999;background:rgba(0,0,0,0.6);"><div class="modal" onclick="event.stopPropagation()" style="max-width:620px;z-index:99999999;position:relative;"><div class="modal__header" style="background:' + grad + ';color:white;"><h3 class="modal__title" style="color:white;">' + titulo + '</h3><button type="button" class="modal__close" onclick="ProductosModule.closeTrackingModal()" style="color:white;cursor:pointer;">' + Icons.x + '</button></div><div class="modal__body" style="padding:16px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Registre cada ' + lbl.toLowerCase() + ' individualmente.</p><div style="display:flex;gap:8px;margin-bottom:16px;align-items:flex-end;">' + inputFields + '</div><div style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;"><table class="data-table" style="width:100%;font-size:11px;"><thead class="data-table__head"><tr>' + tableHeaders + '</tr></thead><tbody class="data-table__body">' + rows + '</tbody></table></div><div style="margin-top:12px;text-align:right;font-size:11px;color:var(--text-muted);">Disponibles: <strong style="color:#10b981;">' + entries.filter(s => !s.vendido).length + '</strong> | Vendidos: <strong style="color:#94a3b8;">' + entries.filter(s => s.vendido).length + '</strong></div></div></div></div>';
    setTimeout(() => document.getElementById('trackSerialNumero')?.focus(), 100);
  };
  const addSerial = (prodId, tipo) => {
    const numero = document.getElementById('trackSerialNumero')?.value?.trim();
    const color = document.getElementById('trackSerialColor')?.value?.trim() || '';
    const cantidad = parseInt(document.getElementById('trackSerialCant')?.value) || 1;
    if (!numero) { alert('Ingrese el ' + (tipo === 'serie' ? 'número de serie' : 'IMEI') + '.'); return; }
    const entries = getTrackingData(prodId, tipo);
    if (entries.find(s => s.numero === numero && !s.vendido)) { alert('Este registro ya existe.'); return; }
    entries.push({ id: Date.now().toString(), numero, color, cantidad, vendido: false, facturaId: null, fechaRegistro: new Date().toISOString() });
    saveTrackingData(prodId, tipo, entries);
    openSerialesModal(prodId, tipo);
  };
  const removeTracking = (prodId, tipo, idx) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const data = getTrackingData(prodId, tipo); data.splice(idx, 1); saveTrackingData(prodId, tipo, data);
    if (tipo === 'lote') openLotesModal(prodId); else openSerialesModal(prodId, tipo);
  };
  const closeTrackingModal = () => { const m = document.getElementById('productosTrackingModal'); if (m) m.innerHTML = ''; };
  const marcarTrackingVendido = (prodId, tipo, trackingId, facturaId, qtySold = 1) => {
    const data = getTrackingData(prodId, tipo); const item = data.find(d => d.id === trackingId);
    if (item) {
      if (item.cantidad !== undefined) {
        item.cantidad -= parseFloat(qtySold);
        if (item.cantidad <= 0) { item.cantidad = 0; item.vendido = true; item.facturaId = facturaId; item.fechaVenta = new Date().toISOString(); }
      } else {
        item.vendido = true; item.facturaId = facturaId; item.fechaVenta = new Date().toISOString();
      }
      saveTrackingData(prodId, tipo, data);
    }
  };
  const getTrackingDisponibles = (prodId, tipo) => getTrackingData(prodId, tipo).filter(d => !d.vendido);

  const openUnidadesModal = () => {
    const unidades = getPosData('prod_unidades');
    let modalAux = document.getElementById('productosAuxModal');
    if (!modalAux) {
        modalAux = document.createElement('div');
        modalAux.id = 'productosAuxModal';
        document.body.appendChild(modalAux);
    }
    modalAux.innerHTML = `<div class="modal-overlay open" style="z-index:9999999;background:rgba(0,0,0,0.6);"><div class="modal" onclick="event.stopPropagation()" style="max-width:420px;z-index:99999999;position:relative;"><div class="modal__header"><h3 class="modal__title">⚙ Gestionar Unidades</h3><button class="modal__close" onclick="ProductosModule.closeAuxModal()">${Icons.x}</button></div>
    <div class="modal__body" style="padding:16px;">
      <div style="display:flex;gap:4px;margin-bottom:12px;"><input type="text" class="form-input" id="newUnidadClave" placeholder="Clave (PZ, KG...)" style="width:100px;"><input type="text" class="form-input" id="newUnidadNombre" placeholder="Nombre (Pieza, Kilogramo...)" style="flex:1;"><button class="btn btn--primary btn--sm" onclick="ProductosModule.addUnidad()">+</button></div>
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;">${unidades.length === 0 ? '<div style="text-align:center;padding:1rem;color:var(--text-muted);">Sin unidades</div>' : unidades.map(u => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-color);font-size:13px;"><span><strong>${u.clave}</strong> — ${u.nombre}</span><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeUnidad('${u.clave}')">🗑️</button></div>`).join('')}
      </div>
    </div></div></div>`;
  };
  const closeAuxModal = () => { const modal = document.getElementById('productosAuxModal'); if (modal) modal.innerHTML = ''; };
  const addUnidad = () => {
    const clave = (document.getElementById('newUnidadClave')?.value || '').trim().toUpperCase();
    const nombre = (document.getElementById('newUnidadNombre')?.value || '').trim();
    if (!clave || !nombre) { alert('Ingrese clave y nombre'); return; }
    const unidades = getPosData('prod_unidades');
    if (!unidades.find(u => u.clave === clave)) {
         unidades.push({ clave, nombre });
         localStorage.setItem('prod_unidades' + getEmpresaSuffix(), JSON.stringify(unidades));
    }
    
    const select = document.querySelector('#productosModal [name="unidad"]');
    if (select) {
        if (!select.querySelector(`option[value="${clave}"]`)) {
            const opt = document.createElement('option');
            opt.value = clave; opt.text = clave + ' - ' + nombre;
            select.appendChild(opt);
        }
        select.value = clave;
    }
    
    alert('✅ Unidad "' + clave + '" agregada y seleccionada.\n\nPuede cerrar esta ventana o agregar otra.');
    openUnidadesModal(); // refresh the modal
  };
  const removeUnidad = (clave) => {
    const unidades = getPosData('prod_unidades').filter(u => u.clave !== clave);
    localStorage.setItem('prod_unidades' + getEmpresaSuffix(), JSON.stringify(unidades)); openUnidadesModal();
  };

  const openMasPreciosModal = (prodId) => {
    const listaPrecios = getPosData('pos_lista_precios');
    const prodPrecios = getPosData('prod_extra_precios_' + prodId) || [];
    // Calculate cost and sale price based on existing form data if editing/creating
    const costInput = document.querySelector('#productosModal [name="precioCompra"]');
    const costo = costInput ? (parseFloat(costInput.value) || 0) : 0;
    
    let modalAux = document.getElementById('productosAuxModal');
    if (!modalAux) {
        modalAux = document.createElement('div');
        modalAux.id = 'productosAuxModal';
        document.body.appendChild(modalAux);
    }
    
    // Add global script functions for calculations inside the modal
    if (!window.calcExtraPrecios) {
        window.calcExtraPrecios = {
            fromPorcentaje: (codigo, costo) => {
                const perc = parseFloat(document.getElementById('extraPorcentaje_' + codigo).value) || 0;
                const pVenta = costo + (costo * perc / 100);
                document.getElementById('extraPrecio_' + codigo).value = pVenta.toFixed(2);
            },
            fromPrecio: (codigo, costo) => {
                if (costo <= 0) return;
                const precio = parseFloat(document.getElementById('extraPrecio_' + codigo).value) || 0;
                const perc = ((precio - costo) / costo) * 100;
                document.getElementById('extraPorcentaje_' + codigo).value = perc.toFixed(2);
            }
        };
    }

    modalAux.innerHTML = `<div class="modal-overlay open" style="z-index:9999999;background:rgba(0,0,0,0.6);"><div class="modal" onclick="event.stopPropagation()" style="max-width:580px;z-index:99999999;position:relative;"><div class="modal__header" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:white;"><h3 class="modal__title" style="color:white;">📊 Precios por Lista</h3><button class="modal__close" onclick="ProductosModule.closeAuxModal()" style="color:white;">${Icons.x}</button></div>
    <div class="modal__body" style="padding:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(14,165,233,0.1);padding:10px 12px;border-radius:8px;border:1px solid rgba(14,165,233,0.3);margin-bottom:16px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-color);">Costo Base de Referencia:</span>
        <span style="font-size:14px;font-weight:700;color:var(--color-primary-500);">C$ ${costo.toFixed(2)}</span>
    </div>
    <div style="max-height:300px;overflow-y:auto;padding-right:8px;">
    ${listaPrecios.map(lp => { 
        const saved = prodPrecios.find(pp => pp.codigo === lp.codigo); 
        const ppRecio = parseFloat(saved?.precio) || 0;
        const pPorcentaje = costo > 0 && ppRecio > 0 ? (((ppRecio - costo) / costo) * 100).toFixed(2) : (saved?.porcentaje || '');
        return `<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border-color);">
            <div style="flex:1;"><label style="font-weight:700;font-size:12px;display:block;margin-bottom:4px;">${lp.nombre}</label><span style="font-size:10px;color:var(--text-muted);">${lp.codigo}</span></div>
            <div style="width:120px;"><label style="font-size:11px;display:block;margin-bottom:4px;color:var(--text-muted);">% Ganancia</label><div style="position:relative;"><input type="number" step="0.01" class="form-input" style="height:32px;padding-right:24px;" id="extraPorcentaje_${lp.codigo}" value="${pPorcentaje}" oninput="window.calcExtraPrecios.fromPorcentaje('${lp.codigo}', ${costo})" placeholder="Ej: 30"><span style="position:absolute;right:8px;top:8px;color:var(--text-muted);font-size:12px;">%</span></div></div>
            <div style="width:140px;"><label style="font-size:11px;display:block;margin-bottom:4px;color:var(--text-muted);">P. Venta Mínimo</label><div style="position:relative;"><span style="position:absolute;left:8px;top:8px;color:var(--text-muted);font-size:12px;">C$</span><input type="number" step="0.01" class="form-input" style="height:32px;padding-left:28px;" id="extraPrecio_${lp.codigo}" value="${ppRecio || ''}" oninput="window.calcExtraPrecios.fromPrecio('${lp.codigo}', ${costo})" placeholder="Precio Final"></div></div>
        </div>`; 
    }).join('')}
    </div>
    ${listaPrecios.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay listas de precios configuradas. Ve a Ajustes > Listas de Precios para crear una.</div>' : ''}
    <div class="modal__footer" style="padding-top:16px;margin-top:0;"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeAuxModal()">Cancelar</button><button type="button" class="btn btn--primary" onclick="ProductosModule.saveExtraPrecios('${prodId}')">💾 Guardar Precios</button></div>
    </div></div></div>`;
  };
  const saveExtraPrecios = (prodId) => {
    const listaPrecios = getPosData('pos_lista_precios');
    const precios = listaPrecios.map(lp => ({ 
        codigo: lp.codigo, 
        nombre: lp.nombre, 
        porcentaje: parseFloat(document.getElementById('extraPorcentaje_' + lp.codigo)?.value) || 0,
        precio: parseFloat(document.getElementById('extraPrecio_' + lp.codigo)?.value) || 0 
    })).filter(p => p.precio > 0);
    localStorage.setItem('prod_extra_precios_' + prodId, JSON.stringify(precios));
    closeAuxModal();
    // Verify if NotificationService is available, else fallback to alert
    if (typeof NotificationService !== 'undefined') NotificationService.showToast('✅ Precios guardados exitosamente.', 'success');
    else alert('✅ Precios guardados exitosamente.');
  };

  const handleFotosUpload = async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;

    const loadingEl = document.getElementById('prodFotosLoading');
    const previewEl = document.getElementById('prodFotosPreview');
    const dataInput = document.getElementById('prodImagenesData');

    if (loadingEl) loadingEl.style.display = 'block';

    let currentImages = [];
    try {
      currentImages = JSON.parse(unescape(dataInput?.value || '[]'));
    } catch (e) {
      console.error("Error parsing existing images:", e);
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`La imagen ${file.name} es muy grande. Máximo 5MB.`);
        continue;
      }
      try {
        const uploadResult = await DataService.uploadImage('productos', file);
        if (uploadResult && uploadResult.success) {
          currentImages.push(uploadResult.url);
        } else {
          console.error("Error subiendo", file.name, uploadResult.error);
        }
      } catch (err) {
        console.error("Excepción al subir imagen", err);
      }
    }

    if (dataInput) dataInput.value = escape(JSON.stringify(currentImages));
    if (previewEl) {
      previewEl.innerHTML = currentImages.map(img => `<div class="prod-foto" style="position:relative;width:60px;height:60px;border-radius:4px;border:1px solid var(--border-color);overflow:hidden;"><img src="${img}" style="width:100%;height:100%;object-fit:cover;"><button type="button" style="position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;" onclick="ProductosModule.removeFoto(this, '${img}')">×</button></div>`).join('');
    }
    if (loadingEl) loadingEl.style.display = 'none';
  };

  const removeFoto = (button, imageUrl) => {
    const dataInput = document.getElementById('prodImagenesData');
    let currentImages = [];
    try {
      currentImages = JSON.parse(unescape(dataInput?.value || '[]'));
    } catch (e) {
      console.error("Error parsing existing images:", e);
    }

    const updatedImages = currentImages.filter(img => img !== imageUrl);
    if (dataInput) dataInput.value = escape(JSON.stringify(updatedImages));

    // Remove the parent div (the image preview)
    button.closest('.prod-foto')?.remove();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    data.precio = parseFloat(data.precio); data.precioCompra = parseFloat(data.precioCompra || 0);
    data.stock = parseInt(data.stock || 0); data.inventarioMinimo = parseInt(data.inventarioMinimo || 0);
    data.inventarioMaximo = parseInt(data.inventarioMaximo || 0);
    data.descMaxTipo = data.descMaxTipo || 'porcentaje';
    data.descMaxValor = parseFloat(data.descMaxValor || 0);
    data.descMaxValor = parseFloat(data.descMaxValor || 0);
    const descMaxTipoToSave = data.descMaxTipo || 'porcentaje';
    const descMaxValorToSave = data.descMaxValor || 0;
    
    data.ganancia = parseFloat(data.gananciaInput || data.ganancia || 0);

    // Parse the hidden imagenes input
    try {
      data.imagenes = JSON.parse(unescape(data.imagenes || '[]'));
      if (data.imagenes.length > 0) {
        data.imagenUrl = data.imagenes[0]; // Set the first image as the main one
      } else {
        data.imagenUrl = null;
      }
    } catch (e) {
      data.imagenes = [];
    }

    // Limpiar tipoSeguimiento si no usa seriales
    if (data.usaSeriales !== 'true') data.tipoSeguimiento = '';
    try {
      let prodId = data.id;
      if (data.id) {
        await DataService.updateProducto(data.id, data);
      } else {
        const created = await DataService.createProducto(data);
        prodId = created?.id || created?.productoId || created?.[0]?.id || data.id;
      }
      
      // Save discount limits using the definitively assigned prodId
      if (prodId) {
        localStorage.setItem('prod_descMax_' + prodId, JSON.stringify({ tipo: descMaxTipoToSave, valor: descMaxValorToSave }));
      }

      // Migrate tracking data if it was saved before product creation (id was empty)
      if (prodId && !data.id) {
        ['lote', 'serie', 'imei'].forEach(tipo => {
          // Migrate both empty key and temp_ keys
          ['', 'temp_'].forEach(prefix => {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('prod_tracking_' + tipo + '_' + prefix));
            keys.forEach(k => {
              const td = localStorage.getItem(k);
              if (td && td !== '[]') {
                localStorage.setItem('prod_tracking_' + tipo + '_' + prodId, td);
                localStorage.removeItem(k);
              }
            });
          });
        });
        // Migrate descMax from empty key to real ID
        const tempDescMax = localStorage.getItem('prod_descMax_');
        if (tempDescMax) {
          localStorage.setItem('prod_descMax_' + prodId, tempDescMax);
          localStorage.removeItem('prod_descMax_');
        }
      }
      
      closeModal(); App.refreshCurrentModule();
    } catch (e) { alert('Error: ' + e.message); }
  };


  // ========== DEPARTAMENTOS ==========
  const openDeptosModal = () => {
    const deptos = getPosData('prod_departamentos');
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">⚙ Gestionar Departamentos</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body">
      <div style="display:flex;gap:4px;margin-bottom:12px;"><input type="text" class="form-input" id="newDeptoInput" placeholder="Nuevo departamento..." style="flex:1;"><button class="btn btn--primary btn--sm" onclick="ProductosModule.addDepto()">Agregar</button></div>
      <div style="max-height:250px;overflow-y:auto;">${deptos.length === 0 ? '<div style="text-align:center;padding:1rem;color:var(--text-muted);">Sin departamentos</div>' : deptos.map(d => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);"><span style="font-weight:600;">${d}</span><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeDepto('${d}')">🗑️</button></div>`).join('')}
      </div>
    </div></div></div>`;
  };
  
  const addDepto = () => {
    const name = prompt('Nombre del nuevo departamento:');
    if (!name || name.trim() === '') return;
    const nameUpper = name.trim().toUpperCase();
    const deptos = getPosData('prod_departamentos');
    if (!deptos.includes(nameUpper)) { 
       deptos.push(nameUpper); 
       localStorage.setItem('prod_departamentos' + getEmpresaSuffix(), JSON.stringify(deptos)); 
    }
    const select = document.querySelector('#productosModal [name="categoria"]');
    if (select) {
        if (!select.querySelector(`option[value="${nameUpper}"]`)) {
            const opt = document.createElement('option');
            opt.value = nameUpper; opt.text = nameUpper;
            select.appendChild(opt);
        }
        select.value = nameUpper;
    }
  };
  const addProveedorModal = () => {
    const name = prompt('Nombre del nuevo proveedor:');
    if (!name || name.trim() === '') return;
    const n = name.trim().toUpperCase();
    const provs = getData('proveedores');
    if (!provs.find(p => p.razonSocial.toUpperCase() === n)) {
        provs.push({ id: Date.now().toString(36), razonSocial: n, fechaRegistro: new Date().toISOString() });
        localStorage.setItem(getSK().proveedores, JSON.stringify(provs));
    }
    const select = document.querySelector('#productosModal [name="proveedor"]');
    if (select) {
        if (!select.querySelector(`option[value="${n}"]`)) {
            const opt = document.createElement('option');
            opt.value = n; opt.text = n;
            select.appendChild(opt);
        }
        select.value = n;
    }
  };
  const saveMasPrecios = (prodId) => {
    const listas = getPosData('pos_lista_precios');
    const preciosExtra = {};
    listas.forEach(l => {
        const pInput = document.getElementById('extraPrecio_' + l.codigo);
        if (pInput) preciosExtra[l.codigo] = parseFloat(pInput.value) || 0;
    });
    const targetId = prodId || document.querySelector('#productosModal [name="id"]')?.value || 'new_temp';
    localStorage.setItem('prod_extra_precios_' + targetId + getEmpresaSuffix(), JSON.stringify(preciosExtra));
    closeAuxModal();
    alert('Precios adicionales guardados.');
  };
  const removeDepto = (name) => {
    const deptos = getPosData('prod_departamentos').filter(d => d !== name);
    localStorage.setItem('prod_departamentos' + getEmpresaSuffix(), JSON.stringify(deptos));
    openDeptosModal();
  };

  // ========== SIDE PANEL MODALS ==========
  const importModal = () => alert('Función Importar en desarrollo.');
  const historialModal = () => {
    if (selectedRow < 0) { alert('Seleccione un producto.'); return; }
    const prods = getProducts(); const p = prods[selectedRow]; if (!p) return;
    const compras = getData('compras'); const hist = [];
    compras.forEach(c => (c.items || []).forEach(it => { if (it.productId === p.id || it.nombre === p.nombre) hist.push({ fecha: c.fecha, fact: c.numFactura, prov: c.proveedorNombre, cant: it.cantidad, precio: it.precioCompra }); }));
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:550px;"><div class="modal__header"><h3 class="modal__title">📋 Historial: ${p.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body"><table class="data-table" style="width:100%;font-size:12px;"><thead><tr><th>Fecha</th><th>Factura</th><th>Proveedor</th><th>Cant</th><th>P.Compra</th></tr></thead>
    <tbody>${hist.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Sin historial de compras</td></tr>' : hist.map(h => `<tr><td>${fmtD(h.fecha)}</td><td style="font-weight:600;">${h.fact}</td><td>${h.prov}</td><td>${h.cant}</td><td>C$${fmt(h.precio)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  };
  const statsModal = () => {
    if (selectedRow < 0) { alert('Seleccione un producto.'); return; }
    const prods = getProducts(); const p = prods[selectedRow]; if (!p) return;
    const compras = getData('compras'); let totalComprado = 0; let totalGastado = 0;
    compras.forEach(c => (c.items || []).forEach(it => { if (it.productId === p.id || it.nombre === p.nombre) { totalComprado += it.cantidad; totalGastado += it.precioCompra * it.cantidad; } }));
    const margen = p.precioVenta || p.precio ? (((p.precioVenta || p.precio) - (p.precioCompra || p.costo || 0)) / (p.precioVenta || p.precio) * 100) : 0;
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:420px;"><div class="modal__header"><h3 class="modal__title">📊 Estadísticas: ${p.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Stock Actual</div><div style="font-size:1.5rem;font-weight:800;">${p.stock || p.cantidad || 0}</div></div>
      <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Comprado</div><div style="font-size:1.5rem;font-weight:800;">${totalComprado}</div></div>
      <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Inversión Total</div><div style="font-size:1.3rem;font-weight:800;color:#ef4444;">C$${fmt(totalGastado)}</div></div>
      <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Margen</div><div style="font-size:1.3rem;font-weight:800;color:#10b981;">${margen.toFixed(1)}%</div></div>
    </div></div></div></div>`;
  };
  const etiquetasModal = () => {
    if (selectedRow < 0) { alert('Seleccione un producto.'); return; }
    const prods = getProducts(); const p = prods[selectedRow]; if (!p) return;
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">🏷️ Etiqueta: ${p.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body" style="text-align:center;">
      <div style="border:2px dashed var(--border-color);padding:24px;border-radius:8px;margin-bottom:12px;">
        <div style="font-size:1.2rem;font-weight:800;margin-bottom:8px;">${p.nombre}</div>
        <div style="font-family:monospace;font-size:1.5rem;letter-spacing:2px;margin-bottom:4px;">${p.codigo || p.sku || 'SIN CÓDIGO'}</div>
        <div style="font-size:1.8rem;font-weight:900;color:var(--color-primary-600);">C$${fmt(p.precioVenta || p.precio || 0)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${p.categoria || p.departamento || ''}</div>
      </div>
      <button class="btn btn--primary btn--sm" onclick="window.print()">🖨️ Imprimir Etiqueta</button>
    </div></div></div>`;
  };
  const pedidoModal = () => {
    if (selectedRow < 0) { alert('Seleccione un producto.'); return; }
    const prods = getProducts(); const p = prods[selectedRow]; if (!p) return;
    const sugerido = Math.max(0, (p.inventarioMinimo || 0) - (p.stock || 0)) + 5;
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">📦 Pedido: ${p.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.savePedido(event,'${p.id}')">
      <div style="font-size:12px;margin-bottom:12px;padding:8px;background:var(--bg-primary);border-radius:4px;">Stock actual: <b>${p.stock || 0}</b> | Mínimo: <b>${p.inventarioMinimo || 0}</b></div>
      <div class="form-group"><label class="form-label">Cantidad Sugerida</label><input type="number" name="cantidad" class="form-input" value="${sugerido}" min="1" required></div>
      <div class="form-group"><label class="form-label">Proveedor</label><select name="proveedorId" class="form-select"><option value="">Seleccionar...</option>${getData('proveedores').map(pr => `<option value="${pr.id}">${pr.razonSocial}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Nota</label><input type="text" name="nota" class="form-input" placeholder="Observaciones..."></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Hacer Pedido</button></div>
    </form></div></div>`;
  };

  const setCompraField = (field, value) => {
    if (field === 'fecha') compraFecha = value;
    else if (field === 'proveedor') compraProveedor = value;
    else if (field === 'metodo') { compraMetodo = value; App.refreshCurrentModule(); return; }
    else if (field === 'comentarios') compraComentarios = value;
    else if (field === 'numFactura') compraNumFactura = value;
    else if (field === 'transfBanco') compraTransfBanco = value;
    else if (field === 'transfRef') compraTransfRef = value;
    else if (field === 'fechaVencimiento') compraFechaVenc = value;
    else if (field === 'fechaVenc') compraFechaVenc = value;
  };

  const searchCompraProduct = (q) => {
    const input = document.getElementById('compraSearchInput');
    const query = (q || (input ? input.value.trim() : '')).toLowerCase();
    const el = document.getElementById('compraSearchResults');
    if (!query) { if (el) el.style.display = 'none'; return; }
    const prods = getProducts();
    const results = prods.filter(p => (p.nombre||'').toLowerCase().includes(query) || (p.codigo||'').toLowerCase().includes(query) || (p.codigoAlt||'').toLowerCase().includes(query)).slice(0, 15);
    
    if (results.length === 0) { if (el) el.style.display = 'none'; return; }
    compraSearchResultIds = results.map(r => r.id);
    compraSearchSelectedIdx = 0;
    
    let html = results.map((p, idx) => `
      <div id="compraSearchItem_${idx}" class="compra-search-item search-result-item ${idx === 0 ? 'selected' : ''}" style="padding:8px 12px;border-bottom:1px solid var(--border-color);cursor:pointer;display:flex;justify-content:space-between;" onclick="ProductosModule.addCompraProduct('${p.id}')">
        <div><strong>${p.nombre}</strong> <span style="font-size:10px;color:var(--text-muted);">${p.codigo||p.codigo_alternativo||p.codigoAlt||''}</span></div>
        <div style="font-weight:700;color:var(--color-primary-600);">C$${fmt(p.precioCompra || p.costo || 0)}</div>
      </div>`).join('');
    
    if (el) { el.innerHTML = html; el.style.display = 'block'; }
    highlightCompraSearchItem(0);
  };

  const handleCompraSearchKeydown = (e) => {
    const el = document.getElementById('compraSearchResults');
    if (!el || el.style.display === 'none' || compraSearchResultIds.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      compraSearchSelectedIdx = Math.min(compraSearchSelectedIdx + 1, compraSearchResultIds.length - 1);
      highlightCompraSearchItem(compraSearchSelectedIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      compraSearchSelectedIdx = Math.max(compraSearchSelectedIdx - 1, 0);
      highlightCompraSearchItem(compraSearchSelectedIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (compraSearchSelectedIdx >= 0 && compraSearchResultIds[compraSearchSelectedIdx]) {
        addCompraProduct(compraSearchResultIds[compraSearchSelectedIdx]);
      }
    } else if (e.key === 'Escape') {
      el.style.display = 'none';
      compraSearchSelectedIdx = -1;
      compraSearchResultIds = [];
    }
  };
  const highlightCompraSearchItem = (idx) => {
    compraSearchSelectedIdx = idx;
    const items = document.querySelectorAll('.compra-search-item');
    items.forEach((item, i) => {
      item.style.background = i === idx ? 'rgba(56,189,248,0.15)' : 'transparent';
    });
    // Scroll into view if needed
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  };
  const addCompraProduct = (id) => {
    const p = getProducts().find(x => x.id === id); if (!p) return;
    const el = document.getElementById('compraSearchResults'); if (el) el.style.display = 'none';
    const si = document.getElementById('compraSearchInput'); if (si) si.value = '';
    const pv = parseFloat(p.precioVenta || p.precio || 0);
    const pc = parseFloat(p.precioCompra || p.costo || 0);
    const allBodegas = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
    const empresaId = typeof State !== 'undefined' && State.getCurrentUser()?.empresa_id ? State.getCurrentUser().empresa_id : null;
    const bodegas = empresaId ? allBodegas.filter(b => b.empresa_id === empresaId) : allBodegas;
    const objBodegasOptions = bodegas.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('');
    
    // Check if calc functions exist (from Mas Precios)
    if (!window.calcExtraPrecios) {
        window.calcExtraPrecios = {
            fromPorcentaje: (codigo, costoId, percId, destId) => {
                const costo = parseFloat(document.getElementById(costoId).value) || 0;
                const perc = parseFloat(document.getElementById(percId).value) || 0;
                const pVenta = costo + (costo * perc / 100);
                document.getElementById(destId).value = pVenta.toFixed(2);
            },
            fromPrecio: (codigo, costoId, percId, destId) => {
                const costo = parseFloat(document.getElementById(costoId).value) || 0;
                if (costo <= 0) return;
                const precio = parseFloat(document.getElementById(destId).value) || 0;
                const perc = ((precio - costo) / costo) * 100;
                document.getElementById(percId).value = perc.toFixed(2);
            }
        };
    }

    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:580px;"><div class="modal__header"><h3 class="modal__title">Agregar: ${p.nombre}</h3><button type="button" class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.confirmAddCompra(event,'${id}')">
      <div class="form-row"><div class="form-group"><label class="form-label form-label--required">Cantidad</label><input type="number" name="cantidad" class="form-input" value="1" min="${p.ventaGranel === 'true' ? '0.01' : '1'}" step="${p.ventaGranel === 'true' ? '0.01' : '1'}" required></div>
      <div class="form-group"><label class="form-label form-label--required">Distribución por Bodega</label>
            <div id="bodegaDistribFields" style="border:1px solid var(--border-color);border-radius:6px;padding:8px;background:var(--bg-primary);max-height:140px;overflow-y:auto;">
              ${bodegas.map(b => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="flex:1;font-size:12px;font-weight:600;">${b.nombre}</span><input type="number" name="bodega_qty_${b.id}" class="form-input" style="width:80px;height:28px;font-size:12px;text-align:center;" value="0" min="0" step="${p.ventaGranel === 'true' ? '0.01' : '1'}" oninput="ProductosModule.calcBodegaDistrib('add')"></div>`).join('')}
            </div>
            <div id="bodegaDistribCounter" style="margin-top:4px;font-size:11px;font-weight:700;padding:4px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;">Restante: 0 / Total: 0</div>
          </div>
      </div>
      <div class="form-row"><div class="form-group"><label class="form-label">P.Compra Costo</label><input type="number" step="0.01" name="precioCompra" id="addCompraCosto" class="form-input" value="${pc}"></div>
      <div class="form-group"><label class="form-label">% Ganancia Principal</label><div style="position:relative;"><input type="number" step="0.01" name="porcentajeGanancia" id="addCompraPerc" class="form-input" value="${pc > 0 ? (((pv - pc) / pc) * 100).toFixed(2) : 0}" oninput="window.calcExtraPrecios.fromPorcentaje('main', 'addCompraCosto', 'addCompraPerc', 'addCompraVenta')" placeholder="Ej: 30"><span style="position:absolute;right:8px;top:8px;color:var(--text-muted);">%</span></div></div>
      <div class="form-group"><label class="form-label">P.Venta Final</label><input type="number" step="0.01" name="precioVenta" id="addCompraVenta" class="form-input" value="${pv}" oninput="window.calcExtraPrecios.fromPrecio('main', 'addCompraCosto', 'addCompraPerc', 'addCompraVenta')"></div></div>
      
      ${(typeof getPosData !== 'undefined' && getPosData('pos_lista_precios')?.length > 0) ? `
      <div style="background:var(--bg-color);border:1px solid var(--border-color);padding:8px;border-radius:6px;margin-bottom:12px;max-height:160px;overflow-y:auto;">
        <label style="font-size:11px;font-weight:700;display:block;margin-bottom:8px;color:var(--text-color);">Distintos Precios Creados (Opcional)</label>
        ${getPosData('pos_lista_precios').map(lp => {
            const saved = (getPosData('prod_extra_precios_' + id) || []).find(pp => pp.codigo === lp.codigo);
            const ppRecio = parseFloat(saved?.precio) || 0;
            const pPorcentaje = pc > 0 && ppRecio > 0 ? (((ppRecio - pc) / pc) * 100).toFixed(2) : (saved?.porcentaje || '');
            return `<div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:6px;">
                <div style="flex:1;"><span style="font-size:11px;font-weight:600;">${lp.nombre}</span></div>
                <div style="width:90px;"><label style="font-size:9px;">% Ganancia</label><input type="number" step="0.01" class="form-input" style="height:26px;font-size:11px;" id="addCompraPerc_${lp.codigo}" value="${pPorcentaje}" oninput="window.calcExtraPrecios.fromPorcentaje('${lp.codigo}', 'addCompraCosto', 'addCompraPerc_${lp.codigo}', 'addCompraPrecio_${lp.codigo}')"></div>
                <div style="width:100px;"><label style="font-size:9px;">P. Final</label><input type="number" step="0.01" class="form-input" style="height:26px;font-size:11px;" id="addCompraPrecio_${lp.codigo}" value="${ppRecio || ''}" name="extraPrecio_${lp.codigo}" oninput="window.calcExtraPrecios.fromPrecio('${lp.codigo}', 'addCompraCosto', 'addCompraPerc_${lp.codigo}', 'addCompraPrecio_${lp.codigo}')"></div>
            </div>`;
        }).join('')}
      </div>` : ''}

      <div class="form-group"><label class="form-label">Descuento Global (Opcional)</label><input type="number" step="0.01" name="descuento" class="form-input" value="0"></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" name="tieneSerial" value="1" ${p.usaSeriales === 'true' ? 'checked' : ''} onchange="ProductosModule.toggleSerialPanel(this)"> 🔢 Tiene No. Serie / Lote / IMEI</label></div>
      <div id="serialField" style="display:${p.usaSeriales === 'true' ? 'block' : 'none'};">
        <div style="border:1px solid var(--border-color);border-radius:8px;padding:12px;background:rgba(56,189,248,0.04);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--text-primary);">📋 Registrar Números de Serie / Lote / IMEI</span>
            <span id="serialCounter" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;background:rgba(239,68,68,0.1);color:#ef4444;">0 / 0</span>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input type="text" id="serialNewInput" class="form-input" style="flex:1;height:30px;font-size:12px;" placeholder="Escriba no. serie, lote o IMEI..." onkeydown="if(event.key==='Enter'){event.preventDefault();ProductosModule.addSerialToList();}">
            <button type="button" class="btn btn--primary btn--sm" style="height:30px;font-size:11px;" onclick="ProductosModule.addSerialToList()">+ Agregar</button>
          </div>
          <div id="serialListContainer" style="max-height:120px;overflow-y:auto;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-primary);min-height:40px;">
            <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">Sin números registrados</div>
          </div>
        </div>
        <input type="hidden" name="serial" id="serialDataHidden" value="">
        <input type="hidden" name="serialList" id="serialListHidden" value="[]">
      </div>
      <div class="modal__footer" style="padding:12px;border-top:1px solid var(--border-color);display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button>
        <button type="submit" class="btn btn--primary">✅ Agregar a Compra</button>
      </div></form></div></div>`;
  };
  const confirmPagoCompra = (e, compraId) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries());
    const abono = parseFloat(fd.monto); if (isNaN(abono) || abono <= 0) { alert('Monto inválido'); return; }
    const compras = getData('compras'); const c = compras.find(x => x.id === compraId); if (!c) return;
    c.saldoPendiente = Math.max(0, (c.saldoPendiente || 0) - abono);
    setData('compras', compras);
    addRec('abonos_cxp', { compraId, numFactura: c.numFactura, monto: abono, metodo: fd.metodo, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert('✅ Abono de C$' + fmt(abono) + ' registrado.'); closeModal(); App.refreshCurrentModule();
  };
  const viewCompraDetail = (id) => {
    const c = getData('compras').find(x => x.id === id); if (!c) return;
    const abonos = getData('abonos_cxp').filter(a => a.compraId === id);
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:650px;"><div class="modal__header"><h3 class="modal__title">📄 Detalle Factura: ${c.numFactura}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;font-size:12px;">
        <div><strong>Proveedor:</strong> ${c.proveedorNombre}</div><div><strong>Fecha:</strong> ${fmtD(c.fecha)}</div><div><strong>Método:</strong> ${c.metodo}</div>
        <div><strong>Total:</strong> C$${fmt(c.total)}</div><div><strong>Saldo:</strong> <span style="color:${(c.saldoPendiente || 0) > 0 ? '#ef4444' : '#10b981'};">C$${fmt(c.saldoPendiente || 0)}</span></div><div><strong>Usuario:</strong> ${c.usuario || 'N/A'}</div>
      </div>
      ${c.comentarios ? `<div style="font-size:12px;padding:8px;background:var(--bg-primary);border-radius:4px;margin-bottom:12px;"><strong>Comentarios:</strong> ${c.comentarios}</div>` : ''}
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Productos (${c.items?.length || 0})</div>
      <table class="data-table" style="width:100%;font-size:11px;"><thead><tr><th>Producto</th><th>Cant</th><th>P.Compra</th><th>Total</th></tr></thead><tbody>${(c.items || []).map(it => `<tr><td>${it.nombre}${it.serial ? ' <span style="color:var(--text-muted);">(' + it.serial + ')</span>' : ''}</td><td>${it.cantidad}</td><td>C$${fmt(it.precioCompra)}</td><td>C$${fmt(it.precioCompra * it.cantidad - (it.descuento || 0))}</td></tr>`).join('')}</tbody></table>
      ${abonos.length > 0 ? `<div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;">Abonos Registrados</div>${abonos.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border-color);"><span>${fmtD(a.fecha)} (${a.metodo || 'Efectivo'})</span><strong style="color:#10b981;">C$${fmt(a.monto)}</strong></div>`).join('')}</div>` : ''}
    </div></div></div>`;
  };
  const editCompraFactura = (id) => {
    const compras = getData('compras'); const c = compras.find(x => x.id === id); if (!c) return;
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:450px;"><div class="modal__header"><h3 class="modal__title">✏️ Editar Factura: ${c.numFactura}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.saveEditCompraFactura(event,'${id}')">
      <div class="form-row"><div class="form-group"><label class="form-label">No. Factura</label><input type="text" name="numFactura" class="form-input" value="${c.numFactura}"></div>
      <div class="form-group"><label class="form-label">Fecha</label><input type="date" name="fecha" class="form-input" value="${(c.fecha || '').split('T')[0]}"></div></div>
      <div class="form-group"><label class="form-label">Método</label><select name="metodo" class="form-select">${['efectivo', 'transferencia', 'tarjeta', 'credito'].map(m => `<option value="${m}" ${c.metodo === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Comentarios</label><textarea name="comentarios" class="form-textarea" rows="2">${c.comentarios || ''}</textarea></div>
      ${c.metodo === 'credito' ? `<div class="form-group"><label class="form-label">Fecha Vencimiento</label><input type="date" name="fechaVencimiento" class="form-input" value="${(c.fechaVencimiento || '').split('T')[0]}"></div>` : ''}
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div>
    </form></div></div>`;
  };
  const saveEditCompraFactura = (e, id) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries());
    const compras = getData('compras'); const c = compras.find(x => x.id === id); if (!c) return;
    c.numFactura = fd.numFactura || c.numFactura; c.fecha = fd.fecha || c.fecha;
    c.metodo = fd.metodo || c.metodo; c.comentarios = fd.comentarios || '';
    if (fd.fechaVencimiento) c.fechaVencimiento = fd.fechaVencimiento;
    if (fd.metodo === 'credito' && c.saldoPendiente === 0) c.saldoPendiente = c.total;
    if (fd.metodo !== 'credito') c.saldoPendiente = 0;
    setData('compras', compras); closeModal(); App.refreshCurrentModule();
  };

  // ========== SUB: TRASLADOS ==========
  // Variables de estado del traslado
  // trasladoEmpresaDestino, trasladoBodegaDestino, trasladosCart — already declared above

  const renderTraslados = () => {
    const todasEmpresas = DataService.getEmpresasSync ? DataService.getEmpresasSync() : [];
    const _empresaId = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
    const currentEmpresa = todasEmpresas.find(e => e.id === _empresaId);
    const todasBodegas = DataService.getBodegasSync ? DataService.getBodegasSync() : [];
    const bodegasOrigen = todasBodegas.filter(b => b.empresa_id === _empresaId);

    return `${backBtn()}
    <div style="display:flex;flex-direction:column;gap:0;border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);min-height:calc(100vh - 160px);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#38bdf8,#0284c7);color:white;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:1.1rem;">🚚 Traslado de Inventario</h3>
        <span style="font-size:12px;opacity:0.8;">Empresa Origen: <strong>${currentEmpresa?.nombre || 'Actual'}</strong></span>
      </div>

      <!-- Destino -->
      <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;border-bottom:1px solid var(--border-color);background:var(--bg-primary);">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Empresa Destino *</label>
          <select class="form-select" style="height:32px;" onchange="ProductosModule.setTrasladoField('empresa',this.value)">
            <option value="">Seleccionar Empresa...</option>
            ${todasEmpresas.filter(e => e.id !== _empresaId).map(e => `<option value="${e.id}" ${trasladoEmpresaDestino === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Bodega Destino *</label>
          <select class="form-select" style="height:32px;" id="trasladoBodegaSelect" onchange="ProductosModule.setTrasladoField('bodega',this.value)">
            <option value="">Seleccione primero la empresa...</option>
          </select>
        </div>
      </div>

      <!-- Buscador -->
      <div style="padding:8px 12px;border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:center;background:var(--bg-primary);">
        <div style="position:relative;flex:1;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:.5;">${Icons.search}</span>
          <input type="text" class="form-input" style="padding-left:36px;height:34px;" placeholder="Buscar producto a trasladar por nombre o código..." oninput="ProductosModule.searchTrasladoProduct(this.value)" id="trasladoSearchInput">
          <div id="trasladoSearchResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:4px;max-height:240px;overflow-y:auto;z-index:200;box-shadow:var(--shadow-md);"></div>
        </div>
      </div>

      <!-- Tabla productos a trasladar -->
      <div style="flex:1;overflow-y:auto;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <thead class="data-table__head">
            <tr><th>#</th><th>Producto</th><th>Bodega Origen</th><th>Disp.</th><th>Costo</th><th>A Trasladar</th><th></th></tr>
          </thead>
          <tbody class="data-table__body">
            ${trasladosCart.length === 0
              ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">Agregue productos usando el buscador</td></tr>'
              : trasladosCart.map((it, i) => {
                  const bodegaNombre = bodegasOrigen.find(b => b.id === it.bodegaOrigenId)?.nombre || 'Principal';
                  return `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${it.nombre}</strong><br><span style="font-size:10px;color:var(--text-muted);">${it.codigo || ''}</span></td>
                    <td><span class="badge badge--primary" style="font-size:10px;">${bodegaNombre}</span></td>
                    <td><span class="badge badge--success">${it.stockDisponible}</span></td>
                    <td>C$${fmt(it.costo)}</td>
                    <td><input type="number" class="form-input" style="width:80px;height:28px;" value="${it.cantidad}" min="1" max="${it.stockDisponible}" onchange="ProductosModule.updateTrasladoQty(${i}, this.value)"></td>
                    <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeTrasladoItem(${i})">🗑️</button></td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>
      </div>

      <!-- Footer acciones -->
      <div style="padding:12px 16px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;gap:8px;justify-content:space-between;align-items:center;">
        <button class="btn btn--ghost" onclick="ProductosModule.verHistorialTraslados()">📋 Historial de Traslado</button>
        <div style="display:flex;gap:8px;">
          ${trasladosCart.length > 0 ? `<span style="font-size:12px;color:var(--text-muted);line-height:32px;">${trasladosCart.length} producto(s) | Total: <strong>${trasladosCart.reduce((s,i)=>s+i.cantidad,0)} unidades</strong></span>` : ''}
          <button class="btn btn--primary" onclick="ProductosModule.realizarTraslado()">Realizar Traslado 👉</button>
        </div>
      </div>
    </div>
    <div id="productosModal">${modalContent}</div>`;
  };


  const setTrasladoField = (k, v) => {
    if (k === 'empresa') {
        trasladoEmpresaDestino = v;
        trasladoBodegaDestino = '';
        updateBodegasDestino();
    }
    if (k === 'bodega') {
        trasladoBodegaDestino = v;
    }
  };

  const updateBodegasDestino = () => {
      const select = document.getElementById('trasladoBodegaSelect');
      if(!select) return;
      if (!trasladoEmpresaDestino) {
          select.innerHTML = '<option value="">Seleccione primero la empresa...</option>';
          return;
      }
      const bodegas = DataService.getBodegasSync ? DataService.getBodegasSync() : [];
      const bodegasEmpresa = bodegas.filter(b => b.empresa_id === trasladoEmpresaDestino);
      select.innerHTML = '<option value="">Seleccionar Bodega...</option>' + bodegasEmpresa.map(b => `<option value="${b.id}" ${trasladoBodegaDestino === b.id ? 'selected' : ''}>${b.nombre} (${b.codigo})</option>`).join('');
  };

  let trasladoSearchTimeoutLocal;
  const searchTrasladoProduct = (q) => {
    clearTimeout(trasladoSearchTimeoutLocal); const el = document.getElementById('trasladoSearchResults'); if (!el) return;
    trasladoSearchSelectedIdx = -1;
    if (!q || q.length < 1) { el.style.display = 'none'; trasladoSearchResultIds = []; return; }
    trasladoSearchTimeoutLocal = setTimeout(() => {
      const prods = getProducts().filter(p => { 
          const s = q.toLowerCase(); 
          const disp = parseInt(p.stock ?? p.cantidad ?? 0);
          return disp > 0 && ['nombre', 'codigo', 'codigoAlt', 'sku'].some(k => (p[k] || '').toLowerCase().includes(s)); 
      }).slice(0, 8);
      
      trasladoSearchResultIds = prods.map(p => p.id);
      if (prods.length === 0) { el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);">Sin resultados o sin stock</div>'; el.style.display = 'block'; return; }
      el.innerHTML = prods.map((p, idx) => `<div class="traslado-search-item" data-idx="${idx}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;transition:background 0.1s;" onclick="ProductosModule.addTrasladoProduct('${p.id}')"><div><div style="font-weight:600;">${p.nombre}</div><div style="font-size:10px;color:var(--text-muted);">${p.codigo || ''}</div></div><div style="text-align:right;"><div style="font-weight:700;font-size:12px;color:var(--color-primary-600);">Disp: ${p.stock ?? p.cantidad ?? 0}</div></div></div>`).join('');
      el.style.display = 'block';
    }, 200);
  };

  const addTrasladoProduct = (id) => {
    const p = getProducts().find(x => x.id === id); if (!p) return;
    const el = document.getElementById('trasladoSearchResults'); if (el) el.style.display = 'none';
    const si = document.getElementById('trasladoSearchInput'); if (si) si.value = '';

    const existing = trasladosCart.find(i => i.productId === id);
    const stockDisp = parseInt(p.stock ?? p.stock_actual ?? p.cantidad ?? 0);

    if (existing) {
      if (existing.cantidad < stockDisp) existing.cantidad++;
      else alert('No hay más stock disponible para trasladar');
      App.refreshCurrentModule(); return;
    }

    // Si hay múltiples bodegas en la empresa origen, preguntar cuál
    const _empresaId = (typeof State !== 'undefined' && State.getCurrentUser?.()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
    const todasBodegas = DataService.getBodegasSync ? DataService.getBodegasSync() : [];
    const bodegasOrigen = todasBodegas.filter(b => b.empresa_id === _empresaId);

    const _agregarConBodega = (bodegaOrigenId) => {
      trasladosCart.push({
        productId: id,
        nombre: p.nombre,
        codigo: p.codigo,
        codigoAlt: p.codigoAlt || p.codigo_alternativo || '',
        stockDisponible: stockDisp,
        cantidad: 1,
        costo: parseFloat(p.precioCompra || p.costo || 0),
        precio: parseFloat(p.precioVenta || p.precio || 0),
        bodegaOrigenId: bodegaOrigenId || (bodegasOrigen[0]?.id || ''),
        pRaw: p
      });
      App.refreshCurrentModule();
    };

    if (bodegasOrigen.length <= 1) {
      // Solo una bodega, agregar directo
      _agregarConBodega(bodegasOrigen[0]?.id || '');
    } else {
      // Múltiples bodegas — mostrar mini-modal para elegir
      const overlay = document.createElement('div');
      overlay.id = 'trasladoBodegaOrigenModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
      const opts = bodegasOrigen.map(b => `<button class="btn btn--ghost" style="width:100%;text-align:left;padding:10px 14px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:6px;" onclick="window._selecBodegaOrigen('${b.id}')">${b.nombre} <span style='float:right;font-size:10px;color:var(--text-muted);'>${b.codigo||''}</span></button>`).join('');
      overlay.innerHTML = `<div style="background:var(--bg-primary);border-radius:12px;padding:24px;min-width:320px;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-size:14px;font-weight:700;margin-bottom:16px;">📦 ¿De cuál bodega se toma <strong>${p.nombre}</strong>?</div>
        ${opts}
        <button class="btn btn--secondary" style="width:100%;margin-top:4px;" onclick="document.body.removeChild(document.getElementById('trasladoBodegaOrigenModal'))">Cancelar</button>
      </div>`;
      document.body.appendChild(overlay);
      window._selecBodegaOrigen = (bodId) => {
        document.body.removeChild(document.getElementById('trasladoBodegaOrigenModal'));
        delete window._selecBodegaOrigen;
        _agregarConBodega(bodId);
      };
    }
  };

  const removeTrasladoItem = (idx) => {
      trasladosCart.splice(idx, 1);
      App.refreshCurrentModule();
  };

  const updateTrasladoQty = (idx, val) => {
      const qty = parseInt(val) || 1;
      const it = trasladosCart[idx];
      if (qty > it.stockDisponible) {
          alert('La cantidad supera el stock disponible.');
          it.cantidad = it.stockDisponible;
      } else if (qty < 1) {
          it.cantidad = 1;
      } else {
          it.cantidad = qty;
      }
      App.refreshCurrentModule();
  };

  const realizarTraslado = async () => {
    if (!trasladoEmpresaDestino) { alert('Seleccione la empresa destino.'); return; }
    if (!trasladoBodegaDestino) { alert('Seleccione la bodega destino.'); return; }
    if (trasladosCart.length === 0) { alert('Agregue productos para trasladar.'); return; }

    const _empresaOrigen = (typeof State !== 'undefined' && State.getCurrentUser?.()?.empresa_id) ? State.getCurrentUser().empresa_id : '';
    const todasBodegas = DataService.getBodegasSync ? DataService.getBodegasSync() : [];

    // Determinar bodega origen: si hay un único item con bodega específica o usar la primera
    const _bodegaOrigen = trasladosCart[0]?.bodegaOrigenId
      || localStorage.getItem('bodega_activa')
      || todasBodegas.filter(b => b.empresa_id === _empresaOrigen)[0]?.id
      || '';

    if (!_empresaOrigen) {
      alert('Error: No se pudo determinar la empresa de origen.'); return;
    }
    if (trasladoEmpresaDestino === _empresaOrigen && trasladoBodegaDestino === _bodegaOrigen) {
      alert('La bodega de origen y destino no pueden ser la misma.'); return;
    }

    if (!confirm(`¿Confirmar traslado de ${trasladosCart.reduce((s,i)=>s+i.cantidad,0)} unidades a la empresa destino?`)) return;

    // Mostrar overlay de carga
    const loadingEl = document.createElement('div');
    loadingEl.id = 'trasladoLoading';
    loadingEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
    loadingEl.innerHTML = '<div style="background:white;border-radius:12px;padding:28px 40px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">⏳</div><div style="font-size:15px;font-weight:700;">Procesando traslado...</div><div id="trasladoStatus" style="font-size:12px;color:#64748b;margin-top:6px;">Iniciando...</div></div>';
    document.body.appendChild(loadingEl);
    const setStatus = (msg) => { const el = document.getElementById('trasladoStatus'); if (el) el.textContent = msg; };

    try {
      for (let i = 0; i < trasladosCart.length; i++) {
        const item = trasladosCart[i];
        setStatus(`Procesando ${item.nombre} (${i+1}/${trasladosCart.length})...`);

        // --- PASO 1: Buscar producto en empresa DESTINO (por código Y nombre como fallback) ---
        const prodDestino = await DataService.getProductoByCodigoAndEmpresa(item.codigo, item.codigoAlt, trasladoEmpresaDestino, item.nombre);

        if (!prodDestino) {
          // Crear copia del producto en la empresa destino
          setStatus(`Creando ${item.nombre} en empresa destino...`);
          const pDraft = { ...item.pRaw };
          delete pDraft.id; delete pDraft.created_at; delete pDraft.updated_at;
          // NO borrar codigo - mantener para que búsquedas futuras encuentren el producto
          pDraft.empresa_id = trasladoEmpresaDestino;
          pDraft.bodega_id = trasladoBodegaDestino;
          pDraft.stock_actual = item.cantidad;
          pDraft.stock = item.cantidad;
          // Crear inventario_bodegas con la bodega destino
          const invBodegas = {};
          invBodegas[trasladoBodegaDestino] = item.cantidad;
          pDraft.inventario_bodegas = JSON.stringify(invBodegas);
          const createRes = await DataService.createProducto(pDraft);
          if (!createRes || createRes.error) {
            throw new Error('Error creando producto ' + item.nombre + ': ' + (createRes?.error || 'desconocido'));
          }
        } else {
          // --- PASO 2: Actualizar stock destino DIRECTO en Supabase (no caché) ---
          setStatus(`Actualizando stock en destino: ${item.nombre}...`);
          const stockActualDst = parseInt(prodDestino.stock_actual ?? prodDestino.stock ?? 0);
          const nuevoStockDst = stockActualDst + item.cantidad;

          // Actualizar inventario_bodegas del destino
          let invBodDst = {};
          try { invBodDst = prodDestino.inventario_bodegas ? (typeof prodDestino.inventario_bodegas === 'string' ? JSON.parse(prodDestino.inventario_bodegas) : prodDestino.inventario_bodegas) : {}; } catch(e){}
          invBodDst[trasladoBodegaDestino] = (parseInt(invBodDst[trasladoBodegaDestino]) || 0) + item.cantidad;

          if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.client) {
            const { error: dstErr } = await SupabaseDataService.client
              .from('productos')
              .update({ stock_actual: nuevoStockDst, inventario_bodegas: JSON.stringify(invBodDst) })
              .eq('id', prodDestino.id);
            if (dstErr) throw new Error('Error actualizando stock destino: ' + dstErr.message);
          } else {
            await DataService.updateProducto(prodDestino.id, { stock_actual: nuevoStockDst, stock: nuevoStockDst, inventario_bodegas: JSON.stringify(invBodDst) });
          }
        }

        // --- PASO 3: Restar stock en ORIGEN directo en Supabase ---
        setStatus(`Reduciendo stock en origen: ${item.nombre}...`);
        const nuevoStockOrig = Math.max(0, (item.stockDisponible || 0) - item.cantidad);

        // Actualizar inventario_bodegas del origen
        let invBodOrig = {};
        try { invBodOrig = item.pRaw?.inventario_bodegas ? (typeof item.pRaw.inventario_bodegas === 'string' ? JSON.parse(item.pRaw.inventario_bodegas) : item.pRaw.inventario_bodegas) : {}; } catch(e){}
        const bodOrgId = item.bodegaOrigenId || _bodegaOrigen;
        if (bodOrgId && invBodOrig[bodOrgId] !== undefined) {
          invBodOrig[bodOrgId] = Math.max(0, (parseInt(invBodOrig[bodOrgId]) || 0) - item.cantidad);
        }

        if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.client) {
          const { error: srcErr } = await SupabaseDataService.client
            .from('productos')
            .update({ stock_actual: nuevoStockOrig, inventario_bodegas: JSON.stringify(invBodOrig) })
            .eq('id', item.productId);
          if (srcErr) throw new Error('Error reduciendo stock origen: ' + srcErr.message);
        } else {
          await DataService.updateProducto(item.productId, { stock_actual: nuevoStockOrig, stock: nuevoStockOrig, inventario_bodegas: JSON.stringify(invBodOrig) });
        }
      }

      // --- PASO 4: Registrar en inventario_traslados ---
      setStatus('Registrando historial...');
      if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.client) {
        const currentUser = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
        await SupabaseDataService.client.from('inventario_traslados').insert([{
          empresa_origen_id: _empresaOrigen,
          bodega_origen_id: _bodegaOrigen,
          empresa_destino_id: trasladoEmpresaDestino,
          bodega_destino_id: trasladoBodegaDestino,
          usuario: currentUser?.name || currentUser?.username || 'Sistema',
          items: JSON.stringify(trasladosCart.map(it => ({
            nombre: it.nombre, codigo: it.codigo,
            cantidad: it.cantidad, costo: it.costo, precio: it.precio, precios: it.pRaw?.precios || it.pRaw?.masPrecios || null
          }))),
          estado: 'Completado'
        }]);
      }

      // --- PASO 5: Recargar caché con datos frescos de Supabase ---
      setStatus('Actualizando inventario...');
      await DataService.refreshData();

      document.body.removeChild(loadingEl);
      trasladosCart = [];
      trasladoEmpresaDestino = '';
      trasladoBodegaDestino = '';
      alert('✅ Traslado realizado exitosamente. El inventario ha sido actualizado.');
      if (typeof App !== 'undefined' && App.render) App.render();
      else if (typeof App !== 'undefined' && App.refreshCurrentModule) App.refreshCurrentModule();

    } catch(err) {
      const le = document.getElementById('trasladoLoading');
      if (le) document.body.removeChild(le);
      alert('❌ Error durante el traslado: ' + err.message);
      console.error('Error traslado:', err);
    }
  };




  const savePedido = (e, id) => {
    e.preventDefault();
    alert('✅ Pedido guardado exitosamente.');
    closeAuxModal();
    closeModal();
  };

  const closeUnidadesModal = () => closeAuxModal();

  // ========== COMPRA FUNCTIONS ==========
  const confirmAddCompra = (e, prodId) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const cantidad = parseFloat(fd.cantidad) || 1;
    const precioCompra = parseFloat(fd.precioCompra) || 0;
    const precioVenta = parseFloat(fd.precioVenta) || 0;
    const descuento = parseFloat(fd.descuento) || 0;
    const tieneSerial = fd.tieneSerial === '1';
    const serial = fd.serial || '';
    const serialListRaw = fd.serialList || '[]';
    let serialList = [];
    try { serialList = JSON.parse(serialListRaw); } catch(ex) {}

    // Calcular distribución por bodega
    const allBodegas = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
    const empresaId = typeof State !== 'undefined' && State.getCurrentUser()?.empresa_id ? State.getCurrentUser().empresa_id : null;
    const bodegas = empresaId ? allBodegas.filter(b => b.empresa_id === empresaId) : allBodegas;
    const bodegaDist = {};
    let totalDistrib = 0;
    bodegas.forEach(b => {
      const qty = parseFloat(fd['bodega_qty_' + b.id]) || 0;
      if (qty > 0) { bodegaDist[b.id] = qty; totalDistrib += qty; }
    });
    if (totalDistrib > 0 && totalDistrib !== cantidad) {
      alert('La distribución por bodegas (' + totalDistrib + ') no coincide con la cantidad (' + cantidad + ').');
      return;
    }

    // Guardar extra precios si hay
    const listaPrecios = getPosData('pos_lista_precios') || [];
    const extraPrecios = [];
    listaPrecios.forEach(lp => {
      const epVal = parseFloat(fd['extraPrecio_' + lp.codigo]) || 0;
      if (epVal > 0) extraPrecios.push({ codigo: lp.codigo, nombre: lp.nombre, precio: epVal });
    });

    const p = getProducts().find(x => x.id === prodId);
    compraCart.push({
      productId: prodId,
      nombre: p?.nombre || 'Producto',
      codigo: p?.codigo || '',
      cantidad,
      precioCompra,
      precioVenta,
      descuento,
      serial: tieneSerial ? serial : '',
      serialList: tieneSerial ? serialList : [],
      bodegaDist,
      extraPrecios
    });
    closeModal();
    App.refreshCurrentModule();
  };

  const removeCompraItem = (idx) => {
    if (idx < 0 || idx >= compraCart.length) return;
    if (!confirm('¿Eliminar este producto de la compra?')) return;
    compraCart.splice(idx, 1);
    if (compraSelectedItem >= compraCart.length) compraSelectedItem = compraCart.length - 1;
    App.refreshCurrentModule();
  };

  const editCompraItem = (idx) => {
    if (idx < 0 || idx >= compraCart.length) return;
    const it = compraCart[idx];
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = '<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">Editar: ' + it.nombre + '</h3><button class="modal__close" onclick="ProductosModule.closeModal()">' + Icons.x + '</button></div>' +
    '<form class="modal__body" onsubmit="ProductosModule.confirmEditCompraItem(event,' + idx + ')">' +
    '<div class="form-row"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" name="cantidad" class="form-input" value="' + it.cantidad + '" min="1" step="1" required></div>' +
    '<div class="form-group"><label class="form-label">P.Compra</label><input type="number" step="0.01" name="precioCompra" class="form-input" value="' + it.precioCompra + '"></div></div>' +
    '<div class="form-row"><div class="form-group"><label class="form-label">P.Venta</label><input type="number" step="0.01" name="precioVenta" class="form-input" value="' + it.precioVenta + '"></div>' +
    '<div class="form-group"><label class="form-label">Descuento</label><input type="number" step="0.01" name="descuento" class="form-input" value="' + (it.descuento || 0) + '"></div></div>' +
    '<div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div></form></div></div>';
  };

  const confirmEditCompraItem = (e, idx) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (idx >= 0 && idx < compraCart.length) {
      compraCart[idx].cantidad = parseFloat(fd.cantidad) || 1;
      compraCart[idx].precioCompra = parseFloat(fd.precioCompra) || 0;
      compraCart[idx].precioVenta = parseFloat(fd.precioVenta) || 0;
      compraCart[idx].descuento = parseFloat(fd.descuento) || 0;
    }
    closeModal();
    App.refreshCurrentModule();
  };

  const setCompraDescGlobal = () => {
    const val = prompt('Descuento global para esta compra (monto C$):', compraDescGlobal || '0');
    if (val === null) return;
    compraDescGlobal = parseFloat(val) || 0;
    App.refreshCurrentModule();
  };

  const applyCompraDescGlobal = (val) => {
    compraDescGlobal = parseFloat(val) || 0;
    App.refreshCurrentModule();
  };

  const saveCompra = async () => {
    if (compraCart.length === 0) { alert('Agregue al menos un producto.'); return; }
    if (!compraProveedor) { alert('Seleccione un proveedor.'); return; }
    const provs = getData('proveedores');
    const provObj = provs.find(p => p.id === compraProveedor);
    const subtotal = compraCart.reduce((s, i) => s + (i.precioCompra * i.cantidad), 0);
    const descTotal = compraCart.reduce((s, i) => s + (i.descuento || 0), 0) + compraDescGlobal;
    const total = subtotal - descTotal;
    const numFact = compraNumFactura || ('CMP-' + Date.now().toString(36).toUpperCase());
    const compra = {
      numFactura: numFact,
      numero_factura_proveedor: numFact,
      proveedor: compraProveedor,
      proveedorId: compraProveedor,
      proveedor_id: compraProveedor,
      proveedorNombre: provObj?.razonSocial || compraProveedor,
      proveedor_nombre: provObj?.razonSocial || compraProveedor,
      fecha: compraFecha || new Date().toISOString(),
      metodo: compraMetodo,
      metodo_pago: compraMetodo,
      items: compraCart,
      subtotal, descTotal, total,
      comentarios: compraComentarios,
      transfBanco: compraTransfBanco,
      transfRef: compraTransfRef,
      fechaVencimiento: compraFechaVenc,
      fecha_vencimiento: compraFechaVenc,
      saldoPendiente: compraMetodo === 'credito' ? total : 0,
      tipo_compra: compraMetodo === 'credito' ? 'credito' : 'contado',
      usuario: user()?.name || 'Sistema'
    };

    // Save to Supabase via DataService
    try {
      if (typeof DataService !== 'undefined' && DataService.createCompra) {
        const saved = await DataService.createCompra(compra);
        if (saved) compra.id = saved.id;
      } else {
        // Fallback localStorage
        compra.id = Date.now().toString(36);
        const compras = getData('compras');
        compras.push(compra);
        setData('compras', compras);
      }
    } catch(e) {
      console.error('Error guardando compra:', e);
      // Fallback localStorage
      compra.id = compra.id || Date.now().toString(36);
      const compras = getData('compras');
      compras.push(compra);
      setData('compras', compras);
    }

    // Actualizar stock por bodega
    compraCart.forEach(it => {
      if (it.bodegaDist && Object.keys(it.bodegaDist).length > 0) {
        Object.entries(it.bodegaDist).forEach(([bodId, qty]) => {
          const key = 'prod_bodegas_' + bodId + '_' + it.productId;
          const current = parseInt(localStorage.getItem(key)) || 0;
          localStorage.setItem(key, JSON.stringify(current + qty));
        });
      }
      // Actualizar extra precios
      if (it.extraPrecios && it.extraPrecios.length > 0) {
        localStorage.setItem('prod_extra_precios_' + it.productId + getEmpresaSuffix(), JSON.stringify(it.extraPrecios));
      }
      // Actualizar precio del producto
      if (it.precioVenta > 0 || it.precioCompra > 0) {
        try {
          DataService.updateProducto(it.productId, {
            precioCompra: it.precioCompra,
            precioVenta: it.precioVenta,
            precio: it.precioVenta,
            costo: it.precioCompra
          });
        } catch(ex) { console.error('Error actualizando producto:', ex); }
      }
      // Guardar seriales si existen
      if (it.serialList && it.serialList.length > 0) {
        const tipo = 'serie';
        const existing = getTrackingData(it.productId, tipo);
        it.serialList.forEach(s => {
          existing.push({ id: Date.now().toString() + Math.random(), numero: s, vendido: false, cantidad: 1, fechaRegistro: new Date().toISOString() });
        });
        saveTrackingData(it.productId, tipo, existing);
      }
    });

    alert('Compra ' + numFact + ' registrada exitosamente por C$' + fmt(total));
    compraCart = []; compraProveedor = ''; compraMetodo = 'efectivo';
    compraDescGlobal = 0; compraNumFactura = ''; compraComentarios = '';
    compraTransfBanco = ''; compraTransfRef = ''; compraFechaVenc = '';
    compraSelectedItem = -1; compraFecha = new Date().toISOString().split('T')[0];
    App.refreshCurrentModule();
  };

  const selectCompraItem = (idx) => {
    compraSelectedItem = idx;
    App.refreshCurrentModule();
  };

  const calcBodegaDistrib = (mode) => {
    const cantInput = document.querySelector('#productosModal [name="cantidad"]');
    const total = parseFloat(cantInput?.value) || 0;
    const allBodegas = typeof DataService !== 'undefined' ? DataService.getBodegasSync() : [];
    const empresaId = typeof State !== 'undefined' && State.getCurrentUser()?.empresa_id ? State.getCurrentUser().empresa_id : null;
    const bodegas = empresaId ? allBodegas.filter(b => b.empresa_id === empresaId) : allBodegas;
    let assigned = 0;
    bodegas.forEach(b => {
      const inp = document.querySelector('#productosModal [name="bodega_qty_' + b.id + '"]');
      if (inp) assigned += parseFloat(inp.value) || 0;
    });
    const counter = document.getElementById('bodegaDistribCounter');
    if (counter) {
      const restante = total - assigned;
      const color = restante === 0 ? '#10b981' : '#ef4444';
      const bg = restante === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
      counter.style.background = bg;
      counter.style.color = color;
      counter.textContent = 'Restante: ' + restante + ' / Total: ' + total;
    }
  };

  const toggleSerialPanel = (chk) => {
    const panel = document.getElementById('serialField') || document.getElementById('serialesPanelConfig');
    if (panel) panel.style.display = chk.checked ? 'block' : 'none';
    // For product form
    if (chk.form && chk.form.usaSeriales) {
      chk.form.usaSeriales.value = chk.checked ? 'true' : 'false';
      chk.parentElement.style.background = chk.checked ? 'rgba(56,189,248,0.1)' : 'transparent';
      if (!chk.checked && chk.form.tipoSeguimiento) {
        chk.form.tipoSeguimiento.value = '';
        const radios = document.querySelectorAll('[name=tipoSeguimientoRadio]');
        radios.forEach(r => { r.checked = false; r.parentElement.style.borderColor = 'var(--border-color)'; r.parentElement.style.background = 'var(--bg-primary)'; });
      }
    }
  };

  let compraSerialList = [];
  const addSerialToList = () => {
    const inp = document.getElementById('serialNewInput');
    const val = (inp?.value || '').trim();
    if (!val) { alert('Escriba un número de serie.'); return; }
    if (compraSerialList.includes(val)) { alert('Ya existe: ' + val); return; }
    compraSerialList.push(val);
    inp.value = '';
    renderSerialList();
    inp.focus();
  };

  const removeSerialFromList = (idx) => {
    compraSerialList.splice(idx, 1);
    renderSerialList();
  };

  const renderSerialList = () => {
    const container = document.getElementById('serialListContainer');
    const counter = document.getElementById('serialCounter');
    const hidden = document.getElementById('serialListHidden');
    const cantInput = document.querySelector('#productosModal [name="cantidad"]');
    const total = parseFloat(cantInput?.value) || 0;

    if (hidden) hidden.value = JSON.stringify(compraSerialList);
    if (counter) counter.textContent = compraSerialList.length + ' / ' + total;

    if (!container) return;
    if (compraSerialList.length === 0) {
      container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">Sin números registrados</div>';
      return;
    }
    container.innerHTML = compraSerialList.map((s, i) =>
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--border-color);font-size:11px;">' +
      '<span style="font-family:monospace;font-weight:600;">' + (i+1) + '. ' + s + '</span>' +
      '<button type="button" class="btn btn--ghost btn--icon btn--sm text-danger" style="padding:2px;" onclick="ProductosModule.removeSerialFromList(' + i + ')">×</button></div>'
    ).join('');
  };

  
  const openProveedorModal = (id = null) => {
    // If it's an event (e.g. from onclick="openProveedorModal(event)"), ignore
    if (id && typeof id === 'object') id = null;

    let p = {};
    if (id) {
        p = typeof DataService !== 'undefined' ? DataService.getProveedorById(id) : {};
        if (!p) {
            const provs = getData('proveedores');
            p = provs.find(x => x.id === id) || {};
        }
    }

    const modal = document.getElementById('productosModal'); if (!modal) return;
    
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:500px;"><div class="modal__header"><h3 class="modal__title">${id ? 'Editar' : 'Nuevo'} Proveedor</h3><button type="button" class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.saveProveedor(event, '${id || ''}')">
      <div class="form-row">
        <div class="form-group"><label class="form-label form-label--required">Razón Social</label><input type="text" name="razonSocial" class="form-input" value="${p.razonSocial || p.razon_social || ''}" required></div>
        <div class="form-group"><label class="form-label">RUC</label><input type="text" name="ruc" class="form-input" value="${p.ruc || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tipo de Proveedor</label>
        <div style="display:flex;gap:4px;">
          <select name="tipoProveedor" class="form-select" style="flex:1;">
            <option value="">Seleccionar...</option>
            ${(() => {
                let r = '';
                const baseTypes = [];
                let t = (p.tipoProveedor || p.tipo_proveedor || '');
                const custom = getData('prov_tipos'); 
                const allTypes = [...new Set([...baseTypes, ...custom.map(x=>x.nombre)])];
                if (t && !allTypes.includes(t)) allTypes.push(t);
                allTypes.forEach(x => { r += `<option value="${x}" ${t === x ? 'selected' : ''}>${x}</option>`; });
                return r;
            })()}
          </select>
          <button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.addProvTipo()" title="Nuevo Tipo">+</button>
        </div>
        </div>
        <div class="form-group"><label class="form-label">Teléfono</label><input type="text" name="telefono" class="form-input" value="${p.telefono || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Ciudad</label><input type="text" name="ciudad" class="form-input" value="${p.ciudad || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Dirección</label><input type="text" name="direccion" class="form-input" value="${p.direccion || ''}"></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div>
    </form></div></div>`;
  };

  const saveProveedor = async (e, id) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const prov = {
      razonSocial: fd.razonSocial,
      ruc: fd.ruc,
      tipoProveedor: fd.tipoProveedor,
      telefono: fd.telefono,
      ciudad: fd.ciudad,
      direccion: fd.direccion
    };
    try {
      if (id && id !== 'undefined' && id !== 'null') {
        if (typeof DataService !== 'undefined' && DataService.updateProveedor) {
            await DataService.updateProveedor(id, prov);
        } else {
            // fallback local
            const provs = getData('proveedores');
            const idx = provs.findIndex(p => p.id === id);
            if (idx >= 0) { provs[idx] = { ...provs[idx], ...prov }; setData('proveedores', provs); }
        }
      } else {
        if (typeof DataService !== 'undefined' && DataService.createProveedor) {
            const created = await DataService.createProveedor(prov);
            if (currentView === 'compras') compraProveedor = created.id;
        } else {
            // fallback local
            const provs = getData('proveedores');
            const createdId = Date.now().toString(36);
            provs.push({ id: createdId, ...prov, fechaRegistro: new Date().toISOString() });
            setData('proveedores', provs);
            if (currentView === 'compras') compraProveedor = createdId;
        }
      }
      closeModal();
      App.refreshCurrentModule();
    } catch(err) {
      alert('Error guardando proveedor: ' + err.message);
    }
  };

  const deleteProveedor = async (id) => {
    const comprasProv = getData('compras').filter(c => c.proveedorId === id);
    const pendingCredits = comprasProv.filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0);
    
    if (pendingCredits.length > 0) {
        alert(`No se puede borrar este proveedor. Tiene ${pendingCredits.length} factura(s) de crédito con saldo pendiente.`);
        return;
    }

    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
        if (typeof DataService !== 'undefined' && DataService.deleteProveedor) {
            await DataService.deleteProveedor(id);
        } else {
            const provs = getData('proveedores').filter(p => p.id !== id);
            setData('proveedores', provs);
        }
        App.refreshCurrentModule();
    } catch(err) {
        alert('Error eliminando: ' + err.message);
    }
  };
  const addProvTipo = () => {
    const pData = getData('prov_tipos');
    const existing = [...pData.map(x => x.nombre)];
    
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">Gestión de Tipos</h3><button type="button" class="modal__close" onclick="ProductosModule.openProveedorModal()">${Icons.x}</button></div>
    <div class="modal__body" style="padding:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">TIPOS EXISTENTES</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
             ${existing.length === 0 ? '<span style="color:var(--text-muted);font-size:12px;">Sin tipos adicionales.</span>' : existing.map(e => `<span class="badge badge--neutral">${e}</span>`).join('')}
        </div>
        <div class="form-group"><label class="form-label form-label--required">Registrar Nuevo Tipo</label><input type="text" id="nuevoTipoInput" class="form-input" placeholder="Ej: Importador, Local, Preferencial..." ></div>
        <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.openProveedorModal()">⬅ Volver</button><button type="button" class="btn btn--primary" onclick="ProductosModule.confirmAddProvTipo()">Agregar y Seleccionar</button></div>
    </div>
    </div></div>`;
    setTimeout(()=>document.getElementById('nuevoTipoInput')?.focus(), 100);
  };

  const confirmAddProvTipo = () => {
    const input = document.getElementById('nuevoTipoInput');
    const v = input ? input.value.trim() : '';
    if (!v) { if (input) input.focus(); return; }
    const p = getData('prov_tipos');
    if (p.some(x => x.nombre.toLowerCase() === v.toLowerCase())) { alert('Ese tipo ya existe.'); return; }
    p.push({ id: Date.now().toString(), nombre: v });
    setData('prov_tipos', p);
    closeModal();
    openProveedorModal();
    setTimeout(() => { const sel = document.querySelector('select[name=tipoProveedor]'); if (sel) sel.value = v; }, 200);
  };

  const registrarPagoCompra = (compraId) => {
    const c = getData('compras').find(x => x.id === compraId);
    if (!c) { alert('Compra no encontrada.'); return; }
    const modal = document.getElementById('productosModal'); if (!modal) return;

    // Obtener cuentas bancarias guardadas en localStorage
    const bancos = (() => {
      try { return JSON.parse(localStorage.getItem('fin_bancos') || '[]'); } catch(e) { return []; }
    })();

    const bancosSelect = bancos.filter(b => b.tipo === 'banco' || b.activo !== false).map(b =>
      `<option value="${b.id}||${b.nombre}">${b.nombre}${b.numero ? ' - ' + b.numero : ''}</option>`
    ).join('');

    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:420px;">
      <div class="modal__header"><h3 class="modal__title">💰 Registrar Abono</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
      <form class="modal__body" onsubmit="ProductosModule.confirmPagoCompra(event,'${compraId}')">
        <div style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.06);border-radius:6px;border:1px solid rgba(239,68,68,0.2);font-size:12px;">
          <div>Factura: <strong>${c.numFactura}</strong> &nbsp;|&nbsp; Proveedor: <strong>${c.proveedorNombre || 'N/A'}</strong></div>
          <div style="margin-top:4px;">Saldo pendiente: <strong style="color:#ef4444;font-size:14px;">C$${fmt(c.saldoPendiente || 0)}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label form-label--required">Monto del Abono</label>
          <input type="number" step="0.01" name="monto" class="form-input" required placeholder="0.00" max="${c.saldoPendiente || 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Método de Pago</label>
          <select name="metodo" class="form-select" id="cxpMetodoPago" onchange="ProductosModule.cxpToggleBancoField(this.value)">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia Bancaria</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
        <div id="cxpBancoField" style="display:none;">
          <div class="form-group">
            <label class="form-label">Cuenta Bancaria</label>
            ${bancos.length > 0
              ? `<select name="cuentaBancaria" class="form-select">
                  <option value="">Seleccionar cuenta...</option>
                  ${bancosSelect}
                </select>`
              : `<div style="padding:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:12px;color:#92400e;">
                  ⚠️ No hay cuentas bancarias registradas. Agrégalas en el módulo Finanzas &rarr; Bancos.
                </div>`
            }
          </div>
          <div class="form-group">
            <label class="form-label">No. Referencia / Transacción</label>
            <input type="text" name="referencia" class="form-input" placeholder="Ej: TRF-2024-001">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <input type="text" name="observaciones" class="form-input" placeholder="Notas adicionales...">
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn--primary">✅ Registrar Abono</button>
        </div>
      </form></div></div>`;
  };

  const cxpToggleBancoField = (metodo) => {
    const el = document.getElementById('cxpBancoField');
    if (el) el.style.display = metodo === 'transferencia' || metodo === 'cheque' ? 'block' : 'none';
  };

  // ========== HISTORIAL DE TRASLADOS ==========
  const _fmtNum = (n) => parseFloat(n||0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const verHistorialTraslados = async () => {
    // Crear overlay propio en el body (independiente del productosModal)
    const overlayId = 'historialTrasladosGlobal';
    let overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove(); // Limpiar previo

    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99998;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div class="modal" style="max-width:960px;width:95vw;max-height:90vh;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;" onclick="event.stopPropagation()">
      <div class="modal__header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);">
        <h3 class="modal__title">📋 Historial de Traslados de Inventario</h3>
        <button class="modal__close" onclick="document.getElementById('${overlayId}')?.remove()">✕</button>
      </div>
      <div id="historialTrasladosBody" class="modal__body" style="padding:1rem;overflow-y:auto;flex:1;">
        <div style="text-align:center;padding:3rem;"><div style="font-size:2rem;">⏳</div><div>Cargando historial...</div></div>
      </div>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    try {
      if (typeof SupabaseDataService === 'undefined' || !SupabaseDataService.client) {
        document.getElementById('historialTrasladosBody').innerHTML = '<div style="color:#ef4444;padding:1rem;">Error: Servicio de base de datos no disponible.</div>';
        return;
      }
      const { data, error } = await SupabaseDataService.client
        .from('inventario_traslados')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      const empresasMap = {};
      (DataService.getEmpresasSync ? DataService.getEmpresasSync() : []).forEach(e => { empresasMap[e.id] = e.nombre; });
      const bodegasMap = {};
      (DataService.getBodegasSync ? DataService.getBodegasSync() : []).forEach(b => { bodegasMap[b.id] = b.nombre; });

      const bodyEl = document.getElementById('historialTrasladosBody');
      if (!bodyEl) return;

      if (error) { bodyEl.innerHTML = `<div style="color:#ef4444;padding:1rem;">Error: ${error.message}</div>`; return; }
      if (!data || data.length === 0) { bodyEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">No hay traslados registrados aún.</div>'; return; }

      const rows = data.map(t => {
        let items = [];
        try { items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items || []); } catch(ex) { items = []; }
        const fecha = new Date(t.created_at).toLocaleString('es-NI', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const origenEmp = empresasMap[t.empresa_origen_id] || t.empresa_origen_id || '—';
        const origenBod = bodegasMap[t.bodega_origen_id] || t.bodega_origen_id || '—';
        const destinoEmp = empresasMap[t.empresa_destino_id] || t.empresa_destino_id || '—';
        const destinoBod = bodegasMap[t.bodega_destino_id] || t.bodega_destino_id || '—';
        const totalUnits = items.reduce((s, i) => s + (i.cantidad || 0), 0);
        const productosHtml = items.length > 0
          ? items.map(i => {
              let pVentas = i.precios ? (Array.isArray(i.precios) ? i.precios.map(p => p.nombrePrecio + ': C$' + _fmtNum(p.monto||0)).join(' | ') : 'Precio Público: C$' + _fmtNum(i.precio||0)) : 'Precio Público: C$' + _fmtNum(i.precio||0);
              return `<div style="font-size:10px;padding:4px 0;border-bottom:1px dashed var(--border-color);display:flex;flex-direction:column;gap:2px;">
                <div style="display:flex;justify-content:space-between;"><span><strong>${i.nombre}</strong> ${i.codigo ? '('+i.codigo+')' : ''}</span><span>x<strong>${i.cantidad}</strong></span></div>
                <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:9px;"><span>Costo: C$${_fmtNum(i.costo||0)}</span> <span>${pVentas}</span></div>
              </div>`;
            }).join('')
          : '<span style="font-size:10px;color:var(--text-muted);">Sin detalle</span>';
        
        return `<tr>
          <td style="font-size:11px;white-space:nowrap;"><strong>${fecha}</strong></td>
          <td style="font-size:11px;">${origenEmp}<br><span style="color:var(--text-muted);font-size:10px;">${origenBod}</span></td>
          <td style="font-size:11px;">➡️ ${destinoEmp}<br><span style="color:var(--text-muted);font-size:10px;">${destinoBod}</span></td>
          <td style="font-size:11px;"><span style="background:var(--bg-secondary);padding:2px 4px;border-radius:4px;">👤 ${t.usuario || 'Sistema'}</span></td>
          <td style="padding:0;min-width:240px;">${productosHtml}</td>
          <td style="text-align:center;"><strong style="font-size:13px;">${totalUnits}</strong><br><span style="font-size:9px;color:var(--text-muted);">unidades</span></td>
          <td><span class="badge badge--success" style="font-size:10px;">${t.estado || 'Completado'}</span></td>
        </tr>`;
      }).join('');

      bodyEl.innerHTML = `<div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <thead class="data-table__head">
            <tr><th>Fecha/Hora</th><th>Origen</th><th>Destino</th><th>Usuario</th><th>Productos</th><th>Total</th><th>Estado</th></tr>
          </thead>
          <tbody class="data-table__body">${rows}</tbody>
        </table>
      </div>`;
    } catch(ex) {
      const bodyEl = document.getElementById('historialTrasladosBody');
      if (bodyEl) bodyEl.innerHTML = `<div style="color:#ef4444;padding:1rem;">Error inesperado: ${ex.message}</div>`;
    }
  };



  // ========== PUBLIC API ==========
  return {
    closeAuxModal, addProveedorModal, saveMasPrecios, closeUnidadesModal,
    render, navigateTo, handleSearch, setFilter, toggleBajoStock, setPageSize, selectRow, prevPage, nextPage,
    openCreateModal, openEditModal, editSelected, deleteSelected, closeModal, handleSubmit, deleteItem,
    importModal, historialModal, statsModal, etiquetasModal, pedidoModal, savePedido,
    calcGanancia, calcPrecioVenta, toggleSerialesPanel, setTipoSeguimiento, closeTrackingModal, addLote, addSerial, removeTracking, getTrackingDisponibles, marcarTrackingVendido, openUnidadesModal, addUnidad, removeUnidad, viewDetalles,
    openMasPreciosModal, saveExtraPrecios,
    handleFotosUpload, removeFoto, renderProductImageCarousel, nextImage, openImageFullscreen,
    openDeptosModal, addDepto, removeDepto,
    setCompraField, searchCompraProduct, handleCompraSearchKeydown, highlightCompraSearchItem, addCompraProduct, confirmAddCompra, removeCompraItem, editCompraItem, confirmEditCompraItem, setCompraDescGlobal, applyCompraDescGlobal, saveCompra, selectCompraItem, calcBodegaDistrib, toggleSerialPanel, addSerialToList, removeSerialFromList,
    openProveedorModal, addProvTipo, confirmAddProvTipo, saveProveedor, deleteProveedor, setProvFiltro, selectProvRow, showProveedorHistorial,
    registrarPagoCompra, confirmPagoCompra, viewCompraDetail, editCompraFactura, saveEditCompraFactura, setHistFiltro,
    openPromoModal, savePromo, deletePromo,
    setTrasladoField, updateBodegasDestino, searchTrasladoProduct, addTrasladoProduct, removeTrasladoItem, updateTrasladoQty, realizarTraslado, verHistorialTraslados,
    cxpSetFiltro, cxpLimpiarFiltros, cxpToggleAgrupada, cxpExportarExcel, cxpExportarPDF, cxpToggleBancoField,
    getData, setData,
    handleTipoFilter: (v) => setFilter('tipo', v),
    handleEstadoFilter: (v) => setFilter('estado', v)
  };
})();
