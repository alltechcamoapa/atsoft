const fs = require('fs');
const path = require('path');

const fileConfig = path.join(__dirname, 'js/modules/config-module.js');
let codeConfig = fs.readFileSync(fileConfig, 'utf8');

// The strategy is to find the beginning of renderEmpresaTab and replace it entirely up to just before the next function.
// Or we can just do a regex replace for the problematic parts.
codeConfig = codeConfig.replace(/\$\{tabsTiposPago\.map\(t => \`.*\`\)\.join\(''\)\}/g, "<!-- Tipos de pago no configurados aún -->");
codeConfig = codeConfig.replace(/\$\{tiposPagoContent \|\| '.*'\}/g, "<p style='padding: var(--spacing-md); text-align: center; color: var(--text-muted);'>Funcionalidad de configuración de pagos en desarrollo</p>");

fs.writeFileSync(fileConfig, codeConfig);
console.log("Variables no definidas removidas de renderEmpresaTab");
