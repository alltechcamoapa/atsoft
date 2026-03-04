const fs = require('fs');
let ejs = fs.readFileSync('js/modules/equipos.js', 'utf8');

// 1. Initial State
ejs = ejs.replace(`let filterState = { search: '', estado: 'all', clienteId: 'all' };`, `let filterState = { search: '', estado: 'all', clienteId: 'all', view: 'grid' };`);

// 2. Add view toggle buttons
const selectFiltersEnd = `              </select>
            </div>
          </div>
        </div>`;
const buttonsHtml = `              </select>
              <div class="view-toggle" style="display: flex; gap: 5px;">
                <button class="btn btn--icon \${filterState.view === 'list' ? 'btn--primary' : 'btn--ghost'}" onclick="EquiposModule.handleViewToggle('list')" title="Vista de Lista">
                  \${Icons.list || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>'}
                </button>
                <button class="btn btn--icon \${filterState.view === 'grid' ? 'btn--primary' : 'btn--ghost'}" onclick="EquiposModule.handleViewToggle('grid')" title="Vista de Cuadrícula">
                  \${Icons.grid || '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'}
                </button>
              </div>
            </div>
          </div>
        </div>`;
ejs = ejs.replace(selectFiltersEnd, buttonsHtml);

// 3. Grid vs List container update
const renderEquipmentCardsDef = "const renderEquipmentCards = (equipos) => {";
const renderEquipmentCardsLogic = `
  const renderEquipmentCards = (equipos) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'equipos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'equipos', 'delete');

    if (filterState.view === 'list') {
      let rows = equipos.map(equipo => {
        const cliente = DataService.getClienteById(equipo.clienteId);
        const reparaciones = DataService.getReparacionesByEquipo(equipo.equipoId);
        const statusClass = equipo.estado === 'Operativo' ? 'success' : equipo.estado === 'En Reparación' ? 'warning' : 'danger';
        return \`
          <tr>
            <td>
              <div style="font-weight: 500;">\${equipo.nombreEquipo}</div>
              <div style="font-size: 0.85rem; color: #666;">\${equipo.marca} \${equipo.modelo}</div>
            </td>
            <td><span class="badge badge--\${statusClass}">\${equipo.estado}</span></td>
            <td>\${equipo.serie || 'N/A'}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="https://ui-avatars.com/api/?name=\${encodeURIComponent(cliente?.nombreCliente || 'N')}&background=1a73e8&color=fff&size=24" style="border-radius: 50%; width: 24px; height: 24px;">
                <div>
                   <div style="line-height:1.2;">\${cliente?.nombreCliente || 'Sin cliente'}</div>
                   <div style="font-size: 0.75rem; color: #666;">\${cliente?.empresa || ''}</div>
                </div>
              </div>
            </td>
            <td>\${reparaciones.length} rep.</td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 5px; justify-content: flex-end;">
                  <button class="btn btn--ghost btn--icon btn--sm" onclick="EquiposModule.viewDetail('\${equipo.equipoId}')" title="Ver">\${Icons.eye || 'O'}</button>
                  \${canUpdate ? \`<button class="btn btn--ghost btn--icon btn--sm" onclick="EquiposModule.openEditModal('\${equipo.equipoId}')" title="Editar">\${Icons.edit || 'E'}</button>\` : ''}
                  \${canDelete ? \`<button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="EquiposModule.deleteEquipo('\${equipo.equipoId}')" title="Eliminar">\${Icons.trash || 'X'}</button>\` : ''}
              </div>
            </td>
          </tr>
        \`;
      }).join('');
      
      return \`
        <div class="table-responsive card" style="width: 100%; border-radius: 8px; overflow: hidden;">
          <table class="table" style="width: 100%; min-width: 800px; border-collapse: collapse;">
            <thead style="background: var(--bg-color); border-bottom: 1px solid var(--border-color);">
              <tr>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Equipo</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Estado</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Serie</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Cliente</th>
                <th style="padding: 12px 15px; text-align: left; font-weight: 600;">Reparaciones</th>
                <th style="padding: 12px 15px; text-align: right; font-weight: 600;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              \${rows}
            </tbody>
          </table>
        </div>
      \`;
    }
`;

const originalRenderCardsCode = `  const renderEquipmentCards = (equipos) => {
    const user = State.get('user');
    const canUpdate = DataService.canPerformAction(user.role, 'equipos', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'equipos', 'delete');`;

ejs = ejs.replace(originalRenderCardsCode, renderEquipmentCardsLogic);

// 4. Update the container class conditionally based on view type
const containerRegex = /<div class="equipment-grid">([\s\S]*?)<\/div>/;
const containerMatch = ejs.match(containerRegex);
if (containerMatch) {
    const updatedContainer = `<div class="\${filterState.view === 'list' ? 'equipment-list' : 'equipment-grid'}" style="\${filterState.view === 'list' ? 'display: block;' : ''}">` + containerMatch[1] + `</div>`;
    ejs = ejs.replace(containerMatch[0], updatedContainer);
}

// 5. Add handleViewToggle to methods
const handleViewToggleMethod = `
  const handleViewToggle = (view) => {
    filterState.view = view;
    App.refreshCurrentModule();
  };
`;
if (!ejs.includes('handleViewToggle')) {
    const submitHandlerIndex = ejs.indexOf('const handleSubmit =');
    ejs = ejs.slice(0, submitHandlerIndex) + handleViewToggleMethod + "\n  " + ejs.slice(submitHandlerIndex);
}

// 6. Export `handleViewToggle`
if (!ejs.includes('handleViewToggle,')) {
    const exportsMatch = ejs.match(/return \{([\s\S]*?)\};/);
    if (exportsMatch) {
        const newExports = exportsMatch[1].trim() + ",\n    handleViewToggle";
        ejs = ejs.replace(exportsMatch[1], "\n    " + newExports + "\n  ");
    }
}

fs.writeFileSync('js/modules/equipos.js', ejs, 'utf8');
console.log('Equipos grid/list view added successfully.');
