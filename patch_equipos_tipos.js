const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'js/modules/equipos.js');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add getTiposEquipo, saveTiposEquipo and modal logic at the beginning of the IIFE
const utilsCode = `
  const getTiposEquipo = () => {
    const defaultTipos = ["Laptop", "Computadora", "Servidor", "Impresora", "Router", "Switch", "Firewall", "UPS", "NAS", "Otro"];
    try {
      const stored = localStorage.getItem('tiposEquipo');
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultTipos;
  };

  const saveTiposEquipo = (tipos) => {
    localStorage.setItem('tiposEquipo', JSON.stringify(tipos));
  };

  const openTiposModal = () => {
    const equipoModal = document.getElementById('equipoModal');
    if (!equipoModal) return;
    
    const existing = document.getElementById('tiposModal');
    if (existing) existing.remove();
    
    equipoModal.insertAdjacentHTML('beforeend', \`<div id="tiposModal">\${renderTiposModal()}</div>\`);
  };

  const closeTiposModal = () => {
    const modal = document.getElementById('tiposModal');
    if (modal) modal.remove();
    const datalist = document.getElementById('tipoEquipoList');
    if (datalist) {
      datalist.innerHTML = getTiposEquipo().map(t => \`<option value="\${t}">\`).join('');
    }
  };

  const addTipoEquipo = () => {
    const input = document.getElementById('nuevoTipoInput');
    const val = input.value.trim();
    if (val) {
      const tipos = getTiposEquipo();
      if (!tipos.includes(val)) {
        tipos.push(val);
        saveTiposEquipo(tipos);
        document.getElementById('tiposModal').innerHTML = renderTiposModal();
      } else {
        alert('Este tipo de equipo ya existe.');
      }
    }
  };

  const deleteTipoEquipo = (index) => {
    if (confirm('¿Eliminar este tipo de equipo?')) {
      const tipos = getTiposEquipo();
      tipos.splice(index, 1);
      saveTiposEquipo(tipos);
      document.getElementById('tiposModal').innerHTML = renderTiposModal();
    }
  };

  const editTipoEquipo = (index) => {
    const tipos = getTiposEquipo();
    const current = tipos[index];
    const val = prompt('Editar tipo de equipo:', current);
    if (val !== null && val.trim() !== '' && val.trim() !== current) {
      if (!tipos.includes(val.trim())) {
        tipos[index] = val.trim();
        saveTiposEquipo(tipos);
        document.getElementById('tiposModal').innerHTML = renderTiposModal();
      } else {
        alert('Este tipo de equipo ya existe.');
      }
    }
  };

  const renderTiposModal = () => {
    const tipos = getTiposEquipo();
    return \`
      <div class="modal-overlay open" style="z-index: 10001; background-color: rgba(0,0,0,0.6);" >
        <div class="modal modal--sm" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Tipos de Equipos</h3>
            <button class="modal__close" type="button" onclick="EquiposModule.closeTiposModal()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="form-group" style="display: flex; gap: 8px;">
              <input type="text" id="nuevoTipoInput" class="form-input" placeholder="Nuevo tipo..." onkeydown="if(event.key === 'Enter') { event.preventDefault(); EquiposModule.addTipoEquipo(); }">
              <button type="button" class="btn btn--primary" onclick="EquiposModule.addTipoEquipo()">Añadir</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
              \${tipos.map((t, idx) => \`
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-color);">
                  <span>\${t}</span>
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn btn--icon btn--ghost btn--sm" onclick="EquiposModule.editTipoEquipo(\${idx})" title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5l4 4L7 21l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button type="button" class="btn btn--icon btn--ghost btn--sm text-danger" onclick="EquiposModule.deleteTipoEquipo(\${idx})" title="Eliminar">
                      <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6V20a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              \`).join('')}
              \${tipos.length === 0 ? '<div style="padding: 12px; text-align:center; color: var(--text-muted)">Sin tipos</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    \`;
  };
`;

content = content.replace("let filterState = { search: '', estado: 'all', clienteId: 'all' };", "let filterState = { search: '', estado: 'all', clienteId: 'all' };\n" + utilsCode);

const regexDatalist = /<div class="form-group">\s*<label class="form-label form-label--required">Tipo de Equipo<\/label>\s*<input type="text" name="tipoEquipo" class="form-input" list="tipoEquipoList"[\s\S]*?<datalist id="tipoEquipoList">[\s\S]*?<\/datalist>\s*<\/div>/;

const newDatalist = `<div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="form-label form-label--required" style="margin-bottom: 0;">Tipo de Equipo</label>
                  <button type="button" class="btn btn--icon btn--ghost btn--sm" onclick="EquiposModule.openTiposModal()" title="Administrar tipos de equipo" style="height: 24px; width: 24px; padding: 2px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  </button>
                </div>
                <input type="text" name="tipoEquipo" class="form-input" list="tipoEquipoList"
                       value="\${equipo?.tipoEquipo || ''}" 
                       placeholder="Ej: Laptop, PC, Servidor..." required>
                <datalist id="tipoEquipoList">
                    \${getTiposEquipo().map(t => \`<option value="\${t}">\`).join('')}
                </datalist>
            </div>`;

if (regexDatalist.test(content)) {
    content = content.replace(regexDatalist, newDatalist);
    console.log('Datalist replaced!');
} else {
    console.log('Could not find datalist block with regex.');
}

const match = content.match(/return \{[\s\S]*?deleteEquipo,[\s\S]*?\};/);
if (match) {
    let replacedExports = match[0].replace('};', '  openTiposModal, closeTiposModal, addTipoEquipo, deleteTipoEquipo, editTipoEquipo\n  };');
    content = content.replace(match[0], replacedExports);
    console.log('Exports replaced!');
}

const formatRegex = /const formatTipoEquipo = \(tipo\) => \{[\s\S]*?return dict\[tipo\.toUpperCase\(\)\.trim\(\)\] \|\| 'Otro';\s*\};/;
const newFormat = `const formatTipoEquipo = (tipo) => {
      if (!tipo) return 'Equipo General';
      const dict = {
        'LAPTOP': 'Laptop',
        'PC ESCRITORIO': 'Computadora',
        'COMPUTADORA': 'Computadora',
        'SERVIDOR': 'Servidor',
        'IMPRESORA': 'Impresora',
        'ROUTER / SWITCH': 'Router',
        'ROUTER': 'Router',
        'SWITCH': 'Switch',
        'FIREWALL': 'Firewall',
        'UPS': 'UPS',
        'NAS': 'NAS',
        'TABLET': 'Otro',
        'TELÉFONO': 'Otro',
        'TELEFONO': 'Otro',
        'OTRO': 'Otro'
      };
      
      const upper = tipo.toUpperCase().trim();
      if (dict[upper]) return dict[upper];
      
      return tipo.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };`;

if (formatRegex.test(content)) {
    content = content.replace(formatRegex, newFormat);
    console.log('formatTipoEquipo updated!');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Patch complete.');
