import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\configuracion.js'

try:
    with open(path, 'r', encoding='utf-8') as f:
        pass
except FileNotFoundError:
    print('configuracion.js does not exist')
