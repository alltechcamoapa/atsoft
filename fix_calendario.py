import re

path_cal = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\calendario.js'
with open(path_cal, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix static variables to dynamic
old_tecnicos = r"const tecnicos = \['Técnico Juan', 'Técnico María', 'Técnico Carlos'\];"
new_tecnicos = r"""const tecnicos = typeof DataService !== 'undefined' && DataService.getUsersSync ? DataService.getUsersSync().map(u => ({ id: u.id, name: u.name || u.username })) : [];"""
text = text.replace(old_tecnicos, new_tecnicos)

old_select = r"""<select class="form-select" onchange="CalendarioModule.handleTecnicoFilter(this.value)">
              <option value="all">Todos</option>
              \$\{tecnicos\.map\(t => `<option value="\$\{t\}" \$\{filterState\.tecnico === t \? 'selected' : ''\}>\$\{t\}</option>`\)\.join\(''\)\}
            </select>"""
new_select = r"""<select class="form-select" onchange="CalendarioModule.handleTecnicoFilter(this.value)">
              <option value="all">Todos</option>
              ${tecnicos.map(t => `<option value="${t.id}" ${filterState.tecnico === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
            </select>"""
text = re.sub(old_select, new_select, text)

with open(path_cal, 'w', encoding='utf-8') as f:
    f.write(text)

print('Calendario fixed')
