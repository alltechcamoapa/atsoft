/**
 * ALLTECH - Configuración Module
 * System settings and user preferences
 */

const ConfigModule = (() => {
  let currentTab = 'perfil'; // Track current tab
  let currentPosConfigTab = 'precio';
  let currentPaymentTab = 'transferencia';

  const render = () => {
    // Reset to default tab if not explicitly set
    if (!currentTab) currentTab = 'perfil';

    const user = State.get('user');
    const theme = State.get('theme');
    const config = DataService.getConfig();

    // Check permissions
    const canManageUsers = DataService.canPerformAction(user.role, 'usuarios', 'read');
    const canManageRoles = DataService.canPerformAction(user.role, 'configuracion', 'update'); // Assuming roles management requires config update

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Configuración</h2>
            <p class="module-subtitle">Preferencias del sistema y gestión de usuarios</p>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="card" style="margin-bottom: var(--spacing-lg);">
          <div class="card__body" style="padding: 0;">
            <div class="settings-tabs">
              <button class="settings-tab ${currentTab === 'perfil' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('perfil')">
                ${Icons.user} Mi Perfil
              </button>
              ${canManageUsers ? `
              <button class="settings-tab ${currentTab === 'usuarios' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('usuarios')">
                ${Icons.users} Gestión de Usuarios
              </button>
              ` : ''}
              ${canManageRoles ? `
              <button class="settings-tab ${currentTab === 'roles' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('roles')">
                ${Icons.shield} Roles y Permisos
              </button>
              ` : ''}
              ${canManageRoles ? `
              <button class="settings-tab ${currentTab === 'bitacora' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('bitacora')">
                ${Icons.fileText} Bitácora
              </button>
              ` : ''}
              ${canManageRoles ? `
              <button class="settings-tab ${currentTab === 'reportes-editor' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('reportes-editor')">
                ${Icons.edit} Editor de Reportes
              </button>
              ` : ''}
              <button class="settings-tab ${currentTab === 'empresa' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('empresa')">
                ${Icons.zap || Icons.briefcase} Empresa
              </button>
              <button class="settings-tab ${currentTab === 'sistema' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('sistema')">
                ${Icons.settings} Sistema
              </button>
              <button class="settings-tab ${currentTab === 'punto-venta' ? 'active' : ''}" 
                      onclick="ConfigModule.switchTab('punto-venta')">
                ${Icons.shoppingCart || '🛒'} Punto de Venta
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="settings-layout">
          ${currentTab === 'perfil' ? renderPerfilTab(user, theme) : ''}
          ${currentTab === 'usuarios' && canManageUsers ? renderUsuariosTab() : ''}
          ${currentTab === 'roles' && canManageRoles ? renderRolesTab() : ''}
          ${currentTab === 'bitacora' && canManageRoles ? renderBitacoraTab() : ''}
          ${currentTab === 'reportes-editor' && canManageRoles ? renderReportesEditorTab() : ''}
          ${currentTab === 'empresa' ? renderEmpresaTab() : ''}
          ${currentTab === 'sistema' ? renderSistemaTab(config) : ''}
          ${currentTab === 'punto-venta' ? renderPuntoVentaTab() : ''}
        </div>
      </div>

      <div id="configModal"></div>
    `;
  };

  // ========== TAB RENDERERS ==========

  const renderPerfilTab = (user, theme) => {
    return `
      <!-- User Profile -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.user} Perfil de Usuario</h4>
        </div>
        <div class="card__body">
          <div class="settings-profile">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1a73e8&color=fff&size=100" 
                 alt="${user.name}" 
                 class="settings-profile__avatar">
            <div class="settings-profile__info">
              <h3 class="settings-profile__name">${user.name}</h3>
              <p class="settings-profile__email">${user.email}</p>
              <div class="profile-details-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; font-size: 13px;">
                  <div>
                      <span class="text-muted d-block">Usuario</span>
                      <span class="font-medium">${user.username || 'N/A'}</span>
                  </div>
                  <div>
                      <span class="text-muted d-block">Rol</span>
                      <span class="badge badge--primary">${user.role}</span>
                  </div>
                  <div>
                      <span class="text-muted d-block">Teléfono</span>
                      <span class="font-medium">${user.phone || 'No registrado'}</span>
                  </div>
                  <div>
                      <span class="text-muted d-block">Dirección</span>
                      <span class="font-medium">${user.address || 'No registrada'}</span>
                  </div>
              </div>
            </div>
            
            <button class="btn btn--secondary btn--sm" style="margin-left: auto; align-self: flex-start;" onclick="ConfigModule.openEditProfile()">
                ${Icons.edit} Editar
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const renderUsuariosTab = () => {
    const users = DataService.getUsersSync() || [];
    const user = State.get('user');
    const canCreate = DataService.canPerformAction(user.role, 'usuarios', 'create');
    const canUpdate = DataService.canPerformAction(user.role, 'usuarios', 'update');
    const canDelete = DataService.canPerformAction(user.role, 'usuarios', 'delete');

    return `
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.users} Gestión de Usuarios</h4>
          ${canCreate ? `
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openCreateUser()">
            ${Icons.plus} Nuevo Usuario
          </button>
          ` : ''}
        </div>
        <div class="card__body" style="padding: 0;">
          ${users.length > 0 ? `
            <table class="data-table">
              <thead class="data-table__head">
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody class="data-table__body">
                ${users.map(u => `
                  <tr>
                    <td>
                      <div class="flex items-center gap-md">
                        <div class="avatar avatar--sm">
                          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1a73e8&color=fff" 
                               alt="${u.name}">
                        </div>
                        <div>
                          <div class="font-medium">${u.name}</div>
                          <div class="text-xs text-muted">${u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>${u.email}</td>
                    <td><span class="badge badge--primary">${u.role}</span></td>
                    <td><span class="badge badge--success">Activo</span></td>
                    <td>
                      <div class="flex gap-xs">
                        ${canUpdate ? `
                        <button class="btn btn--ghost btn--icon btn--sm" 
                                onclick="ConfigModule.editUser('${u.username}')"
                                title="Editar">
                          ${Icons.edit}
                        </button>
                        ` : ''}
                        ${canDelete ? `
                        <button class="btn btn--ghost btn--icon btn--sm" 
                                onclick="ConfigModule.deleteUser('${u.username}')"
                                title="Eliminar">
                          ${Icons.trash}
                        </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <div class="empty-state__icon">${Icons.users}</div>
              <h3 class="empty-state__title">No hay usuarios</h3>
              <p class="empty-state__description">Crea tu primer usuario para comenzar</p>
              ${canCreate ? `
              <button class="btn btn--primary" onclick="ConfigModule.openCreateUser()">
                ${Icons.plus} Crear Usuario
              </button>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;
  };

  const renderRolesTab = () => {
    const allRoles = DataService.getAvailableRoles();
    const allModulos = [
      { id: 'clientes', name: 'Clientes', icon: Icons.users },
      { id: 'recepciones', name: 'Recepción de Equipos', icon: Icons.inbox },
      { id: 'visitas', name: 'Visitas', icon: Icons.wrench },
      { id: 'equipos', name: 'Equipos', icon: Icons.monitor },
      { id: 'software', name: 'Software', icon: Icons.code },
      { id: 'contratos', name: 'Contratos', icon: Icons.fileText },
      { id: 'calendario', name: 'Calendarios de Trabajos', icon: Icons.calendar },
      { id: 'pedidos', name: 'Pedidos', icon: Icons.shoppingCart },
      { id: 'proformas', name: 'Proformas', icon: Icons.fileText },
      { id: 'productos', name: 'Productos', icon: Icons.package },
      { id: 'prestaciones', name: 'Prestaciones', icon: Icons.dollarSign },
      { id: 'gestion-financiera', name: 'Gestión Financiera', icon: Icons.wallet },
      { id: 'gestion-tecnicos', name: 'Gestión de Técnicos', icon: Icons.users },
      { id: 'reportes', name: 'Reportes', icon: Icons.barChart },
      { id: 'configuracion', name: 'Configuración', icon: Icons.settings },
      { id: 'usuarios', name: 'Usuarios', icon: Icons.users }
    ];

    const empresas = typeof DataService !== 'undefined' && DataService.getEmpresasSync ? DataService.getEmpresasSync() : [];
    if (empresas.length > 0) {
      allModulos.push({ id: 'divider', isDivider: true, name: 'Acceso a Empresas' });
      empresas.forEach(emp => {
        allModulos.push({ id: 'empresa_' + emp.id, name: 'Empresa: ' + emp.nombre, icon: '🏢' });
      });
    }

    return `
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.shield} Roles y Permisos</h4>
          <p class="text-sm text-muted" style="margin-top: var(--spacing-xs);">
            Configure permisos granulares (Crear, Leer, Editar, Eliminar) por módulo y rol
          </p>
        </div>
        <div class="card__body">
          ${allRoles.map(roleName => {
      const rolePerms = DataService.getRolePermissions(roleName) || {};

      return `
            <div class="role-permissions-card" style="margin-bottom: var(--spacing-xl); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--border-radius-lg); overflow: hidden;">
              <div style="padding: var(--spacing-lg); background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color);">
                <h5 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); margin-bottom: var(--spacing-xs); display: flex; align-items: center; gap: var(--spacing-sm);">
                  ${Icons.shield} ${roleName}
                </h5>
                <p class="text-sm text-muted">Control granular de permisos por módulo</p>
              </div>
              
              <div style="overflow-x: auto;">
                <table class="permissions-table" style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                      <th style="padding: var(--spacing-md); text-align: left; font-weight: var(--font-weight-semibold); min-width: 180px;">Módulo</th>
                      <th style="padding: var(--spacing-md); text-align: center; font-weight: var(--font-weight-semibold); width: 100px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);">
                          <span style="color: var(--color-primary-600);">${Icons.plus}</span>
                          <span style="font-size: var(--font-size-xs);">Crear</span>
                        </div>
                      </th>
                      <th style="padding: var(--spacing-md); text-align: center; font-weight: var(--font-weight-semibold); width: 100px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);">
                          <span style="color: var(--color-success);">${Icons.eye}</span>
                          <span style="font-size: var(--font-size-xs);">Leer</span>
                        </div>
                      </th>
                      <th style="padding: var(--spacing-md); text-align: center; font-weight: var(--font-weight-semibold); width: 100px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);">
                          <span style="color: var(--color-warning);">${Icons.edit}</span>
                          <span style="font-size: var(--font-size-xs);">Editar</span>
                        </div>
                      </th>
                      <th style="padding: var(--spacing-md); text-align: center; font-weight: var(--font-weight-semibold); width: 100px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);">
                          <span style="color: var(--color-danger);">${Icons.trash}</span>
                          <span style="font-size: var(--font-size-xs);">Eliminar</span>
                        </div>
                      </th>
                      <th style="padding: var(--spacing-md); text-align: center; font-weight: var(--font-weight-semibold); width: 120px;">
                        <span style="font-size: var(--font-size-xs);">Acceso Total</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allModulos.map(modulo => {
        if (modulo.isDivider) {
            return `<tr><td colspan="6" style="padding:var(--spacing-md); background:var(--bg-secondary); font-weight:bold; color:var(--text-primary);">${modulo.name}</td></tr>`;
        }
        const perms = rolePerms[modulo.id] || { create: false, read: false, update: false, delete: false };
        const hasFullAccess = perms.create && perms.read && perms.update && perms.delete;
        const hasNoAccess = !perms.create && !perms.read && !perms.update && !perms.delete;
        const hasReadOnly = perms.read && !perms.create && !perms.update && !perms.delete;

        return `
                      <tr style="border-bottom: 1px solid var(--border-color); ${perms.read ? 'background: var(--bg-primary);' : ''}">
                        <td style="padding: var(--spacing-md);">
                          <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                            <span style="color: ${perms.read ? 'var(--text-primary)' : 'var(--text-muted)'};">${modulo.icon || ''}</span>
                            <span style="font-weight: var(--font-weight-medium); color: ${perms.read ? 'var(--text-primary)' : 'var(--text-muted)'};">${modulo.name}</span>
                            ${hasFullAccess ? '<span class="badge badge--success" style="font-size: var(--font-size-xs); margin-left: var(--spacing-xs);">Full</span>' : ''}
                            ${hasReadOnly ? '<span class="badge badge--warning" style="font-size: var(--font-size-xs); margin-left: var(--spacing-xs);">Solo Lectura</span>' : ''}
                            ${hasNoAccess ? '<span class="badge badge--neutral" style="font-size: var(--font-size-xs); margin-left: var(--spacing-xs);">Sin Acceso</span>' : ''}
                          </div>
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <input type="checkbox" 
                                 class="permission-checkbox"
                                 ${perms.create ? 'checked' : ''}
                                 ${!perms.read ? 'disabled' : ''}
                                 onchange="ConfigModule.toggleSpecificPermission('${roleName}', '${modulo.id}', 'create', this.checked)"
                                 style="cursor: ${!perms.read ? 'not-allowed' : 'pointer'}; width: 18px; height: 18px;">
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <input type="checkbox" 
                                 class="permission-checkbox"
                                 ${perms.read ? 'checked' : ''}
                                 onchange="ConfigModule.toggleSpecificPermission('${roleName}', '${modulo.id}', 'read', this.checked)"
                                 style="cursor: pointer; width: 18px; height: 18px;">
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <input type="checkbox" 
                                 class="permission-checkbox"
                                 ${perms.update ? 'checked' : ''}
                                 ${!perms.read ? 'disabled' : ''}
                                 onchange="ConfigModule.toggleSpecificPermission('${roleName}', '${modulo.id}', 'update', this.checked)"
                                 style="cursor: ${!perms.read ? 'not-allowed' : 'pointer'}; width: 18px; height: 18px;">
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <input type="checkbox" 
                                 class="permission-checkbox"
                                 ${perms.delete ? 'checked' : ''}
                                 ${!perms.read ? 'disabled' : ''}
                                 onchange="ConfigModule.toggleSpecificPermission('${roleName}', '${modulo.id}', 'delete', this.checked)"
                                 style="cursor: ${!perms.read ? 'not-allowed' : 'pointer'}; width: 18px; height: 18px;">
                        </td>
                        <td style="padding: var(--spacing-md); text-align: center;">
                          <input type="checkbox" 
                                 class="permission-checkbox-full"
                                 ${hasFullAccess ? 'checked' : ''}
                                 onchange="ConfigModule.toggleFullAccess('${roleName}', '${modulo.id}', this.checked)"
                                 style="cursor: pointer; width: 18px; height: 18px;">
                        </td>
                      </tr>
                      `;
      }).join('')}
                  </tbody>
                </table>
              </div>
              
              <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-top: 1px solid var(--border-color); font-size: var(--font-size-xs); color: var(--text-muted);">
                <strong>Nota:</strong> Para poder Crear, Editar o Eliminar registros, el permiso de "Leer" debe estar activo.
              </div>
            </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  };

  const renderBitacoraTab = () => {
    const logs = LogService.getLogs();
    const stats = LogService.getStats();
    // Use window.matchMedia to check logical resolution if needed, but here simple slice
    const displayLogs = logs.slice(0, 50);

    const getAccionBadge = (accion) => {
      const badges = {
        'create': '<span class="badge badge--success">Crear</span>',
        'read': '<span class="badge badge--info">Leer</span>',
        'update': '<span class="badge badge--warning">Editar</span>',
        'delete': '<span class="badge badge--danger">Eliminar</span>'
      };
      return badges[accion] || `<span class="badge badge--neutral">${accion}</span>`;
    };

    const formatDate = (isoString) => {
      if (!isoString) return '-';
      const date = new Date(isoString);
      return date.toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
    };

    return `
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.fileText} Bitácora del Sistema</h4>
          <p class="text-sm text-muted" style="margin-top: var(--spacing-xs);">
            Registro de auditoría de actividad del sistema
          </p>
        </div>
        <div class="card__body">
          <!-- Stats Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
             <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-primary-500);">
               <div class="text-sm text-muted">Total Registros</div>
               <div style="font-size: 1.5rem; font-weight: bold;">${stats.total}</div>
             </div>
             <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-danger);">
               <div class="text-sm text-muted">Eliminaciones</div>
               <div style="font-size: 1.5rem; font-weight: bold;">${stats.porAccion.delete || 0}</div>
             </div>
             <div style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-success);">
               <div class="text-sm text-muted">Creaciones</div>
               <div style="font-size: 1.5rem; font-weight: bold;">${stats.porAccion.create || 0}</div>
             </div>
          </div>

          <!-- Actions Toolbar -->
          <div style="display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
            <button class="btn btn--secondary" onclick="App.refreshCurrentModule()">
              ${Icons.refresh} Actualizar
            </button>
            <button class="btn btn--secondary" onclick="ConfigModule.exportarBitacora()">
              ${Icons.download} Exportar JSON
            </button>
            <button class="btn btn--danger" onclick="if(confirm('¿Borrar historial?')) ConfigModule.limpiarBitacora()">
              ${Icons.trash} Limpiar
            </button>
          </div>

          <!-- Table -->
          <div style="overflow-x: auto;">
             <table class="table" style="width: 100%; text-align: left; border-collapse: collapse;">
               <thead>
                 <tr style="background: var(--bg-tertiary);">
                   <th style="padding: var(--spacing-sm); border-bottom: 2px solid var(--border-color);">Fecha</th>
                   <th style="padding: var(--spacing-sm); border-bottom: 2px solid var(--border-color);">Usuario</th>
                   <th style="padding: var(--spacing-sm); border-bottom: 2px solid var(--border-color);">Módulo</th>
                   <th style="padding: var(--spacing-sm); border-bottom: 2px solid var(--border-color);">Acción</th>
                   <th style="padding: var(--spacing-sm); border-bottom: 2px solid var(--border-color);">Detalle</th>
                 </tr>
               </thead>
               <tbody>
                 ${displayLogs.length > 0 ? displayLogs.map(log => `
                   <tr style="border-bottom: 1px solid var(--border-color);">
                     <td style="padding: var(--spacing-sm); font-size: var(--font-size-sm);">${formatDate(log.timestamp)}</td>
                     <td style="padding: var(--spacing-sm);">${log.nombreUsuario || log.usuario}</td>
                     <td style="padding: var(--spacing-sm);"><span class="badge badge--neutral">${log.modulo}</span></td>
                     <td style="padding: var(--spacing-sm);">${getAccionBadge(log.accion)}</td>
                     <td style="padding: var(--spacing-sm); font-size: var(--font-size-sm);">${log.descripcion || '-'}</td>
                   </tr>
                 `).join('') : `
                   <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-muted);">No hay registros</td></tr>
                 `}
               </tbody>
             </table>
          </div>
          ${logs.length > 50 ? `<div class="text-xs text-muted" style="margin-top: var(--spacing-sm); text-align: center;">Mostrando últimos 50 eventos</div>` : ''}
        </div>
      </div>
    `;
  };

  // ========== REPORT EDITOR TAB ==========
  const renderReportesEditorTab = () => {
    // Trigger init after render
    requestAnimationFrame(() => {
      if (typeof ReportEditorModule !== 'undefined') {
        ReportEditorModule.init();
      }
    });

    // Return the report editor content
    if (typeof ReportEditorModule !== 'undefined') {
      return ReportEditorModule.render();
    }

    return `
      <div class="card">
        <div class="card__body">
          <p class="text-muted">El módulo de Editor de Reportes no está disponible.</p>
        </div>
      </div>
    `;
  };

  const renderEmpresaTab = () => {
    const companyConfig = State.get('companyConfig') || {
      name: 'ALLTECH',
      logoUrl: 'assets/logo.png',
      sidebarColor: '#1a73e8',
      brandColor: '#1a73e8',
      address: '',
      phone: '',
      slogan: ''
    };
    const theme = State.get('theme') || 'light';

    return `
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.settings} Configuración de Empresa</h4>
          <p class="text-sm text-muted">Personaliza la identidad visual de la aplicación</p>
        </div>
        <div class="card__body">
           <form onsubmit="ConfigModule.saveCompanyConfig(event)">
              <div class="form-group">
                <label class="form-label">Nombre de la Empresa</label>
                <input type="text" name="name" class="form-input" value="${companyConfig.name}" required>
              </div>
              
              <div class="form-group">
                <label class="form-label">Eslogan / Subtítulo</label>
                <input type="text" name="slogan" class="form-input" value="${companyConfig.slogan || ''}" placeholder="Ej: Servicios Profesionales">
              </div>

              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" name="address" class="form-input" value="${companyConfig.address || ''}" placeholder="Ej: Calle Principal #123">
              </div>

              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" name="phone" class="form-input" value="${companyConfig.phone || ''}" placeholder="Ej: 8888-8888">
              </div>

              <div class="form-group">
                <label class="form-label">URL del Logo</label>
                <input type="text" name="logoUrl" class="form-input" value="${companyConfig.logoUrl || ''}" placeholder="assets/logo.png">
                <span class="form-hint">Ruta a la imagen del logo para reportes y sidebar.</span>
              </div>
              
              <div class="form-group">
                  <label class="form-label">Color del Sidebar</label>
                  <div style="display: flex; align-items: center; gap: 10px;">
                      <input type="color" name="sidebarColor" class="form-input" style="width: 60px; height: 40px; padding: 2px;" value="${companyConfig.sidebarColor || '#1a73e8'}" onchange="this.nextElementSibling.value = this.value">
                      <input type="text" class="form-input" value="${companyConfig.sidebarColor || '#1a73e8'}" readonly style="width: 100px;">
                  </div>
                  <span class="form-hint">Selecciona el color de fondo para el menú lateral.</span>
              </div>

              <div class="form-group">
                  <label class="form-label">Color de la Aplicación (Marca)</label>
                  <div style="display: flex; align-items: center; gap: 10px;">
                      <input type="color" name="brandColor" class="form-input" style="width: 60px; height: 40px; padding: 2px;" value="${companyConfig.brandColor || '#1a73e8'}" onchange="this.nextElementSibling.value = this.value">
                      <input type="text" class="form-input" value="${companyConfig.brandColor || '#1a73e8'}" readonly style="width: 100px;">
                  </div>
                  <span class="form-hint">Color principal para botones, enlaces y destacados.</span>
              </div>

              <div class="form-group">
                  <label class="form-label">Tema del Sistema (Lado Derecho)</label>
                  <select name="appTheme" class="form-select">
                      <option value="light" ${theme === 'light' ? 'selected' : ''}>Claro</option>
                      <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Oscuro</option>
                  </select>
                  <span class="form-hint">Selecciona el modo visual del área principal.</span>
              </div>

              <div class="form-actions" style="margin-top: var(--spacing-lg);">
                <button type="submit" class="btn btn--primary">${Icons.save} Guardar Cambios</button>
              </div>
           </form>
        </div>
      </div>

      <!-- Gestión de Empresas -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 class="card__title">${Icons.briefcase || '🏢'} Directorio de Empresas</h4>
            <p class="text-sm text-muted">Añade o edita entidades empresariales</p>
          </div>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openEmpresaModal()">
            ${Icons.plus || '+'} Nueva Empresa
          </button>
        </div>
        <div class="card__body" style="padding:0;">
          <table class="data-table">
            <thead class="data-table__head">
              <tr>
                <th>Nombre / Razón Social</th>
                <th>RUC</th>
                <th>Moneda</th>
                <th>Estado</th>
                <th style="width:100px; text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody class="data-table__body">
              ${(typeof DataService !== 'undefined' && DataService.getEmpresasSync ? DataService.getEmpresasSync() : []).map(emp => `
                <tr>
                  <td><strong>${emp.nombre}</strong><br><small class="text-muted">${emp.razon_social || ''}</small></td>
                  <td>${emp.ruc || '-'}</td>
                  <td><span class="badge badge--neutral">${emp.moneda_principal || 'USD'}</span></td>
                  <td><span class="badge ${emp.estado === 'Activo' ? 'badge--success' : 'badge--error'}">${emp.estado}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn--icon btn--ghost" onclick="ConfigModule.editEmpresa('${emp.id}', '${emp.nombre}')" title="Editar Nombre">✏️</button>
                  </td>
                </tr>
              `).join('') || `<tr><td colspan="5" style="text-align:center; padding:var(--spacing-md); color:var(--text-muted)">No hay empresas adicionales registradas</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Gestión de Bodegas -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 class="card__title">${Icons.home || '🏭'} Bodegas y Sucursales</h4>
            <p class="text-sm text-muted">Configura los puntos de almacenamiento e inventario</p>
          </div>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openBodegaModal()">
            ${Icons.plus || '+'} Nueva Bodega
          </button>
        </div>
        <div class="card__body" style="padding:0;">
          <table class="data-table">
            <thead class="data-table__head">
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Empresa Asociada</th>
                <th>Principal</th>
                <th style="width:100px; text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody class="data-table__body">
              ${(typeof DataService !== 'undefined' && DataService.getBodegasSync ? DataService.getBodegasSync() : []).map(bod => `
                <tr>
                  <td><span class="badge badge--primary">${bod.codigo}</span></td>
                  <td>${bod.nombre}</td>
                  <td>${bod.empresa?.nombre || 'Empresa Principal'}</td>
                  <td>${bod.es_principal ? '<span class="badge badge--success">Sí</span>' : '<span class="badge badge--neutral">No</span>'}</td>
                  <td style="text-align:right;">
                    <button class="btn btn--icon btn--ghost" onclick="ConfigModule.editBodega('${bod.id}', '${bod.nombre}')" title="Editar Nombre">✏️</button>
                    ${!bod.es_principal ? `<button class="btn btn--icon btn--ghost text-danger" onclick="ConfigModule.deleteBodega('${bod.id}')" title="Eliminar">🗑️</button>` : ''}
                  </td>
                </tr>
              `).join('') || `<tr><td colspan="5" style="text-align:center; padding:var(--spacing-md); color:var(--text-muted)">No hay bodegas registradas</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Gestión de Régimen Fiscal -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header">
          <h4 class="card__title">${Icons.scale || '⚖️'} Régimen Fiscal</h4>
          <p class="text-sm text-muted">Configura el régimen fiscal de la empresa y cómo se manejan los impuestos.</p>
        </div>
        <div class="card__body">
          ${renderRegimenSection()}
        </div>
      </div>

      <!-- Tipos de Pagos -->
      <div class="card" style="margin-top: var(--spacing-lg);">
        <div class="card__header">
          <h4 class="card__title">${Icons.wallet || '💳'} Tipos de Pagos</h4>
          <p class="text-sm text-muted">Configura las cuentas bancarias y métodos de pago aceptados</p>
        </div>
        <div class="card__body">
          ${renderTiposPagosSection()}
        </div>
      </div>
    `;
  };

  // ========== CAMBIO DE RÉGIMEN FISCAL ==========

  /**
   * Obtiene el régimen fiscal actual desde localStorage.
   * 'cuota_fija' = precios con 15% incluido (no se desglosa).
   * 'regimen_general' = precios base + IVA 15% desglosado.
   */
  const getRegimenActual = () => {
    // Primero intentar desde el config centralizado (sincronizado con Supabase)
    const config = typeof DataService !== 'undefined' ? DataService.getConfig() : {};
    if (config.regimenFiscal) return config.regimenFiscal;
    
    // Fallback a localStorage
    const suffix = getConfigEmpresaSuffix();
    return localStorage.getItem('regimen_fiscal' + suffix) || 'cuota_fija';
  };


  const setRegimenActual = async (regimen) => {
    if (typeof DataService !== 'undefined' && DataService.updateSystemConfig) {
      await DataService.updateSystemConfig('regimen_fiscal', regimen);
    }
    const suffix = getConfigEmpresaSuffix();
    localStorage.setItem('regimen_fiscal' + suffix, regimen);
  };


  const getRegimenHistorial = () => {
    const config = typeof DataService !== 'undefined' ? DataService.getConfig() : {};
    if (config.regimenHistorial) {
      try {
        return typeof config.regimenHistorial === 'string' 
          ? JSON.parse(config.regimenHistorial) 
          : config.regimenHistorial;
      } catch (e) { return []; }
    }
    const suffix = getConfigEmpresaSuffix();
    try { return JSON.parse(localStorage.getItem('regimen_historial' + suffix) || '[]'); } catch { return []; }
  };

  const addRegimenHistorial = async (entry) => {
    const historial = getRegimenHistorial();
    historial.unshift(entry);
    const sliced = historial.slice(0, 50);
    
    if (typeof DataService !== 'undefined' && DataService.updateSystemConfig) {
      await DataService.updateSystemConfig('regimen_historial', sliced);
    }
    
    const suffix = getConfigEmpresaSuffix();
    localStorage.setItem('regimen_historial' + suffix, JSON.stringify(sliced));
  };

  const renderRegimenSection = () => {
    const regimenActual = getRegimenActual();
    const isCuotaFija = regimenActual === 'cuota_fija';
    const historial = getRegimenHistorial().slice(0, 5);
    const totalProductos = typeof DataService !== 'undefined' && DataService.getProductosSync
      ? DataService.getProductosSync().length : 0;

    return `
      <!-- Estado Actual -->
      <div style="display: flex; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg); flex-wrap: wrap;">
        <div style="flex: 1; min-width: 260px; padding: var(--spacing-lg); border-radius: var(--border-radius-lg); border: 2px solid ${isCuotaFija ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)'}; background: ${isCuotaFija ? 'rgba(34, 197, 94, 0.05)' : 'rgba(59, 130, 246, 0.05)'}; position: relative;">
          <div style="position: absolute; top: 12px; right: 12px;">
            <span class="badge ${isCuotaFija ? 'badge--success' : 'badge--primary'}" style="font-size: var(--font-size-sm); padding: 4px 12px;">
              ${isCuotaFija ? '✅ Activo' : '✅ Activo'}
            </span>
          </div>
          <div style="font-size: 2rem; margin-bottom: var(--spacing-sm);">${isCuotaFija ? '🏪' : '🏢'}</div>
          <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); margin-bottom: var(--spacing-xs);">
            ${isCuotaFija ? 'Cuota Fija' : 'Régimen General'}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted); line-height: 1.5;">
            ${isCuotaFija
              ? 'Los precios de venta <strong>incluyen el 15%</strong> de impuesto. No se desglosa IVA en las facturas.'
              : 'Los precios de venta son <strong>precios base</strong>. Se agrega el <strong>15% IVA</strong> desglosado en las facturas.'}
          </div>
        </div>

        <div style="flex: 1; min-width: 260px; padding: var(--spacing-lg); border-radius: var(--border-radius-lg); border: 2px dashed ${isCuotaFija ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)'}; background: var(--bg-secondary); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: var(--spacing-md);">
          <div style="font-size: 2rem;">${isCuotaFija ? '🏢' : '🏪'}</div>
          <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--text-secondary);">
            Cambiar a: ${isCuotaFija ? 'Régimen General' : 'Cuota Fija'}
          </div>
          <button class="btn ${isCuotaFija ? 'btn--primary' : 'btn--warning'}" style="min-width: 200px;" onclick="ConfigModule.openCambioRegimenModal()">
            ⚖️ Cambiar Régimen
          </button>
          <p style="font-size: 10px; color: var(--text-muted); text-align: center; max-width: 280px;">
            ⚠️ Esta acción actualizará masivamente los precios de <strong>${totalProductos} producto(s)</strong>.
            Se requiere contraseña de administrador.
          </p>
        </div>
      </div>

      <!-- Información Técnica -->
      <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--spacing-sm);">📐 Fórmula de Conversión</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); font-size: var(--font-size-sm);">
          <div style="padding: var(--spacing-sm); background: var(--bg-primary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-success);">
            <strong>Cuota Fija → Régimen General:</strong><br>
            <code style="font-size: 11px;">Precio Base = Precio Actual ÷ 1.15</code><br>
            <code style="font-size: 11px;">IVA (15%) = Precio Base × 0.15</code><br>
            <code style="font-size: 11px;">Precio Final = Precio Base + IVA</code>
          </div>
          <div style="padding: var(--spacing-sm); background: var(--bg-primary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-primary-500);">
            <strong>Régimen General → Cuota Fija:</strong><br>
            <code style="font-size: 11px;">Precio con IVA incluido = Precio Base × 1.15</code><br>
            <code style="font-size: 11px;">Se elimina el desglose de IVA</code>
          </div>
        </div>
      </div>

      <!-- Historial de Cambios -->
      ${historial.length > 0 ? `
      <div style="border: 1px solid var(--border-color); border-radius: var(--border-radius-md); overflow: hidden;">
        <div style="padding: var(--spacing-sm) var(--spacing-md); background: var(--bg-tertiary); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-color);">
          📜 Historial de Cambios de Régimen
        </div>
        <div style="max-height: 200px; overflow-y: auto;">
          ${historial.map(h => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm) var(--spacing-md); border-bottom: 1px solid var(--border-color); font-size: 12px;">
              <div>
                <span class="badge ${h.nuevoRegimen === 'regimen_general' ? 'badge--primary' : 'badge--success'}" style="font-size: 10px;">
                  ${h.nuevoRegimen === 'regimen_general' ? '🏢 Régimen General' : '🏪 Cuota Fija'}
                </span>
                <span style="margin-left: var(--spacing-sm); color: var(--text-muted);">
                  ${h.productosActualizados || 0} productos actualizados
                </span>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600;">${h.usuario || 'Admin'}</div>
                <div style="font-size: 10px; color: var(--text-muted);">${h.fecha ? new Date(h.fecha).toLocaleString('es-NI') : '-'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    `;
  };

  /**
   * Abre el modal de confirmación de cambio de régimen.
   * Paso 1: Confirmación + Paso 2: Contraseña del admin.
   */
  const openCambioRegimenModal = () => {
    const regimenActual = getRegimenActual();
    const nuevoRegimen = regimenActual === 'cuota_fija' ? 'regimen_general' : 'cuota_fija';
    const totalProductos = typeof DataService !== 'undefined' && DataService.getProductosSync
      ? DataService.getProductosSync().length : 0;
    const user = State.get('user');

    const regimenLabel = nuevoRegimen === 'regimen_general' ? 'Régimen General (IVA 15% desglosado)' : 'Cuota Fija (15% incluido en precios)';
    const fromLabel = regimenActual === 'cuota_fija' ? 'Cuota Fija' : 'Régimen General';

    document.getElementById('configModal').innerHTML = `
    <div class="modal-overlay open" style="z-index: 999999;">
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 520px;">
        <div class="modal__header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border-radius: 12px 12px 0 0;">
          <h3 class="modal__title" style="color: white;">⚖️ Cambio de Régimen Fiscal</h3>
          <button class="modal__close" onclick="ConfigModule.closeModal()" style="color: white;">${Icons.x}</button>
        </div>
        <div class="modal__body" style="padding: var(--spacing-lg);">
          <!-- Información del Cambio -->
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--border-radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
            <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
              <div style="text-align: center;">
                <div style="font-size: 1.3rem;">${regimenActual === 'cuota_fija' ? '🏪' : '🏢'}</div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted);">${fromLabel}</div>
              </div>
              <div style="font-size: 1.5rem; color: var(--color-warning);">➡️</div>
              <div style="text-align: center;">
                <div style="font-size: 1.3rem;">${nuevoRegimen === 'regimen_general' ? '🏢' : '🏪'}</div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-primary);">${regimenLabel}</div>
              </div>
            </div>
            <div style="font-size: 12px; line-height: 1.6; color: var(--text-secondary);">
              ${nuevoRegimen === 'regimen_general'
                ? `<strong>Se realizarán los siguientes cambios:</strong>
                   <ul style="margin: 4px 0 0 16px; padding: 0;">
                     <li>Se extraerá el 15% incluido del precio de venta actual</li>
                     <li>Se obtendrá el <strong>precio base</strong> (sin impuesto)</li>
                     <li>Se registrará el <strong>IVA 15%</strong> como impuesto desglosado</li>
                     <li>El precio final visible será el mismo, pero desglosado</li>
                   </ul>`
                : `<strong>Se realizarán los siguientes cambios:</strong>
                   <ul style="margin: 4px 0 0 16px; padding: 0;">
                     <li>Se tomará el precio base actual</li>
                     <li>Se incluirá el 15% directamente en el precio de venta</li>
                     <li>Se eliminará el desglose de IVA</li>
                   </ul>`
              }
            </div>
          </div>

          <!-- Alerta Importante -->
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--border-radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg); display: flex; gap: var(--spacing-sm); align-items: flex-start;">
            <span style="font-size: 1.2rem;">⚠️</span>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              <strong style="color: var(--color-danger);">Acción irreversible parcial:</strong>
              Se actualizarán los precios de <strong>${totalProductos} producto(s)</strong> de forma masiva.
              Se guardará un registro del cambio para referencia futura.
            </div>
          </div>

          <!-- Confirmación -->
          <div style="margin-bottom: var(--spacing-lg);">
            <label style="display: flex; align-items: center; gap: var(--spacing-sm); font-size: 13px; font-weight: 600; cursor: pointer; padding: var(--spacing-sm); border: 1px solid var(--border-color); border-radius: var(--border-radius-md);">
              <input type="checkbox" id="regimenConfirmCheck" onchange="document.getElementById('regimenPassSection').style.display = this.checked ? 'block' : 'none';">
              Entiendo que esta acción modificará los precios de todos los productos
            </label>
          </div>

          <!-- Sección de Contraseña (oculta hasta confirmar) -->
          <div id="regimenPassSection" style="display: none;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--spacing-sm); padding-bottom: 4px; border-bottom: 1px solid var(--border-color);">
              🔐 Verificación de Seguridad
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: var(--spacing-sm);">
              Ingrese la contraseña del usuario administrador activo (<strong>${user?.name || user?.username || 'Admin'}</strong>) para confirmar.
            </p>
            <div class="form-group" style="margin-bottom: var(--spacing-md);">
              <label class="form-label form-label--required">Contraseña del Administrador</label>
              <input type="password" id="regimenAdminPass" class="form-input" placeholder="Ingrese su contraseña" autocomplete="current-password">
            </div>
            <div id="regimenError" style="display: none; color: var(--color-danger); font-size: 12px; margin-bottom: var(--spacing-sm); padding: var(--spacing-sm); background: rgba(239,68,68,0.08); border-radius: var(--border-radius-sm);"></div>
            <div id="regimenProgress" style="display: none; text-align: center; padding: var(--spacing-lg);">
              <div style="font-size: 2rem; margin-bottom: var(--spacing-sm);">⏳</div>
              <div style="font-weight: 600; margin-bottom: var(--spacing-xs);">Actualizando precios...</div>
              <div id="regimenProgressText" style="font-size: 12px; color: var(--text-muted);">Preparando datos...</div>
              <div style="margin-top: var(--spacing-sm); height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                <div id="regimenProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 3px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal__footer" style="border-top: 1px solid var(--border-color); padding: var(--spacing-md) var(--spacing-lg);">
          <button type="button" class="btn btn--secondary" onclick="ConfigModule.closeModal()">Cancelar</button>
          <button type="button" class="btn btn--warning" id="regimenSubmitBtn" onclick="ConfigModule.ejecutarCambioRegimen('${nuevoRegimen}')" style="min-width: 160px;">
            ⚖️ Confirmar Cambio
          </button>
        </div>
      </div>
    </div>
    `;
  };

  /**
   * Ejecuta el cambio de régimen:
   * 1. Verifica la contraseña del admin usando DataService.authenticateUser
   * 2. Actualiza masivamente los precios de los productos
   * 3. Guarda historial del cambio
   */
  const ejecutarCambioRegimen = async (nuevoRegimen) => {
    const confirmCheck = document.getElementById('regimenConfirmCheck');
    if (!confirmCheck || !confirmCheck.checked) {
      alert('Debe confirmar que entiende los cambios antes de continuar.');
      return;
    }

    const passwordInput = document.getElementById('regimenAdminPass');
    const password = passwordInput?.value?.trim();
    if (!password) {
      showRegimenError('Debe ingresar la contraseña del administrador.');
      passwordInput?.focus();
      return;
    }

    const user = State.get('user');
    if (!user || !user.username) {
      showRegimenError('No se pudo identificar al usuario activo.');
      return;
    }

    // Deshabilitar botón
    const submitBtn = document.getElementById('regimenSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Verificando...';
    }

    // Verificar contraseña del admin
    try {
      const authResult = await DataService.authenticateUser(user.username, password);

      if (authResult.error) {
        showRegimenError('❌ Contraseña incorrecta. Intente nuevamente.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '⚖️ Confirmar Cambio';
        }
        passwordInput?.focus();
        return;
      }
    } catch (authError) {
      showRegimenError('Error de autenticación: ' + (authError.message || 'Intente de nuevo'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '⚖️ Confirmar Cambio';
      }
      return;
    }

    // Contraseña verificada — mostrar progreso
    const passSection = document.getElementById('regimenPassSection');
    const progressDiv = document.getElementById('regimenProgress');
    if (passSection) {
      // Ocultar inputs de contraseña, mostrar progreso
      passSection.querySelectorAll('.form-group, p, div[style*="border-bottom"]').forEach(el => el.style.display = 'none');
      if (progressDiv) progressDiv.style.display = 'block';
    }
    const errorDiv = document.getElementById('regimenError');
    if (errorDiv) errorDiv.style.display = 'none';

    try {
      await procesarCambioRegimenMasivo(nuevoRegimen, user);
    } catch (processError) {
      showRegimenError('Error en el proceso: ' + (processError.message || 'Error desconocido'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '⚖️ Confirmar Cambio';
      }
    }
  };

  /**
   * Actualización masiva de precios de productos.
   * Cuota Fija → Régimen General:
   *   precioBase = precioVentaActual / 1.15
   *   IVA = precioBase * 0.15
   *   Se guarda precioBase como nuevo precio_venta y 15 como impuesto_iva
   * 
   * Régimen General → Cuota Fija:
   *   precioConIVA = precioVentaBase * 1.15
   *   Se guarda precioConIVA como precio_venta y 0 como impuesto_iva
   */
  const procesarCambioRegimenMasivo = async (nuevoRegimen, user) => {
    const productos = typeof DataService !== 'undefined' && DataService.getProductosSync
      ? DataService.getProductosSync() : [];
    const total = productos.length;
    let actualizados = 0;
    let errores = 0;
    const IVA_RATE = 0.15;
    const detallesCambios = [];  // Registro detallado por producto

    updateRegimenProgress(0, total, 'Iniciando actualización masiva...');

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      const precioVentaActual = parseFloat(producto.precioVenta || producto.precio || 0);
      const precioCostoActual = parseFloat(producto.precioCompra || producto.costo || 0);

      if (precioVentaActual <= 0) {
        // Producto sin precio, omitir
        updateRegimenProgress(i + 1, total, `Omitido: ${producto.nombre || 'Sin nombre'} (sin precio)`);
        continue;
      }

      let nuevoPrecioVenta, impuestoIva, precioBase, ivaAmount;

      if (nuevoRegimen === 'regimen_general') {
        // Cuota Fija → Régimen General: extraer el 15% incluido
        precioBase = precioVentaActual / (1 + IVA_RATE);
        ivaAmount = precioBase * IVA_RATE;
        nuevoPrecioVenta = Math.round(precioBase * 100) / 100;
        impuestoIva = 15;
      } else {
        // Régimen General → Cuota Fija: incluir el 15% en el precio
        precioBase = precioVentaActual;
        ivaAmount = precioBase * IVA_RATE;
        nuevoPrecioVenta = Math.round((precioBase * (1 + IVA_RATE)) * 100) / 100;
        impuestoIva = 0;
      }

      try {
        await DataService.updateProducto(producto.id, {
          precioVenta: nuevoPrecioVenta,
          precio: nuevoPrecioVenta,
          impuestoIva: impuestoIva
        });

        detallesCambios.push({
          productoId: producto.id,
          nombre: producto.nombre,
          precioAnterior: precioVentaActual,
          precioNuevo: nuevoPrecioVenta,
          ivaPorcentaje: impuestoIva,
          ivaMontoExtraido: Math.round(ivaAmount * 100) / 100
        });

        actualizados++;
      } catch (updateError) {
        console.error(`Error actualizando producto ${producto.nombre}:`, updateError);
        errores++;
      }

      updateRegimenProgress(i + 1, total, `Procesando: ${producto.nombre || 'Producto'}`);

      // Pequeña pausa cada 10 productos para no sobrecargar
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Guardar el nuevo régimen
    await setRegimenActual(nuevoRegimen);

    // Guardar historial
    await addRegimenHistorial({
      fecha: new Date().toISOString(),
      usuario: user.name || user.username,
      regimenAnterior: nuevoRegimen === 'regimen_general' ? 'cuota_fija' : 'regimen_general',
      nuevoRegimen: nuevoRegimen,
      productosActualizados: actualizados,
      errores: errores,
      detalles: detallesCambios
    });

    // Registrar en bitácora
    if (typeof LogService !== 'undefined') {
      LogService.log('configuracion', 'update', 'regimen_fiscal',
        `Cambio de régimen: ${nuevoRegimen === 'regimen_general' ? 'Cuota Fija → Régimen General' : 'Régimen General → Cuota Fija'}. ${actualizados} productos actualizados.`,
        { nuevoRegimen, actualizados, errores }
      );
    }

    // Mostrar resultado
    updateRegimenProgress(total, total, '¡Proceso completado!');

    setTimeout(() => {
      closeModal();
      App.refreshCurrentModule();
      alert(
        `✅ Cambio de régimen completado exitosamente.\n\n` +
        `📊 Resumen:\n` +
        `• Régimen: ${nuevoRegimen === 'regimen_general' ? 'Régimen General (IVA 15%)' : 'Cuota Fija (15% incluido)'}\n` +
        `• Productos actualizados: ${actualizados}\n` +
        `${errores > 0 ? '• Errores: ' + errores + '\n' : ''}` +
        `• El registro ha sido guardado en el historial.`
      );
    }, 800);
  };

  const showRegimenError = (message) => {
    const errorDiv = document.getElementById('regimenError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  };

  const updateRegimenProgress = (current, total, message) => {
    const progressBar = document.getElementById('regimenProgressBar');
    const progressText = document.getElementById('regimenProgressText');
    if (progressBar) {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      progressBar.style.width = percent + '%';
    }
    if (progressText) {
      progressText.textContent = `${message} (${current}/${total})`;
    }
  };

  const renderSistemaTab = (config) => {
    const theme = State.get('theme') || 'light';

    return `
      <!-- Currency Settings -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.wallet} Moneda y Finanzas</h4>
        </div>
        <div class="card__body">
          <div class="settings-group">
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Moneda Principal</h5>
                <p class="settings-item__description">Moneda por defecto para nuevos registros</p>
              </div>
              <select class="form-select" style="width: 150px;" 
                      onchange="ConfigModule.setMoneda(this.value)">
                <option value="USD" ${config.monedaPrincipal === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="NIO" ${config.monedaPrincipal === 'NIO' ? 'selected' : ''}>NIO (C$)</option>
              </select>
            </div>
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Tipo de Cambio USD/NIO</h5>
                <p class="settings-item__description">Tasa de conversión actual (ejemplo: 36.85)</p>
              </div>
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <span class="text-sm text-muted">1 USD =</span>
                <input type="number" class="form-input" 
                       style="width: 120px; text-align: right; font-weight: var(--font-weight-semibold);"
                       value="${config.tipoCambio}" 
                       step="0.01"
                       min="0"
                       placeholder="36.85"
                       onchange="ConfigModule.setTipoCambio(this.value)">
                <span class="text-sm text-muted">C$</span>
                <button type="button" class="btn btn--primary btn--sm" style="height:32px;font-size:11px;padding:0 12px;white-space:nowrap;" onclick="ConfigModule.saveTipoCambio()">💾 Guardar Tasa</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.bell} Notificaciones</h4>
        </div>
        <div class="card__body">
          <div class="settings-group">
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Alertas de Contratos</h5>
                <p class="settings-item__description">Notificar cuando un contrato está por vencer</p>
              </div>
              <label class="toggle">
                <input type="checkbox" class="toggle__input" 
                       ${config.alertasContratos ? 'checked' : ''}
                       onchange="ConfigModule.toggleAlertasContratos(this.checked)">
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
              </label>
            </div>
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Días de Anticipación</h5>
                <p class="settings-item__description">Días antes del vencimiento para alertar</p>
              </div>
              <input type="number" class="form-input" style="width: 100px;"
                     value="${config.diasAnticipacion}"
                     min="1" max="90"
                     onchange="ConfigModule.setDiasAnticipacion(this.value)">
            </div>
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Recordatorios de Visitas</h5>
                <p class="settings-item__description">Enviar recordatorio antes de visitas programadas</p>
              </div>
              <label class="toggle">
                <input type="checkbox" class="toggle__input" 
                       ${config.recordatoriosVisitas ? 'checked' : ''}
                       onchange="ConfigModule.toggleRecordatoriosVisitas(this.checked)">
                <span class="toggle__track"><span class="toggle__thumb"></span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.settings} Gestión de Datos</h4>
        </div>
        <div class="card__body">
          <div class="settings-group">
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Exportar Datos</h5>
                <p class="settings-item__description">Descargar todos los datos del sistema</p>
              </div>
              <button class="btn btn--secondary btn--sm" onclick="ConfigModule.exportData()">
                ${Icons.fileText} Exportar
              </button>
            </div>
            <div class="settings-item">
              <div class="settings-item__info">
                <h5 class="settings-item__title">Limpiar Caché Local</h5>
                <p class="settings-item__description">Eliminar datos temporales del navegador</p>
              </div>
              <button class="btn btn--secondary btn--sm" onclick="ConfigModule.clearCache()">
                ${Icons.trash} Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">${Icons.info} Acerca de</h4>
        </div>
        <div class="card__body">
          <div class="about-info">
            <img src="assets/logo.png" alt="ALLTECH Logo" class="about-logo-img" style="display: block; margin: 0 auto var(--spacing-md) auto; max-width: 180px; height: auto; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));">
            <h3>ALLTECH</h3>
            <p class="text-muted">Sistema de Gestión Empresarial</p>
            <p class="text-sm">Versión 1.0.1</p>
            <p class="text-sm" style="margin-top: var(--spacing-sm); color: var(--text-secondary);">
              📍 Camoapa, Nicaragua
            </p>
            <p class="text-xs text-muted" style="margin-top: var(--spacing-md);">
              Desarrollado por ALLTECH © 2026
            </p>
          </div>
        </div>
      </div>
    `;
  };

  // ========== PUNTO DE VENTA TAB ==========
  // Multi-Empresa: sufijo para aislar config POS por empresa en localStorage
  const getConfigEmpresaSuffix = () => {
    try {
      const user = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
      return user?.empresa_id ? '_' + user.empresa_id.substring(0, 8) : '';
    } catch { return ''; }
  };

  const getPosData = (key) => {
    const actualKey = key.startsWith('pos_') ? key + getConfigEmpresaSuffix() : key;
    try { return JSON.parse(localStorage.getItem(actualKey) || '[]'); } catch { return []; }
  };
  const setPosData = (key, data) => {
    const actualKey = key.startsWith('pos_') ? key + getConfigEmpresaSuffix() : key;
    localStorage.setItem(actualKey, JSON.stringify(data));
  };

  const setPosConfigTab = (tab) => {
    currentPosConfigTab = tab;
    App.refreshCurrentModule();
  };

  const renderPuntoVentaTab = () => {
    let divisas = getPosData('pos_divisas');
    if (divisas.length === 0) {
      divisas = [
        { tipo: 'Billete', divisa: 'USD', nombre: '100 Dólares', valor: 100 },
        { tipo: 'Billete', divisa: 'USD', nombre: '50 Dólares', valor: 50 },
        { tipo: 'Billete', divisa: 'USD', nombre: '20 Dólares', valor: 20 },
        { tipo: 'Billete', divisa: 'USD', nombre: '10 Dólares', valor: 10 },
        { tipo: 'Billete', divisa: 'USD', nombre: '5 Dólares', valor: 5 },
        { tipo: 'Billete', divisa: 'USD', nombre: '2 Dólares', valor: 2 },
        { tipo: 'Billete', divisa: 'USD', nombre: '1 Dólar', valor: 1 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '1 Dólar (Moneda)', valor: 1 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '50 Centavos', valor: 0.50 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '25 Centavos', valor: 0.25 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '10 Centavos', valor: 0.10 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '5 Centavos', valor: 0.05 },
        { tipo: 'Moneda', divisa: 'USD', nombre: '1 Centavo', valor: 0.01 }
      ];
      setPosData('pos_divisas', divisas);
      if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.createConfiguracionPos) {
        divisas.forEach(d => {
          SupabaseDataService.createConfiguracionPos({ tipo: 'pos_divisas', datos: d }).then(res => {
            if(res.success && res.data) d.id = res.data.id;
          });
        });
      }
    }

    const listas = getPosData('pos_lista_precios');

    const tabs = [
      { id: 'precio', name: 'Listas de Precio' },
      { id: 'divisas', name: 'Contador de Divisas' }
    ];

    let content = '';
    if (currentPosConfigTab === 'precio') {
      content = `
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center;">
          <h4 class="card__title">Catálogo: Lista de Precios</h4>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('precio')">${Icons.plus || '➕'} Agregar</button>
        </div>
        <div class="card__body" style="padding:0;">
          ${listas.length > 0 ? `
            <table class="data-table">
              <thead class="data-table__head"><tr><th>Código Precio</th><th>Nombre de Precio</th><th>Acciones</th></tr></thead>
              <tbody class="data-table__body">
                ${listas.map((t, i) => `<tr><td style="font-weight:600; color:var(--primary);">${t.codigo}</td><td>${t.nombre}</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem('pos_lista_precios', ${i})">${Icons.trash || '🗑️'}</button></td></tr>`).join('')}
              </tbody>
            </table>
          ` : '<p style="padding: var(--spacing-md); text-align: center; color: var(--text-muted);">No hay listas de precios registradas</p>'}
        </div>`;
    } else if (currentPosConfigTab === 'divisas') {
      content = `
        <div class="card__header" style="display:flex; justify-content:space-between; align-items:center;">
          <h4 class="card__title">Contador de Divisas</h4>
          <button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('divisas')">${Icons.plus || '➕'} Agregar</button>
        </div>
        <div class="card__body" style="padding:0;">
          ${divisas.length > 0 ? `
            <table class="data-table">
              <thead class="data-table__head"><tr><th>Tipo</th><th>Divisa</th><th>Nombre</th><th>Valor</th><th>Acciones</th></tr></thead>
              <tbody class="data-table__body">
                ${divisas.map((t, i) => `<tr>
                  <td><span class="badge ${t.tipo === 'Billete' ? 'badge--primary' : 'badge--neutral'}">${t.tipo}</span></td>
                  <td>${t.divisa}</td>
                  <td>${t.nombre}</td>
                  <td style="font-weight:bold;">${Number(t.valor).toFixed(2)}</td>
                  <td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem('pos_divisas', ${i})">${Icons.trash || '🗑️'}</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          ` : '<p style="padding: var(--spacing-md); text-align: center; color: var(--text-muted);">No hay divisas registradas</p>'}
        </div>`;
    }

    return `
      <!-- Tabs Navigation -->
      <div style="display:flex; gap:12px; margin-bottom:var(--spacing-md); flex-wrap:wrap; background:var(--bg-secondary); padding:10px; border-radius:12px; border:1px solid var(--border-color);">
        ${tabs.map(t => `<button class="btn btn--sm ${currentPosConfigTab === t.id ? 'btn--primary' : 'btn--ghost'}" onclick="ConfigModule.setPosConfigTab('${t.id}')">${t.name}</button>`).join('')}
      </div>
      <!-- Tab Content -->
      <div class="card" style="margin-bottom: var(--spacing-lg);">
        ${content}
      </div>
    `;
  };

  const setPaymentTab = (tab) => { currentPaymentTab = tab; App.refreshCurrentModule(); };

  const renderTiposPagosSection = () => {
    const transferencias = getPosData('pos_transferencias');
    const tarjetas = getPosData('pos_tarjetas');
    const tarjetasAsumir = getPosData('pos_tarjetas_asumir');
    const extras = getPosData('pos_extrafinanciamiento');
    const payTabs = [
      { id: 'transferencia', name: '🏦 Transferencias', count: transferencias.length },
      { id: 'tarjeta', name: '💳 Tarjetas', count: tarjetas.length },
      { id: 'tarjeta_asumir', name: '💳 Tarjetas (Asumir)', count: tarjetasAsumir.length },
      { id: 'extra', name: '📈 Extrafinanciamiento', count: extras.length }
    ];
    let content = '';
    if (currentPaymentTab === 'transferencia') {
      content = `<div class="card__header" style="display:flex; justify-content:space-between; align-items:center;"><h4 class="card__title">Transferencia Bancaria</h4><button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('transferencia')">${Icons.plus || '➕'} Agregar</button></div><div class="card__body" style="padding:0;">${transferencias.length > 0 ? `<table class="data-table"><thead class="data-table__head"><tr><th>Banco</th><th>Divisa</th><th>Número de Cuenta</th><th>Acciones</th></tr></thead><tbody class="data-table__body">${transferencias.map((t, i) => '<tr><td>'+t.banco+'</td><td><span class="badge badge--primary">'+t.divisa+'</span></td><td style="font-family:monospace;">'+t.numeroCuenta+'</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem(\'pos_transferencias\', '+i+')">'+(Icons.trash||'🗑️')+'</button></td></tr>').join('')}</tbody></table>` : '<p style="padding:var(--spacing-md);text-align:center;color:var(--text-muted);">No hay cuentas registradas</p>'}</div>`;
    } else if (currentPaymentTab === 'tarjeta') {
      content = `<div class="card__header" style="display:flex; justify-content:space-between; align-items:center;"><h4 class="card__title">Tarjeta (POS Bancario)</h4><button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('tarjeta')">${Icons.plus || '➕'} Agregar</button></div><div class="card__body" style="padding:0;">${tarjetas.length > 0 ? `<table class="data-table"><thead class="data-table__head"><tr><th>POS Banco</th><th>% Bancario</th><th>% IR</th><th>% Total</th><th>Acciones</th></tr></thead><tbody class="data-table__body">${tarjetas.map((t, i) => '<tr><td>'+t.posBanco+'</td><td>'+Number(t.porcentajeBancario).toFixed(2)+'%</td><td>'+Number(t.porcentajeIR).toFixed(2)+'%</td><td><strong>'+(Number(t.porcentajeBancario)+Number(t.porcentajeIR)).toFixed(2)+'%</strong></td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem(\'pos_tarjetas\', '+i+')">'+(Icons.trash||'🗑️')+'</button></td></tr>').join('')}</tbody></table>` : '<p style="padding:var(--spacing-md);text-align:center;color:var(--text-muted);">No hay configuraciones de POS</p>'}</div>`;
    } else if (currentPaymentTab === 'tarjeta_asumir') {
      content = `<div class="card__header" style="display:flex; justify-content:space-between; align-items:center;"><h4 class="card__title">Tarjeta (Asumir Comisión)</h4><button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('tarjeta_asumir')">${Icons.plus || '➕'} Agregar</button></div><div class="card__body" style="padding:0;">${tarjetasAsumir.length > 0 ? `<table class="data-table"><thead class="data-table__head"><tr><th>POS Banco</th><th>% Comisión</th><th>% IR</th><th>Acciones</th></tr></thead><tbody class="data-table__body">${tarjetasAsumir.map((t, i) => '<tr><td>'+t.posBanco+'</td><td>'+Number(t.porcentajeBancario).toFixed(2)+'%</td><td>'+Number(t.porcentajeIR).toFixed(2)+'%</td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem(\'pos_tarjetas_asumir\', '+i+')">'+(Icons.trash||'🗑️')+'</button></td></tr>').join('')}</tbody></table>` : '<p style="padding:var(--spacing-md);text-align:center;color:var(--text-muted);">No hay opciones registradas</p>'}</div>`;
    } else if (currentPaymentTab === 'extra') {
      content = `<div class="card__header" style="display:flex; justify-content:space-between; align-items:center;"><h4 class="card__title">Extrafinanciamiento</h4><button class="btn btn--primary btn--sm" onclick="ConfigModule.openPosModal('extra')">${Icons.plus || '➕'} Agregar</button></div><div class="card__body" style="padding:0;">${extras.length > 0 ? `<table class="data-table"><thead class="data-table__head"><tr><th>Banco</th><th>Plazo</th><th>% Bancario</th><th>% IR</th><th>% Total</th><th>Acciones</th></tr></thead><tbody class="data-table__body">${extras.map((t, i) => '<tr><td>'+t.banco+'</td><td><span class="badge badge--neutral">'+t.plazoMeses+' meses</span></td><td>'+Number(t.porcentajeBancario).toFixed(2)+'%</td><td>'+Number(t.porcentajeIR).toFixed(2)+'%</td><td><strong>'+(Number(t.porcentajeBancario)+Number(t.porcentajeIR)).toFixed(2)+'%</strong></td><td><button class="btn btn--ghost btn--icon btn--sm" onclick="ConfigModule.deletePosItem(\'pos_extrafinanciamiento\', '+i+')">'+(Icons.trash||'🗑️')+'</button></td></tr>').join('')}</tbody></table>` : '<p style="padding:var(--spacing-md);text-align:center;color:var(--text-muted);">No hay extrafinanciamientos</p>'}</div>`;
    }
    return `<div style="display:flex; gap:8px; margin-bottom:var(--spacing-md); flex-wrap:wrap; background:var(--bg-body); padding:8px; border-radius:10px; border:1px solid var(--border-color);">${payTabs.map(t => '<button class="btn btn--sm '+(currentPaymentTab === t.id ? 'btn--primary' : 'btn--ghost')+'" onclick="ConfigModule.setPaymentTab(\''+t.id+'\')">'+t.name+' <span class="badge badge--neutral" style="margin-left:4px;font-size:10px;">'+t.count+'</span></button>').join('')}</div><div class="card" style="border:1px solid var(--border-color);">${content}</div>`;
  };

  const openPosModal = (tipo) => {
    let title = '';
    let formHtml = '';
    
    if (tipo === 'precio') {
      title = 'Nueva Lista de Precio';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="precio">
        <div class="form-group"><label class="form-label">Código Precio</label><input type="text" name="codigo" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Nombre</label><input type="text" name="nombre" class="form-input" required></div>
      `;
    } else if (tipo === 'divisas') {
      title = 'Nueva Divisa';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="divisas">
        <div class="form-group"><label class="form-label">Tipo</label><select name="tipoDivisa" class="form-select"><option value="Billete">Billete</option><option value="Moneda">Moneda</option></select></div>
        <div class="form-group"><label class="form-label">Divisa</label><input type="text" name="divisa" value="USD" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Nombre</label><input type="text" name="nombre" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Valor Numérico</label><input type="number" step="0.01" name="valor" class="form-input" required></div>
      `;
    } else if (tipo === 'transferencia') {
      title = 'Nueva Cuenta Bancaria';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="transferencia">
        <div class="form-group"><label class="form-label">Banco</label><input type="text" name="banco" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Divisa</label><select name="divisa" class="form-select"><option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option></select></div>
        <div class="form-group"><label class="form-label">Número de Cuenta</label><input type="text" name="numeroCuenta" class="form-input" required></div>
      `;
    } else if (tipo === 'tarjeta') {
      title = 'Nuevo POS Bancario';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="tarjeta">
        <div class="form-group"><label class="form-label">Nombre POS Banco</label><input type="text" name="posBanco" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Retención Bancaria</label><input type="number" step="0.01" name="porcentajeBancario" value="0" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Retención Alcaldía/IR</label><input type="number" step="0.01" name="porcentajeIR" value="0" class="form-input" required></div>
      `;
    } else if (tipo === 'tarjeta_asumir') {
      title = 'Nuevo POS (Asumir Comisión)';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="tarjeta_asumir">
        <div class="form-group"><label class="form-label">Nombre POS Banco</label><input type="text" name="posBanco" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Retención Bancaria</label><input type="number" step="0.01" name="porcentajeBancario" value="0" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Retención Alcaldía/IR</label><input type="number" step="0.01" name="porcentajeIR" value="0" class="form-input" required></div>
      `;
    } else if (tipo === 'extra') {
      title = 'Nuevo Extrafinanciamiento';
      formHtml = `
        <input type="hidden" name="tipo_modal" value="extra">
        <div class="form-group"><label class="form-label">Banco</label><input type="text" name="banco" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Plazo (Meses)</label><input type="number" name="plazoMeses" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Comisión Bancaria</label><input type="number" step="0.01" name="porcentajeBancario" value="0" class="form-input" required></div>
        <div class="form-group"><label class="form-label">% Retención Alcaldía/IR</label><input type="number" step="0.01" name="porcentajeIR" value="0" class="form-input" required></div>
      `;
    }

    document.getElementById('configModal').innerHTML = `
      <div class="modal-overlay open">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${title}</h3>
            <button class="modal__close" onclick="ConfigModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="ConfigModule.handleSavePosModal(event)">
            ${formHtml}
            <div class="modal__footer" style="padding:var(--spacing-lg); border-top:1px solid var(--border-color); margin-top:var(--spacing-lg);">
              <button type="button" class="btn btn--secondary" onclick="ConfigModule.closeModal()">Cancelar</button>
              <button type="submit" class="btn btn--primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  const handleSavePosModal = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const tipo = data.tipo_modal;
    delete data.tipo_modal;

    let key = '';
    if (tipo === 'precio') key = 'pos_lista_precios';
    else if (tipo === 'divisas') {
      key = 'pos_divisas';
      data.valor = parseFloat(data.valor);
    }
    else if (tipo === 'transferencia') key = 'pos_transferencias';
    else if (tipo === 'tarjeta') {
      key = 'pos_tarjetas';
      data.porcentajeBancario = parseFloat(data.porcentajeBancario);
      data.porcentajeIR = parseFloat(data.porcentajeIR);
    }
    else if (tipo === 'tarjeta_asumir') {
      key = 'pos_tarjetas_asumir';
      data.porcentajeBancario = parseFloat(data.porcentajeBancario);
      data.porcentajeIR = parseFloat(data.porcentajeIR);
    }
    else if (tipo === 'extra') {
      key = 'pos_extrafinanciamiento';
      data.plazoMeses = parseInt(data.plazoMeses);
      data.porcentajeBancario = parseFloat(data.porcentajeBancario);
      data.porcentajeIR = parseFloat(data.porcentajeIR);
    }

    if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.createConfiguracionPos) {
      const res = await SupabaseDataService.createConfiguracionPos({
        tipo: key,
        datos: data
      });
      if (res.success && res.data) {
        data.id = res.data.id;
      }
    }

    const currentList = getPosData(key);
    currentList.push(data);
    setPosData(key, currentList);

    closeModal();
    App.refreshCurrentModule();
  };

  const deletePosItem = async (key, index) => {
    if (confirm('¿Eliminar este registro?')) {
      const dataList = getPosData(key);
      const item = dataList[index];

      if (item && item.id && typeof SupabaseDataService !== 'undefined' && SupabaseDataService.deleteConfiguracionPos) {
        await SupabaseDataService.deleteConfiguracionPos(item.id);
      }

      dataList.splice(index, 1);
      setPosData(key, dataList);
      App.refreshCurrentModule();
    }
  };

  const saveTipoCambio = () => {
    const input = document.querySelector('input[onchange*="setTipoCambio"]');
    if (!input) { alert('No se encontró el campo de tipo de cambio.'); return; }
    const val = parseFloat(input.value);
    if (isNaN(val) || val <= 0) { alert('Ingrese un valor válido para la tasa de cambio.'); return; }
    DataService.updateConfig({ tipoCambio: val });
    const suffix = typeof State !== 'undefined' && State.getCurrentUser()?.empresa_id ? '_' + State.getCurrentUser().empresa_id : '';
    localStorage.setItem('pos_tipoCambio' + suffix, JSON.stringify(val));
    alert('✅ Tasa de cambio guardada: 1 USD = C$' + val.toFixed(2));
  };

  const toggleAlertasContratos = (enabled) => {
    DataService.updateConfig({ alertasContratos: enabled });
  };

  const toggleRecordatoriosVisitas = (enabled) => {
    DataService.updateConfig({ recordatoriosVisitas: enabled });
  };

  const setDiasAnticipacion = (dias) => {
    DataService.updateConfig({ diasAnticipacion: parseInt(dias) });
  };

  const openEditProfile = () => {
    const user = State.get('user');
    document.getElementById('configModal').innerHTML = `
        <div class="modal-overlay open">
          <div class="modal" onclick="event.stopPropagation()">
            <div class="modal__header">
              <h3 class="modal__title">Editar Perfil</h3>
              <button class="modal__close" onclick="ConfigModule.closeModal()">${Icons.x}</button>
            </div>
            <form class="modal__body" onsubmit="ConfigModule.saveProfile(event)">
              <div class="form-group">
                <label class="form-label">Nombre</label>
                <input type="text" name="name" class="form-input" value="${user.name}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" name="email" class="form-input" value="${user.email}" required>
              </div>
              <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
                <button type="button" class="btn btn--secondary" onclick="ConfigModule.closeModal()">Cancelar</button>
                <button type="submit" class="btn btn--primary">Guardar</button>
              </div>
            </form>
          </div>
      </div>
  `;
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    State.setNested('user.name', formData.get('name'));
    State.setNested('user.email', formData.get('email'));
    closeModal();
    App.refreshCurrentModule();
  };

  const exportData = () => {
    const data = DataService.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alltech-support-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearCache = () => {
    if (confirm('¿Estás seguro de que deseas limpiar la caché local?')) {
      localStorage.clear();
      State.init();
      App.refreshCurrentModule();
    }
  };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('configModal').innerHTML = '';
  };

  const openCreateUser = () => {
    const availableModules = [
      { id: 'clientes', name: 'Clientes', icon: Icons.users },
      { id: 'contratos', name: 'Contratos', icon: Icons.fileText },
      { id: 'visitas', name: 'Visitas', icon: Icons.calendar },
      { id: 'pedidos', name: 'Pedidos', icon: Icons.shoppingCart },
      { id: 'proformas', name: 'Proformas', icon: Icons.fileText },
      { id: 'productos', name: 'Productos', icon: Icons.package },
      { id: 'equipos', name: 'Equipos', icon: Icons.monitor },
      { id: 'software', name: 'Software', icon: Icons.code },
      { id: 'reportes', name: 'Reportes', icon: Icons.barChart },
      { id: 'configuracion', name: 'Configuración', icon: Icons.settings }
    ];

    document.getElementById('configModal').innerHTML = `
  <div class="modal-overlay open">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal__header">
        <h3 class="modal__title">Crear Nuevo Usuario</h3>
        <button class="modal__close" onclick="ConfigModule.closeModal()">${Icons.x}</button>
      </div>
      <form class="modal__body" onsubmit="ConfigModule.handleCreateUser(event)">
        <div class="form-group">
          <label class="form-label">Nombre Completo</label>
          <input type="text" name="name" class="form-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" name="username" class="form-input" required pattern="[a-zA-Z0-9_]+" title="Solo letras, números y guiones bajos">
        </div>

        <div class="form-group">
          <label class="form-label">Correo Electrónico (Para Login)</label>
          <input type="email" name="email" class="form-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" name="password" class="form-input" required minlength="6">
        </div>

        <div class="form-group">
          <label class="form-label">Rol</label>
          <select name="role" class="form-select" required onchange="ConfigModule.toggleModulesSelector(this.value)">
            ${['Administrador', 'Tecnico', 'Ejecutivo de Ventas'].map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>

        <div id="modulesSelector" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm);">
          <label class="form-label" style="margin-bottom: var(--spacing-xs);">Módulos Permitidos (Solo para Vendedor/Tecnico)</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-xs);">
            ${availableModules.map(m => `
                        <label style="display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm); cursor: pointer;">
                            <input type="checkbox" name="allowedModules" value="${m.id}" checked>
                            <span>${m.name}</span>
                        </label>
                    `).join('')}
          </div>
          <p class="text-xs text-muted" style="margin-top: 5px;">Desmarca los módulos que no debe ver este usuario.</p>
        </div>

        <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
          <button type="button" class="btn btn--secondary" onclick="ConfigModule.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn--primary">Crear Usuario</button>
        </div>
      </form>
    </div>
  </div>
  `;

    // Initial check for modules selector visibility
    setTimeout(() => ConfigModule.toggleModulesSelector('Admin'), 0);
  };

  const toggleModulesSelector = (role) => {
    const selector = document.getElementById('modulesSelector');
    if (selector) {
      if (role === 'Administrador' || role === 'Admin') {
        selector.style.display = 'none';
      } else {
        selector.style.display = 'block';
      }
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    // Handle allowedModules checkboxes
    if (data.data && data.data.role !== 'Administrador' && data.role !== 'Admin') {
      const checkboxes = event.target.querySelectorAll('input[name="allowedModules"]:checked');
      data.allowedModules = Array.from(checkboxes).map(cb => cb.value);
    } else if (!data.data && data.role !== 'Administrador' && data.role !== 'Admin') {
      const checkboxes = event.target.querySelectorAll('input[name="allowedModules"]:checked');
      data.allowedModules = Array.from(checkboxes).map(cb => cb.value);
    } else {
      data.allowedModules = []; // Admin sees everything
    }

    try {
      await DataService.createUser(data);
      closeModal();
      App.refreshCurrentModule();
      alert('Usuario creado exitosamente');
    } catch (error) {
      alert(error.message);
    }
  };

  const saveCompanyConfig = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newConfig = {
      name: formData.get('name'),
      logoUrl: formData.get('logoUrl'),
      sidebarColor: formData.get('sidebarColor'),
      brandColor: formData.get('brandColor'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      slogan: formData.get('slogan'),
      updatedAt: new Date().toISOString()
    };
    State.set('companyConfig', newConfig);

    const appTheme = formData.get('appTheme');
    if (appTheme) {
      setTheme(appTheme);
    }

    // Apply Brand Color
    if (newConfig.brandColor) {
      document.documentElement.style.setProperty('--color-primary-500', newConfig.brandColor);
      document.documentElement.style.setProperty('--bg-sidebar-active', newConfig.brandColor);
      document.documentElement.style.setProperty('--color-primary-600', newConfig.brandColor);
    }

    // Directly apply styles if App has the method, otherwise reload handles it via state init
    if (typeof App.updateSidebarStyle === 'function') {
      App.updateSidebarStyle();
    } else {
      // Fallback: reload strictly necessary parts or just refresh module
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.style.setProperty('--sidebar-brand', newConfig.sidebarColor || '#0a1628');

      // Update logo
      const logo = document.querySelector('.sidebar__logo-img');
      if (logo && newConfig.logoUrl) logo.src = newConfig.logoUrl;
    }

    alert('Configuración guardada correctamente.');
    App.refreshCurrentModule();
  };

  const editUser = (username) => {
    const user = DataService.getUserByUsername(username);
    if (!user) {
      alert('Usuario no encontrado');
      return;
    }

    const availableModules = [
      { id: 'clientes', name: 'Clientes', icon: Icons.users },
      { id: 'contratos', name: 'Contratos', icon: Icons.fileText },
      { id: 'visitas', name: 'Visitas', icon: Icons.calendar },
      { id: 'pedidos', name: 'Pedidos', icon: Icons.shoppingCart },
      { id: 'proformas', name: 'Proformas', icon: Icons.fileText },
      { id: 'productos', name: 'Productos', icon: Icons.package },
      { id: 'equipos', name: 'Equipos', icon: Icons.monitor },
      { id: 'software', name: 'Software', icon: Icons.code },
      { id: 'reportes', name: 'Reportes', icon: Icons.barChart },
      { id: 'configuracion', name: 'Configuración', icon: Icons.settings }
    ];

    const userModules = user.allowedModules || [];

    document.getElementById('configModal').innerHTML = `
  <div class="modal-overlay open">
    <div class="modal" onclick="event.stopPropagation()" style="max-width: 700px;">
      <div class="modal__header">
        <h3 class="modal__title">Editar Usuario</h3>
        <button class="modal__close" onclick="ConfigModule.closeModal()">${Icons.x}</button>
      </div>
      <form class="modal__body" onsubmit="ConfigModule.saveEditUser(event, '${username}')">
        <div class="form-group">
          <label class="form-label">Nombre de Usuario</label>
          <input type="text" class="form-input" value="${user.username}" disabled style="background: var(--bg-tertiary); cursor: not-allowed;">
            <p class="text-xs text-muted" style="margin-top: var(--spacing-xs);">El nombre de usuario no puede modificarse</p>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre Completo</label>
          <input type="text" name="name" class="form-input" value="${user.name}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Correo Electrónico</label>
          <input type="email" name="email" class="form-input" value="${user.email}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" name="password" class="form-input" placeholder="Dejar en blanco para no cambiar" minlength="6">
            <p class="text-xs text-muted" style="margin-top: var(--spacing-xs);">Solo completa si deseas cambiar la contraseña</p>
        </div>
        <div class="form-group">
          <label class="form-label">Rol del Usuario</label>
          <select name="role" class="form-select" required onchange="ConfigModule.toggleModulesSelector(this.value)">
            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
            <option value="Vendedor" ${user.role === 'Vendedor' ? 'selected' : ''}>Vendedor</option>
            <option value="Tecnico" ${user.role === 'Tecnico' ? 'selected' : ''}>Tecnico</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Módulos Permitidos</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--spacing-sm);">
            ${availableModules.map(mod => `
              <label class="checkbox-container" style="background: var(--bg-tertiary); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); margin: 0; display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer;">
                <input type="checkbox" name="modules" value="${mod.id}" ${userModules.includes(mod.id) ? 'checked' : ''}>
                <span style="display: flex; align-items: center; gap: 4px;">${mod.icon || ''} ${mod.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
          <button type="button" class="btn btn--secondary" onclick="ConfigModule.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn--primary">${Icons.save || '💾'} Guardar Cambios</button>
        </div>
      </form>
    </div>
  </div>
  `;
  };
  const saveEditUser = async (event, username) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const selectedModules = Array.from(formData.getAll('modules'));

    const updates = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      allowedModules: selectedModules
    };

    const password = formData.get('password');
    if (password && password.trim()) {
      updates.password = password;
    }

    try {
      await DataService.updateUser(username, updates);
      closeModal();
      App.refreshCurrentModule();
      alert('Usuario actualizado');
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteUser = async (username) => {
    if (confirm('¿Eliminar usuario ' + username + '?')) {
      try {
        await DataService.deleteUser(username);
        App.refreshCurrentModule();
      } catch (e) { alert(e.message); }
    }
  };

  const exportarBitacora = () => {
    const logsJson = LogService.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_alltech_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const limpiarBitacora = () => {
    LogService.clearLogs();
    App.refreshCurrentModule();
  };

  return {
    render,
    switchTab,
    toggleSpecificPermission,
    toggleFullAccess,
    togglePermission,
    setTheme,
    setMoneda,
    setTipoCambio, saveTipoCambio,
    toggleAlertasContratos,
    toggleRecordatoriosVisitas,
    setDiasAnticipacion,
    openEditProfile,
    saveProfile,
    exportData,
    clearCache,
    closeModal,
    exportarBitacora,
    limpiarBitacora,
    editUser,
    saveEditUser,
    deleteUser,
    openCreateUser,
    handleCreateUser,
    toggleModulesSelector,
    saveCompanyConfig,
    openPosModal,
    handleSavePosModal,
    deletePosItem,
    setPosConfigTab,
    openEmpresaModal,
    openBodegaModal,
    handleSaveEmpresaModal,
    handleSaveBodegaModal,
    openCambioRegimenModal,
    ejecutarCambioRegimen,
    editEmpresa,
    editBodega,
    deleteBodega,
    setPaymentTab
  };
})();
