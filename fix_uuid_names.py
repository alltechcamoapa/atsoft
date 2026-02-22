import re

path_reports = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\reportes.js'
with open(path_reports, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the render generation for general report
old_td = r'<td>\$\{v\.usuarioSoporte \|\| \'N/A\'\}</td>'
new_td = r"""<td>${ (() => {
                      const t = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === v.usuarioSoporte) : null;
                      return t ? (t.name || t.username) : (v.usuarioSoporte || 'N/A');
                  })() }</td>"""

text = re.sub(old_td, new_td, text)

with open(path_reports, 'w', encoding='utf-8') as f:
    f.write(text)

path_ds = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\services\data-service.js'
with open(path_ds, 'r', encoding='utf-8') as f:
    text_ds = f.read()

# Fix getReportesStats inside data-service.js
old_tech_map = r"""        filteredVisitas\.forEach\(v => \{
            const t = v\.usuarioSoporte \|\| 'SIN ASIGNAR';
            tecnicoMap\[t\] = \(tecnicoMap\[t\] \|\| 0\) \+ 1;
        \}\);"""

new_tech_map = r"""        filteredVisitas.forEach(v => {
            const techObj = cache.users.find(u => u.id === v.usuarioSoporte);
            const t = techObj ? (techObj.name || techObj.username) : (v.usuarioSoporte || 'SIN ASIGNAR');
            tecnicoMap[t] = (tecnicoMap[t] || 0) + 1;
        });"""

text_ds = re.sub(old_tech_map, new_tech_map, text_ds)

with open(path_ds, 'w', encoding='utf-8') as f:
    f.write(text_ds)

print('UUID Names Fixed')
