const fs = require('fs');
const fn = 'js/modules/visitas.js';
let content = fs.readFileSync(fn, 'utf8');

const regexVars = /const selectedClienteId = visita\?\.clienteId \|\| '';/;
const newVars = `const selectedClienteId = visita?.clienteId || '';
    const selectedClienteObj = selectedClienteId ? clientes.find(c => c.id === selectedClienteId) : null;
    const clientDisplayFormat = c => \`\${c.codigo || c.clienteId || c.id || ''} - \${c.nombreCliente || c.empresa || 'Sin Nombre'}\`;
    const selectedClienteLabel = selectedClienteObj ? clientDisplayFormat(selectedClienteObj) : '';`;

content = content.replace(regexVars, newVars);

const regexSelect = /<div class="form-group">\s*<label class="form-label form-label--required">Cliente<\/label>\s*<select name="clienteId" class="form-select" required onchange="VisitasModule.onClienteChange\(this.value\)">[\s\S]*?<\/select>\s*<\/div>/;

const newSelect = `<style>
         .cliente-option:hover { background: var(--color-primary-50); color: var(--color-primary-700); }
      </style>
      <div class="form-group" style="position: relative;">
                <label class="form-label form-label--required">Cliente</label>
                <input type="hidden" name="clienteId" id="hiddenClienteId" value="\${selectedClienteId}" required>
                <input type="text" id="searchClienteInput" class="form-input" placeholder="Buscar código o nombre..." 
                       value="\${selectedClienteLabel}" 
                       autocomplete="off" 
                       onfocus="VisitasModule.showClientesList()" 
                       onblur="setTimeout(() => { const d = document.getElementById('clientesDropdownList'); if(d) d.style.display = 'none'; }, 250)"
                       oninput="VisitasModule.filterClientesList(this.value)" required>
                <div id="clientesDropdownList" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 1000; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); max-height: 250px; overflow-y: auto;">
                  \${clientes.map(c => \`
                    <div class="cliente-option" 
                         data-id="\${c.id}" 
                         data-label="\${c.codigo || c.clienteId || c.id || ''} - \${c.nombreCliente || c.empresa || ''}" 
                         onclick="VisitasModule.selectClienteInline('\${c.id}', this.getAttribute('data-label'))" 
                         style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                      <div style="font-weight: 500;">\${c.codigo || c.clienteId || c.id} - \${c.nombreCliente || c.empresa || ''}</div>
                    </div>
                  \`).join('')}
                  \${clientes.length === 0 ? \`<div style="padding: 10px 14px; color: var(--text-muted);">No hay clientes...</div>\` : ''}
                </div>
              </div>`;

if (regexSelect.test(content)) {
    content = content.replace(regexSelect, newSelect);
    console.log("Replaced select markup");
} else {
    console.log("Cannot find select block to replace");
}

const targetExport = `closeEquipoModal, deleteVisita
  };`;
const newExport = `closeEquipoModal, deleteVisita,
    showClientesList, filterClientesList, selectClienteInline
  };`;
content = content.replace(targetExport, newExport);


// Insert the new methods
let newMethods = `
  const showClientesList = () => {
    const dropdown = document.getElementById('clientesDropdownList');
    if (dropdown) dropdown.style.display = 'block';
  };

  const filterClientesList = (val) => {
    const dropdown = document.getElementById('clientesDropdownList');
    if (dropdown) dropdown.style.display = 'block';
    const term = val.toLowerCase();
    document.querySelectorAll('.cliente-option').forEach(el => {
      const label = (el.getAttribute('data-label') || '').toLowerCase();
      el.style.display = label.includes(term) ? 'block' : 'none';
      
      // Update the hidden input when filtering to force a selection
      const hiddenInput = document.getElementById('hiddenClienteId');
      if (hiddenInput) {
        hiddenInput.value = '';
        VisitasModule.onClienteChange('');
      }
    });
  };

  const selectClienteInline = (id, label) => {
    document.getElementById('hiddenClienteId').value = id;
    document.getElementById('searchClienteInput').value = label;
    document.getElementById('clientesDropdownList').style.display = 'none';
    document.getElementById('searchClienteInput').setCustomValidity('');
    VisitasModule.onClienteChange(id);
  };
`;

const replaceModalStr = `const closeModal = (event) => {`;
if (content.includes("showClientesList = ()")) {
    console.log("methods already injected");
} else {
    content = content.replace(replaceModalStr, newMethods + '\n  const closeModal = (event) => {');
}

fs.writeFileSync(fn, content, 'utf8');
console.log('done patching');
