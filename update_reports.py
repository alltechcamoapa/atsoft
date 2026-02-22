import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\prestaciones.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the HTML for the card "Historial de Pagos Realizados"
old_card_html = r"""  <div class="card" style="margin-top: 20px;">
    <div class="card__header" style="background: #1a1f36; color: white;">
      <h3 class="card__title" style="color: white;">\$\{Icons\.fileText\} Historial de Pagos Realizados</h3>
    </div>
    <div class="card__body">
      <p class="text-muted">Historial detallado de recibos, bonos y adelantos por empleado\.</p>

      <div class="reports-filter-grid" style="display: grid; grid-template-columns: repeat\(auto-fit, minmax\(200px, 1fr\)\); gap: 15px; margin-top: 15px; align-items: end;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="text-xs">Empleado:</label>
          <select id="reportPagosEmpleadoId" class="form-select">
            <option value="all">Todos los Empleados</option>
            \$\{DataService\.getEmpleadosSync\(\)\.map\(e => `<option value="\$\{e\.id\}">\$\{e\.nombre\}</option>`\)\.join\(''\)\}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="text-xs">Tipo de Filtro:</label>
          <select id="reportPagosTipoFiltro" class="form-select" onchange="PrestacionesModule\.toggleReportFilters\(\)">
            <option value="mes">Por Mes</option>
            <option value="anio">Por Año</option>
            <option value="rango">Rango de Fechas</option>
          </select>
        </div>

        <!-- Inputs dinámicos -->
        <div class="form-group" id="filterContainerMes" style="margin-bottom: 0;">
          <label class="text-xs">Mes:</label>
          <input type="month" id="reportPagosMes" class="form-input" value="\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 7\)\}">
        </div>
        <div class="form-group" id="filterContainerAnio" style="display:none; margin-bottom: 0;">
          <label class="text-xs">Año:</label>
          <select id="reportPagosAnio" class="form-select">
            \$\{Array\.from\(\{ length: 5 \}, \(_, i\) => new Date\(\)\.getFullYear\(\) - i\)\.map\(y => `<option value="\$\{y\}">\$\{y\}</option>`\)\.join\(''\)\}
          </select>
        </div>
        <div class="form-group" id="filterContainerRango" style="display:none; margin-bottom: 0; gap: 5px; flex-direction:column;">
          <input type="date" id="reportPagosInicio" class="form-input" title="Desde">
            <input type="date" id="reportPagosFin" class="form-input" title="Hasta">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <button class="btn btn--primary" style="width: 100%;" onclick="PrestacionesModule\.generarReportePagosHechos\(\)">
                \$\{Icons\.search\} Consultar
              </button>
            </div>
        </div>
      </div>
    </div>
  </div>"""

new_card_html = r"""  <div class="card" style="margin-top: 20px;">
    <div class="card__header" style="background: #1a1f36; color: white;">
      <h3 class="card__title" style="color: white;">${Icons.fileText} Historial de Pagos de Empleado</h3>
    </div>
    <div class="card__body">
      <p class="text-muted">Reporte integral de todos los pagos realizados a un empleado (Recibos, Bonos, etc.).</p>

      <div class="reports-filter-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; align-items: end;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="text-xs">Empleado:</label>
          <select id="reportPagosEmpleadoId" class="form-select">
            ${DataService.getEmpleadosSync().map(e => `<option value="${e.id}">${e.nombre}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="text-xs">Tipo de Filtro:</label>
          <select id="reportPagosTipoFiltro" class="form-select" onchange="PrestacionesModule.toggleReportFilters()">
            <option value="anio" selected>Por Año</option>
            <option value="rango">Rango de Fechas</option>
            <option value="desde_alta">Desde Fecha de Alta</option>
          </select>
        </div>

        <!-- Inputs dinámicos -->
        <div class="form-group" id="filterContainerMes" style="display:none; margin-bottom: 0;">
          <label class="text-xs">Mes:</label>
          <input type="month" id="reportPagosMes" class="form-input" value="${new Date().toISOString().slice(0, 7)}">
        </div>
        <div class="form-group" id="filterContainerDesdeAlta" style="display:none; margin-bottom: 0;">
          <label class="text-xs" style="color: transparent;">.</label>
          <button class="btn btn--ghost" disabled>Todo el histórico disponible</button>
        </div>
        <div class="form-group" id="filterContainerAnio" style="display:block; margin-bottom: 0;">
          <label class="text-xs">Año:</label>
          <select id="reportPagosAnio" class="form-select">
            ${Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="filterContainerRango" style="display:none; margin-bottom: 0; gap: 5px; flex-direction:column;">
          <input type="date" id="reportPagosInicio" class="form-input" title="Desde">
          <input type="date" id="reportPagosFin" class="form-input" title="Hasta">
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <button class="btn btn--primary" style="width: 100%;" onclick="PrestacionesModule.generarReportePagosHechos()">
            ${Icons.search} Consultar
          </button>
        </div>
      </div>
    </div>
  </div>"""

text = re.sub(old_card_html, new_card_html, text)


toggle_old = r"""  const toggleReportFilters = \(\) => \{

    const tipo = document\.getElementById\('reportPagosTipoFiltro'\)\.value;

    document\.getElementById\('filterContainerMes'\)\.style\.display = tipo === 'mes' \? 'block' : 'none';

    document\.getElementById\('filterContainerAnio'\)\.style\.display = tipo === 'anio' \? 'block' : 'none';

    document\.getElementById\('filterContainerRango'\)\.style\.display = tipo === 'rango' \? 'flex' : 'none';

  \};"""

toggle_new = """  const toggleReportFilters = () => {
    const tipo = document.getElementById('reportPagosTipoFiltro').value;
    const btnMes = document.getElementById('filterContainerMes');
    if (btnMes) btnMes.style.display = tipo === 'mes' ? 'block' : 'none';
    const btnAnio = document.getElementById('filterContainerAnio');
    if (btnAnio) btnAnio.style.display = tipo === 'anio' ? 'block' : 'none';
    const btnRango = document.getElementById('filterContainerRango');
    if (btnRango) btnRango.style.display = tipo === 'rango' ? 'flex' : 'none';
    const btnAlta = document.getElementById('filterContainerDesdeAlta');
    if (btnAlta) btnAlta.style.display = tipo === 'desde_alta' ? 'block' : 'none';
  };"""

text = re.sub(toggle_old, toggle_new, text)


# Update the Report Logic with real async fetching and correct headers/calculations
report_old_regex = r"const generarReportePagosHechos = \(\) => {.*?printDocument\(`Historial de Pagos - \$\{periodStr\} `, content, 'portrait'\);\s*};"
# We match everything inside the old function, replacing it entirely since we rewrite to async and adapt logic

report_new = """const generarReportePagosHechos = async () => {
    const empId = document.getElementById('reportPagosEmpleadoId').value;
    const tipoFiltro = document.getElementById('reportPagosTipoFiltro').value;
    const allEmps = DataService.getEmpleadosSync();
    if (!allEmps.length) return App.showNotification('No hay empleados.', 'warning');

    const emp = allEmps.find(e => e.id === empId);
    if (!emp) return alert('Seleccione un empleado válido.');

    let fechaInicio, fechaFin;
    const today = new Date();

    if (tipoFiltro === 'mes') {
      const mesInput = document.getElementById('reportPagosMes').value; 
      if (!mesInput) return alert('Seleccione un mes válido');
      const [y, m] = mesInput.split('-');
      fechaInicio = new Date(y, m - 1, 1);
      fechaFin = new Date(y, m, 0, 23, 59, 59);
    } else if (tipoFiltro === 'anio') {
      const y = document.getElementById('reportPagosAnio').value;
      fechaInicio = new Date(y, 0, 1);
      fechaFin = new Date(y, 11, 31, 23, 59, 59);
    } else if (tipoFiltro === 'rango') {
      const dInicio = document.getElementById('reportPagosDesde').value || document.getElementById('reportPagosInicio').value;
      const dFin = document.getElementById('reportPagosHasta').value || document.getElementById('reportPagosFin').value;
      if (!dInicio || !dFin) return alert('Seleccione fecha inicial y final');
      fechaInicio = new Date(dInicio);
      fechaFin = new Date(dFin);
      fechaFin.setHours(23, 59, 59);
    } else if (tipoFiltro === 'desde_alta') {
      if (!emp.fechaAlta && !emp.fecha_alta) return alert('El empleado no tiene registrada una fecha de alta.');
      fechaInicio = new Date(emp.fechaAlta || emp.fecha_alta);
      fechaFin = new Date();
      fechaFin.setHours(23, 59, 59);
    }

    try {
        // Obtenemos los recibos formales mediante la base de datos o su persistencia real
        const allNominas = await DataService.getAllNominas?.() || JSON.parse(localStorage.getItem('nominas_historial') || '[]');
        const bonos = JSON.parse(localStorage.getItem('bonificaciones') || '[]');

        const filterByDate = (item, dateField) => {
            if (item.empleadoId !== emp.id && item.empleado_id !== emp.id) return false;
            const dStr = item[dateField];
            if (!dStr) return false;
            const d = new Date(dStr);
            return d >= fechaInicio && d <= fechaFin;
        };

        const eNominas = allNominas.filter(n => filterByDate(n, 'fechaPago') || filterByDate(n, 'created_at'));
        const eBonos = bonos.filter(b => filterByDate(b, 'fecha'));

        if (!eNominas.length && !eBonos.length) {
            return App.showNotification('No se encontraron pagos en este período para el empleado seleccionado', 'error');
        }

        const totalNominas = eNominas.reduce((acc, curr) => acc + (parseFloat(curr.montoNeto || curr.total_neto) || 0), 0);
        const totalBonos = eBonos.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

        const rowsHtml = [];

        eNominas.forEach(n => {
            const date = new Date(n.fechaPago || n.created_at).toLocaleDateString('es-NI');
            const periodo = n.tipo_periodo ? ` (${n.tipo_periodo} ${new Date(n.periodo_inicio).toLocaleDateString('es-NI')} al ${new Date(n.periodo_fin).toLocaleDateString('es-NI')})` : '';
            const val = parseFloat(n.montoNeto || n.total_neto);
            rowsHtml.push(`<tr><td>${date}</td><td><strong>Recibo de Pago</strong>${periodo}</td><td class="text-right">C$${val.toLocaleString()}</td></tr>`);
        });

        eBonos.forEach(b => {
            const date = new Date(b.fecha).toLocaleDateString('es-NI');
            rowsHtml.push(`<tr><td>${date}</td><td>Bono / Extra: ${b.concepto}</td><td class="text-right text-success">+ C$${parseFloat(b.monto).toLocaleString()}</td></tr>`);
        });

        const content = `
        <h3 style="border-bottom: 2px solid #1a73e8; padding-bottom: 5px; color: #1a73e8;">Detalle de Pagos: ${emp.nombre}</h3>
        <p style="font-size: 11px; margin-top: -5px;">Cargo: ${emp.cargo} | Cédula: ${emp.cedula}</p>
        <div style="margin-bottom: 20px;">
          <strong>Período:</strong> Del ${fechaInicio.toLocaleDateString('es-NI')} al ${fechaFin.toLocaleDateString('es-NI')}
        </div>
        <table style="width: 100%; font-size: 12px;">
            <thead>
                <tr>
                    <th style="width: 15%">Fecha</th>
                    <th style="width: 60%">Concepto de Pago</th>
                    <th class="text-right" style="width: 25%">Monto Acreditado</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml.join('')}
            </tbody>
            <tfoot>
                <tr style="background: #f8fafc; font-weight: bold; font-size: 14px;">
                    <td colspan="2" class="text-right">Total Pagado al Empleado en el Período:</td>
                    <td class="text-right" style="color: #1a73e8;">C$${(totalNominas + totalBonos).toLocaleString()}</td>
                </tr>
            </tfoot>
        </table>`;

        printDocument('Historial de Pagos de Empleado', content, 'portrait');

    } catch (e) {
        console.error(e);
        App.showNotification('Error al generar historial.', 'error');
    }
};"""

text = re.sub(report_old_regex, report_new, text, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Update successful.')
