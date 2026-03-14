const fs = require('fs');
const path = require('path');

const fileVehiculos = path.join(__dirname, 'js/modules/gestion-vehiculos.js');
let codeVehiculos = fs.readFileSync(fileVehiculos, 'utf8');

// --- 1. Fix getMetrics (Total Gastos y Combustibles) ---
// Currently it looks at getData('veh_gastos') and getData('veh_combustible').
// We should make it look at "facturas" where they are consolidated.
const metricsRegex = /const getMetrics = \(\) => \{[\s\S]*?totalCombMes = cMes.reduce\(\(s, x\) => s \+ parseFloat\(x\.total \|\| 0\), 0\),/;
if (codeVehiculos.match(metricsRegex)) {
    const newMetricsInit = `const getMetrics = () => {
    const v = getData("vehiculos"),
      f = getData("facturas"),
      now = new Date(),
      ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Gastos y Combustibles ahora viven dentro de facturas
    const fMes = f.filter(x => x.fecha >= ms);
    
    const totalGastosMes = fMes.reduce((s, x) => s + parseFloat(x.monto || x.total || x.subtotal || 0), 0);
    const totalCombMes = fMes.filter(x => x.tipo_gasto === 'Combustible').reduce((s, x) => s + parseFloat(x.monto || x.total || x.subtotal || 0), 0);`;
    
    codeVehiculos = codeVehiculos.replace(metricsRegex, newMetricsInit);
    
    // Fix the "topV/topC" loop to check facturas instead of gastos
    codeVehiculos = codeVehiculos.replace(
        /g\.forEach\(\(x\) => \{/g, 
        `f.forEach((x) => {`
    );
}

// --- 2. Fix Proveedores Load Issue in Nueva Factura ---
// Instead of sys_proveedores, we should call ProductosModule APIs or data service.
const invoiceProvRegex = /let proveedoresServicios = \[\];[\s\S]*?getTarjetas/;
if (codeVehiculos.match(invoiceProvRegex)) {
    const newProvLogic = `let proveedoresServicios = [];
    if (typeof DataService !== 'undefined' && DataService.getProveedoresSync) {
        proveedoresServicios = DataService.getProveedoresSync().filter(p => !p.inactivo);
    } else {
        try { proveedoresServicios = JSON.parse(localStorage.getItem('sys_proveedores')||'[]'); } catch(e){}
    }
    
    // Filter services or those without type
    proveedoresServicios = proveedoresServicios.filter(p => p.tipoProveedor === 'Servicios' || p.tipo_proveedor === 'Servicios' || p.tipo_proveedor === 'Servicio' || p.tipoProveedor === 'Servicio' || !p.tipo_proveedor);

    let optsProveedores = '<option value="">Seleccione proveedor...</option>';
    proveedoresServicios.forEach(p => {
        optsProveedores += '<option value="' + (p.nombre || p.proveedor) + '">' + (p.nombre || p.proveedor) + '</option>';
    });

    const getTarjetas = `;
    codeVehiculos = codeVehiculos.replace(invoiceProvRegex, newProvLogic);
}

// --- 3. Fixing routing mapping in index.js / welcome ---
// The user says they can't access configuration. Wait, in js/app.js we don't have navigate config handler?
// Actually App.render looks for `currentModule` and calls its render method. The `ConfigModule` name is likely what it expects.
const fileApp = path.join(__dirname, 'js/app.js');
let codeApp = fs.readFileSync(fileApp, 'utf8');

// Searching for the render() method to see how it mounts modules.
// Usually: if (currentModule === 'configuracion') html = ConfigModule.render();

const renderSwitchRegex = /if \(currentModule === 'reportes'\) content = typeof ReportesModule !== 'undefined' \? ReportesModule\.render\(\) : renderModulePlaceholder\('reportes'\);/;
if (codeApp.match(renderSwitchRegex)) {
    if (!codeApp.includes("currentModule === 'configuracion'")) {
        const configRender = `if (currentModule === 'reportes') content = typeof ReportesModule !== 'undefined' ? ReportesModule.render() : renderModulePlaceholder('reportes');
      else if (currentModule === 'configuracion') content = typeof ConfigModule !== 'undefined' ? ConfigModule.render() : renderModulePlaceholder('configuracion');`;
        codeApp = codeApp.replace(renderSwitchRegex, configRender);
    }
}

// Add a specific fallback in case the ConfigModule expects 'Configuracion' with capital C or something.


fs.writeFileSync(fileVehiculos, codeVehiculos);
fs.writeFileSync(fileApp, codeApp);
console.log('✅ Bug fixes applied correctly for Vehiculos & Configuration!');
