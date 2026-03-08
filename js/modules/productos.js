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
  let modalContent = '';

  const SK = {
    compras: 'prod_compras', proveedores: 'prod_proveedores', cxp: 'prod_cxp',
    abonos_cxp: 'prod_abonos_cxp', prov_tipos: 'prod_prov_tipos'
  };
  const getData = (k) => { try { return JSON.parse(localStorage.getItem(SK[k]) || '[]'); } catch { return []; } };
  const setData = (k, d) => localStorage.setItem(SK[k], JSON.stringify(d));
  const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const addRec = (k, r) => { const d = getData(k); r.id = genId(); r.created_at = new Date().toISOString(); d.unshift(r); setData(k, d); return r; };
  const fmt = (n) => parseFloat(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = (d) => d ? new Date(d).toLocaleDateString('es-NI') : 'N/A';
  const getProducts = () => (typeof DataService !== 'undefined' && DataService.getProductosSync) ? DataService.getProductosSync() : [];
  const getPosData = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
  const user = () => State.get('user');

  // ========== NAVIGATION ==========
  const navigateTo = (v) => { currentView = v; selectedRow = -1; currentPage = 0; App.render(); };

  const tile = (id, icon, name, desc, color, bg, badge) => `<div class="ventas-tile" onclick="ProductosModule.navigateTo('${id}')"><div class="ventas-tile__icon" style="background:${bg};color:${color};">${icon}</div><div class="ventas-tile__name">${name}</div><div class="ventas-tile__desc">${desc}</div><div class="ventas-tile__badge" style="background:${bg};color:${color};">${badge}</div></div>`;
  const backBtn = () => `<button class="btn btn--ghost btn--sm" onclick="ProductosModule.navigateTo('dashboard')" style="margin-bottom:var(--spacing-md);">⬅ Volver al Panel</button>`;

  // ========== RENDER ==========
  const render = () => {
    const views = {
      dashboard: renderDashboard, productos: renderProductos, compras: renderCompras,
      'historial-compras': renderHistorialCompras, proveedores: renderProveedores,
      'cuentas-pagar': renderCuentasPagar, promociones: renderPromociones,
      inventario: renderInventario, reportes: renderReportesProductos
    };
    const html = (views[currentView] || renderDashboard)();
    if (currentView === 'productos') setTimeout(() => setupKeyboardNav(), 100);
    return html;
  };
  const setupKeyboardNav = () => {
    if (window._prodKeyNav) return; window._prodKeyNav = true;
    document.addEventListener('keydown', (e) => {
      if (currentView !== 'productos') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const allProds = getProducts(); const total = allProds.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); selectedRow = Math.min(selectedRow + 1, total - 1); App.refreshCurrentModule(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selectedRow = Math.max(selectedRow - 1, 0); App.refreshCurrentModule(); }
      else if (e.key === 'Enter' && selectedRow >= 0 && allProds[selectedRow]) { e.preventDefault(); openEditModal(allProds[selectedRow].id); }
      else if (e.key === 'Delete' && selectedRow >= 0 && allProds[selectedRow]) { e.preventDefault(); deleteItem(allProds[selectedRow].id); }
    });
  };

  // ========== DASHBOARD ==========
  const renderDashboard = () => {
    const prods = getProducts();
    const provs = getData('proveedores');
    const compras = getData('compras');
    const bajoStock = prods.filter(p => p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo).length;
    const totalInv = prods.reduce((s, p) => s + (parseFloat(p.precioCompra || p.costo || 0) * (p.stock || p.cantidad || 0)), 0);
    return `
      <div class="ventas-header"><div class="ventas-header__title">${Icons.package} Productos y Servicios</div>
        <div class="ventas-kpis">
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('productos')"><div class="ventas-kpi__label">Productos</div><div class="ventas-kpi__value" style="color:#3b82f6;">${prods.length}</div><div class="ventas-kpi__sub">Registrados</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('productos')"><div class="ventas-kpi__label">Bajo Stock</div><div class="ventas-kpi__value" style="color:#ef4444;">${bajoStock}</div><div class="ventas-kpi__sub">⚠️ Alertas</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('proveedores')"><div class="ventas-kpi__label">Proveedores</div><div class="ventas-kpi__value" style="color:#8b5cf6;">${provs.length}</div><div class="ventas-kpi__sub">Activos</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('compras')"><div class="ventas-kpi__label">Compras (Mes)</div><div class="ventas-kpi__value" style="color:#f59e0b;">${compras.length}</div><div class="ventas-kpi__sub">Facturas</div></div>
          <div class="ventas-kpi"><div class="ventas-kpi__label">Valor Inventario</div><div class="ventas-kpi__value" style="color:#10b981;">C$${fmt(totalInv)}</div><div class="ventas-kpi__sub">Estimado</div></div>
          <div class="ventas-kpi" onclick="ProductosModule.navigateTo('cuentas-pagar')"><div class="ventas-kpi__label">Ctas. Por Pagar</div><div class="ventas-kpi__value" style="color:#ec4899;">${getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0).length}</div><div class="ventas-kpi__sub">Pendientes</div></div>
        </div>
      </div>
      <div class="ventas-grid">
        ${tile('productos', Icons.package, 'Productos', 'Catalogo completo', '#3b82f6', '#eff6ff', prods.length + ' items')}
        ${tile('compras', Icons.shoppingCart, 'Compras', 'Compras a proveedores', '#f59e0b', '#fffbeb', 'Nueva Compra')}
        ${tile('historial-compras', Icons.fileText, 'Historial Facts. Compra', 'Facturas guardadas', '#6366f1', '#eef2ff', compras.length + ' facts.')}
        ${tile('proveedores', Icons.users, 'Proveedores', 'Lista y gestión', '#8b5cf6', '#f5f3ff', provs.length + ' provs.')}
        ${tile('cuentas-pagar', Icons.dollarSign, 'Cuentas por Pagar', 'Estado de cuenta', '#ec4899', '#fdf2f8', 'Saldos')}
        ${tile('promociones', '🏷️', 'Promociones', 'Ofertas y descuentos', '#14b8a6', '#f0fdfa', 'Gestionar')}
        ${tile('inventario', Icons.layers, 'Inventario', 'Control de stock', '#0ea5e9', '#f0f9ff', 'Ajustes')}
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

    return `${backBtn()}
    <div style="display:flex;gap:0;height:calc(100vh - 160px);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);">
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:12px;background:var(--bg-primary);border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div style="position:relative;flex:1;min-width:200px;"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.5;">${Icons.search}</span><input type="text" class="form-input" style="padding-left:36px;height:36px;" placeholder="Buscar nombre, código, marca, descripción..." value="${filterState.search}" oninput="ProductosModule.handleSearch(this.value)" id="prodSearchInput"></div>
          <select class="form-select" style="width:130px;height:36px;" onchange="ProductosModule.setFilter('depto',this.value)"><option value="all">Departamento</option>${deptos.map(d => `<option value="${d}" ${filterState.depto === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <button class="btn btn--ghost btn--sm" onclick="ProductosModule.openDeptosModal()" title="Gestionar Departamentos" style="height:36px;">⚙ Deptos</button>
          <select class="form-select" style="width:140px;height:36px;" onchange="ProductosModule.setFilter('proveedor',this.value)"><option value="all">Proveedor</option>${provs.map(p => `<option value="${p.razonSocial}" ${filterState.proveedor === p.razonSocial ? 'selected' : ''}>${p.razonSocial}</option>`).join('')}</select>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;cursor:pointer;"><input type="checkbox" ${filterState.bajoStock ? 'checked' : ''} onchange="ProductosModule.toggleBajoStock()"> Bajo Stock</label>
          <select class="form-select" style="width:80px;height:36px;" onchange="ProductosModule.setPageSize(this.value)"><option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option><option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option><option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option></select>
        </div>
        <div style="flex:1;overflow-y:auto;">
          <table class="data-table" style="width:100%;font-size:12px;">
            <thead class="data-table__head"><tr>
              <th style="width:30px;">#</th><th>Cod. Barras</th><th>Cod. Alt.</th><th>Nombre</th><th>Existencia</th><th>Inv. Mín.</th><th>P. Costo</th><th>P. Venta</th><th>Departamento</th><th>Proveedor</th>
            </tr></thead>
            <tbody class="data-table__body">
              ${paged.length === 0 ? '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">Sin resultados</td></tr>' :
        paged.map((p, i) => {
          const idx = currentPage * pageSize + i;
          const low = p.stock !== undefined && p.inventarioMinimo !== undefined && p.stock <= p.inventarioMinimo;
          return `<tr style="cursor:pointer;${selectedRow === idx ? 'background:rgba(56,189,248,0.15);' : ''}${low ? 'color:#ef4444;' : ''}" onclick="ProductosModule.selectRow(${idx})" ondblclick="ProductosModule.openEditModal('${p.id}')">
                    <td>${idx + 1}</td><td style="font-family:monospace;">${p.codigo || p.sku || '-'}</td><td style="font-family:monospace;font-size:10px;">${p.codigoAlt || '-'}</td>
                    <td style="line-height:1.2;"><strong>${p.nombre || ''}</strong><div style="display:flex;gap:4px;margin-top:2px;">${p.unidad ? `<span style="background:var(--color-primary-100);color:var(--color-primary-700);font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">${p.unidad}</span>` : ''}${p.ventaGranel === 'true' ? `<span style="background:#d1fae5;color:#059669;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">⚖ Granel</span>` : ''}${p.usaSeriales === 'true' ? `<span style="background:#e0f2fe;color:#0284c7;font-size:8px;padding:2px 4px;border-radius:4px;font-weight:600;">🔢 Serie/Lote</span>` : ''}</div></td>
                    <td style="font-weight:700;${low ? 'color:#ef4444;' : ''}">${p.stock ?? p.cantidad ?? '∞'}</td><td>${p.inventarioMinimo ?? '-'}</td>
                    <td>C$${fmt(p.precioCompra || p.costo || 0)}</td><td style="font-weight:700;">C$${fmt(p.precioVenta || p.precio || 0)}</td>
                    <td>${p.categoria || p.departamento || '-'}</td><td>${p.proveedor || '-'}</td>
                  </tr>`;
        }).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding:8px 12px;background:var(--bg-primary);border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:12px;">
          <span>${filtered.length} productos | Página ${currentPage + 1}/${totalPages}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn--ghost btn--sm" onclick="ProductosModule.prevPage()" ${currentPage === 0 ? 'disabled' : ''}>◀</button>
            <button class="btn btn--ghost btn--sm" onclick="ProductosModule.nextPage()" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        ${selProd ? `<div style="padding:8px 12px;background:var(--bg-primary);border-top:1px solid var(--border-color);max-height:130px;overflow-y:auto;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Últimos 5 Movimientos: ${selProd.nombre}</div>${movs.length === 0 ? '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">Sin movimientos registrados</div>' : movs.map(m => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid var(--border-color);"><span><span class="badge ${m.tipo === 'Venta' ? 'badge--success' : 'badge--primary'}" style="font-size:9px;padding:1px 5px;">${m.tipo}</span> ${m.ref}</span><span>${m.cant} uds - ${fmtD(m.fecha)}</span></div>`).join('')}</div>` : ''}
      </div>
      <div style="width:200px;background:var(--bg-primary);border-left:1px solid var(--border-color);display:flex;flex-direction:column;gap:6px;padding:10px;">
        ${selProd ? ProductosModule.renderProductImageCarousel(selProd.imagenes, 'prodList') : ''}
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border-color);margin-bottom:4px;">Acciones</div>
        ${[['openCreateModal', '➕', 'Nuevo Producto'], ['viewDetalles', '👁️', 'Ver Detalles'], ['editSelected', '✏️', 'Editar'], ['deleteSelected', '🗑️', 'Eliminar'], ['importModal', '📥', 'Importar'], ['historialModal', '📋', 'Historial'], ['statsModal', '📊', 'Estadísticas'], ['etiquetasModal', '🏷️', 'Etiquetas'], ['pedidoModal', '📦', 'Pedido']].map(([fn, ic, lb]) => `<button class="btn btn--ghost" style="justify-content:flex-start;gap:8px;font-size:13px;width:100%;padding:8px 10px;" onclick="ProductosModule.${fn}()">${ic} ${lb}</button>`).join('')}
      </div>
    </div>
    <div id="productosModal">${modalContent}</div>`;
  };

  // ========== SUB: COMPRAS ==========
  const renderCompras = () => {
    const provs = getData('proveedores');
    const transferencias = getPosData('pos_transferencias');
    const subtotal = compraCart.reduce((s, i) => s + (i.precioCompra * i.cantidad), 0);
    const descTotal = compraCart.reduce((s, i) => s + (i.descuento || 0), 0) + compraDescGlobal;
    const total = subtotal - descTotal;
    const selIt = compraSelectedItem >= 0 ? compraCart[compraSelectedItem] : null;
    return `${backBtn()}
    <div style="display:flex;gap:0;border:1px solid var(--border-color);border-radius:12px;overflow:hidden;background:var(--bg-secondary);height:calc(100vh - 160px);">
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:1.1rem;">${Icons.shoppingCart} Nueva Compra a Proveedor</h3>
          <span style="font-size:12px;opacity:0.8;">Usuario: ${user()?.name || 'N/A'}</span>
        </div>
        <div style="padding:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;border-bottom:1px solid var(--border-color);">
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">No. Factura</label><input type="text" class="form-input" style="height:32px;" value="${compraNumFactura}" onchange="ProductosModule.setCompraField('numFactura',this.value)" placeholder="Auto si vacío"></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Proveedor *</label>
            <select class="form-select" style="height:32px;" onchange="ProductosModule.setCompraField('proveedor',this.value)">
              <option value="">Seleccionar...</option>${provs.map(p => `<option value="${p.id}" ${compraProveedor === p.id ? 'selected' : ''}>${p.razonSocial}</option>`).join('')}
            </select></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Método de Pago</label>
            <select class="form-select" style="height:32px;" onchange="ProductosModule.setCompraField('metodo',this.value)">
              ${['efectivo', 'transferencia', 'tarjeta', 'credito'].map(m => `<option value="${m}" ${compraMetodo === m ? 'selected' : ''}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
            </select></div>
          <div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Fecha Compra</label><input type="date" class="form-input" style="height:32px;" value="${compraFecha}" onchange="ProductosModule.setCompraField('fecha',this.value)"></div>
          ${compraMetodo === 'transferencia' ? `<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Banco / Cuenta</label><select class="form-select" style="height:32px;" onchange="ProductosModule.setCompraField('transfBanco',this.value)"><option value="">Seleccionar...</option>${transferencias.map(t => `<option value="${t.banco + ' - ' + t.cuenta}" ${compraTransfBanco === (t.banco + ' - ' + t.cuenta) ? 'selected' : ''}>${t.banco} - ${t.cuenta}</option>`).join('')}</select></div>
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

  // ========== SUB: PROVEEDORES ==========
  const renderProveedores = () => {
    const provs = getData('proveedores');
    return `${backBtn()}<div class="card"><div class="card__header" style="display:flex;justify-content:space-between;align-items:center;"><h4 class="card__title">${Icons.users} Proveedores</h4><button class="btn btn--primary btn--sm" onclick="ProductosModule.openProveedorModal()">➕ Nuevo Proveedor</button></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>Tipo</th><th>RUC</th><th>Razón Social</th><th>Teléfono</th><th>Dirección</th><th>Ciudad</th><th>Acc</th></tr></thead>
      <tbody class="data-table__body">${provs.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay proveedores registrados</td></tr>' : provs.map(p => `<tr><td><span class="badge badge--neutral">${p.tipo || '-'}</span></td><td style="font-family:monospace;">${p.ruc || '-'}</td><td style="font-weight:600;">${p.razonSocial}</td><td>${p.telefono || '-'}</td><td>${p.direccion || '-'}</td><td>${p.ciudad || '-'}</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ProductosModule.openProveedorModal('${p.id}')">✏️</button><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.deleteProveedor('${p.id}')">🗑️</button></td></tr>`).join('')}</tbody></table></div></div><div id="productosModal">${modalContent}</div>`;
  };

  // ========== SUB: CUENTAS POR PAGAR ==========
  const renderCuentasPagar = () => {
    const compras = getData('compras').filter(c => c.metodo === 'credito' && (c.saldoPendiente || 0) > 0);
    const provs = getData('proveedores');
    const totalDeuda = compras.reduce((s, c) => s + (c.saldoPendiente || 0), 0);
    return `${backBtn()}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;">
      <div style="background:rgba(239,68,68,0.05);padding:1.5rem;border-radius:8px;border:1px solid rgba(239,68,68,0.2);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Deuda Total</div><div style="font-size:1.8rem;font-weight:800;color:#ef4444;">C$${fmt(totalDeuda)}</div></div>
      <div style="background:var(--bg-primary);padding:1.5rem;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:.85rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Facturas Pendientes</div><div style="font-size:1.8rem;font-weight:800;">${compras.length}</div></div>
    </div>
    <div class="card"><div class="card__header"><h4 class="card__title">${Icons.dollarSign} Facturas con Saldo Pendiente</h4></div><div class="card__body" style="padding:0;">
      <table class="data-table" style="width:100%;font-size:12px;"><thead class="data-table__head"><tr><th>Factura</th><th>Proveedor</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Vencimiento</th><th>Acc</th></tr></thead>
      <tbody class="data-table__body">${compras.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay cuentas pendientes</td></tr>' : compras.map(c => { const prov = provs.find(p => p.id === c.proveedorId); const abonado = (c.total || 0) - (c.saldoPendiente || 0); return `<tr><td style="font-weight:600;">${c.numFactura}</td><td>${prov ? prov.razonSocial : 'N/A'}</td><td>C$${fmt(c.total)}</td><td style="color:#10b981;">C$${fmt(abonado)}</td><td style="color:#ef4444;font-weight:700;">C$${fmt(c.saldoPendiente)}</td><td>${c.fechaVencimiento ? fmtD(c.fechaVencimiento) : '-'}</td><td><button class="btn btn--primary btn--sm" onclick="ProductosModule.registrarPagoCompra('${c.id}')">💰 Abonar</button></td></tr>`; }).join('')}</tbody></table></div></div><div id="productosModal">${modalContent}</div>`;
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
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Marca</strong><div>${p.marca || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Departamento</strong><div>${p.categoria || p.departamento || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Proveedor</strong><div>${p.proveedor || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Existencia</strong><div style="font-weight:700;color:var(--color-primary-600);">${p.stock ?? p.cantidad ?? '∞'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Inv. Mínimo</strong><div>${p.inventarioMinimo || '-'}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Precio Costo</strong><div>C$${fmt(p.precioCompra || p.costo || 0)}</div></div>
          <div><strong style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">Precio Venta</strong><div style="font-weight:700;">C$${fmt(p.precioVenta || p.precio || 0)}</div></div>
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
      <div class="form-group"><label class="form-label">Marca</label><input type="text" name="marca" class="form-input" value="${p?.marca || ''}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Departamento</label><div style="display:flex;gap:4px;"><select name="categoria" class="form-select" style="flex:1;"><option value="">Seleccionar...</option>${deptos.map(d => `<option value="${d}" ${(p?.categoria === d || p?.departamento === d) ? 'selected' : ''}>${d}</option>`).join('')}</select><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.addDepto()" title="Nuevo Depto">+</button></div></div>
      <div class="form-group"><label class="form-label">Proveedor</label><select name="proveedor" class="form-select"><option value="">Seleccionar...</option>${provs.map(pr => `<option value="${pr.razonSocial}" ${p?.proveedor === pr.razonSocial ? 'selected' : ''}>${pr.razonSocial}</option>`).join('')}</select></div>
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
      <div class="form-row"><div class="form-group"><label class="form-label">Stock</label><input type="number" name="stock" class="form-input" value="${p?.stock ?? p?.cantidad ?? 0}" readonly style="background:var(--bg-body);opacity:0.7;" title="Controlado por compras/ventas"></div>
      <div class="form-group"><label class="form-label">Inv. Mínimo</label><input type="number" name="inventarioMinimo" class="form-input" value="${p?.inventarioMinimo || p?.stock_minimo || 0}"></div>
      <div class="form-group"><label class="form-label">Inv. Máximo</label><input type="number" name="inventarioMaximo" class="form-input" value="${p?.inventarioMaximo || p?.stock_maximo || 0}" placeholder="0 = sin límite"></div>
      <div class="form-group" style="max-width:120px;"><label class="form-label">Estado</label><select name="estado" class="form-select"><option value="Activo" ${p?.estado === 'Activo' ? 'selected' : ''}>Activo</option><option value="Inactivo" ${p?.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></div></div>

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
    const prodId = document.querySelector('#productosModal [name=id]')?.value || '';
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
    const rows = entries.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Sin registros</td></tr>' :
      entries.map((s, i) => {
        const sc = s.vendido ? '#94a3b8' : '#10b981'; const st = s.vendido ? 'Vendido' : 'Disponible';
        return '<tr style="' + (s.vendido ? 'opacity:0.5;' : '') + '"><td>' + (s.cantidad || 1) + '</td><td style="font-weight:600;font-family:monospace;">' + s.numero + '</td><td>' + (s.color || '-') + '</td><td><span style="color:' + sc + ';font-weight:700;font-size:10px;">' + st + '</span></td><td style="font-size:10px;">' + (s.facturaId || '-') + '</td><td>' + (!s.vendido ? '<button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeTracking(\'' + prodId + '\',\'' + tipo + '\',' + i + ')">🗑️</button>' : '') + '</td></tr>';
      }).join('');
    let modal = document.getElementById('productosTrackingModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'productosTrackingModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div class="modal-overlay open" style="z-index:9999999;background:rgba(0,0,0,0.6);"><div class="modal" onclick="event.stopPropagation()" style="max-width:620px;z-index:99999999;position:relative;"><div class="modal__header" style="background:' + grad + ';color:white;"><h3 class="modal__title" style="color:white;">' + titulo + '</h3><button type="button" class="modal__close" onclick="ProductosModule.closeTrackingModal()" style="color:white;cursor:pointer;">' + Icons.x + '</button></div><div class="modal__body" style="padding:16px;"><p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Registre cada ' + lbl.toLowerCase() + ' individualmente.</p><div style="display:flex;gap:8px;margin-bottom:16px;align-items:flex-end;"><div class="form-group" style="flex:1;margin:0;"><label class="form-label" style="font-size:11px;">' + lbl + ' *</label><input type="text" class="form-input" id="trackSerialNumero" placeholder="Ingrese ' + lbl + '..." style="height:32px;"></div><div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Color</label><input type="text" class="form-input" id="trackSerialColor" placeholder="Ej: Negro" style="height:32px;width:100px;"></div><div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">Cant.</label><input type="number" class="form-input" id="trackSerialCant" value="1" min="1" style="height:32px;width:60px;"></div><button type="button" class="btn btn--primary btn--sm" onclick="ProductosModule.addSerial(\'' + prodId + '\',\'' + tipo + '\')" style="height:32px;cursor:pointer;">+ Agregar</button></div><div style="max-height:250px;overflow-y:auto;border:1px solid var(--border-color);border-radius:8px;"><table class="data-table" style="width:100%;font-size:11px;"><thead class="data-table__head"><tr><th>Cant.</th><th>' + lbl + '</th><th>Color</th><th>Estado</th><th>Factura</th><th></th></tr></thead><tbody class="data-table__body">' + rows + '</tbody></table></div><div style="margin-top:12px;text-align:right;font-size:11px;color:var(--text-muted);">Disponibles: <strong style="color:#10b981;">' + entries.filter(s => !s.vendido).length + '</strong> | Vendidos: <strong style="color:#94a3b8;">' + entries.filter(s => s.vendido).length + '</strong></div></div></div></div>';
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
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open" style="z-index:1100;"><div class="modal" onclick="event.stopPropagation()" style="max-width:420px;"><div class="modal__header"><h3 class="modal__title">⚙ Gestionar Unidades</h3><button class="modal__close" onclick="ProductosModule.closeUnidadesModal()">${Icons.x}</button></div>
    <div class="modal__body">
      <div style="display:flex;gap:4px;margin-bottom:12px;"><input type="text" class="form-input" id="newUnidadClave" placeholder="Clave (PZ, KG...)" style="width:100px;"><input type="text" class="form-input" id="newUnidadNombre" placeholder="Nombre (Pieza, Kilogramo...)" style="flex:1;"><button class="btn btn--primary btn--sm" onclick="ProductosModule.addUnidad()">+</button></div>
      <div style="max-height:220px;overflow-y:auto;">${unidades.length === 0 ? '<div style="text-align:center;padding:1rem;color:var(--text-muted);">Sin unidades</div>' : unidades.map(u => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);"><span><strong>${u.clave}</strong> — ${u.nombre}</span><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ProductosModule.removeUnidad('${u.clave}')">🗑️</button></div>`).join('')}
      </div>
    </div></div></div>`;
  };
  const closeUnidadesModal = () => { const modal = document.getElementById('productosModal'); if (modal) modal.innerHTML = ''; };
  const addUnidad = () => {
    const clave = (document.getElementById('newUnidadClave')?.value || '').trim().toUpperCase();
    const nombre = (document.getElementById('newUnidadNombre')?.value || '').trim();
    if (!clave || !nombre) { alert('Ingrese clave y nombre.'); return; }
    const unidades = getPosData('prod_unidades');
    if (!unidades.find(u => u.clave === clave)) { unidades.push({ clave, nombre }); localStorage.setItem('prod_unidades', JSON.stringify(unidades)); }
    openUnidadesModal();
  };
  const removeUnidad = (clave) => {
    const unidades = getPosData('prod_unidades').filter(u => u.clave !== clave);
    localStorage.setItem('prod_unidades', JSON.stringify(unidades)); openUnidadesModal();
  };

  const openMasPreciosModal = (prodId) => {
    const listaPrecios = getPosData('pos_lista_precios');
    const prodPrecios = getPosData('prod_extra_precios_' + prodId);
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open" style="z-index:1100;"><div class="modal" onclick="event.stopPropagation()" style="max-width:500px;"><div class="modal__header"><h3 class="modal__title">📊 Precios por Lista</h3><button class="modal__close" onclick="ProductosModule.closeUnidadesModal()">${Icons.x}</button></div>
    <div class="modal__body"><p style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">Asigne precios específicos para cada lista de precios configurada.</p>
    ${listaPrecios.map(lp => { const saved = prodPrecios.find(pp => pp.codigo === lp.codigo); return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><label style="min-width:120px;font-weight:600;font-size:12px;">${lp.nombre}</label><input type="number" step="0.01" class="form-input" style="flex:1;height:32px;" id="extraPrecio_${lp.codigo}" value="${saved?.precio || ''}" placeholder="C$ Precio"></div>`; }).join('')}
    <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeUnidadesModal()">Cancelar</button><button type="button" class="btn btn--primary" onclick="ProductosModule.saveExtraPrecios('${prodId}')">Guardar</button></div>
    </div></div></div>`;
  };
  const saveExtraPrecios = (prodId) => {
    const listaPrecios = getPosData('pos_lista_precios');
    const precios = listaPrecios.map(lp => ({ codigo: lp.codigo, nombre: lp.nombre, precio: parseFloat(document.getElementById('extraPrecio_' + lp.codigo)?.value) || 0 })).filter(p => p.precio > 0);
    localStorage.setItem('prod_extra_precios_' + prodId, JSON.stringify(precios));
    closeUnidadesModal(); alert('✅ Precios guardados.');
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

        // Migrate tracking data if it was saved before product creation (id was empty)
        if (prodId && !data.id) {
          ['lote', 'serie', 'imei'].forEach(tipo => {
            const trackData = localStorage.getItem('prod_tracking_' + tipo + '_');
            if (trackData && trackData !== '[]') {
              localStorage.setItem('prod_tracking_' + tipo + '_' + prodId, trackData);
              localStorage.removeItem('prod_tracking_' + tipo + '_');
            }
          });
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
    const input = document.getElementById('newDeptoInput');
    const name = input ? input.value.trim() : prompt('Nombre del departamento:');
    if (!name) return;
    const deptos = getPosData('prod_departamentos');
    if (!deptos.includes(name.toUpperCase())) { deptos.push(name.toUpperCase()); localStorage.setItem('prod_departamentos', JSON.stringify(deptos)); }
    openDeptosModal();
  };
  const removeDepto = (name) => {
    const deptos = getPosData('prod_departamentos').filter(d => d !== name);
    localStorage.setItem('prod_departamentos', JSON.stringify(deptos));
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
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Crear Pedido</button></div>
    </form></div></div>`;
  };
  const savePedido = (e, prodId) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries()); alert('✅ Pedido creado: ' + fd.cantidad + ' unidades para el proveedor seleccionado.'); closeModal(); };

  // ========== COMPRAS HANDLERS ==========
  const selectCompraItem = (i) => { compraSelectedItem = i; App.refreshCurrentModule(); };
  const setCompraField = (k, v) => {
    if (k === 'numFactura') compraNumFactura = v;
    if (k === 'proveedor') compraProveedor = v;
    if (k === 'metodo') { compraMetodo = v; App.refreshCurrentModule(); }
    if (k === 'fecha') compraFecha = v;
    if (k === 'comentarios') compraComentarios = v;
    if (k === 'transfBanco') compraTransfBanco = v;
    if (k === 'transfRef') compraTransfRef = v;
    if (k === 'fechaVenc') compraFechaVenc = v;
  };

  let compraSearchTimeout;
  const searchCompraProduct = (q) => {
    clearTimeout(compraSearchTimeout); const el = document.getElementById('compraSearchResults'); if (!el) return;
    compraSearchSelectedIdx = -1;
    if (!q || q.length < 1) { el.style.display = 'none'; compraSearchResultIds = []; return; }
    compraSearchTimeout = setTimeout(() => {
      const prods = getProducts().filter(p => { const s = q.toLowerCase(); return ['nombre', 'codigo', 'sku', 'marca', 'departamento', 'categoria', 'descripcion'].some(k => (p[k] || '').toLowerCase().includes(s)); }).slice(0, 8);
      compraSearchResultIds = prods.map(p => p.id);
      if (prods.length === 0) { el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);">Sin resultados</div>'; el.style.display = 'block'; return; }
      el.innerHTML = prods.map((p, idx) => `<div class="compra-search-item" data-idx="${idx}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;transition:background 0.1s;" onclick="ProductosModule.addCompraProduct('${p.id}')" onmouseenter="ProductosModule.highlightCompraSearchItem(${idx})"><div><div style="font-weight:600;">${p.nombre}</div><div style="font-size:10px;color:var(--text-muted);">${p.codigo || ''} ${p.marca ? '| ' + p.marca : ''}</div></div><div style="text-align:right;"><div style="font-weight:700;font-size:12px;">C$${fmt(p.precioCompra || p.costo || 0)}</div><div style="font-size:10px;color:var(--text-muted);">Stock: ${p.stock ?? p.cantidad ?? '∞'}</div></div></div>`).join('');
      el.style.display = 'block';
    }, 200);
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
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:480px;"><div class="modal__header"><h3 class="modal__title">Agregar: ${p.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.confirmAddCompra(event,'${id}')">
      <div class="form-row"><div class="form-group"><label class="form-label form-label--required">Cantidad</label><input type="number" name="cantidad" class="form-input" value="1" min="${p.ventaGranel === 'true' ? '0.01' : '1'}" step="${p.ventaGranel === 'true' ? '0.01' : '1'}" required></div>
      <div class="form-group"><label class="form-label">P.Compra Actual</label><input type="number" step="0.01" name="precioCompra" class="form-input" value="${pc}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">P.Venta</label><input type="number" step="0.01" name="precioVenta" class="form-input" value="${pv}"></div>
      <div class="form-group"><label class="form-label">Descuento Ind.</label><input type="number" step="0.01" name="descuento" class="form-input" value="0"></div></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" name="tieneSerial" value="1" ${p.usaSeriales === 'true' ? 'checked' : ''}> Tiene No. Serie / Lote / IMEI</label></div>
      <div id="serialField" style="display:${p.usaSeriales === 'true' ? 'block' : 'none'};"><div class="form-group"><label class="form-label">No. Serie / Lote / IMEI</label><input type="text" name="serial" class="form-input" placeholder="Ingrese número..."></div></div>
      <script>document.querySelector('[name=tieneSerial]').onchange=function(){document.getElementById('serialField').style.display=this.checked?'block':'none';}<\/script>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Agregar</button></div>
    </form></div></div>`;
  };
  const confirmAddCompra = (e, id) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries());
    const p = getProducts().find(x => x.id === id);
    const cantidad = (p?.ventaGranel === 'true') ? parseFloat(fd.cantidad) || 1 : parseInt(fd.cantidad) || 1;
    const precioCompra = parseFloat(fd.precioCompra) || 0;
    const precioVenta = parseFloat(fd.precioVenta) || 0; const descuento = parseFloat(fd.descuento) || 0;
    const serial = fd.serial || '';
    const existing = compraCart.findIndex(i => i.productId === id && i.serial === serial); // Match serial as well
    if (existing >= 0 && !serial) { compraCart[existing].cantidad += cantidad; compraCart[existing].precioCompra = precioCompra; }
    else compraCart.push({ productId: id, nombre: p?.nombre || '', codigo: p?.codigo || '', precioCompra, precioVenta, cantidad, descuento, serial });
    closeModal(); App.refreshCurrentModule();
  };
  const removeCompraItem = (i) => { compraCart.splice(i, 1); App.refreshCurrentModule(); };
  const editCompraItem = (i) => {
    const it = compraCart[i]; if (!it) return;
    const p = getProducts().find(x => x.id === it.productId);
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:400px;"><div class="modal__header"><h3 class="modal__title">Editar: ${it.nombre}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.confirmEditCompraItem(event,${i})">
      <div class="form-row"><div class="form-group"><label class="form-label">Cantidad</label><input type="number" name="cantidad" class="form-input" value="${it.cantidad}" min="${p?.ventaGranel === 'true' ? '0.01' : '1'}" step="${p?.ventaGranel === 'true' ? '0.01' : '1'}" required></div>
      <div class="form-group"><label class="form-label">P. Compra</label><input type="number" step="0.01" name="precioCompra" class="form-input" value="${it.precioCompra}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">P. Venta</label><input type="number" step="0.01" name="precioVenta" class="form-input" value="${it.precioVenta || 0}"></div>
      <div class="form-group"><label class="form-label">Descuento</label><input type="number" step="0.01" name="descuento" class="form-input" value="${it.descuento || 0}"></div></div>
      <div class="form-group"><label class="form-label">Serie/Lote/IMEI</label><input type="text" name="serial" class="form-input" value="${it.serial || ''}"></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div>
    </form></div></div>`;
  };
  const confirmEditCompraItem = (e, i) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries());
    const prod = getProducts().find(p => p.id === compraCart[i].productId);
    compraCart[i].cantidad = (prod?.ventaGranel === 'true') ? parseFloat(fd.cantidad) || 1 : parseInt(fd.cantidad) || 1;
    compraCart[i].precioCompra = parseFloat(fd.precioCompra) || 0;
    compraCart[i].precioVenta = parseFloat(fd.precioVenta) || 0;
    compraCart[i].descuento = parseFloat(fd.descuento) || 0;
    compraCart[i].serial = fd.serial || '';
    closeModal(); App.refreshCurrentModule();
  };
  const setCompraDescGlobal = () => {
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:380px;"><div class="modal__header"><h3 class="modal__title">💲 Descuento Global</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.applyCompraDescGlobal(event)">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Ingrese el monto de descuento que se aplicará al total de la compra.</p>
      <div class="form-group"><label class="form-label form-label--required">Monto Descuento (C$)</label><input type="number" step="0.01" min="0" name="descGlobal" class="form-input" value="${compraDescGlobal}" autofocus style="font-size:1.1rem;font-weight:700;text-align:center;"></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Aplicar Descuento</button></div>
    </form></div></div>`;
    setTimeout(() => { const inp = modal.querySelector('[name=descGlobal]'); if (inp) { inp.focus(); inp.select(); } }, 100);
  };
  const applyCompraDescGlobal = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    compraDescGlobal = parseFloat(fd.descGlobal) || 0;
    closeModal();
    App.refreshCurrentModule();
  };

  const saveCompra = async () => {
    if (!compraProveedor) { alert('Seleccione un proveedor.'); return; }
    if (compraCart.length === 0) { alert('Agregue al menos un producto.'); return; }
    if (compraMetodo === 'transferencia' && !compraTransfBanco) { alert('Seleccione la cuenta bancaria.'); return; }
    if (compraMetodo === 'credito' && !compraFechaVenc) { alert('Indique la fecha de vencimiento.'); return; }
    const provs = getData('proveedores'); const prov = provs.find(p => p.id === compraProveedor);
    const subtotal = compraCart.reduce((s, i) => s + (i.precioCompra * i.cantidad), 0);
    const descTotal = compraCart.reduce((s, i) => s + (i.descuento || 0), 0) + compraDescGlobal;
    const total = subtotal - descTotal;
    const numFact = compraNumFactura || ((prov ? prov.razonSocial.substring(0, 3).toUpperCase() : 'CMP') + '-' + String(getData('compras').length + 1).padStart(4, '0'));
    const rec = { numFactura: numFact, proveedorId: compraProveedor, proveedorNombre: prov ? prov.razonSocial : 'N/A', fecha: compraFecha, metodo: compraMetodo, comentarios: compraComentarios, items: compraCart.map(i => ({ ...i })), subtotal, descuentoGlobal: compraDescGlobal, total, saldoPendiente: compraMetodo === 'credito' ? total : 0, fechaVencimiento: compraMetodo === 'credito' ? compraFechaVenc : null, transferenciaBanco: compraTransfBanco, transferenciaRef: compraTransfRef, usuario: user()?.name || 'N/A' };
    addRec('compras', rec);
    // Update product cost prices and stock
    for (const item of compraCart) {
      if (item.productId && typeof DataService !== 'undefined' && DataService.updateProducto) {
        try {
          const prod = DataService.getProductoById(item.productId);
          if (prod) {
            const newStock = (prod.stock || prod.cantidad || 0) + item.cantidad;
            await DataService.updateProducto(item.productId, { precioCompra: item.precioCompra, stock: newStock });
          }
        } catch (e) { console.warn('Error actualizando producto:', e); }
      }
    }
    alert('✅ Compra ' + numFact + ' guardada!');
    compraCart = []; compraProveedor = null; compraMetodo = 'efectivo'; compraNumFactura = ''; compraComentarios = ''; compraDescGlobal = 0; compraSelectedItem = -1; compraTransfBanco = ''; compraTransfRef = ''; compraFechaVenc = '';
    navigateTo('historial-compras');
  };

  // ========== PROVEEDORES HANDLERS ==========
  const openProveedorModal = (id) => {
    const prov = id ? getData('proveedores').find(p => p.id === id) : null;
    const tipos = getPosData('prod_prov_tipos');
    const html = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()"><div class="modal__header"><h3 class="modal__title">${prov ? 'Editar' : 'Nuevo'} Proveedor</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <form class="modal__body" onsubmit="ProductosModule.saveProveedor(event)"><input type="hidden" name="id" value="${prov?.id || ''}">
      <div class="form-row"><div class="form-group"><label class="form-label">Tipo Proveedor</label><div style="display:flex;gap:4px;"><select name="tipo" class="form-select" style="flex:1;"><option value="">Seleccionar...</option>${tipos.map(t => `<option value="${t}" ${prov?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="btn btn--ghost btn--sm" onclick="ProductosModule.addProvTipo()">+</button></div></div>
      <div class="form-group"><label class="form-label">RUC</label><input type="text" name="ruc" class="form-input" value="${prov?.ruc || ''}"></div></div>
      <div class="form-group"><label class="form-label form-label--required">Razón Social</label><input type="text" name="razonSocial" class="form-input" value="${prov?.razonSocial || ''}" required></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Teléfono</label><input type="text" name="telefono" class="form-input" value="${prov?.telefono || ''}"></div>
      <div class="form-group"><label class="form-label">Ciudad</label><input type="text" name="ciudad" class="form-input" value="${prov?.ciudad || ''}"></div></div>
      <div class="form-group"><label class="form-label">Dirección</label><input type="text" name="direccion" class="form-input" value="${prov?.direccion || ''}"></div>
      <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></div>
    </form></div></div>`;
    const el = document.getElementById('productosModal'); if (el) el.innerHTML = html;
  };
  const addProvTipo = () => { const t = prompt('Nombre del nuevo tipo de proveedor:'); if (!t) return; const tipos = getPosData('prod_prov_tipos'); tipos.push(t); localStorage.setItem('prod_prov_tipos', JSON.stringify(tipos)); openProveedorModal(); };
  const saveProveedor = (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target).entries()); const provs = getData('proveedores'); if (data.id) { const idx = provs.findIndex(p => p.id === data.id); if (idx >= 0) { provs[idx] = { ...provs[idx], ...data }; setData('proveedores', provs); } } else { data.id = genId(); data.created_at = new Date().toISOString(); provs.unshift(data); setData('proveedores', provs); } closeModal(); App.refreshCurrentModule(); };
  const deleteProveedor = (id) => { if (!confirm('¿Eliminar proveedor?')) return; const provs = getData('proveedores').filter(p => p.id !== id); setData('proveedores', provs); App.refreshCurrentModule(); };

  // ========== CXP / PAGOS ==========
  const registrarPagoCompra = (compraId) => {
    const compras = getData('compras'); const c = compras.find(x => x.id === compraId); if (!c) return;
    const abonos = getData('abonos_cxp').filter(a => a.compraId === compraId);
    const transferencias = getPosData('pos_transferencias');
    const modal = document.getElementById('productosModal'); if (!modal) return;
    modal.innerHTML = `<div class="modal-overlay open"><div class="modal" onclick="event.stopPropagation()" style="max-width:550px;"><div class="modal__header"><h3 class="modal__title">💰 Registrar Pago - ${c.numFactura}</h3><button class="modal__close" onclick="ProductosModule.closeModal()">${Icons.x}</button></div>
    <div class="modal__body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:var(--bg-primary);padding:12px;border-radius:8px;border:1px solid var(--border-color);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Factura</div><div style="font-size:1.3rem;font-weight:800;">C$${fmt(c.total)}</div></div>
        <div style="background:rgba(239,68,68,0.05);padding:12px;border-radius:8px;border:1px solid rgba(239,68,68,0.2);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Saldo Pendiente</div><div style="font-size:1.3rem;font-weight:800;color:#ef4444;">C$${fmt(c.saldoPendiente)}</div></div>
      </div>
      ${abonos.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Historial de Abonos</div>${abonos.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border-color);"><span>${fmtD(a.fecha)} - ${a.metodo || 'Efectivo'}</span><strong style="color:#10b981;">C$${fmt(a.monto)}</strong></div>`).join('')}</div>` : ''}
      <form onsubmit="ProductosModule.confirmPagoCompra(event,'${compraId}')">
        <div class="form-row"><div class="form-group"><label class="form-label form-label--required">Monto a Abonar</label><input type="number" step="0.01" name="monto" class="form-input" value="${c.saldoPendiente}" max="${c.saldoPendiente}" required></div>
        <div class="form-group"><label class="form-label">Forma de Pago</label><select name="metodo" class="form-select"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option></select></div></div>
        <div class="modal__footer"><button type="button" class="btn btn--secondary" onclick="ProductosModule.closeModal()">Cancelar</button><button type="submit" class="btn btn--primary">Registrar Abono</button></div>
      </form>
    </div></div></div>`;
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

  // ========== PUBLIC API ==========
  return {
    render, navigateTo, handleSearch, setFilter, toggleBajoStock, setPageSize, selectRow, prevPage, nextPage,
    openCreateModal, openEditModal, editSelected, deleteSelected, closeModal, handleSubmit, deleteItem,
    importModal, historialModal, statsModal, etiquetasModal, pedidoModal, savePedido,
    calcGanancia, calcPrecioVenta, toggleSerialesPanel, setTipoSeguimiento, closeTrackingModal, addLote, addSerial, removeTracking, getTrackingDisponibles, marcarTrackingVendido, openUnidadesModal, closeUnidadesModal, addUnidad, removeUnidad, viewDetalles,
    openMasPreciosModal, saveExtraPrecios,
    handleFotosUpload, removeFoto, renderProductImageCarousel, nextImage, openImageFullscreen,
    openDeptosModal, addDepto, removeDepto,
    setCompraField, searchCompraProduct, handleCompraSearchKeydown, highlightCompraSearchItem, addCompraProduct, confirmAddCompra, removeCompraItem, editCompraItem, confirmEditCompraItem, setCompraDescGlobal, applyCompraDescGlobal, saveCompra, selectCompraItem,
    openProveedorModal, addProvTipo, saveProveedor, deleteProveedor,
    registrarPagoCompra, confirmPagoCompra, viewCompraDetail, editCompraFactura, saveEditCompraFactura, setHistFiltro,
    openPromoModal, savePromo, deletePromo,
    handleTipoFilter: (v) => setFilter('tipo', v),
    handleEstadoFilter: (v) => setFilter('estado', v)
  };
})();
