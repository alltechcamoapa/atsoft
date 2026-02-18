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
      { id: 'clientes', label: 'Clientes', icon: Icons.users },
      { id: 'contratos', label: 'Contratos', icon: Icons.fileText },
      { id: 'visitas', label: 'Visitas / Servicios', icon: Icons.wrench },
      { id: 'pedidos', label: 'Pedidos', icon: Icons.shoppingCart },
      { id: 'proformas', label: 'Proformas', icon: Icons.fileText },
      { id: 'productos', label: 'Productos / Servicios', icon: Icons.package },
      { id: 'equipos', label: 'Equipos', icon: Icons.monitor },
      { id: 'software', label: 'Software', icon: Icons.monitor },
      { id: 'prestaciones', label: 'Prestaciones', icon: Icons.dollarSign },
      { id: 'calendario', label: 'Calendario', icon: Icons.calendar },
      { id: 'reportes', label: 'Reportes', icon: Icons.barChart },
      { id: 'gestion-tecnicos', label: 'Gestión de Técnicos', icon: Icons.users },
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
      <aside class="sidebar" id="sidebar" style="background: ${companyConfig.sidebarColor || '#1a73e8'};">
        <div class="sidebar__header">
          <img src="${companyConfig.logoUrl || 'assets/logo.png'}" alt="${companyConfig.name || 'ALLTECH'}" class="sidebar__logo-img" style="max-width: 120px; height: auto; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
        </div>
        
        <nav class="sidebar__nav">
          <ul class="sidebar__menu">
            ${visibleItems.map(item => `
              <li class="sidebar__menu-item">
                <a href="#${item.id}" 
                   class="sidebar__menu-link ${currentModule === item.id ? 'active' : ''}"
                   data-module="${item.id}">
                  <span class="sidebar__menu-icon">${item.icon}</span>
                  ${item.label}
                </a>
              </li>
            `).join('')}
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
      software: 'Software y Licencias',
      prestaciones: 'Prestaciones Laborales',
      calendario: 'Calendario',
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
            <button class="header__action-btn notification-bell ${(typeof NotificationService !== 'undefined' && NotificationService.getUnreadCount() > 0) ? 'has-notifications' : ''}" id="notificationsBtn" onclick="App.toggleNotifications()">
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
             <button class="header__avatar-btn" onclick="App.toggleUserMenu()">
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

    // Log out and return to login screen
    State.logout();
    render();
  };

  const toggleUserMenu = () => {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('show');
  };

  // ========== DASHBOARD MODULE ==========

  const renderDashboard = () => {
    const stats = DataService.getDashboardStats();
    const activities = DataService.getRecentActivities();
    const savingsPlans = DataService.getSavingsPlans();
    const bankAccounts = DataService.getBankAccounts();
    const user = State.get('user');
    const proformas = DataService.getProformasSync().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

    // Get upcoming visits
    const allVisitas = DataService.getVisitasSync();
    const today = new Date();
    const upcomingVisitas = allVisitas
      .filter(v => new Date(v.fechaInicio) >= today && !v.trabajoRealizado)
      .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
      .slice(0, 5);

    return `
      <div class="dashboard">
        <!-- Stats Row -->
        <div class="dashboard__row dashboard__row--stats">
          <div class="stat-card stat-card--primary" onclick="App.navigate('clientes')" title="Ver Clientes">
            <div class="stat-card__header">
              <div class="stat-card__icon">${Icons.users}</div>
              <span class="stat-card__trend stat-card__trend--${stats.clientesActivos.trendDirection}">
                ${stats.clientesActivos.trendDirection === 'up' ? Icons.trendingUp : Icons.trendingDown}
                ${Math.abs(stats.clientesActivos.trend)}%
              </span>
            </div>
            <span class="stat-card__label">Clientes Activos</span>
            <span class="stat-card__value">${stats.clientesActivos.value}</span>
            <span class="stat-card__period">Click para ver más →</span>
          </div>

          <div class="stat-card stat-card--success" onclick="App.navigate('visitas')" title="Ver Visitas">
            <div class="stat-card__header">
              <div class="stat-card__icon">${Icons.calendar}</div>
              <span class="stat-card__trend stat-card__trend--${stats.serviciosMes.trendDirection}">
                ${stats.serviciosMes.trendDirection === 'up' ? Icons.trendingUp : Icons.trendingDown}
                ${Math.abs(stats.serviciosMes.trend)}%
              </span>
            </div>
            <span class="stat-card__label">Servicios del Mes</span>
            <span class="stat-card__value">${stats.serviciosMes.value}</span>
            <span class="stat-card__period">Click para ver más →</span>
          </div>

          <div class="stat-card stat-card--warning" onclick="App.navigate('proformas')" title="Ver Proformas">
            <div class="stat-card__header">
              <div class="stat-card__icon">${Icons.fileText}</div>
              <span class="stat-card__trend stat-card__trend--${stats.ingresosMes.trendDirection}">
                ${stats.ingresosMes.trendDirection === 'up' ? Icons.trendingUp : Icons.trendingDown}
                ${Math.abs(stats.ingresosMes.trend)}%
              </span>
            </div>
            <span class="stat-card__label">Ingresos (USD)</span>
            <span class="stat-card__value">$${stats.ingresosMes.value.toFixed(2)}</span>
            <span class="stat-card__period">Click para ver más →</span>
          </div>

          <div class="stat-card stat-card--info" onclick="App.navigate('contratos')" title="Ver Contratos">
            <div class="stat-card__header">
              <div class="stat-card__icon">${Icons.fileText}</div>
              <span class="stat-card__trend stat-card__trend--${stats.contratosActivos.trendDirection}">
                ${stats.contratosActivos.trendDirection === 'up' ? Icons.trendingUp : Icons.trendingDown}
                ${Math.abs(stats.contratosActivos.trend)}%
              </span>
            </div>
            <span class="stat-card__label">Contratos Activos</span>
            <span class="stat-card__value">${stats.contratosActivos.value}</span>
            <span class="stat-card__period">Click para ver más →</span>
          </div>
        </div>

        <!-- Upcoming Visits Alert -->
        ${upcomingVisitas.length > 0 ? `
          <div class="card" style="background: linear-gradient(135deg, var(--color-primary-50) 0%, var(--bg-secondary) 100%); border-left: 4px solid var(--color-primary-500);">
            <div class="card__header">
              <h3 class="card__title">${Icons.calendar} Próximas Visitas Programadas</h3>
              <button class="btn btn--ghost btn--sm" onclick="App.navigate('visitas')">
                Ver Todas
              </button>
            </div>
            <div class="card__body">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--spacing-md);">
                ${upcomingVisitas.map(visita => {
      const cliente = DataService.getClienteById(visita.clienteId);
      const equipo = DataService.getEquipoById(visita.equipoId);
      const fechaVisita = new Date(visita.fechaInicio);
      const diasRestantes = Math.ceil((fechaVisita - today) / (1000 * 60 * 60 * 24));

      return `
                    <div class="upcoming-visit-card" style="padding: var(--spacing-md); background: var(--bg-secondary); border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
                      <div style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-sm);">
                        <div style="flex-shrink: 0; width: 48px; height: 48px; border-radius: var(--border-radius-md); background: var(--color-primary-100); color: var(--color-primary-600); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: var(--font-weight-bold);">
                          <div style="font-size: var(--font-size-lg);">${fechaVisita.getDate()}</div>
                          <div style="font-size: var(--font-size-xs); text-transform: uppercase;">${fechaVisita.toLocaleDateString('es-NI', { month: 'short' })}</div>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                          <div style="font-weight: var(--font-weight-semibold); color: var(--text-primary); margin-bottom: var(--spacing-xs);">${visita.tipoVisita}</div>
                          <div style="font-size: var(--font-size-sm); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${Icons.user} ${cliente?.nombreCliente || 'Cliente N/A'}
                          </div>
                          ${equipo ? `
                            <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 2px;">
                              ${Icons.monitor} ${equipo.nombreEquipo}
                            </div>
                          ` : ''}
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: var(--spacing-sm); border-top: 1px solid var(--border-color);">
                        <span class="badge badge--${diasRestantes === 0 ? 'danger' : diasRestantes <= 2 ? 'warning' : 'primary'}" style="font-size: var(--font-size-xs);">
                          ${diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Mañana' : `En ${diasRestantes} días`}
                        </span>
                        <button class="btn btn--ghost btn--icon btn--sm" onclick="App.navigate('visitas')" title="Ver detalles">
                          ${Icons.arrowRight}
                        </button>
                      </div>
                    </div>
                  `;
    }).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Quick Actions Row (Moved to top) -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Acciones Rápidas</h3>
          </div>
          <div class="card__body">
            <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
              <button class="btn btn--primary" onclick="App.navigate('visitas')">
                ${Icons.plus} Nueva Visita
              </button>
              <button class="btn btn--secondary" onclick="App.navigate('clientes')">
                ${Icons.users} Nuevo Cliente
              </button>
              <button class="btn btn--secondary" onclick="App.navigate('proformas')">
                ${Icons.fileText} Nueva Proforma
              </button>
              <button class="btn btn--secondary" onclick="App.navigate('contratos')">
                ${Icons.fileText} Nuevo Contrato
              </button>
              <button class="btn btn--secondary" onclick="App.navigate('equipos')">
                ${Icons.monitor} Nuevo Equipo
              </button>
              <button class="btn btn--secondary" onclick="ReportesModule.generateGeneralReport()">
                ${Icons.barChart} Reporte General
              </button>
            </div>
          </div>
        </div>

        <!-- Main Row -->
        <div class="dashboard__row dashboard__row--main">
          <!-- Chart Card -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">Estadísticas ALLTECH</h3>
              <div class="dropdown">
                <button class="btn btn--ghost btn--sm dropdown__trigger">
                  Esta Semana
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            <div class="card__body">
              <div style="display: flex; align-items: baseline; gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
                <span class="text-sm text-muted">Ingresos por mes</span>
                <span style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">$12,345.00</span>
                <span class="text-sm text-success">+5%</span>
              </div>
              <div style="display: flex; gap: var(--spacing-lg); margin-bottom: var(--spacing-md);">
                <div style="display: flex; align-items: center; gap: var(--spacing-xs);">
                  <span style="width: 12px; height: 12px; background: var(--color-primary-500); border-radius: 2px;"></span>
                  <span class="text-sm">Ingresos</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--spacing-xs);">
                  <span style="width: 12px; height: 12px; background: var(--color-success); border-radius: 2px;"></span>
                  <span class="text-sm">Beneficio</span>
                </div>
              </div>
              <div class="chart-container">
                <canvas id="statsChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Right Panel -->
          <div style="display: flex; flex-direction: column; gap: var(--spacing-lg);">
            <!-- User Profile Card -->
            <div class="card">
              <div class="user-profile-card">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=1a73e8&color=fff&size=80" 
                     alt="${user?.name || 'User'}" 
                     class="user-profile-card__avatar">
                <div class="user-profile-card__name">${user?.name || 'Invitado'}</div>
                <div class="user-profile-card__email">${user?.email || 'No disponible'}</div>
                <div class="user-profile-card__actions">
                  <div class="user-profile-card__action">
                    <div class="user-profile-card__action-icon">${Icons.phone}</div>
                    <span class="user-profile-card__action-label">Contacto</span>
                  </div>
                  <div class="user-profile-card__action">
                    <div class="user-profile-card__action-icon">${Icons.user}</div>
                    <span class="user-profile-card__action-label">Perfil</span>
                  </div>
                  <div class="user-profile-card__action">
                    <div class="user-profile-card__action-icon">${Icons.info}</div>
                    <span class="user-profile-card__action-label">Info</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Savings Plans -->
             <div class="card">
              <div class="card__header">
                <h3 class="card__title">Plan de Metas</h3>
                <button class="btn btn--ghost btn--icon">${Icons.moreVertical}</button>
              </div>
              <div class="card__body" style="padding: var(--spacing-md) 0;">
                <div class="savings-plan">
                  ${savingsPlans.map(plan => `
                    <div class="savings-plan__item">
                      <div class="savings-plan__icon" style="background: ${plan.id === 1 ? 'var(--color-primary-50)' : 'var(--color-success-light)'};">
                        ${plan.icon}
                      </div>
                      <div class="savings-plan__info">
                        <div class="savings-plan__title">${plan.title}</div>
                        <div class="savings-plan__subtitle">${plan.subtitle}</div>
                      </div>
                      <div class="savings-plan__progress">
                        <div class="progress ${plan.id === 1 ? '' : 'progress--success'}">
                          <div class="progress__bar" style="width: ${plan.percent}%"></div>
                        </div>
                      </div>
                      <div class="savings-plan__amount">
                        <div class="savings-plan__value">$${plan.target.toLocaleString()}</div>
                        <div class="savings-plan__percent">${plan.percent}%</div>
                      </div>
                    </div >
  `).join('')}
                </div>
              </div>
            </div>

            <!-- Recent Proformas -->
            <div class="card">
              <div class="card__header">
                <h3 class="card__title">Proformas Recientes</h3>
                <button class="btn btn--ghost btn--sm" onclick="App.navigate('proformas')">
                  Ver Todas
                </button>
              </div>
              <div class="card__body" style="padding: 0;">
                ${proformas.length > 0 ? `
                  <table class="data-table">
                    <tbody class="data-table__body">
                      ${proformas.map(p => {
      const cliente = DataService.getClienteById(p.clienteId);
      return `
                          <tr style="cursor: pointer;" onclick="App.navigate('proformas')">
                            <td>
                              <div style="font-weight: var(--font-weight-medium);">${p.proformaId}</div>
                              <div class="text-xs text-muted">${cliente?.empresa || 'N/A'}</div>
                            </td>
                            <td>
                              <span class="badge ${p.estado === 'Activa' ? 'badge--primary' :
          p.estado === 'Aprobada' ? 'badge--success' :
            p.estado === 'Vencida' ? 'badge--warning' : 'badge--neutral'
        }">
                                ${p.estado}
                              </span>
                            </td>
                            <td style="text-align: right;">
                              <div style="font-weight: var(--font-weight-semibold);">${p.moneda === 'USD' ? '$' : 'C$'}${p.total.toFixed(2)}</div>
                              <div class="text-xs text-muted">${new Date(p.fecha).toLocaleDateString('es-NI')}</div>
                            </td>
                          </tr>
                        `;
    }).join('')}
                    </tbody>
                  </table>
                ` : '<p class="text-muted text-center" style="padding: var(--spacing-lg);">No hay proformas</p>'}
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activities Table -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Actividades Recientes</h3>
            <div style="display: flex; gap: var(--spacing-md);">
              <div class="header__search" style="width: 200px;">
                <span class="header__search-icon">${Icons.search}</span>
                <input type="text" 
                       class="header__search-input" 
                       placeholder="Buscar archivo...">
              </div>
              <button class="btn btn--ghost btn--sm">
                ${Icons.filter} Filtrar
              </button>
            </div>
          </div>
          <div class="card__body" style="padding: 0;">
            <table class="data-table">
              <thead class="data-table__head">
                <tr>
                  <th>No</th>
                  <th>No. Servicio</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody class="data-table__body">
                ${activities.map((activity, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td><span class="font-medium">${activity.numero}</span></td>
                    <td>${activity.cliente}</td>
                    <td>${activity.fecha}</td>
                    <td>
                      <span class="badge ${activity.estado === 'Completado' ? 'badge--success' : 'badge--warning'}">
                        ${activity.estado}
                      </span>
                    </td>
                    <td>${activity.monto}</td>
                    <td>
                      <div style="display: flex; gap: var(--spacing-xs);">
                        <button class="btn btn--ghost btn--icon btn--sm">${Icons.eye}</button>
                        <button class="btn btn--ghost btn--icon btn--sm">${Icons.edit}</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
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
    // Always close sidebar before navigation (prevents flash on mobile)
    closeSidebar();
    State.setCurrentModule(module);
    // Update hash without triggering hashchange re-render
    const currentHash = window.location.hash.slice(1);
    if (currentHash !== module) {
      window.removeEventListener('hashchange', handleHashChange);
      window.location.hash = module;
      requestAnimationFrame(() => {
        window.addEventListener('hashchange', handleHashChange);
      });
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
      case 'calendario':
        moduleContent = CalendarioModule.render();
        break;
      case 'prestaciones':
        moduleContent = PrestacionesModule.render();
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

    appContainer.innerHTML = `
      ${renderSidebar()}
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <main class="main">
        ${renderHeader()}
        <div class="content">
          ${moduleContent}
        </div>
      </main>
      ${renderBottomNav()}
    `;

    // Initialize chart after render
    if (currentModule === 'dashboard') {
      requestAnimationFrame(() => {
        initChart();
      });
    }

    // Initialize Mobile UI Helpers
    setupMobileMenuHandlers();
    setupMobileTables();
    attachEventListeners();
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
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) {
      sidebar.classList.toggle('open');
    }
    if (overlay) {
      overlay.classList.toggle('active');
    }
  };

  const closeSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  };

  // ========== EVENT LISTENERS ==========

  function attachEventListeners() {
    // Navigation links (sidebar)
    document.querySelectorAll('.sidebar__menu-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const module = link.dataset.module;
        closeSidebar(); // Close sidebar after navigation on mobile
        navigate(module);
      });
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
        closeSidebar();
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
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .sidebar__menu-link, .pwa-bottom-nav__item, .stat-card, .card--clickable');
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

  const toggleNotifications = () => {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.toggle('show');
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
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 10000;
          animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
          border-left: 4px solid var(--color-info-500);
        }
        .toast-notification--success { border-left-color: var(--color-success-500); }
        .toast-notification--error { border-left-color: var(--color-danger-500); }
        .toast-notification--warning { border-left-color: var(--color-warning-500); }
        .toast-notification__icon { font-size: 18px; }
        .toast-notification--success .toast-notification__icon { color: var(--color-success-500); }
        .toast-notification--error .toast-notification__icon { color: var(--color-danger-500); }
        .toast-notification--warning .toast-notification__icon { color: var(--color-warning-500); }
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
        showNotification('¡Datos actualizados!', 'success');
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

    if (companyConfig && sidebar) {
      sidebar.style.background = companyConfig.sidebarColor || '#1a73e8';
    }
    if (companyConfig && logo) {
      logo.src = companyConfig.logoUrl || 'assets/logo.png';
      logo.alt = companyConfig.name || 'ALLTECH';
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
      // For now, full render is safest
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
