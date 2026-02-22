import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\prestaciones.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Planilla Mensual
# Find the line reading localStorage
plan_loc = text.find("const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');")
if plan_loc != -1:
    addition = """const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');
    const feriados = JSON.parse(localStorage.getItem('feriados_trabajados') || '[]');
    const abonos_prestamos = JSON.parse(localStorage.getItem('abonos_prestamos') || '[]');"""
    text = text.replace("const adelantos = JSON.parse(localStorage.getItem('adelantos') || '[]');", addition)

# Find total initialization
init_loc = text.find("let totalAdelantos = 0;")
if init_loc != -1:
    addition = """let totalAdelantos = 0;
    let totalFeriados = 0;
    let totalAbonos = 0;"""
    text = text.replace("let totalAdelantos = 0;", addition)

# Find employee mapping sums
row_loc = text.find("const mAdelantos = adelantos.filter(a => a.empleadoId === e.id && a.fecha?.startsWith(mesSeleccionado))\n\n        .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);")
if row_loc != -1:
    addition = """const mAdelantos = adelantos.filter(a => a.empleadoId === e.id && a.fecha?.startsWith(mesSeleccionado))
        .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);

      const mFeriados = feriados.filter(f => f.empleadoId === e.id && f.fecha?.startsWith(mesSeleccionado))
        .reduce((sum, f) => sum + (parseFloat(f.monto) || 0), 0);

      const mAbonos = abonos_prestamos.filter(a => a.empleadoId === e.id && a.fecha?.startsWith(mesSeleccionado))
        .reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);"""
    # Just carefully perform regex replace to avoid mismatching whitespace
    text = re.sub(r"const mAdelantos = adelantos\.filter\(a => a\.empleadoId === e\.id && a\.fecha\?\.startsWith\(mesSeleccionado\)\)\s*\.reduce\(\(sum, a\) => sum \+ \(parseFloat\(a\.monto\) \|\| 0\), 0\);", addition, text)

# Find inss / neto calculation
text = re.sub(r"const ingresosBrutos = salarioBase \+ mExtras \+ mBonos;", r"const ingresosBrutos = salarioBase + mExtras + mBonos + mFeriados;", text)
text = re.sub(r"const neto = ingresosBrutos - inss - mAdelantos - decAusencia;", r"const neto = ingresosBrutos - inss - mAdelantos - decAusencia - mAbonos;", text)

# Update totals
totals_addition = """totalAdelantos += (mAdelantos + decAusencia);
      totalFeriados += mFeriados;
      totalAbonos += mAbonos;"""
text = re.sub(r"totalAdelantos \+= \(mAdelantos \+ decAusencia\);.*?\n", totals_addition + '\n', text)

# Update HTML headers for Planilla Mensual
html_head = """<th>Empleado</th>
            <th class="text-right">Salario Base</th>
            <th class="text-right">H. Extras</th>
            <th class="text-right">Bonos</th>
            <th class="text-right">Feriados</th>
            <th class="text-right">Ausenc.</th>
            <th class="text-right">INSS (7%)</th>
            <th class="text-right">Adelantos</th>
            <th class="text-right">Préstamos</th>
            <th class="text-right">Neto Recibir</th>"""
text = re.sub(r"<th>Empleado</th>\s*<th class=\"text-right\">Salario Base</th>\s*<th class=\"text-right\">H\. Extras</th>\s*<th class=\"text-right\">Bonos</th>\s*<th class=\"text-right\">Ausenc\.</th>\s*<th class=\"text-right\">INSS \(7%\)</th>\s*<th class=\"text-right\">Adelantos</th>\s*<th class=\"text-right\">Neto Recibir</th>", html_head, text)

# Update HTML row
html_row = """<td>${e.nombre}</td>
            <td class="text-right">C$${salarioBase.toLocaleString()}</td>
            <td class="text-right text-success">+ C$${mExtras.toLocaleString()}</td>
            <td class="text-right text-success">+ C$${mBonos.toLocaleString()}</td>
            <td class="text-right text-success">+ C$${mFeriados.toLocaleString()}</td>
            <td class="text-right text-danger">${diasAusentes > 0 ? `<div style="font-size:9px">(${diasAusentes}d)</div>` : ''}- C$${decAusencia.toLocaleString()}</td>
            <td class="text-right text-danger">- C$${inss.toLocaleString()}</td>
            <td class="text-right text-danger">- C$${mAdelantos.toLocaleString()}</td>
            <td class="text-right text-danger">- C$${mAbonos.toLocaleString()}</td>
            <td class="text-right font-bold" style="background: #f8fafc;">C$${neto.toLocaleString()}</td>"""
text = re.sub(r"<td>\$\{e\.nombre\}</td>\s*<td class=\"text-right\">C\$\$\{salarioBase\.toLocaleString\(\)\}</td>\s*<td class=\"text-right text-success\">\+ C\$\$\{mExtras\.toLocaleString\(\)\}</td>\s*<td class=\"text-right text-success\">\+ C\$\$\{mBonos\.toLocaleString\(\)\}</td>\s*<td class=\"text-right text-danger\">\$\{diasAusentes > 0 \? `<div style=\"font-size:9px\">\(\$\{diasAusentes\}d\)</div>` : ''\}- C\$\$\{decAusencia\.toLocaleString\(\)\}</td>\s*<td class=\"text-right text-danger\">- C\$\$\{inss\.toLocaleString\(\)\}</td>\s*<td class=\"text-right text-danger\">- C\$\$\{mAdelantos\.toLocaleString\(\)\}</td>\s*<td class=\"text-right font-bold\" style=\"background: #f8fafc;\">C\$\$\{neto\.toLocaleString\(\)\}</td>", html_row, text)

# Update totals row
html_totals = """<td class="text-right">TOTALES:</td>
            <td class="text-right">C$${totalSalarioBase.toLocaleString()}</td>
            <td class="text-right">C$${totalExtras.toLocaleString()}</td>
            <td class="text-right">C$${totalBonos.toLocaleString()}</td>
            <td class="text-right">C$${totalFeriados.toLocaleString()}</td>
            <td class="text-right"></td>
            <td class="text-right">C$${totalInss.toLocaleString()}</td>
            <td class="text-right">C$${totalAdelantos.toLocaleString()}</td>
            <td class="text-right">C$${totalAbonos.toLocaleString()}</td>
            <td class="text-right" style="color: #1a73e8; font-size: 14px;">C$${totalNetoGeneral.toLocaleString()}</td>"""
text = re.sub(r"<td class=\"text-right\">TOTALES:</td>\s*<td class=\"text-right\">C\$\$\{totalSalarioBase\.toLocaleString\(\)\}</td>\s*<td class=\"text-right\">C\$\$\{totalExtras\.toLocaleString\(\)\}</td>\s*<td class=\"text-right\">C\$\$\{totalBonos\.toLocaleString\(\)\}</td>\s*<td colspan=\"3\"></td>\s*<td class=\"text-right\" style=\"color: #1a73e8; font-size: 14px;\">C\$\$\{totalNetoGeneral\.toLocaleString\(\)\}</td>", html_totals, text)


with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Planilla mensual modification applied.')
