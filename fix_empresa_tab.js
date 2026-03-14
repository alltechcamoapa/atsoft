const fs = require('fs');
const path = require('path');

const fileConfig = path.join(__dirname, 'js/modules/config-module.js');
let codeConfig = fs.readFileSync(fileConfig, 'utf8');

if (!codeConfig.includes("const renderEmpresaTab = () => {")) {
    // We will inject it right before renderSistemaTab
    const systemTabRegex = /const renderSistemaTab = \(config\) => \{/;
    
    if (codeConfig.match(systemTabRegex)) {
        const renderEmpresaT = `const renderEmpresaTab = () => {
    const empresas = typeof DataService !== 'undefined' && DataService.getEmpresasSync ? DataService.getEmpresasSync() : [];
    const bodegas = typeof DataService !== 'undefined' && DataService.getBodegasSync ? DataService.getBodegasSync() : [];

    return \`
      <div class="card" style="margin-bottom: var(--spacing-lg);">
        <div class="card__header" style="justify-content: space-between;">
          <h4 class="card__title">\${Icons.briefcase || '🏢'} Perfil de Empresa</h4>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openEmpresaModal()">
            \${Icons.plus || '+'} Nueva Empresa
          </button>
        </div>
        <div class="card__body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Razón Social</th>
                <th>RUC</th>
                <th>Moneda Principal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              \${empresas.length > 0 ? empresas.map(emp => \`
                <tr>
                  <td><strong>\${emp.nombre || '-'}</strong></td>
                  <td>\${emp.razon_social || '-'}</td>
                  <td>\${emp.ruc || '-'}</td>
                  <td><span class="badge badge--primary">\${emp.moneda_principal || '-'}</span></td>
                  <td>
                    <button class="btn btn--ghost btn--sm btn--icon" onclick="ConfigModule.openEmpresaModal('\${emp.id}')" title="Editar">\${Icons.edit || '✎'}</button>
                  </td>
                </tr>
              \`).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay empresas configuradas</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card__header" style="justify-content: space-between;">
          <h4 class="card__title">\${Icons.box || '📦'} Sucursales / Bodegas</h4>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openBodegaModal()">
            \${Icons.plus || '+'} Nueva Bodega
          </button>
        </div>
        <div class="card__body" style="padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Empresa</th>
                <th>Dirección</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              \${bodegas.length > 0 ? bodegas.map(bod => {
                const cmp = empresas.find(e => e.id === bod.empresa_id);
                return \`
                <tr>
                  <td><strong>\${bod.nombre}</strong> \${bod.es_principal ? '<span class="badge badge--success">Principal</span>' : ''}</td>
                  <td><span class="badge badge--secondary">\${bod.tipo || 'Bodega'}</span></td>
                  <td>\${cmp ? cmp.nombre : '-'}</td>
                  <td>\${bod.direccion || '-'}</td>
                  <td>
                    <button class="btn btn--ghost btn--sm btn--icon" onclick="ConfigModule.openBodegaModal('\${bod.id}')" title="Editar">\${Icons.edit || '✎'}</button>
                    \${!bod.es_principal ? \`<button class="btn btn--ghost btn--sm btn--icon text-danger" onclick="ConfigModule.deleteBodega('\${bod.id}')" title="Eliminar">\${Icons.trash || '✕'}</button>\` : ''}
                  </td>
                </tr>
                \`
              }).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay sucursales/bodegas</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  };

  `;
        codeConfig = codeConfig.replace(systemTabRegex, renderEmpresaT + 'const renderSistemaTab = (config) => {');
        fs.writeFileSync(fileConfig, codeConfig);
        console.log("renderEmpresaTab inyectado correctamente");
    } else {
        console.log("No se pudo hallar 'const renderSistemaTab'");
    }
} else {
    console.log("renderEmpresaTab ya está definido.");
}
