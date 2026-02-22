import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\config-module.js'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the roles array
text = text.replace(
    "${['Admin', 'Tecnico', 'Vendedor'].map(r => `<option value=\"${r}\">${r}</option>`).join('')}",
    "${['Administrador', 'Tecnico', 'Ejecutivo de Ventas'].map(r => `<option value=\"${r}\">${r}</option>`).join('')}"
)

# And fix toggleModulesSelector
text = text.replace("if (role === 'Admin')", "if (role === 'Administrador' || role === 'Admin')")
text = text.replace("role !== 'Admin'", "data.role !== 'Administrador' && data.role !== 'Admin'")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Roles updated')
