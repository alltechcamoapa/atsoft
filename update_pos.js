const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/modules/ventas.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD NEW STATE VARIABLES
content = content.replace(
    `let selectedCartRow = -1; // arrow-key navigation index for cart rows`,
    `let selectedCartRow = -1; // arrow-key navigation index for cart rows\n  let globalDiscount = 0;\n  let posComment = '';\n  let showPaymentModal = false;`
);

// 2. MODIFY OPEN TURNO TO ADD SHIFT NUMBER
content = content.replace(
    `turnoActivo = { fondoInicial: amount, apertura: new Date().toISOString(), usuario: user()?.name || 'N/A', ventas: 0, totalVentas: 0 };`,
    `const numTurno = getData('cortes').length + 1;\n    turnoActivo = { numero: numTurno, fondoInicial: amount, apertura: new Date().toISOString(), usuario: user()?.name || 'N/A', ventas: 0, totalVentas: 0 };`
);

// 3. DEFINE THE NEW `renderPOS` HTML LAYOUT
// We'll replace the block from "const renderPOS = () => {" to "const renderOpenTurno = () => `"
const renderPosRegex = /const renderPOS = \(\) => \{[\s\S]*?const renderOpenTurno = \(\) => `/;

const newRenderPosBody = `const renderPOS = () => {
    if (!turnoActivo) return renderOpenTurno();
    const clients = getClients();
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    const currSymbol = selectedCurrency === 'USD' ? '$' : 'C$';

    // The client filter combo logic
    const displayedClientName = selectedClient ? (clients.find(c => c.id === selectedClient)?.empresa || clients.find(c => c.id === selectedClient)?.nombreCliente) : 'Público General';

    return \`
      <div style="display:grid;grid-template-columns:56px 1fr 340px;height:calc(100vh - var(--header-height) - 20px);border-radius:var(--border-radius-lg);overflow:hidden;border:1px solid var(--border-color);box-shadow:var(--shadow-lg);background:var(--bg-secondary);">
        <!-- POS SIDEBAR -->
        <div style="background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px;overflow-y:auto;">
          \${[
             { id: 'pos', ic: '🛒', lb: 'Venta', key: 'F2' },
             { id: 'consultor-precios', ic: '🔍', lb: 'Precios', key: 'F3' },
             { id: 'pos-devoluciones', ic: '↩️', lb: 'Devoluc.', key: 'F9' },
             { id: 'entrada-caja', ic: '📥', lb: 'Entradas', key: '' },
             { id: 'salida-caja', ic: '📤', lb: 'Salidas', key: '' },
             { id: 'pos-clientes', ic: '👥', lb: 'Clientes', key: '' },
             { id: 'pos-sucursal', ic: '🏢', lb: 'Sucursal', key: '' },
             { id: 'catalogo', ic: '📄', lb: 'Ventas', key: '' }
          ].map(b => \`<button onclick="VentasModule.navigateSidebar('\${b.id}')" style="background:\${posSubView === b.id ? 'rgba(56,189,248,.2)' : 'transparent'};border:none;color:white;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;transition:all .15s;" title="\${b.lb}\${b.key ? ' (' + b.key + ')' : ''}">
            <span style="font-size:18px;">\${b.ic}</span><span style="text-align:center;word-break:keep-all;">\${b.lb}</span>\${b.key ? \`<span style="font-size:8px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">\${b.key}</span>\` : ''}</button>\`).join('')}
          <div style="flex:1;"></div>
          <button onclick="VentasModule.closeTurno()" style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:8px 4px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:48px;font-size:9px;margin-bottom:4px;" title="Cerrar turno (F11)"><span style="font-size:18px;">🔒</span><span>Cerrar</span><span style="font-size:8px;opacity:.5;background:rgba(255,255,255,.1);padding:1px 4px;border-radius:3px;margin-top:1px;">F11</span></button>
        </div>
        
        <!-- POS CENTER -->
        <div style="display:flex;flex-direction:column;border-right:1px solid var(--border-color);overflow:hidden;position:relative;">
          
          <!-- CLIENT BAR -->
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
          
          <!-- SEARCH BAR -->
          <div class="pos-toolbar">
            <div class="pos-toolbar__search" style="position:relative;flex:1;">
              <span class="pos-toolbar__search-icon">\${Icons.search}</span>
              <input type="text" id="posSearch" placeholder="Buscar producto por nombre o código (F2)" oninput="VentasModule.searchProducts(this.value)" autocomplete="off">
              <div id="posSearchResults" style="display:none;" class="pos-search-results"></div>
            </div>
            <button class="pos-toolbar__btn" onclick="VentasModule.suspendSale()" \${cart.length === 0 ? 'disabled' : ''}>⏸️ Vta en espera <kbd>F8</kbd></button>
            <button class="pos-toolbar__btn" onclick="VentasModule.clearCart()">🗑️ <kbd>F5</kbd></button>
          </div>
          
          <!-- CART -->
          <div class="pos-items" id="posItemsContainer" style="flex:1;overflow-y:auto;">
            \${cart.length === 0 ? \`<div class="pos-items__empty"><div class="pos-items__empty-icon">🛒</div><p>Busque un producto o escanee un código</p></div>\` : \`
            <table>
              <thead>
                <tr>
                  <th>C. Barras</th>
                  <th>Cant.</th>
                  <th>Nombre de producto</th>
                  <th>TP</th>
                  <th>P.Unit</th>
                  <th>Descuento</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
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

          <!-- BOTTOM MODIFY BAR -->
          <div style="display:flex;gap:8px;padding:12px;background:var(--bg-primary);border-top:1px solid var(--border-color);align-items:center;">
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('qty')" \${selectedCartRow < 0 ? 'disabled' : ''}>CANTIDAD</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('del')" \${selectedCartRow < 0 ? 'disabled' : ''} style="color:var(--color-danger);">ELIMINAR</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('disc')" \${selectedCartRow < 0 ? 'disabled' : ''}>DESCUENTO</button>
            <button class="btn btn--secondary btn--sm" onclick="VentasModule.modifySelected('price')" \${selectedCartRow < 0 ? 'disabled' : ''}>CAMBIAR PRECIO</button>
          </div>
        </div>

        <!-- POS RIGHT -->
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
      
      <!-- PAYMENT OVERLAY -->
      \${showPaymentModal ? renderPaymentModal(total, currSymbol) : ''}
    \`;
  };

  const renderOpenTurno = () => \``;

content = content.replace(renderPosRegex, newRenderPosBody);


// 4. ADD NEW FUNCTIONS
// We will insert them before `// ========== PUBLIC API ==========`
const insertIndex = content.indexOf(`// ========== PUBLIC API ==========`);
const newFunctions = `
  // ========== NEW POS LOGIC ==========
  
  const navigateSidebar = (id) => {
    if(id === 'entrada-caja') {
        openCajaInOut('ingreso');
    } else if(id === 'salida-caja') {
        openCajaInOut('retiro');
    } else if (id === 'pos-clientes') {
        navigateTo('clientes');
    } else if (id === 'pos-sucursal') {
        alert('Funcionalidad de Consulta Sucursal en desarrollo.');
    } else if (id === 'catalogo') {
        navigateTo('catalogo');
    } else {
        navigateTo(id);
    }
  };

  const selectCartRow = (i) => {
    selectedCartRow = i;
    highlightCartRow();
    App.render();
  };

  const searchClientsCombo = (q) => {
    const el = document.getElementById('posClientResults');
    if (!el) return;
    if (!q || q.length < 1) { el.style.display = 'none'; return; }
    
    // exact match or substring
    const found = getClients().filter(c => {
       const str = (c.empresa || c.nombreCliente || '').toLowerCase();
       return str.includes(q.toLowerCase());
    }).slice(0, 5);
    
    if (found.length === 0) {
      el.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text-muted);">Sin resultados. <a href="#" onclick="VentasModule.nuevoClienteRapido();return false;">Crear nuevo</a></div>';
    } else {
      el.innerHTML = found.map(c => \`<div style="padding:8px;font-size:12px;cursor:pointer;border-bottom:1px solid #eee;" onclick="VentasModule.selectClientCombo('\${c.id}')">\${c.empresa || c.nombreCliente}</div>\`).join('');
    }
    el.style.display = 'block';
  };

  const selectClientCombo = (id) => {
    selectedClient = id;
    App.render();
  };

  const nuevoClienteRapido = () => {
    const name = prompt('Nombre o Empresa del nuevo cliente:');
    if (!name) return;
    
    let dbClients = [];
    try { dbClients = JSON.parse(localStorage.getItem('cli_clientes') || '[]'); } catch(e){}
    
    const newCli = { id: Date.now().toString(36), nombreCliente: name, fechaRegistro: new Date().toISOString() };
    dbClients.push(newCli);
    localStorage.setItem('cli_clientes', JSON.stringify(dbClients));
    
    alert('Cliente agregado: ' + name);
    selectedClient = newCli.id;
    App.render();
  };

  const modifySelected = (action) => {
    if (selectedCartRow < 0 || selectedCartRow >= cart.length) return;
    const item = cart[selectedCartRow];
    
    if (action === 'qty') {
        const val = prompt('CANTIDAD de producto (Facturar):', item.cantidad);
        if(val && !isNaN(val) && val > 0) {
            cart[selectedCartRow].cantidad = parseInt(val);
        }
    } else if (action === 'del') {
        if(confirm('¿Eliminar "' + item.nombre + '" del carrito?')) {
            removeItem(selectedCartRow);
            return; // removeItem calls render
        }
    } else if (action === 'disc') {
        const d = prompt('Descuento INDIVIDUAL (en moneda o porcentaje %):\\nEjemplo: 50 o 10%');
        if(!d) return;
        if(d.includes('%')) {
            const pct = parseFloat(d.replace('%',''));
            if(!isNaN(pct)) {
                 cart[selectedCartRow].descuento = (item.precio * item.cantidad) * (pct/100);
            }
        } else {
             const val = parseFloat(d);
             if(!isNaN(val)) cart[selectedCartRow].descuento = val;
        }
    } else if (action === 'price') {
        const p = prompt('Cambiar PRECIO (P.Unit actual: ' + item.precio + '):', item.precio);
        if(p && !isNaN(p) && p > 0) {
            cart[selectedCartRow].precio = parseFloat(p);
        }
    }
    App.render();
  };

  const setPosComment = (v) => { posComment = v; };

  const promptGlobalDiscount = () => {
    const d = prompt('Agregar Descuento GLOBAL a la factura:\\nEjemplo: 100 o 5%');
    if(!d) return;
    
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0) - cart.reduce((s, i) => s + (i.descuento || 0), 0);
    
    if(d.includes('%')) {
        const pct = parseFloat(d.replace('%',''));
        if(!isNaN(pct)) globalDiscount = subtotal * (pct/100);
    } else {
         const val = parseFloat(d);
         if(!isNaN(val)) globalDiscount = val;
    }
    App.render();
  };

  const openPaymentModal = () => {
     if(cart.length === 0) return;
     showPaymentModal = true;
     selectedPayment = 'efectivo'; // default
     cashReceived = 0;
     App.render();
  };

  const closePaymentModal = () => {
     showPaymentModal = false;
     App.render();
  };
  
  const setPaymentOnly = (m) => {
     selectedPayment = m;
     App.render();
  };

  const processPaymentOverride = () => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const descuento = cart.reduce((s, i) => s + (i.descuento || 0), 0);
    const iva = (subtotal - descuento - globalDiscount) * IVA_RATE;
    const total = subtotal - descuento - globalDiscount + iva;
    if (selectedPayment === 'efectivo' && cashReceived < total) { alert('El efectivo recibido es menor al total.'); return; }
    
    // Make sure we have the comment
    const finalComment = posComment;
    
    const costoTotal = cart.reduce((s, i) => s + (i.costo * i.cantidad), 0);
    const numFactura = 'VNT-' + String(getData('ventas').length + 1).padStart(6, '0');
    
    const clientFound = selectedClient ? getClients().find(c => c.id === selectedClient) : null;
    
    addRec('ventas', {
      numero: numFactura, fecha: new Date().toISOString(), clienteId: selectedClient,
      cliente: clientFound ? (clientFound.empresa || clientFound.nombreCliente || 'Cliente') : 'Público General',
      items: cart.map(i => ({ ...i })), subtotal, descuento, descuento_global: globalDiscount, iva, total, costo_total: costoTotal,
      metodo: selectedPayment, efectivo_recibido: selectedPayment === 'efectivo' ? cashReceived : 0,
      cambio: selectedPayment === 'efectivo' ? Math.max(0, cashReceived - total) : 0,
      saldo_pendiente: selectedPayment === 'credito' ? total : 0,
      vendedor: user()?.name || 'N/A', estado: 'completada',
      comentario: finalComment
    });
    
    alert(\`✅ Venta \${numFactura} registrada!\\nTotal: C$\${fmt(total)}\${selectedPayment === 'efectivo' ? '\\nCambio: C$' + fmt(Math.max(0, cashReceived - total)) : ''}\`);
    cart = []; selectedClient = null; cashReceived = 0; globalDiscount = 0; posComment = ''; showPaymentModal = false;
    posSubView = 'pos'; App.render();
  };

  const renderPaymentModal = (total, currSymbol) => {
    return \`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;">
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
               <button class="pos-cobrar__btn" style="flex:2;" onclick="VentasModule.processPaymentOverride()">
                 \${Icons.check} Confirmar Pago
               </button>
            </div>
         </div>
      </div>
    \`;
  };

  const openCajaInOut = (tipo) => {
    const motivo = prompt('Motivo del ' + tipo + ':');
    if(!motivo) return;
    const monto = parseFloat(prompt('Monto (C$):'));
    if(isNaN(monto) || monto <= 0) { alert('Monto inválido'); return; }
    addRec('cajaMovs', { tipo, motivo, monto, fecha: new Date().toISOString(), usuario: user()?.name || 'N/A' });
    alert('✅ ' + tipo.toUpperCase() + ' registrado existosamente.'); App.render();
  };

`;
content = content.replace(`// ========== PUBLIC API ==========`, newFunctions + `\n  // ========== PUBLIC API ==========`);

// 5. REMOVE OLD DASHBOARD "CAJA" & REWIRE IT
content = content.replace(
    /\$\{tile\('caja', Icons.wallet, 'Caja', 'Entradas y salidas', '#fbbf24', '#fffbeb', 'Gestionar'\)\}/g,
    `\${tile('abrir-entrada', Icons.download, 'Entrada', 'Añadir a caja', '#34d399', '#ecfdf5', 'Ingreso')}
   \${tile('abrir-salida', Icons.upload, 'Salida', 'Retiro de caja', '#f87171', '#fef2f2', 'Egreso')}`
);

// We need to route Dashboard clicks to new functions
content = content.replace(
    `const navigateTo = (v) => {`,
    `const navigateTo = (v) => {
    if(v === 'abrir-entrada') { openCajaInOut('ingreso'); return; }
    if(v === 'abrir-salida') { openCajaInOut('retiro'); return; }`
);

// We should replace processPayment calls by openPaymentModal inside Shortcuts
content = content.replace(`action: () => processPayment()`, `action: () => openPaymentModal()`);
content = content.replace(`onclick="VentasModule.processPayment()"`, `onclick="VentasModule.openPaymentModal()"`);


// Update the Exports API
content = content.replace(
    `focusCartField, highlightCartRow
  };`,
    `focusCartField, highlightCartRow,
    navigateSidebar, selectCartRow, searchClientsCombo, selectClientCombo, nuevoClienteRapido,
    modifySelected, setPosComment, promptGlobalDiscount, openPaymentModal, closePaymentModal,
    setPaymentOnly, processPaymentOverride
  };`
);


fs.writeFileSync(filePath, content, 'utf8');
console.log('Script updated successfully');
