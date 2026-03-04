const fs = require('fs');

let rjs = fs.readFileSync('js/modules/recepciones.js', 'utf8');

// 1. replace getClientOptions
const getClientOptionsMatch = rjs.match(/const getClientOptions = \(selectedId.*?join\(''\);\n    };/s);
if (getClientOptionsMatch) {
    const newGetClientOptions = `
    const getClientOptions = (selectedId) => {
        const clientes = DataService.getClientesSync();
        return clientes.map(c => {
            const isSelected = (selectedId === (c.clienteId || c.id)) ? 'selected' : '';
            const displayId = c.codigo_cliente || c.codigoCliente || c.clienteId || c.id;
            return \`<option value="\${c.clienteId || c.id}" \${isSelected}>\${displayId} - \${c.nombreCliente || c.nombre_cliente || c.empresa}</option>\`;
        }).join('');
    };
`;
    rjs = rjs.replace(getClientOptionsMatch[0], newGetClientOptions.trim());
}

// 2. update accesoriosIncluidos
// In the renderFormModal function:
const accesoriosBlock = `<div class="form-group">
                    <label class="form-label">Artículos o Accesorios Recibidos (Cargador, Bolso, Cables, etc.)</label>
                    <textarea name="accesoriosIncluidos" class="form-textarea" rows="2" placeholder="Ej: Cargador original HP, Estuche negro...">\${recepcion?.accesorios_incluidos || recepcion?.accesoriosIncluidos || ''}</textarea>
                  </div>`;

const newAccesoriosBlock = `
                    <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Artículos o Accesorios Recibidos</span>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="RecepcionesModule.addAccesorioInput()" style="padding: 2px 8px; font-size: 0.8rem;">+ Nueva Línea</button>
                    </label>
                    <div id="accesoriosContainer" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
                    </div>
                    <input type="hidden" name="accesoriosIncluidos" id="accesoriosIncluidosValue" value="\${recepcion?.accesorios_incluidos || recepcion?.accesoriosIncluidos || ''}">
`;
rjs = rjs.replace(accesoriosBlock, newAccesoriosBlock);

// 3. update contrasena_equipo
const passwordBlock = `<div class="form-group">
                          <label class="form-label text-danger" style="color: var(--danger-color);">Contraseña del Equipo (Si tiene)</label>
                          <input type="text" name="nuevoEquipoContrasena" class="form-input" placeholder="Contraseña de usuario / PIN">
                      </div>`;

const newPasswordBlock = `
                      <div class="form-group">
                          <label class="form-label text-danger" style="color: var(--danger-color); display: flex; justify-content: space-between;">
                            Contraseña del Equipo (Si tiene)
                            <button type="button" class="btn btn--ghost btn--sm" onclick="document.getElementById('patternLockContainer').style.display = document.getElementById('patternLockContainer').style.display === 'none' ? 'block' : 'none';" style="padding: 0; color: var(--primary-color);">
                                <b>Dibujar Patrón</b>
                            </button>
                          </label>
                          <input type="text" name="nuevoEquipoContrasena" id="nuevoEquipoContrasena" class="form-input" placeholder="Contraseña de usuario / PIN">
                          
                          <div id="patternLockContainer" style="display: none; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-top: 10px; width: fit-content;">
                              <div style="text-align: center; margin-bottom: 10px; color: #666; font-size: 0.85rem;">Dibuja o haz clic en los números</div>
                              <div style="display: grid; grid-template-columns: repeat(3, 45px); gap: 15px; justify-content: center;" id="patternGrid">
                                  \${[1,2,3,4,5,6,7,8,9].map(n => \`
                                      <button type="button" class="btn btn--secondary" style="width: 45px; height: 45px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; font-weight: bold;" onclick="RecepcionesModule.addPatternNode(\${n})">\${n}</button>
                                  \`).join('')}
                              </div>
                              <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                  <button type="button" class="btn btn--danger btn--sm" onclick="RecepcionesModule.clearPattern()">Limpiar</button>
                                  <button type="button" class="btn btn--primary btn--sm" onclick="document.getElementById('patternLockContainer').style.display='none'">Confirmar</button>
                              </div>
                          </div>
                      </div>
`;
rjs = rjs.replace(passwordBlock, newPasswordBlock);

// Inject logic for UI features into the module before the return statement
const uiLogic = `
    const initAccesorios = () => {
        const valEl = document.getElementById('accesoriosIncluidosValue');
        if (!valEl) return;
        const container = document.getElementById('accesoriosContainer');
        if (!container) return;
        container.innerHTML = '';
        const items = valEl.value.split('\\n').filter(i => i.trim() !== '');
        if (items.length === 0) {
            addAccesorioInput('');
        } else {
            items.forEach(i => addAccesorioInput(i));
        }
    };

    const addAccesorioInput = (val = '') => {
        const container = document.getElementById('accesoriosContainer');
        if (!container) return;
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.innerHTML = \`
            <input type="text" class="form-input acc-inp" value="\${val}" placeholder="Ej: Cargador original..." oninput="RecepcionesModule.updateAccesoriosValue()" style="flex: 1; padding: 6px 12px; font-size: 0.9rem;">
            <button type="button" class="btn btn--danger btn--icon" onclick="this.parentElement.remove(); RecepcionesModule.updateAccesoriosValue()" style="padding: 6px; min-width: 32px; height: 32px;" title="Remover">\${Icons.trash2 || 'X'}</button>
        \`;
        container.appendChild(div);
        
        // focus the new input
        const newInp = div.querySelector('input');
        if(newInp && val === '') newInp.focus();
    };

    const updateAccesoriosValue = () => {
        const inputs = document.querySelectorAll('.acc-inp');
        const vals = Array.from(inputs).map(i => i.value).filter(v => v.trim() !== '');
        const valEl = document.getElementById('accesoriosIncluidosValue');
        if (valEl) valEl.value = vals.join('\\n');
    };

    const addPatternNode = (n) => {
        const pwdInp = document.getElementById('nuevoEquipoContrasena');
        if (!pwdInp) return;
        if (pwdInp.value.length > 0 && !pwdInp.value.includes('-')) {
            // If it was standard text, reset
            pwdInp.value = '';
        }
        if (pwdInp.value !== '') {
            pwdInp.value += '-' + n;
        } else {
            pwdInp.value = n;
        }
    };

    const clearPattern = () => {
        const pwdInp = document.getElementById('nuevoEquipoContrasena');
        if (pwdInp) pwdInp.value = '';
    };

    // Override openEditModal and openCreateModal wrapper to init accesorios
    const _oldOpenCreate = openCreateModal;
    const _oldOpenEdit = openEditModal;
`;

if (!rjs.includes('updateAccesoriosValue')) {
    const returnIndex = rjs.lastIndexOf('return {');
    rjs = rjs.slice(0, returnIndex) + uiLogic + "\n    " + rjs.slice(returnIndex);

    // Add exports
    const exportsToInject = `
        initAccesorios, addAccesorioInput, updateAccesoriosValue, addPatternNode, clearPattern,
    `;
    const finalReturnMatch = rjs.substring(rjs.lastIndexOf('return {'));
    rjs = rjs.replace(finalReturnMatch, finalReturnMatch.replace('return {', 'return {' + exportsToInject));
}

// Add init logic after innerHTML renders
const createMatch = rjs.match(/document\.getElementById\('recepcionModal'\)\.innerHTML\s*=\s*renderFormModal\(\);/);
if (createMatch && !rjs.includes('setTimeout(() => RecepcionesModule.initAccesorios(), 10)')) {
    rjs = rjs.replace(createMatch[0], createMatch[0] + "\n        setTimeout(() => RecepcionesModule.initAccesorios(), 10);");
}

const editMatchContent = `document.getElementById('recepcionModal').innerHTML = renderFormModal(recepcion);`;
if (rjs.includes(editMatchContent) && !rjs.includes('initAccesorios(); // EDIT MODE')) {
    rjs = rjs.replace(editMatchContent, editMatchContent + `\n        setTimeout(() => RecepcionesModule.initAccesorios(), 10); /* initAccesorios(); // EDIT MODE */`);
}

fs.writeFileSync('js/modules/recepciones.js', rjs, 'utf8');
console.log('UI Patch complete.');
