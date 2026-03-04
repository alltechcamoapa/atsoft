const fs = require('fs');

let rjs = fs.readFileSync('js/modules/recepciones.js', 'utf8');

// 1. Update Cliente Dropdown to a ComboBox
const oldClienteFormGroup = `                  <div class="form-group">
                    <label class="form-label form-label--required">Cliente</label>
                    <select name="clienteId" id="clienteId" class="form-select" onchange="RecepcionesModule.onClienteChange()" required>
                      <option value="">Seleccionar cliente...</option>
                      <option value="NEW" style="font-weight: bold; color: var(--primary-color);">+ Crear Nuevo Cliente</option>
                      \${getClientOptions(recepcion?.clienteId || recepcion?.cliente_id)}
                    </select>
                  </div>`;

const newClienteFormGroup = `                  <div class="form-group" style="position: relative;">
                    <label class="form-label form-label--required">Cliente</label>
                    <input type="text" id="clienteSearchInput" class="form-input" 
                           placeholder="Buscar cliente por nombre o código..." 
                           autocomplete="off"
                           onclick="RecepcionesModule.showClientesList()"
                           onkeyup="RecepcionesModule.filterClientesList(this.value)">
                    <div id="clientesList" class="dropdown-list" style="display: none; position: absolute; z-index: 1000; width: 100%; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      <div class="dropdown-item" onclick="RecepcionesModule.selectClienteInline('NEW', '+ Crear Nuevo Cliente')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-weight: bold; color: var(--primary-color);">
                        + Crear Nuevo Cliente
                      </div>
                      \${DataService.getClientesSync().map(c => {
                          const idText = c.codigo_cliente || c.codigoCliente || c.id || c.clienteId || 'ID';
                          const nameText = c.nombreCliente || c.nombre_cliente || c.empresa || '';
                          const text = \`\${idText} - \${nameText}\`;
                          return \`<div class="dropdown-item cliente-item" data-name="\${text.toLowerCase()}" onclick="RecepcionesModule.selectClienteInline('\${c.id || c.clienteId}', '\${text.replace(/'/g, "\\'")}')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
                            \${text}
                          </div>\`;
                      }).join('')}
                    </div>
                    <input type="hidden" name="clienteId" id="clienteId" value="\${recepcion?.clienteId || recepcion?.cliente_id || ''}" required onchange="RecepcionesModule.onClienteChange()">
                  </div>`;
rjs = rjs.replace(oldClienteFormGroup, newClienteFormGroup);

// Add missing Methods for combobox to the module
const inlineMethods = `
    const showClientesList = () => {
        const list = document.getElementById('clientesList');
        if (list) list.style.display = 'block';
    };

    const filterClientesList = (val) => {
        const list = document.getElementById('clientesList');
        if (list) list.style.display = 'block';
        const items = document.querySelectorAll('.cliente-item');
        const lowerVal = val.toLowerCase();
        items.forEach(item => {
            if (item.getAttribute('data-name').includes(lowerVal)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    };

    const selectClienteInline = (id, label) => {
        const searchInput = document.getElementById('clienteSearchInput');
        const hiddenInput = document.getElementById('clienteId');
        const list = document.getElementById('clientesList');
        
        if (searchInput && hiddenInput && list) {
            searchInput.value = label;
            hiddenInput.value = id;
            list.style.display = 'none';
            
            // Trigger change
            onClienteChange();
        }
    };

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        const list = document.getElementById('clientesList');
        const searchInput = document.getElementById('clienteSearchInput');
        if (list && searchInput && e.target !== list && e.target !== searchInput && !list.contains(e.target)) {
            list.style.display = 'none';
        }
    });
`;

if (!rjs.includes('showClientesList = () => {')) {
    const insertBeforeReturn = rjs.lastIndexOf('return {');
    rjs = rjs.slice(0, insertBeforeReturn) + inlineMethods + "\n  " + rjs.slice(insertBeforeReturn);

    // Add to return obj
    const returnObj = rjs.match(/return \{([^}]+)\};/)[1];
    rjs = rjs.replace(/return \{[^}]+\};/, `return {${returnObj},
        showClientesList, filterClientesList, selectClienteInline
    };`);
}


// 2. Adjust onClienteChange
// We already have onClienteChange in the module. Let's make sure it checks for equipos and if the client has equipments, fills the select
const onClienteChangeIndex = rjs.indexOf('const onClienteChange = () => {');
if (onClienteChangeIndex > -1) {
    const onClientChangeBodyEnd = rjs.indexOf('};', onClienteChangeIndex);
    const onClienteChangeBlock = rjs.substring(onClienteChangeIndex, onClientChangeBodyEnd + 2);

    const newOnClienteChange = `
    const onClienteChange = () => {
        const clienteId = document.getElementById('clienteId').value;
        const newClienteSection = document.getElementById('newClienteSection');
        const equipoIdSelect = document.getElementById('equipoId');
        const newEquipoSection = document.getElementById('newEquipoSection');
        
        if (!equipoIdSelect) return;

        if (clienteId === 'NEW') {
            newClienteSection.style.display = 'block';
            equipoIdSelect.innerHTML = '<option value="NEW">+ Crear Nuevo Equipo para este Cliente</option>';
            equipoIdSelect.disabled = false;
            onEquipoChange(); // show new equipo form
            
            // Reset fields
            document.getElementById('nuevoClienteNombre').required = true;
            document.getElementById('nuevoEquipoTipo').required = true;
            document.getElementById('nuevoEquipoMarca').required = true;
            document.getElementById('nuevoEquipoModelo').required = true;
        } else if (clienteId) {
            newClienteSection.style.display = 'none';
            document.getElementById('nuevoClienteNombre').required = false;
            
            // Check if client has equipment
            const clientEquipments = DataService.getEquiposByCliente(clienteId);
            
            let optionsHtml = '<option value="">Seleccionar equipo...</option>';
            optionsHtml += '<option value="NEW" style="font-weight: bold; color: var(--primary-color);">+ Crear Nuevo Equipo</option>';
            
            optionsHtml += clientEquipments.map(e => {
                const isSelected = (document.getElementById('equipoId').getAttribute('data-selected-val') === (e.equipoId || e.id)) ? 'selected' : '';
                return \`<option value="\${e.equipoId || e.id}" \${isSelected}>\${e.nombreEquipo || e.nombre_equipo || 'Equipo'} (\${e.marca || ''} \${e.modelo || ''}) - \${e.serie || ''}</option>\`;
            }).join('');
            
            equipoIdSelect.innerHTML = optionsHtml;
            equipoIdSelect.disabled = false;
            
            // Si el cliente seleccionado cambia, verificar si equipo estaba seleccionado
            onEquipoChange();
        } else {
            newClienteSection.style.display = 'none';
            equipoIdSelect.innerHTML = '<option value="">Primero seleccione un cliente...</option>';
            equipoIdSelect.disabled = true;
            newEquipoSection.style.display = 'none';
            document.getElementById('nuevoClienteNombre').required = false;
        }
    };
    `;
    rjs = rjs.replace(onClienteChangeBlock, newOnClienteChange.trim());
}

// 3. Change accessories field to multiple list button (from before)
const accesoriosOld = `<div class="form-group">
                    <label class="form-label">Artículos o Accesorios Recibidos (Cargador, Bolso, Cables, etc.)</label>
                    <textarea name="accesoriosIncluidos" class="form-textarea" rows="2" placeholder="Ej: Cargador original HP, Estuche negro..."></textarea>
                  </div>`;
const accesoriosOld2 = `<div class="form-group">
                    <label class="form-label">Artículos o Accesorios Recibidos (Cargador, Bolso, Cables, etc.)</label>
                    <textarea name="accesoriosIncluidos" class="form-textarea" rows="2" placeholder="Ej: Cargador original HP, Estuche negro...">\${recepcion?.accesorios_incluidos || recepcion?.accesoriosIncluidos || ''}</textarea>
                  </div>`;

const newAccesoriosBlock = `
                  <div class="form-group">
                    <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Artículos o Accesorios Recibidos</span>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="RecepcionesModule.addAccesorioInput()" style="padding: 2px 8px; font-size: 0.8rem;">+ Nueva Línea</button>
                    </label>
                    <div id="accesoriosContainer" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;">
                    </div>
                    <input type="hidden" name="accesoriosIncluidos" id="accesoriosIncluidosValue" value="\${recepcion?.accesorios_incluidos || recepcion?.accesoriosIncluidos || ''}">
                  </div>
`;

rjs = rjs.replace(accesoriosOld, newAccesoriosBlock);
rjs = rjs.replace(accesoriosOld2, newAccesoriosBlock);

// Inject inline accessory helpers into module
const accMethods = `
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
            <button type="button" class="btn btn--danger btn--icon" onclick="this.parentElement.remove(); RecepcionesModule.updateAccesoriosValue()" style="padding: 6px; min-width: 32px; height: 32px;" title="Remover">X</button>
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
`;
if (!rjs.includes('initAccesorios = () => {')) {
    const insertBeforeReturn = rjs.lastIndexOf('return {');
    rjs = rjs.slice(0, insertBeforeReturn) + accMethods + "\n  " + rjs.slice(insertBeforeReturn);

    // Add to return obj
    const returnObj = rjs.match(/return \{([^}]+)\};/)[1];
    rjs = rjs.replace(/return \{[^}]+\};/, `return {${returnObj},
        initAccesorios, addAccesorioInput, updateAccesoriosValue
    };`);
}


// 4. Update fecha recepcion to Central America string
const dateLine1 = `new Date().toISOString().slice(0, 16)`;
const nicaraguaTimeString = `new Date(new Date().toLocaleString("en-US", {timeZone: "America/Managua"})).toLocaleString("sv-SE").replace(' ', 'T').slice(0, 16)`; // output format: YYYY-MM-DDTHH:mm
rjs = rjs.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*16\)/g, nicaraguaTimeString);

// Update init calls into opening modals
// Ensure `initAccesorios`, `onClienteChange` are called after modal render
rjs = rjs.replace(/document\.getElementById\('recepcionModal'\)\.innerHTML\s*=\s*renderFormModal\(\);/g,
    `document.getElementById('recepcionModal').innerHTML = renderFormModal(); 
   setTimeout(() => { RecepcionesModule.initAccesorios(); }, 50);`);
rjs = rjs.replace(/document\.getElementById\('recepcionModal'\)\.innerHTML\s*=\s*renderFormModal\(recepcion\);/g,
    `document.getElementById('recepcionModal').innerHTML = renderFormModal(recepcion);
   setTimeout(() => { 
     RecepcionesModule.initAccesorios(); 
     const ci = document.getElementById('clienteId');
     const csearch = document.getElementById('clienteSearchInput');
     if(ci && ci.value) {
       // Restore text input from existing val
       const c = DataService.getClienteById(ci.value);
       if(c) csearch.value = \`\${c.codigo_cliente || c.codigoCliente || c.id || c.clienteId} - \${c.nombreCliente || c.empresa}\`;
       document.getElementById('equipoId').setAttribute('data-selected-val', recepcion.equipoId || recepcion.equipo_id);
       RecepcionesModule.onClienteChange(); 
     }
   }, 50);`);

fs.writeFileSync('js/modules/recepciones.js', rjs, 'utf8');
console.log('Patch complete.');
