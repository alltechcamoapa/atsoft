const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/modules/ventas.js');
let content = fs.readFileSync(filePath, 'utf8');

// The original file is severely duplicated. We want:
// Head: from start up to "const renderPOS = () => {"
// Tail: from the SECOND occurrence of "      <div style=\"display:flex;align-items:center;justify-content:center;min-height:70vh;\">"
// But prefixed with "const renderOpenTurno = () => `\n"
// Then we just take the entire "newRenderPosBody" from our previous script and slap it in between!

let head = content.substring(0, content.indexOf('const renderPOS = () => {'));

const originalRestSignature = "      <div style=\"display:flex;align-items:center;justify-content:center;min-height:70vh;\">";
let firstRest = content.indexOf(originalRestSignature);
let secondRest = content.indexOf(originalRestSignature, firstRest + 1);

let tail = "const renderOpenTurno = () => `\n" + content.substring(secondRest);

// Let's create `newRenderPosBody` again from our script, properly with no replacement issues.
const newRenderPosBody = `const renderPOS = () => {
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
\n`;

// Build final repaired string
let repaired = head + newRenderPosBody + tail;

fs.writeFileSync(filePath, repaired, 'utf8');
console.log('Successfully repaired ventas.js !');
