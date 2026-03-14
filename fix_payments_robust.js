const fs = require('fs');
const path = 'c:\\Users\\ALLTECH\\Documents\\PROYECTOS APPS\\SYSFACT\\js\\modules\\config-module.js';
let content = fs.readFileSync(path, 'utf8');

// The most unique part of the placeholder block
const anchor = "Funcionalidad de configuración de pagos en desarrollo";

if (content.includes(anchor)) {
    // Find the start of the "card" that contains this anchor
    // We'll look for the comment <!-- Tipos de Pago --> which is just above it
    const startTag = "<!-- Tipos de Pago -->";
    const endTag = "<!-- Gestión de Régimen Fiscal -->";
    
    const startIndex = content.indexOf(startTag);
    const endIndex = content.indexOf(endTag);
    
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        const replacement = `<!-- Tipos de Pago -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header">
          <h4 class="card__title">\${Icons.creditCard || '💳'} Tipos de Pago</h4>
          <p class="text-sm text-muted">Configura las formas de pago como transferencias, tarjetas y extrafinanciamiento aplicables a esta empresa.</p>
        </div>
        <div class="card__body">
          \${(() => {
            const tabsTiposPago = [
              { id: 'transferencia', name: 'Transferencias' },
              { id: 'tarjeta', name: 'Tarjetas (POS)' },
              { id: 'tarjeta_asumir', name: 'Tarjetas (Asumir)' },
              { id: 'extra', name: 'Extrafinanciamiento' }
            ];

            const activeTab = typeof currentPosConfigTab !== 'undefined' && ['transferencia', 'tarjeta', 'tarjeta_asumir', 'extra'].includes(currentPosConfigTab) 
              ? currentPosConfigTab : 'transferencia';

            let tiposPagoContent = '';
            if (activeTab === 'transferencia') {
              const items = getPosData('pos_transferencias');
              tiposPagoContent = \`
                <div class="card__header" style="justify-content: space-between; border-bottom: 0;">
                  <h5 style="margin:0;">Cuentas Bancarias</h5>
                  <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('transferencia')">\${Icons.plus || '+'} Agregar</button>
                </div>
                <table class="data-table">
                  <thead><tr><th>Banco</th><th>Número de Cuenta</th><th>Moneda</th><th>Acciones</th></tr></thead>
                  <tbody>
                    \${items.map((it, i) => \`<tr>
                      <td><strong>\${it.banco}</strong></td>
                      <td>\${it.numeroCuenta}</td>
                      <td><span class="badge badge--neutral">\${it.divisa}</span></td>
                      <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ConfigModule.deletePosItem('pos_transferencias', \${i})">\${Icons.trash || '✕'}</button></td>
                    </tr>\`).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No hay transferencias configuradas</td></tr>'}
                  </tbody>
                </table>\`;
            } else if (activeTab === 'tarjeta') {
              const items = getPosData('pos_tarjetas');
              tiposPagoContent = \`
                <div class="card__header" style="justify-content: space-between; border-bottom: 0;">
                  <h5 style="margin:0;">Perfiles de Tarjeta (POS)</h5>
                  <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('tarjeta')">\${Icons.plus || '+'} Agregar</button>
                </div>
                <table class="data-table">
                  <thead><tr><th>POS Banco</th><th>Bancario (%)</th><th>IR (%)</th><th>Total Impuesto</th><th>Acciones</th></tr></thead>
                  <tbody>
                    \${items.map((it, i) => \`<tr>
                      <td><strong>\${it.posBanco}</strong></td>
                      <td>\${it.porcentajeBancario}%</td>
                      <td>\${it.porcentajeIR}%</td>
                      <td><span class="badge badge--primary">\${(parseFloat(it.porcentajeBancario) + parseFloat(it.porcentajeIR)).toFixed(2)}%</span></td>
                      <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ConfigModule.deletePosItem('pos_tarjetas', \${i})">\${Icons.trash || '✕'}</button></td>
                    </tr>\`).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No hay perfiles de tarjeta</td></tr>'}
                  </tbody>
                </table>\`;
            } else if (activeTab === 'tarjeta_asumir') {
              const items = getPosData('pos_tarjetas_asumir');
              tiposPagoContent = \`
                <div class="card__header" style="justify-content: space-between; border-bottom: 0;">
                  <h5 style="margin:0;">POS Bancario (Asumir Comisión)</h5>
                  <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('tarjeta_asumir')">\${Icons.plus || '+'} Agregar</button>
                </div>
                <table class="data-table">
                  <thead><tr><th>POS Banco</th><th>Comisión (%)</th><th>IR (%)</th><th>Acciones</th></tr></thead>
                  <tbody>
                    \${items.map((it, i) => \`<tr>
                      <td><strong>\${it.posBanco}</strong></td>
                      <td>\${it.porcentajeBancario}%</td>
                      <td>\${it.porcentajeIR}%</td>
                      <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ConfigModule.deletePosItem('pos_tarjetas_asumir', \${i})">\${Icons.trash || '✕'}</button></td>
                    </tr>\`).join('') || '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No hay configuraciones registradas</td></tr>'}
                  </tbody>
                </table>\`;
            } else if (activeTab === 'extra') {
              const items = getPosData('pos_extrafinanciamiento');
              tiposPagoContent = \`
                <div class="card__header" style="justify-content: space-between; border-bottom: 0;">
                  <h5 style="margin:0;">Extrafinanciamiento</h5>
                  <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('extra')">\${Icons.plus || '+'} Agregar</button>
                </div>
                <table class="data-table">
                  <thead><tr><th>Banco</th><th>Plazo</th><th>Comisión (%)</th><th>IR (%)</th><th>Acciones</th></tr></thead>
                  <tbody>
                    \${items.map((it, i) => \`<tr>
                      <td><strong>\${it.banco}</strong></td>
                      <td>\${it.plazoMeses} meses</td>
                      <td>\${it.porcentajeBancario}%</td>
                      <td>\${it.porcentajeIR}%</td>
                      <td><button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="ConfigModule.deletePosItem('pos_extrafinanciamiento', \${i})">\${Icons.trash || '✕'}</button></td>
                    </tr>\`).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No hay extrafinanciamiento configurado</td></tr>'}
                  </tbody>
                </table>\`;
            }

            return \`
              <div style="display:flex; gap:12px; margin-bottom:var(--spacing-md); flex-wrap:wrap; background:var(--bg-secondary); padding:10px; border-radius:12px; border:1px solid var(--border-color);">
                \${tabsTiposPago.map(t => \`<button class="btn btn--sm \${activeTab === t.id ? 'btn--primary' : 'btn--ghost'}" onclick="ConfigModule.setPosConfigTab('\${t.id}')">\${t.name}</button>\`).join('')}
              </div>
              <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                \${tiposPagoContent}
              </div>
            \`;
          })()}
        </div>
      </div>
      
      `;
        
        const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
        fs.writeFileSync(path, newContent);
        console.log("Successfully updated config-module.js");
    } else {
        console.log("Could not find start or end tags around anchor.");
    }
} else {
    console.log("Anchor not found. Already updated?");
}
