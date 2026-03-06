/**
 * ALLTECH - Main Application
 * Application initialization, routing, and core functionality
 */

const App = (() => {
  // Module registry
  const modules = {};

  // ========== SIDEBAR COMPONENT ==========

  const renderSidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Icons.home },
      { id: 'ventas', label: 'Ventas', icon: Icons.shoppingBag },
      { id: 'clientes', label: 'Clientes', icon: Icons.users },
      { id: 'pedidos', label: 'Pedidos', icon: Icons.shoppingCart },
      { id: 'productos', label: 'Productos / Servicios', icon: Icons.package },
      { id: 'recepciones', label: 'Recepción de Equipos', icon: Icons.inbox },
      { id: 'visitas', label: 'Visitas / Servicios', icon: Icons.wrench },
      { id: 'equipos', label: 'Equipos', icon: Icons.monitor },
      { id: 'software', label: 'Software', icon: Icons.monitor },
      { id: 'contratos', label: 'Contratos', icon: Icons.fileText },
      { id: 'calendario', label: 'Calendarios de Trabajos', icon: Icons.calendar },
      { id: 'proformas', label: 'Proformas', icon: Icons.fileText },
      { id: 'gestion-financiera', label: 'Gestión Financiera', icon: Icons.wallet },
      { id: 'prestaciones', label: 'Prestaciones', icon: Icons.dollarSign },
      { id: 'gestion-tecnicos', label: 'Gestión de Técnicos', icon: Icons.users },
      { id: 'reportes', label: 'Reportes', icon: Icons.barChart },
      { id: 'configuracion', label: 'Configuración', icon: Icons.settings }
    ];

    // Get permissions dynamically from DataService
    const currentModule = State.get('currentModule');
    const user = State.get('user');

    // Get user's role permissions from DataService
    const rolePermissions = user && user.role ? DataService.getRolePermissions(user.role) : null;

    // Get user's allowed modules (individual user restriction)
    const userAllowedModules = user && user.allowedModules ? user.allowedModules : [];

    // Filter items based on permissions AND allowed modules
    const visibleItems = menuItems.filter(item => {
      // Dashboard is always visible
      if (item.id === 'dashboard') return true;
      if (!user) return false;
      if (user.role === 'Admin' || user.role === 'Administrador') return true; // Admins see all

      // Check if user has read permission for this module (role-based)
      const hasRolePermission = rolePermissions && rolePermissions[item.id] && rolePermissions[item.id].read === true;

      // Check if module is in user's allowed modules (user-based)
      // LOGIC UPDATE:
      // 1. If user is Admin, they see everything (handled elsewhere or by allowedModules usually being empty/null for admin legacy).
      // 2. If 'allowedModules' is null/undefined (legacy users), we fallback to Role Default (allow all).
      // 3. If 'allowedModules' is an Array (even empty), we STRICTLY respect it.

      let isModuleAllowed = true; // Default for legacy compatibility

      if (Array.isArray(userAllowedModules)) {
        // Strict mode: User has explicit permissions configuration
        // If empty array, they see NOTHING (except dashboard)
        isModuleAllowed = userAllowedModules.includes(item.id);
      } else {
        // Legacy mode: No explicit configuration, allow all (or fallback to role permissions)
        isModuleAllowed = true;
      }

      // User needs BOTH role permission AND module to be allowed
      return hasRolePermission && isModuleAllowed;
    });



    const companyConfig = State.get('companyConfig') || { name: 'ALLTECH', logoUrl: 'assets/logo.png', sidebarColor: '#1a73e8' };

    return `
      <aside class="sidebar" id="sidebar" style="--sidebar-brand: ${companyConfig.sidebarColor || '#1a73e8'};">
        <div class="sidebar__header">
          <img src="${companyConfig.logoUrl || 'assets/logo.png'}" alt="${companyConfig.name || 'ALLTECH'}" class="sidebar__logo-img">
        </div>
        
        <nav class="sidebar__nav">
          <ul class="sidebar__menu">
            ${(() => {
        const groups = {
          'Principal': [],
          'VENTAS': [],
          'Servicios Técnicos': [],
          'Administración': []
        };

        visibleItems.forEach(item => {
          if (['ventas', 'proformas', 'clientes', 'pedidos', 'productos'].includes(item.id)) {
            groups['VENTAS'].push(item);
          } else if (['recepciones', 'visitas', 'equipos', 'software', 'contratos', 'calendario'].includes(item.id)) {
            groups['Servicios Técnicos'].push(item);
          } else if (['gestion-financiera', 'prestaciones', 'gestion-tecnicos', 'reportes', 'configuracion'].includes(item.id)) {
            groups['Administración'].push(item);
          } else {
            groups['Principal'].push(item);
          }
        });

        let itemDelay = 1;

        return Object.entries(groups)
          .filter(([_, items]) => items.length > 0)
          .map(([groupName, items], index) => {
            const isPrincipal = groupName === 'Principal';
            const groupId = 'sidebar-group-' + index;
            const isActiveGroup = items.some(item => item.id === currentModule) || isPrincipal;
            const displayStyle = isActiveGroup ? 'block' : 'none';
            const isActiveClass = isActiveGroup ? 'active' : '';

            const headerHtml = !isPrincipal
              ? `<li class="sidebar__menu-header ${isActiveClass}" 
                     onclick="const el = document.getElementById('${groupId}'); const isHidden = el.style.display === 'none'; el.style.display = isHidden ? 'block' : 'none'; this.classList.toggle('active');">
                  ${groupName}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sidebar__chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
                 </li>`
              : '';

            const itemsHtml = items.map(item => {
              const delay = itemDelay++ * 0.05;
              return `
                    <li class="sidebar__menu-item" style="--animation-order: ${delay}s;">
                      <a href="#${item.id}" 
                         class="sidebar__menu-link ${currentModule === item.id ? 'active' : ''}"
                         data-module="${item.id}">
                        <div class="sidebar__menu-icon-wrapper">${item.icon}</div>
                        <span class="sidebar__menu-label">${item.label}</span>
                      </a>
                    </li>
                  `;
            }).join('');

            if (isPrincipal) {
              return itemsHtml;
            } else {
              return headerHtml + `<ul id="${groupId}" class="sidebar__submenu" style="display: ${displayStyle};">${itemsHtml}</ul>`;
            }
          }).join('');
      })()}
          </ul>
        </nav>
        
        <div class="sidebar__footer">
          <div class="sidebar__user">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1a73e8&color=fff" 
                 alt="${user?.name || 'User'}" 
                 class="sidebar__user-avatar">
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">${user?.name || 'Invitado'}</div>
            </div>
          </div>
        </div>
      </aside>
    `;
  };

  // ========== HEADER COMPONENT ==========

  const renderHeader = () => {
    const currentModule = State.get('currentModule');
    const theme = State.get('theme');
    const user = State.get('user');

    const titles = {
      dashboard: 'Dashboard',
      clientes: 'Clientes',
      contratos: 'Contratos',
      visitas: 'Visitas / Servicios',
      pedidos: 'Pedidos',
      proformas: 'Proformas / Cotizaciones',
      productos: 'Productos y Servicios',
      equipos: 'Equipos',
      recepciones: 'Recepción de Equipos',
      software: 'Software y Licencias',
      prestaciones: 'Prestaciones Laborales',
      'gestion-financiera': 'Gestión Financiera',
      ventas: 'Ventas',
      calendario: 'Calendarios de Trabajos',
      reportes: 'Reportes',
      'gestion-tecnicos': 'Gestión de Técnicos',
      configuracion: 'Configuración'
    };

    return `
      <header class="header">
        <button class="header__menu-btn btn btn--ghost btn--icon" id="menuToggle">
          ${Icons.menu}
        </button>
        <h1 class="header__title">${titles[currentModule] || 'Dashboard'}</h1>
        
        <div class="header__search">
          <span class="header__search-icon">${Icons.search}</span>
          <input type="text" 
                 class="header__search-input" 
                 placeholder="Buscar...">
        </div>
        
        <div class="header__actions">
          <!-- Refresh Button -->
          <button class="header__action-btn header__refresh-btn" id="refreshDataBtn" onclick="App.handleRefreshData()" title="Sincronizar datos">
            ${Icons.refreshCw}
          </button>
          
          <div class="dropdown">
            <button class="header__action-btn notification-bell ${(typeof NotificationService !== 'undefined' && NotificationService.getUnreadCount() > 0) ? 'has-notifications' : ''}" id="notificationsBtn" onclick="App.toggleNotifications(event)">
              ${Icons.bell}
              <span class="badge" style="${(typeof NotificationService !== 'undefined' && NotificationService.getUnreadCount() > 0) ? '' : 'display:none'}">${typeof NotificationService !== 'undefined' ? NotificationService.getUnreadCount() : 0}</span>
            </button>
            <div class="dropdown__menu dropdown__menu--right dropdown__menu--notifications" id="notificationsDropdown" style="width: 320px; max-height: 400px; overflow-y: auto;">
                <div class="dropdown__header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Notificaciones</span>
                    <button class="btn btn--ghost btn--xs" onclick="NotificationService.markAllAsRead()" style="font-size: 11px;">Marcar leídas</button>
                </div>
                <div class="notification-list">
                    ${typeof NotificationService !== 'undefined' ? NotificationService.renderList() : '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Cargando...</div>'}
                </div>
                <div class="dropdown__footer" style="padding: var(--spacing-sm); border-top: 1px solid var(--border-color); text-align: center;">
                    <button class="btn btn--ghost btn--sm" onclick="NotificationService.refresh(); App.toggleNotifications();" style="width: 100%;">
                        ${Icons.refreshCw} Actualizar
                    </button>
                </div>
            </div>
          </div>
          
          
          <div class="dropdown">
             <button class="header__avatar-btn" onclick="App.toggleUserMenu(event)">
                 <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1a73e8&color=fff&size=44" 
                    alt="${user?.name || 'User'}" 
                    class="header__avatar">
             </button>
             <ul class="dropdown__menu dropdown__menu--right" id="userDropdown">
                <li class="dropdown__header">${user?.name || 'Usuario'}<br><small>${user?.email || ''}</small></li>
                <li class="dropdown__divider"></li>
                <li class="dropdown__item" onclick="App.navigate('configuracion')">
                  ${Icons.user} Mi Perfil
                </li>
                <li class="dropdown__item" onclick="App.navigate('configuracion')">
                  ${Icons.settings} Configuración
                </li>
                <li class="dropdown__item" onclick="App.handleSwitchUser()">
                  ${Icons.refreshCw} Cambiar Perfil
                </li>
                <li class="dropdown__item" onclick="App.handleLogout()" style="color: var(--color-danger);">
                  ${Icons.logOut} Cerrar Sesión
                </li>
              </ul>
          </div>
        </div>
      </header>
    `;
  };

  // ========== LOGIN COMPONENT ==========
  // Usando LoginModule nuevo con Supabase y fondo negro
  const renderLogin = () => {
    return LoginModule.render();
  };

  // ========== AUTH ACTIONS ==========
  // El login ahora lo maneja LoginModule.handleLogin()

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión?')) {
      await signOut(); // Cerrar sesión en Supabase
      State.logout();
      render();
    }
  };

  const handleSwitchUser = () => {
    // Close user dropdown first
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.remove('show');

    // Make sure we completely sign out
    if (typeof signOut === 'function') {
      signOut().then(() => {
        State.logout();
        render();
      }).catch(err => {
        console.error('Logout error:', err);
        State.logout();
        render();
      });
    } else {
      State.logout();
      render();
    }
  };

  const toggleUserMenu = (event) => {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  };

  // ========== DASHBOARD MODULE ==========

  const renderDashboard = () => {
    const stats = DataService.getDashboardStats();
    const activities = DataService.getRecentActivities();
    const user = State.get('user');
    const proformas = DataService.getProformasSync().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

    // Get upcoming visits
    const allVisitas = DataService.getVisitasSync();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingVisitas = allVisitas
      .filter(v => new Date(v.fechaInicio || v.fecha) >= today && !v.trabajoRealizado && (v.estado !== 'Cancelada'))
      .sort((a, b) => new Date(a.fechaInicio || a.fecha) - new Date(b.fechaInicio || b.fecha))
      .slice(0, 5);

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 18 ? 'Buenas tardes' : 'Buenas noches';

    return `
      <style>
        .dashboard-v2 { padding: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-xl); background: var(--bg-body); animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .welcome-banner { background: linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-800) 100%); border-radius: 20px; padding: 2.5rem; color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
        .welcome-banner::after { content: ''; position: absolute; right: -50px; top: -50px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }
        .welcome-text h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 0.5rem; letter-spacing: -0.5px; }
        .welcome-text p { color: rgba(255,255,255,0.85); font-size: 1.1rem; }
        
        .metric-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
        .metric-card { background: var(--bg-surface); border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid var(--border-color); display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .metric-card:hover { transform: translateY(-5px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
        .metric-card__icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin-bottom: 1.2rem; }
        .metric-card.primary .metric-card__icon { background: var(--color-primary-50); color: var(--color-primary-600); }
        .metric-card.success .metric-card__icon { background: var(--color-success-light); color: var(--color-success); }
        .metric-card.warning .metric-card__icon { background: var(--color-warning-light); color: var(--color-warning); }
        .metric-card.info .metric-card__icon { background: #e0f2fe; color: #0284c7; }
        .metric-card__label { color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .metric-card__value { color: var(--text-primary); font-size: 2.2rem; font-weight: 700; line-height: 1.1; letter-spacing: -1px; }
        .metric-card__trend { margin-top: 1rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; font-weight: 500; color: var(--text-muted); }
        .metric-card__trend.up { color: var(--color-success); }
        
        .dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }
        @media (max-width: 1024px) { .dashboard-grid { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .welcome-banner { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.5rem; } }
        
        .modern-card { background: var(--bg-surface); border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid var(--border-color); overflow: hidden; height: 100%; display: flex; flex-direction: column; }
        .modern-card__header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); }
        .modern-card__title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.6rem; margin: 0; }
        .modern-card__body { padding: 1.5rem; flex: 1; overflow-y: auto; }
        
        .quick-actions { display: flex; gap: 1rem; overflow-x: auto; scrollbar-width: none; flex-wrap: wrap; }
        .quick-actions::-webkit-scrollbar { display: none; }
        .quick-action-btn { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 500; color: white; transition: all 0.2s; cursor: pointer; backdrop-filter: blur(4px); }
        .quick-action-btn:hover { background: white; color: var(--color-primary-700); border-color: white; transform: translateY(-2px); }
        
        .visit-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 12px; transition: background 0.2s; border: 1px solid transparent; background: var(--bg-body); }
        .visit-item:hover { background: var(--color-primary-50); border-color: var(--color-primary-100); }
        .visit-date { background: white; color: var(--color-primary-600); padding: 0.6rem; border-radius: 10px; text-align: center; min-width: 65px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .visit-date .day { font-size: 1.4rem; font-weight: 800; line-height: 1; }
        .visit-date .month { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; margin-top: 0.3rem; letter-spacing: 0.5px; }
        .visit-info { flex: 1; overflow: hidden; }
        .visit-title { font-weight: 600; color: var(--text-primary); margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1rem; }
        .visit-subtitle { font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.3rem; }
      </style>

      <div class="dashboard-v2">
        <div class="welcome-banner">
          <div class="welcome-text">
            <h1>${greeting}, ${user?.name?.split(' ')[0] || 'Usuario'}! 👋</h1>
            <p>Aquí tienes el resumen de tu negocio el día de hoy.</p>
          </div>
          <div class="quick-actions">
            <button class="quick-action-btn" onclick="App.navigate('visitas')" style="background: white; color: var(--color-primary-700);">
              ${Icons.plus} Nueva Visita
            </button>
            <button class="quick-action-btn" onclick="App.navigate('clientes')">
              ${Icons.users} Nuevo Cliente
            </button>
            <button class="quick-action-btn" onclick="ReportesModule.generateGeneralReport()">
              ${Icons.barChart} Reporte
            </button>
          </div>
        </div>

        <div class="metric-cards">
          <div class="metric-card primary" onclick="App.navigate('clientes')">
            <div class="metric-card__icon">${Icons.users}</div>
            <div class="metric-card__label">Clientes Activos</div>
            <div class="metric-card__value">${stats.clientesActivos ? stats.clientesActivos.value : 0}</div>
            <div class="metric-card__trend up"><span>Total Activos</span></div>
          </div>
          <div class="metric-card success" onclick="App.navigate('visitas')">
            <div class="metric-card__icon">${Icons.calendar}</div>
            <div class="metric-card__label">Servicios del Mes</div>
            <div class="metric-card__value">${stats.serviciosMes ? stats.serviciosMes.value : 0}</div>
            <div class="metric-card__trend up"><span>Visitas programadas</span></div>
          </div>
          <div class="metric-card warning" onclick="App.navigate('contratos')">
            <div class="metric-card__icon">${Icons.creditCard || Icons.fileText}</div>
            <div class="metric-card__label">Ingresos Recurrentes</div>
            <div class="metric-card__value">$${(stats.ingresosMes ? stats.ingresosMes.value : 0).toFixed(2)}</div>
            <div class="metric-card__trend up"><span>Base contratada</span></div>
          </div>
          <div class="metric-card info" onclick="App.navigate('contratos')">
            <div class="metric-card__icon">${Icons.fileText}</div>
            <div class="metric-card__label">Contratos Activos</div>
            <div class="metric-card__value">${stats.contratosActivos ? stats.contratosActivos.value : 0}</div>
            <div class="metric-card__trend up"><span>Mantenimientos</span></div>
          </div>
          <div class="metric-card" style="border-left: 4px solid var(--color-primary-600);" onclick="App.navigate('equipos')">
            <div class="metric-card__icon" style="background: var(--color-primary-50); color: var(--color-primary-600);">${Icons.monitor || Icons.box}</div>
            <div class="metric-card__label">Total Equipos</div>
            <div class="metric-card__value">${stats.equiposActivos ? stats.equiposActivos.value : 0}</div>
            <div class="metric-card__trend up"><span>En sistema</span></div>
          </div>
          <div class="metric-card" style="border-left: 4px solid var(--color-warning);" onclick="App.navigate('recepciones')">
            <div class="metric-card__icon" style="background: var(--color-warning-light); color: var(--color-warning);">${Icons.tool || Icons.briefcase}</div>
            <div class="metric-card__label">Recepciones Activas</div>
            <div class="metric-card__value">${stats.recepcionesActivas ? stats.recepcionesActivas.value : 0}</div>
            <div class="metric-card__trend up"><span>En proceso</span></div>
          </div>
          <div class="metric-card" style="border-left: 4px solid var(--color-success);" onclick="App.navigate('proformas')">
            <div class="metric-card__icon" style="background: var(--color-success-light); color: var(--color-success);">${Icons.fileText}</div>
            <div class="metric-card__label">Proformas Activas</div>
            <div class="metric-card__value">${stats.proformasActivas ? stats.proformasActivas.value : 0}</div>
            <div class="metric-card__trend up"><span>Pendientes/Aprobadas</span></div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Resumen de Actividad -->
            <div class="modern-card">
              <div class="modern-card__header">
                <h3 class="modern-card__title">${Icons.activity} Resumen del Sistema</h3>
              </div>
              <div class="modern-card__body" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">Clientes Activos</span>
                    <span style="font-weight: 700; color: var(--color-primary-600);">${stats.clientesActivos ? stats.clientesActivos.value : 0}</span>
                  </div>
                  <div style="width: 100%; height: 8px; border-radius: 10px; background: var(--border-color); overflow: hidden;">
                    <div style="width: 85%; height: 100%; background: var(--color-primary-500); border-radius: 10px;"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">Servicios del Mes</span>
                    <span style="font-weight: 700; color: var(--color-success);">${stats.serviciosMes ? stats.serviciosMes.value : 0}</span>
                  </div>
                  <div style="width: 100%; height: 8px; border-radius: 10px; background: var(--border-color); overflow: hidden;">
                    <div style="width: 65%; height: 100%; background: var(--color-success); border-radius: 10px;"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">Equipos en Sistema</span>
                    <span style="font-weight: 700; color: var(--color-warning);">${stats.equiposActivos ? stats.equiposActivos.value : 0}</span>
                  </div>
                  <div style="width: 100%; height: 8px; border-radius: 10px; background: var(--border-color); overflow: hidden;">
                    <div style="width: 50%; height: 100%; background: var(--color-warning); border-radius: 10px;"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <span style="font-weight: 600; color: var(--text-primary);">Contratos Activos</span>
                    <span style="font-weight: 700; color: var(--color-primary-700);">${stats.contratosActivos ? stats.contratosActivos.value : 0}</span>
                  </div>
                  <div style="width: 100%; height: 8px; border-radius: 10px; background: var(--border-color); overflow: hidden;">
                    <div style="width: 40%; height: 100%; background: var(--color-primary-700); border-radius: 10px;"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Servicios Recientes -->
            <div class="modern-card">
              <div class="modern-card__header">
                <h3 class="modern-card__title">${Icons.activity} Servicios Recientes</h3>
                <button class="btn btn--ghost btn--sm" onclick="App.navigate('visitas')">Ver Todos</button>
              </div>
              <div class="modern-card__body" style="padding: 0;">
                <table class="data-table" style="margin: 0; box-shadow: none; border-radius: 0; border: none;">
                  <thead style="background: var(--bg-body);">
                    <tr><th>Servicio / Fecha</th><th>Cliente</th><th style="text-align: right;">Estado</th></tr>
                  </thead>
                  <tbody>
                    ${activities.length > 0 ? activities.map(a => `
                      <tr onclick="App.navigate('visitas')" style="cursor: pointer;">
                        <td><strong style="color: var(--color-primary-600);">${a.numero}</strong><div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${a.fecha}</div></td>
                        <td style="font-weight: 500;">${a.cliente}</td>
                        <td style="text-align: right;"><span class="badge ${a.estado === 'Completado' ? 'badge--success' : 'badge--warning'}">${a.estado}</span></td>
                      </tr>
                    `).join('') : '<tr><td colspan="3" class="text-center text-muted" style="padding: 2rem;">No hay servicios recientes</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Próximas Visitas -->
            <div class="modern-card">
              <div class="modern-card__header">
                <h3 class="modern-card__title">${Icons.calendar} Próximas Visitas</h3>
              </div>
              <div class="modern-card__body" style="display: flex; flex-direction: column; gap: 0.8rem;">
                ${upcomingVisitas.length > 0 ? upcomingVisitas.map(visita => {
      const cliente = DataService.getClienteById(visita.clienteId || visita.cliente_id);
      const d = new Date(visita.fechaInicio || visita.fecha);
      return `
                  <div class="visit-item" onclick="App.navigate('visitas')" style="cursor: pointer;">
                    <div class="visit-date">
                      <div class="day">${d.getDate()}</div>
                      <div class="month">${d.toLocaleDateString('es-NI', { month: 'short' })}</div>
                    </div>
                    <div class="visit-info">
                      <div class="visit-title">${(visita.tipoVisita && visita.tipoVisita !== 'undefined') ? visita.tipoVisita : (visita.titulo || 'Servicio Técnico')}</div>
                      <div class="visit-subtitle text-muted">${Icons.mapPin} ${(cliente && cliente.empresa && cliente.empresa !== 'undefined') ? cliente.empresa : ((cliente && cliente.nombreCliente && cliente.nombreCliente !== 'undefined') ? cliente.nombreCliente : 'Cliente de Contrato')}</div>
                    </div>
                  </div>
                `}).join('') : `
                  <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;">📅</div>
                    <p>No hay visitas próximas programadas.</p>
                  </div>
                `}
                <div style="margin-top: 0.5rem;">
                  <button class="btn btn--outline" style="width: 100%; border-radius: 10px;" onclick="App.navigate('calendario')">Ver Calendario Completo</button>
                </div>
              </div>
            </div>

            <!-- Proformas Recientes -->
            <div class="modern-card">
              <div class="modern-card__header">
                <h3 class="modern-card__title">${Icons.fileText} Últimas Cotizaciones</h3>
              </div>
              <div class="modern-card__body" style="display: flex; flex-direction: column; gap: 0.8rem;">
                ${proformas.length > 0 ? proformas.map(p => {
        const cliente = DataService.getClienteById(p.clienteId || p.cliente_id);
        const isAprobada = p.estado === 'Aprobada';
        return `
                  <div class="visit-item" onclick="App.navigate('proformas')" style="cursor: pointer;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${isAprobada ? 'var(--color-success-light)' : 'var(--bg-body)'}; color: ${isAprobada ? 'var(--color-success)' : 'var(--text-secondary)'}; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-size: 1.2rem;">
                      ${isAprobada ? Icons.check : Icons.fileText}
                    </div>
                    <div class="visit-info">
                      <div class="visit-title">${(p.numero || p.numero_proforma || p.codigo_proforma || p.proformaId) && (p.numero || p.numero_proforma || p.codigo_proforma || p.proformaId) !== 'undefined' ? (p.numero || p.numero_proforma || p.codigo_proforma || p.proformaId) : 'Sin Nº'}</div>
                      <div class="visit-subtitle">${(cliente && cliente.empresa && cliente.empresa !== 'undefined') ? cliente.empresa : ((cliente && cliente.nombreCliente && cliente.nombreCliente !== 'undefined') ? cliente.nombreCliente : 'Cliente N/A')}</div>
                    </div>
                    <div style="text-align: right; font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">
                      ${p.moneda === 'USD' ? '$' : 'C$'}${(p.total || 0).toFixed(2)}
                      <div style="font-size: 0.75rem; font-weight: 500; color: ${isAprobada ? 'var(--color-success)' : 'var(--text-muted)'}; margin-top: 0.2rem;">${(p.estado && p.estado !== 'undefined') ? p.estado : 'Borrador'}</div>
                    </div>
                  </div>
                `}).join('') : `
                  <p class="text-muted text-center py-4">No hay cotizaciones recientes.</p>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ========== MODULE PLACEHOLDER ==========

  const renderModulePlaceholder = (moduleName) => {
    const titles = {
      clientes: 'Gestión de Clientes',
      contratos: 'Gestión de Contratos',
      visitas: 'Visitas y Servicios',
      equipos: 'Inventario de Equipos',
      calendario: 'Calendario de Mantenimiento',
      reportes: 'Reportes e Historial',
      configuracion: 'Configuración del Sistema'
    };

    return `
      <div class="empty-state">
        <div class="empty-state__icon">${Icons.settings}</div>
        <h2 class="empty-state__title">${titles[moduleName] || moduleName}</h2>
        <p class="empty-state__description">
          Este módulo está en desarrollo. Pronto estará disponible con todas las funcionalidades.
        </p>
        <button class="btn btn--primary" onclick="App.navigate('dashboard')">
          Volver al Dashboard
        </button>
      </div>
    `;
  };

  // ========== CHART INITIALIZATION ==========

  const initChart = () => {
    const canvas = document.getElementById('statsChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartData = DataService.getChartData();

    // Get dimensions
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get max value
    const maxValue = Math.max(...chartData.revenue, ...chartData.profit);
    const scale = chartHeight / maxValue;

    // Draw grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#868e96';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const value = Math.round(maxValue - (maxValue / 4) * i);
      ctx.fillText(`$${value}`, padding.left - 8, y + 4);
    }

    // Draw X-axis labels
    const barGroupWidth = chartWidth / chartData.labels.length;
    ctx.fillStyle = '#868e96';
    ctx.textAlign = 'center';
    chartData.labels.forEach((label, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2;
      ctx.fillText(label, x, canvas.height - 8);
    });

    // Draw bars
    const barWidth = barGroupWidth * 0.3;
    const gap = 4;

    chartData.revenue.forEach((value, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2 - barWidth - gap / 2;
      const barHeight = value * scale;
      const y = padding.top + chartHeight - barHeight;

      // Revenue bar (gradient)
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, '#1a73e8');
      gradient.addColorStop(1, '#155cb9');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
    });

    chartData.profit.forEach((value, i) => {
      const x = padding.left + barGroupWidth * i + barGroupWidth / 2 + gap / 2;
      const barHeight = value * scale;
      const y = padding.top + chartHeight - barHeight;

      // Profit bar (gradient)
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, '#28a745');
      gradient.addColorStop(1, '#1e7e34');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
    });

    // Highlight Friday
    const fridayIndex = 5;
    const fridayX = padding.left + barGroupWidth * fridayIndex + barGroupWidth / 2;

    // Draw tooltip box
    const tooltipWidth = 80;
    const tooltipHeight = 50;
    const tooltipX = fridayX - tooltipWidth / 2;
    const tooltipY = padding.top - 10;

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
    ctx.fill();

    // Tooltip text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Viernes', fridayX, tooltipY + 15);
    ctx.fillText(`Ingresos: $${chartData.revenue[fridayIndex]}`, fridayX, tooltipY + 30);
    ctx.fillText(`Beneficio: $${chartData.profit[fridayIndex]}`, fridayX, tooltipY + 42);
  };

  // ========== ROUTING ==========

  const handleHashChange = () => {
    const hash = window.location.hash.slice(1) || 'dashboard';
    if (hash !== State.get('currentModule')) {
      navigate(hash);
    }
  };

  const navigate = (module) => {
    // On mobile, close always. On PC, do not auto-close so the user can see it still.
    if (window.innerWidth <= 1024) {
      closeSidebarForMobile();
    }

    State.setCurrentModule(module);

    // Update hash cleanly without triggering jump/scroll on mobile
    const currentHash = window.location.hash.slice(1);
    if (currentHash !== module) {
      if (history.pushState) {
        history.pushState(null, null, `#${module}`);
      } else {
        // Fallback that might jump but works in very old browsers
        window.removeEventListener('hashchange', handleHashChange);
        window.location.hash = module;
        requestAnimationFrame(() => {
          window.addEventListener('hashchange', handleHashChange);
        });
      }
    }
    render();
  };

  // ========== RENDER ==========

  function render() {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // Verify Authentication
    if (!State.get('isAuthenticated')) {
      appContainer.innerHTML = renderLogin();
      appContainer.dataset.shellInitialized = 'false'; // Reset shell flag
      return;
    }

    const currentModule = State.get('currentModule');

    let moduleContent;
    switch (currentModule) {
      case 'dashboard':
        moduleContent = renderDashboard();
        break;
      case 'clientes':
        moduleContent = ClientesModule.render();
        break;
      case 'contratos':
        moduleContent = ContratosModule.render();
        break;
      case 'visitas':
        moduleContent = VisitasModule.render();
        break;
      case 'proformas':
        moduleContent = ProformasModule.render();
        break;
      case 'pedidos':
        moduleContent = PedidosModule.render();
        break;
      case 'productos':
        moduleContent = ProductosModule.render();
        break;
      case 'equipos':
        moduleContent = EquiposModule.render();
        break;
      case 'software':
        moduleContent = SoftwareModule.render();
        break;
      case 'recepciones':
        moduleContent = typeof RecepcionesModule !== 'undefined' ? RecepcionesModule.render() : renderModulePlaceholder(currentModule);
        break;
      case 'calendario':
        moduleContent = CalendarioModule.render();
        break;
      case 'prestaciones':
        moduleContent = PrestacionesModule.render();
        break;
      case 'gestion-financiera':
        moduleContent = GestionFinancieraModule.render();
        break;
      case 'ventas':
        moduleContent = typeof VentasModule !== 'undefined' ? VentasModule.render() : renderModulePlaceholder(currentModule);
        break;
      case 'gestion-tecnicos':
        moduleContent = GestionTecnicosModule.render();
        break;
      case 'reportes':
        moduleContent = ReportesModule.render();
        break;
      case 'configuracion':
        moduleContent = ConfigModule.render();
        break;
      default:
        moduleContent = renderModulePlaceholder(currentModule);
    }

    const titles = {
      dashboard: 'Dashboard',
      clientes: 'Clientes',
      contratos: 'Contratos',
      visitas: 'Visitas / Servicios',
      pedidos: 'Pedidos',
      proformas: 'Proformas / Cotizaciones',
      productos: 'Productos y Servicios',
      equipos: 'Equipos',
      recepciones: 'Recepción de Equipos',
      software: 'Software y Licencias',
      prestaciones: 'Prestaciones Laborales',
      ventas: 'Ventas',
      calendario: 'Calendario',
      reportes: 'Reportes',
      'gestion-tecnicos': 'Gestión de Técnicos',
      configuracion: 'Configuración'
    };

    // Check if the app shell is already initialized
    const isReady = appContainer.dataset.shellInitialized === 'true' && document.querySelector('.main .content');

    if (isReady) {
      // 1. Update ONLY the module content
      const contentEl = document.querySelector('.main .content');
      if (contentEl) {
        // Save focus state
        const activeElement = document.activeElement;
        let activeElementData = null;

        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
          activeElementData = {
            tagName: activeElement.tagName,
            className: activeElement.className,
            placeholder: activeElement.placeholder,
            id: activeElement.id,
            name: activeElement.name,
            selectionStart: null,
            selectionEnd: null
          };
          try {
            activeElementData.selectionStart = activeElement.selectionStart;
            activeElementData.selectionEnd = activeElement.selectionEnd;
          } catch (e) { }
        }

        contentEl.innerHTML = moduleContent;

        // Restore focus state
        if (activeElementData) {
          let target = null;
          if (activeElementData.id) {
            target = document.getElementById(activeElementData.id);
          } else {
            const selectors = [activeElementData.tagName];
            if (activeElementData.name) selectors.push(`[name="${activeElementData.name}"]`);
            if (activeElementData.placeholder) selectors.push(`[placeholder="${activeElementData.placeholder}"]`);
            if (activeElementData.className) {
              const classes = activeElementData.className.split(' ').map(c => c.trim()).filter(c => c).join('.');
              if (classes) selectors.push('.' + classes);
            }

            const selectorStr = selectors.join('');
            try {
              target = contentEl.querySelector(selectorStr);
            } catch (e) { console.error('Error finding target for focus', e); }
          }

          if (target) {
            target.focus();
            try {
              if (activeElementData.selectionStart !== null) {
                target.setSelectionRange(activeElementData.selectionStart, activeElementData.selectionEnd);
              }
            } catch (e) { }
          }
        }
      }

      // 2. Update Header Title
      const headerTitle = document.querySelector('.header__title');
      if (headerTitle) {
        headerTitle.textContent = titles[currentModule] || 'Dashboard';
      }

      // 3. Update active states for Sidebar
      document.querySelectorAll('.sidebar__menu-link').forEach(link => {
        if (link.dataset.module === currentModule) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      // 4. Update active states for Bottom Nav
      document.querySelectorAll('.pwa-bottom-nav__item').forEach(btn => {
        if (btn.dataset.module === currentModule) {
          btn.classList.add('pwa-bottom-nav__item--active');
        } else {
          btn.classList.remove('pwa-bottom-nav__item--active');
        }
      });

    } else {
      // First render: create the entire shell
      appContainer.innerHTML = `
        ${renderSidebar()}
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
        <div id="sidebar-tooltip" class="sidebar-tooltip"></div>
        <main class="main">
          ${renderHeader()}
          <div class="content">
            ${moduleContent}
          </div>
        </main>
        ${renderBottomNav()}
      `;

      appContainer.dataset.shellInitialized = 'true';
      setupMobileMenuHandlers();
      attachEventListeners();
    }

    // Initialize chart after render
    if (currentModule === 'dashboard') {
      requestAnimationFrame(() => {
        initChart();
      });
    }

    // Initialize Mobile UI Helpers only for the new content
    setupMobileTables();

    // Initialize Draggable FAB
    requestAnimationFrame(() => {
      initDraggableFAB();
    });
  }

  // ========== BOTTOM NAVIGATION (Mobile PWA) ==========
  function renderBottomNav() {
    const currentModule = State.get('currentModule');
    const user = State.get('user');
    if (!user) return '';

    // Core navigation items for bottom nav
    // REMOVED 'Menu' item to satisfy user request: sidebar trigger only on top button
    const navItems = [
      { id: 'dashboard', label: 'Inicio', icon: Icons.home },
      { id: 'clientes', label: 'Clientes', icon: Icons.users },
      { id: 'visitas', label: 'Servicios', icon: Icons.wrench },
      { id: 'calendario', label: 'Agenda', icon: Icons.calendar },
      { id: 'reportes', label: 'Reportes', icon: Icons.barChart }
    ];

    return `
      <nav class="pwa-bottom-nav" id="bottomNav">
        ${navItems.map(item => `
          <button type="button"
             class="pwa-bottom-nav__item ${currentModule === item.id ? 'pwa-bottom-nav__item--active' : ''}"
             data-module="${item.id}">
            <span class="pwa-bottom-nav__icon">${item.icon}</span>
            <span class="pwa-bottom-nav__label">${item.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  };

  // ========== SIDEBAR TOGGLE ==========
  const toggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    } else {
      const sidebar = document.getElementById('sidebar');
      const main = document.querySelector('.main');
      if (sidebar) sidebar.classList.toggle('collapsed');
      if (main) main.classList.toggle('expanded');
    }
  };

  const closeSidebarForMobile = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  };

  const closeSidebarForPC = () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main');
    if (sidebar) sidebar.classList.add('collapsed');
    if (main) main.classList.add('expanded');
  };

  const openSidebarForPC = () => {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main');
    if (sidebar) sidebar.classList.remove('collapsed');
    if (main) main.classList.remove('expanded');
  };

  // ========== EVENT LISTENERS ==========

  function attachEventListeners() {
    // Forzar mayúsculas en todos los inputs de texto excepto campos sensibles y numéricos
    if (!window.uppercaseListenerAttached) {
      document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          const type = e.target.type ? e.target.type.toLowerCase() : '';
          // Ignorar contraseñas, emails y tipos donde el cursor o el valor fallaría al convertir
          if (!['password', 'email', 'url', 'color', 'date', 'time', 'number', 'month', 'week', 'file'].includes(type)) {
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.toUpperCase();
            // Evitar perder la posición del cursor en inputs de texto normal
            try {
              if (e.target.setSelectionRange) {
                e.target.setSelectionRange(start, end);
              }
            } catch (err) { }
          }
        }
      });
      window.uppercaseListenerAttached = true;
    }

    // Navigation links (sidebar)
    const sidebarTooltip = document.getElementById('sidebar-tooltip');
    document.querySelectorAll('.sidebar__menu-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const module = link.dataset.module;
        if (window.innerWidth <= 1024) closeSidebarForMobile();
        navigate(module);
      });

      // Tooltip logic for contracted sidebar
      if (sidebarTooltip) {
        link.addEventListener('mouseenter', () => {
          const sidebar = document.getElementById('sidebar');
          if (sidebar && sidebar.classList.contains('collapsed') && window.innerWidth > 1024) {
            const rect = link.getBoundingClientRect();
            const labelEl = link.querySelector('.sidebar__menu-label');
            if (labelEl) {
              sidebarTooltip.innerText = labelEl.innerText || labelEl.textContent;
              sidebarTooltip.style.top = `${rect.top + (rect.height / 2)}px`;
              sidebarTooltip.style.left = `${rect.right + 10}px`;
              sidebarTooltip.classList.add('show');
            }
          }
        });
        link.addEventListener('mouseleave', () => {
          sidebarTooltip.classList.remove('show');
        });
      }
    });

    // Bottom navigation buttons
    document.querySelectorAll('.pwa-bottom-nav__item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const module = btn.dataset.module;
        if (module) {
          navigate(module);
        }
      });
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        State.toggleTheme();
        render();
      });
    }

    // Mobile menu toggle (hamburger button)
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    // Sidebar overlay click to close
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        closeSidebarForMobile();
      });
    }

    // Close notifications and user menu when clicking outside
    document.addEventListener('click', (e) => {
      const notifDropdown = document.getElementById('notificationsDropdown');
      const notifBtn = document.getElementById('notificationsBtn');
      const userDropdown = document.getElementById('userDropdown');
      const userBtn = document.querySelector('.header__avatar-btn');

      if (notifDropdown && notifBtn && !notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove('show');
      }

      if (userDropdown && userBtn && !userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });

    // Handle hash changes
    window.addEventListener('hashchange', handleHashChange);

    // RIPPLE EFFECT FOR BUTTONS
    if (!window.rippleListenerAttached) {
      document.addEventListener('click', (e) => {
        // Removed .pwa-bottom-nav__item because it prevents issues with clicks on mobile
        const btn = e.target.closest('.btn, .sidebar__menu-link, .stat-card, .card--clickable');
        if (btn) {
          const rect = btn.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const ripple = document.createElement('span');
          ripple.classList.add('ripple-effect');
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;

          btn.appendChild(ripple);

          setTimeout(() => {
            ripple.remove();
          }, 600);
        }
      });
      window.rippleListenerAttached = true;
    }
  };

  // ========== INITIALIZATION ==========

  const init = () => {
    // Initialize state
    State.init();

    // Check initial hash
    const initialModule = window.location.hash.slice(1) || 'dashboard';
    State.setCurrentModule(initialModule);

    // Initial render
    render();

    // Apply company styling and branding
    updateSidebarStyle();

    // Initialize Realtime Sync
    if (typeof SupabaseDataService !== 'undefined' && typeof DataService !== 'undefined') {
      // Wait for potential session restore
      setTimeout(() => {
        if (State.isLoggedIn()) {
          console.log('🔌 App: Iniciando sincronización Realtime...');
          SupabaseDataService.subscribeToChanges((payload) => {
            if (DataService.handleRealtimeUpdate) {
              DataService.handleRealtimeUpdate(payload);
              // Optional: Show toast for significant events
              if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                showNotification(`Actualización: ${payload.table}`, 'info');
              }
            }
          });
        }
      }, 1000);
    }

    // Handle window resize for chart
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (State.get('currentModule') === 'dashboard') {
          initChart();
        }
      }, 250);
    });

    // Listen for Service Worker messages (Push Notification Clicks)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'NAVIGATE_TO') {
          console.log('🔔 Navegando desde notificación:', event.data.module);
          navigate(event.data.module);
        }
      });
    }

    console.log('ALLTECH initialized');
  };

  // ========== NOTIFICATIONS TOGGLE ==========

  const toggleNotifications = (event) => {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  };

  // ========== FAB DRAGGABLE SUPPORT ==========
  const initDraggableFAB = () => {
    const fab = document.querySelector('.module-header .btn--primary');
    if (!fab || window.innerWidth > 768) return;

    let isDragging = false;
    let startY, startYPos;

    fab.addEventListener('touchstart', (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      // Get current bottom property or computed style
      const computed = window.getComputedStyle(fab);
      startYPos = parseInt(computed.bottom, 10) || 85;
      fab.style.transition = 'none';
      e.stopPropagation(); // don't trigger clicks yet
    }, { passive: true });

    fab.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      let newBottom = startYPos + deltaY;

      // Boundaries
      if (newBottom < 85) newBottom = 85; // minimal bottom
      if (newBottom > window.innerHeight - 100) newBottom = window.innerHeight - 100;

      fab.style.bottom = newBottom + 'px';
      // Add a tiny movement threshold to prevent triggering click when dragging
      if (Math.abs(deltaY) > 5) {
        fab.dataset.dragged = 'true';
      }
    }, { passive: true });

    fab.addEventListener('touchend', (e) => {
      isDragging = false;
      fab.style.transition = 'bottom 0.3s ease, box-shadow 0.3s ease';
      setTimeout(() => {
        fab.dataset.dragged = 'false';
      }, 50);
    });

    fab.addEventListener('click', (e) => {
      if (fab.dataset.dragged === 'true') {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  };

  // ========== TOAST NOTIFICATIONS ==========

  const showNotification = (message, type = 'info') => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `toast-notification toast-notification--${type}`;
    notification.innerHTML = `
      <span class="toast-notification__icon">
        ${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}
      </span>
      <span class="toast-notification__message">${message}</span>
    `;

    // Add styles if not present
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          background: var(--bg-secondary);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 10000;
          animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
          border-left: 4px solid var(--color-info-500);
        }
        .toast-notification--success { border-left-color: var(--color-success); }
        .toast-notification--error { border-left-color: var(--color-danger); }
        .toast-notification--warning { border-left-color: var(--color-warning); }
        .toast-notification__icon { font-size: 18px; }
        .toast-notification--success .toast-notification__icon { color: var(--color-success); }
        .toast-notification--error .toast-notification__icon { color: var(--color-danger); }
        .toast-notification--warning .toast-notification__icon { color: var(--color-warning); }
        .toast-notification--info .toast-notification__icon { color: var(--color-info-500); }
        .toast-notification__message { color: var(--text-primary); font-size: var(--font-size-sm); }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  // ========== REFRESH DATA HANDLER ==========

  const handleRefreshData = async () => {
    const refreshBtn = document.getElementById('refreshDataBtn');

    // Avoid multiple simultaneous refreshes
    if (DataService.isRefreshing && DataService.isRefreshing()) {
      showNotification('Sincronización en progreso...', 'info');
      return;
    }

    // Add spinning animation
    if (refreshBtn) {
      refreshBtn.classList.add('refreshing');
      refreshBtn.disabled = true;
    }

    try {
      showNotification('Sincronizando datos...', 'info');

      const success = await DataService.refreshData();

      if (success) {
        showNotification('¡Díatos actualizados!', 'success');
        // Re-render current module with fresh data
        render();
      } else {
        showNotification('Error al actualizar datos', 'error');
      }
    } catch (error) {
      console.error('Error en handleRefreshData:', error);
      showNotification('Error de conexión', 'error');
    } finally {
      // Remove spinning animation
      if (refreshBtn) {
        refreshBtn.classList.remove('refreshing');
        refreshBtn.disabled = false;
      }
    }
  };

  // ========== PUBLIC API ==========
  // ========== MOBILE UI HELPERS ==========

  function setupMobileMenuHandlers() {
    // Only handles legacy references if any, logic moved to attachEventListeners
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar && overlay) {
      // Close sidebar when a menu item is clicked (redundant safety)
      sidebar.querySelectorAll('.sidebar__menu-link').forEach(link => {
        link.addEventListener('click', () => {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        });
      });
    }
  };

  function setupMobileTables() {
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
          if (headers[index] && !cell.hasAttribute('data-label')) {
            cell.setAttribute('data-label', headers[index]);
          }
        });
      });
    });
  };

  const updateSidebarStyle = () => {
    const sidebar = document.getElementById('sidebar');
    const logo = document.querySelector('.sidebar__logo-img');
    const companyConfig = State.get('companyConfig');

    if (companyConfig) {
      if (sidebar) {
        sidebar.style.setProperty('--sidebar-brand', companyConfig.sidebarColor || '#0a1628');
      }

      if (companyConfig.brandColor) {
        document.documentElement.style.setProperty('--color-primary-500', companyConfig.brandColor);
        document.documentElement.style.setProperty('--bg-sidebar-active', companyConfig.brandColor);
        document.documentElement.style.setProperty('--color-primary-600', companyConfig.brandColor);
      }

      if (logo) {
        logo.src = companyConfig.logoUrl || 'assets/logo.png';
        logo.alt = companyConfig.name || 'ALLTECH';
      }
    }

    // Actualizar favicon dinámicamente con el logo de la empresa
    if (companyConfig && companyConfig.logoUrl) {
      const faviconLink = document.querySelector('link[rel="icon"]');
      if (faviconLink) {
        faviconLink.href = companyConfig.logoUrl;
      }
    }

    // Actualizar título de la página
    if (companyConfig && companyConfig.name) {
      document.title = companyConfig.name;
      const metaAppName = document.querySelector('meta[name="application-name"]');
      if (metaAppName) metaAppName.content = companyConfig.name;
      const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (metaAppleTitle) metaAppleTitle.content = companyConfig.name;
    }
  };

  return {
    init,
    render,
    navigate,
    refreshCurrentModule: () => {
      // Re-render current module content without full page reload if possible
      // Focus state preservation is now handled synchronously inside render()
      render();
    },
    handleRefreshData,
    toggleNotifications,
    handleSwitchUser,
    handleLogout,
    toggleUserMenu,
    updateSidebarStyle,

    toggleSidebar: () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    },
    closeSidebar: () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }
  };
})();
