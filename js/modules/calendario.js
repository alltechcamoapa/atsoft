/**
 * ALLTECH - Calendario Module
 * Maintenance calendar with scheduled visits and contract alerts
 */

const CalendarioModule = (() => {
  let currentDate = new Date();
  let filterState = { tecnico: 'all', cliente: 'all' };

  const render = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const visitas = DataService.getVisitasByMonth(year, month);
    const contratosVencidos = DataService.getContratosProximosAVencer();
    const clientes = DataService.getClientesSync();
    const tecnicos = ['Técnico Juan', 'Técnico María', 'Técnico Carlos'];
    const user = State.get('user');
    const canCreateVisita = DataService.canPerformAction(user.role, 'visitas', 'create');

    return `
      <div class="module-container">
        <div class="module-header">
          <div class="module-header__left">
            <h2 class="module-title">Calendario de Mantenimiento</h2>
            <p class="module-subtitle">${visitas.length} visitas programadas en ${getMonthName(month)} ${year}</p>
          </div>
          <div class="module-header__right">
            ${canCreateVisita ? `
            <button class="btn btn--primary" onclick="VisitasModule.openCreateModal()">
              ${Icons.plus} Nueva Visita
            </button>
            ` : ''}
          </div>
        </div>
        <!-- Alerts -->
        ${contratosVencidos.length > 0 ? `
          <div class="alert alert--warning">
            <div class="alert__icon">${Icons.alertCircle}</div>
            <div class="alert__content">
              <strong>Contratos próximos a vencer:</strong> ${contratosVencidos.length} contratos vencen en los próximos 30 días.
              <a href="#contratos" class="alert__link" onclick="App.navigate('contratos')">Ver contratos</a>
            </div>
          </div>
        ` : ''
      }

  <div class="calendar-layout">
    <!-- Calendar -->
    <div class="card calendar-card">
      <div class="card__header">
        <div class="calendar-nav">
          <button class="btn btn--ghost btn--icon" onclick="CalendarioModule.prevMonth()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h3 class="calendar-title">${getMonthName(month)} ${year}</h3>
          <button class="btn btn--ghost btn--icon" onclick="CalendarioModule.nextMonth()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <button class="btn btn--secondary btn--sm" onclick="CalendarioModule.goToToday()">Hoy</button>
      </div>
      <div class="card__body">
        ${renderCalendarGrid(year, month, visitas)}
      </div>
    </div>

    <!-- Sidebar -->
    <div class="calendar-sidebar">
      <!-- Filters -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">Filtros</h4>
        </div>
        <div class="card__body">
          <div class="form-group">
            <label class="form-label">Técnico</label>
            <select class="form-select" onchange="CalendarioModule.handleTecnicoFilter(this.value)">
              <option value="all">Todos</option>
              ${tecnicos.map(t => `<option value="${t}" ${filterState.tecnico === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cliente</label>
            <select class="form-select" onchange="CalendarioModule.handleClienteFilter(this.value)">
              <option value="all">Todos</option>
              ${clientes.map(c => `<option value="${c.clienteId}" ${filterState.cliente === c.clienteId ? 'selected' : ''}>${c.empresa}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Today's Events -->
      <div class="card">
        <div class="card__header">
          <h4 class="card__title">Próximas Visitas</h4>
        </div>
        <div class="card__body">
          ${renderUpcomingVisits(visitas)}
        </div>
      </div>
    </div>
  </div>
      </div >
  `;
  };

  const renderCalendarGrid = (year, month, visitas) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    let html = '<div class="calendar-grid">';

    // Day headers
    dayNames.forEach(day => {
      html += `<div class="calendar-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      html += '<div class="calendar-day calendar-day--empty"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayVisitas = getVisitasForDate(visitas, dateStr);
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

      html += `
        <div class="calendar-day ${isToday ? 'calendar-day--today' : ''}" onclick="CalendarioModule.showDayEvents('${dateStr}')">
    <span class="calendar-day__number">${day}</span>
          ${dayVisitas.length > 0 ? `
            <div class="calendar-day__events">
              ${dayVisitas.slice(0, 2).map(v => {
        const tipoClass = v.tipoVisita === 'Física' ? 'primary' : 'info';
        return `<div class="calendar-event calendar-event--${tipoClass}">${v.descripcionTrabajo.slice(0, 15)}...</div>`;
      }).join('')}
              ${dayVisitas.length > 2 ? `<div class="calendar-event calendar-event--more">+${dayVisitas.length - 2} más</div>` : ''}
            </div>
          ` : ''
        }
        </div >
  `;
    }

    // Empty cells after last day
    const endDay = (startDay + daysInMonth) % 7;
    if (endDay !== 0) {
      for (let i = endDay; i < 7; i++) {
        html += '<div class="calendar-day calendar-day--empty"></div>';
      }
    }

    html += '</div>';
    return html;
  };

  const renderUpcomingVisits = (visitas) => {
    const now = new Date();
    const upcoming = visitas
      .filter(v => new Date(v.fechaInicio) >= now)
      .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return '<p class="text-muted text-sm">No hay visitas próximas.</p>';
    }

    return upcoming.map(v => {
      const cliente = DataService.getClienteById(v.clienteId);
      const fecha = new Date(v.fechaInicio);

      return `
        <div class="upcoming-visit" onclick="VisitasModule.viewDetail('${v.visitaId}')">
          <div class="upcoming-visit__date">
            <span class="upcoming-visit__day">${fecha.getDate()}</span>
            <span class="upcoming-visit__month">${getMonthName(fecha.getMonth()).slice(0, 3)}</span>
          </div>
          <div class="upcoming-visit__info">
            <div class="upcoming-visit__title">${v.descripcionTrabajo}</div>
            <div class="upcoming-visit__client">${cliente?.empresa || 'Cliente'}</div>
          </div>
          <span class="badge badge--${v.tipoVisita === 'Física' ? 'primary' : 'info'} badge--sm">
            ${v.tipoVisita}
          </span>
        </div >
  `;
    }).join('');
  };

  const getVisitasForDate = (visitas, dateStr) => {
    return visitas.filter(v => {
      const visitaDate = v.fechaInicio.split('T')[0];
      let matches = visitaDate === dateStr;

      if (filterState.tecnico !== 'all') {
        matches = matches && v.usuarioSoporte === filterState.tecnico;
      }
      if (filterState.cliente !== 'all') {
        matches = matches && v.clienteId === filterState.cliente;
      }

      return matches;
    });
  };

  const getMonthName = (month) => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month];
  };

  // Navigation
  const prevMonth = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    App.refreshCurrentModule();
  };

  const nextMonth = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    App.refreshCurrentModule();
  };

  const goToToday = () => {
    currentDate = new Date();
    App.refreshCurrentModule();
  };

  const showDayEvents = (dateStr) => {
    const visitas = DataService.getVisitasSync().filter(v => v.fechaInicio.startsWith(dateStr));
    if (visitas.length === 1) {
      VisitasModule.viewDetail(visitas[0].visitaId);
    } else if (visitas.length > 1) {
      // Show day modal with all events
      alert(`${visitas.length} visitas programadas para ${dateStr} `);
    }
  };

  // Filters
  const handleTecnicoFilter = (value) => { filterState.tecnico = value; App.refreshCurrentModule(); };
  const handleClienteFilter = (value) => { filterState.cliente = value; App.refreshCurrentModule(); };

  return {
    render, prevMonth, nextMonth, goToToday, showDayEvents,
    handleTecnicoFilter, handleClienteFilter
  };
})();
