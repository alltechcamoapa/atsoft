import re

path_contratos = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\contratos.js'
with open(path_contratos, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the render of visitas in contratos
old_td = r'<td>\$\{v\.usuarioSoporte\}</td>'
new_td = r"""<td>${ (() => {
                      const t = typeof DataService.getUsersSync === 'function' ? DataService.getUsersSync().find(u => u.id === v.usuarioSoporte) : null;
                      return t ? (t.name || t.username) : (v.usuarioSoporte || 'N/A');
                  })() }</td>"""

text = re.sub(old_td, new_td, text)

with open(path_contratos, 'w', encoding='utf-8') as f:
    f.write(text)

print('Contratos UUID Names Fixed')
