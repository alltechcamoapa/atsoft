const fs = require('fs');
const path = 'c:\\Users\\ALLTECH\\Documents\\PROYECTOS APPS\\SYSFACT\\js\\modules\\config-module.js';
let content = fs.readFileSync(path, 'utf8');

const target = `      <!-- Tipos de Pago -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header">
          <h4 class="card__title">\${Icons.creditCard || '💳'} Tipos de Pago</h4>
          <p class="text-sm text-muted">Configura las formas de pago como transferencias, tarjetas y extrafinanciamiento aplicables a esta empresa.</p>
        </div>
        <div class="card__body">
          <!-- Tabs Navigation Tipos de Pago -->
          <div style="display:flex; gap:12px; margin-bottom:var(--spacing-md); flex-wrap:wrap; background:var(--bg-secondary); padding:10px; border-radius:12px; border:1px solid var(--border-color);">
            <!-- Tipos de pago no configurados aún -->
          </div>
          <!-- Tab Content Tipos de Pago -->
          <div style="border: 1px solid var(--border-color); border-radius: 8px;">
            <p style='padding: var(--spacing-md); text-align: center; color: var(--text-muted);'>Funcionalidad de configuración de pagos en desarrollo</p>
          </div>
        </div>
      </div>`;

const replacement = `      <!-- Tipos de Pago -->
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

            if (typeof currentPosConfigTab === 'undefined' || !['transferencia', 'tarjeta', 'tarjeta_asumir', 'extra'].includes(currentPosConfigTab)) {
                // We use a local variable to not break if it's undefined, though it should be in closure
                // But usually we set it to 'transferencia' by default effectively
                var activeTab = typeof currentPosConfigTab !== 'undefined' ? currentPosConfigTab : 'transferencia';
            } else {
                var activeTab = currentPosConfigTab;
            }

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
      </div>\`;

if (content.includes('<!-- Tipos de pago no configurados aún -->')) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('Successfully updated Tipos de Pago section.');
} else {
    console.log('Target section not found or already updated.');
}
