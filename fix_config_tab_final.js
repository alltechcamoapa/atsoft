const fs = require('fs');
const path = require('path');

const fileConfig = path.join(__dirname, 'js/modules/config-module.js');
let codeConfig = fs.readFileSync(fileConfig, 'utf8');

// The file might contain a switchTab function but maybe named differently?
// Let's check for "switchTab:" in the return block
if (!codeConfig.includes("switchTab: switchTab")) {
    if (!codeConfig.includes("const switchTab = ")) {
        // We will insert switchTab right after render
        const renderEndingRegex = /const renderPerfilTab = \(/;
        if (codeConfig.match(renderEndingRegex)) {
            const switchFunc = `
  const switchTab = (tabId) => {
    currentTab = tabId;
    App.refreshCurrentModule();
  };\n\n  const renderPerfilTab = (`;
            codeConfig = codeConfig.replace(renderEndingRegex, switchFunc);
            console.log("switchTab funcion inyectada");
        } else {
             console.log("No pude inyectar switchTab");
        }
    }

    // Now adding it to the exported returns
    const returnRegex = /return \{\n\s+render,/g;
    codeConfig = codeConfig.replace(returnRegex, "return {\n    render,\n    switchTab,");
}

// Now checking renderEmpresaTab definition precisely
if (!codeConfig.includes("const renderEmpresaTab = ")) {
    // Inject at the end before "return {"
    const returnStart = codeConfig.lastIndexOf("return {");
    if (returnStart > -1) {
        const empresaTabHtml = `
  const renderEmpresaTab = () => {
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
\n`;
        codeConfig = codeConfig.slice(0, returnStart) + empresaTabHtml + codeConfig.slice(returnStart);
        console.log("renderEmpresaTab inyectada exitosamente antes del final del modulo.");
    }
} else {
    console.log("renderEmpresaTab ya fue detectado.");
}

fs.writeFileSync(fileConfig, codeConfig);
console.log("Proceso terminado");
