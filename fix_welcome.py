import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\welcome-module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix isAssigned logic in welcome-module.js
old_assigned = r"const isAssigned = visita\.usuarioSoporte === user\.nombre;"
new_assigned = r"const isAssigned = (visita.usuarioSoporte === user.id || visita.usuarioSoporte === user.nombre || visita.usuarioSoporte === user.username);"

text = re.sub(old_assigned, new_assigned, text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Welcome module isAssigned fixed')
