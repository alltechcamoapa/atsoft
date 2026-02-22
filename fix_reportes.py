import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\reportes.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace openExternalReport and exportReport
old_export = r"""  const exportReport = \(\) => \{
    alert\('Exportando analíticas del dashboard \(simulado\)...'\);
  \};

  // ========== ACTIONS ==========
  const openExternalReport = \(type\) => \{
    switch \(type\) \{
      case 'contratos':
        App\.setCurrentModule\('contratos'\);
        setTimeout\(\(\) => \{
          if \(typeof ContratosModule !== 'undefined'\) \{
            // No hay modal general de reportes en Contratos, pero podemos abrir el primer contrato si existe
            // O simplemente dejar que el usuario elija\. Para cumplir con el "vibe" premium:
            // Intentar abrir el generador de reportes del primer contrato activo si hay uno\?
            // Mejor: mostrar un aviso o simplemente dejarlo ahí\.
          \}
        \}, 100\);
        break;
      case 'pedidos':
        if \(typeof PedidosModule !== 'undefined'\) \{
          PedidosModule\.openReportModal\(\);
        \} else \{
          App\.setCurrentModule\('pedidos'\);
          setTimeout\(\(\) => PedidosModule\?\.openReportModal\(\), 200\);
        \}
        break;
      case 'visitas':
        if \(typeof VisitasModule !== 'undefined'\) \{
          VisitasModule\.openReportModal\(\);
        \} else \{
          App\.setCurrentModule\('visitas'\);
          setTimeout\(\(\) => VisitasModule\?\.openReportModal\(\), 200\);
        \}
        break;
      case 'software':
        if \(typeof SoftwareModule !== 'undefined'\) \{
          SoftwareModule\.openReportModal\(\);
        \} else \{
          App\.setCurrentModule\('software'\);
          setTimeout\(\(\) => SoftwareModule\?\.openReportModal\(\), 200\);
        \}
        break;
      case 'prestaciones':
        App\.setCurrentModule\('prestaciones'\);
        setTimeout\(\(\) => \{
          if \(typeof PrestacionesModule !== 'undefined'\) \{
            PrestacionesModule\.changeTab\('reportes'\);
          \}
        \}, 200\);
        break;
    \}
  \};"""

new_export = r"""  const exportReport = () => {
    const stats = DataService.getReportesStats(filterState);
    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png', sidebarColor: '#1a73e8' };
    
    // Construir tabla de técnicos
    let tecnicosRows = '<p>No hay datos</p>';
    if(stats.serviciosPorTecnico && stats.serviciosPorTecnico.length > 0) {
        tecnicosRows = '<table style="width:100%; border-collapse:collapse; margin-top:10px;"><thead><tr><th style="border-bottom:1px solid #ddd; text-align:left; padding:5px;">Técnico</th><th style="border-bottom:1px solid #ddd; text-align:right; padding:5px;">Servicios</th></tr></thead><tbody>';
        stats.serviciosPorTecnico.forEach(t => {
            tecnicosRows += `<tr><td style="padding:5px;">${t.tecnico}</td><td style="text-align:right; padding:5px;">${t.count}</td></tr>`;
        });
        tecnicosRows += '</tbody></table>';
    }

    const content = `
      <div class="header">
        ${companyConfig.logoUrl ? `<img src="${companyConfig.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px; border: none; background: transparent;">` : ''}
        <h1 style="color: #1e3a8a;">${companyConfig.name} - Dashboard Analítico</h1>
        <p style="color: #64748b;">Resumen General del Sistema</p>
        <p style="color: #64748b; font-size: 11px;">Filtro Aplicado: ${filterState.periodo.toUpperCase()} | Fecha de Emisión: ${new Date().toLocaleDateString('es-NI')}</p>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Total Clientes</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.totalClientes}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #10b981; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Servicios Realizados</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.totalServicios}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Ingresos Totales (USD)</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">$${stats.ingresosTotales.toFixed(2)}</div>
        </div>
        <div style="flex: 1; min-width: 150px; padding: 20px; background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 8px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Contratos Activos</div>
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${stats.contratosActivos}</div>
        </div>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 30px;">
        <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Servicios por Técnico</h3>
            ${tecnicosRows}
        </div>
        <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Distribución de Servicios</h3>
            <p>Física: <b>${stats.serviciosPorTipo.fisica}</b></p>
            <p>Remota: <b>${stats.serviciosPorTipo.remota}</b></p>
            <br>
            <h3 style="color: #334155; font-size: 14px; margin-bottom: 10px;">Modalidad</h3>
            <p>Con Contrato: <b>${stats.contratoVsEventual.contrato}</b></p>
            <p>Eventual: <b>${stats.contratoVsEventual.eventual}</b></p>
        </div>
      </div>
    `;

    printReport('Dashboard Analítico', content);
  };

  // ========== ACTIONS ==========
  const openExternalReport = (type) => {
    switch (type) {
      case 'contratos':
        App.navigate('contratos');
        setTimeout(() => {
          App.showNotification('Ve a la lista de Contratos y presiona "Generar PDF" en el recuadro del cliente que desees.', 'info');
        }, 300);
        break;
      case 'pedidos':
        App.navigate('pedidos');
        setTimeout(() => {
          if (typeof PedidosModule !== 'undefined' && PedidosModule.openReportModal) {
            PedidosModule.openReportModal();
          }
        }, 300);
        break;
      case 'visitas':
        App.navigate('visitas');
        setTimeout(() => {
          if (typeof VisitasModule !== 'undefined' && VisitasModule.openReportModal) {
            VisitasModule.openReportModal();
          }
        }, 300);
        break;
      case 'software':
        App.navigate('software');
        setTimeout(() => {
          if (typeof SoftwareModule !== 'undefined' && SoftwareModule.openReportModal) {
            SoftwareModule.openReportModal();
          }
        }, 300);
        break;
      case 'prestaciones':
        App.navigate('prestaciones');
        setTimeout(() => {
          if (typeof PrestacionesModule !== 'undefined' && PrestacionesModule.changeTab) {
            PrestacionesModule.changeTab('reportes');
          }
        }, 300);
        break;
    }
  };"""

# Sometimes regex needs exact line matching or dotall if there are newlines differences.
# Let's perform a manual substitution just in case formatting had a minor discrepancy.
res = re.search(r"const exportReport = \(\) => \{.+?\} \};", text, re.DOTALL)
if res:
    pass # Wait, my regex might fail.

text = re.sub(old_export, new_export, text, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Reportes fix applied')
