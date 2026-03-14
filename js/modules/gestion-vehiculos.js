const GestionVehiculosModule = (() => {
  let currentView = "dashboard",
    selectedVehicle = null,
    selectedTab = "facturas",
    filterType = "",
    searchQuery = "",
    // Factura filters
    factFiltroTipo = "all",
    factFiltroProv = "all",
    factFiltroMes = "all",
    factFiltroDesde = "",
    factFiltroHasta = "",
    // Conductor filters
    condFiltroNombre = "",
    condFiltroEstado = "all",
    // Timeline filters
    histFiltroTipo = "all",
    histFiltroDesde = "",
    histFiltroHasta = "",
    // Depreciation
    depTipo = "lineal",
    depData = {};
  const SK = {
    vehiculos: "veh_vehiculos",
    conductores: "veh_conductores",
    gastos: "veh_gastos",
    asignaciones: "veh_asignaciones",
    combustible: "veh_combustible",
    facturas: "veh_facturas",
  };
  const getData = (k) => {
    try {
      return JSON.parse(localStorage.getItem(SK[k]) || "[]");
    } catch {
      return [];
    }
  };
  const setData = (k, d) => localStorage.setItem(SK[k], JSON.stringify(d));
  const genId = () =>
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString("es-NI", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("es-NI") : "N/A");
  const today = () => new Date().toISOString().split("T")[0];
  const addRec = (k, r) => {
    const d = getData(k);
    r.id = genId();
    r.created_at = new Date().toISOString();
    d.unshift(r);
    setData(k, d);
    return r;
  };
  const updateRec = (k, id, u) => {
    const d = getData(k);
    const i = d.findIndex((r) => r.id === id);
    if (i !== -1) {
      d[i] = { ...d[i], ...u };
      setData(k, d);
    }
    return d[i];
  };
  const deleteRec = (k, id) =>
    setData(
      k,
      getData(k).filter((r) => r.id !== id),
    );
  const navigateTo = (v) => {
    currentView = v;
    App.render();
  };
  const SQ = String.fromCharCode(39);
  const showModal = (html, cls) => {
    const e = document.getElementById("vehModal");
    if (e) e.remove();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="modal-overlay open" id="vehModal" style="z-index:10001;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;"><div class="modal ' +
        (cls || "modal--md") +
        '" style="margin:0;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">' +
        html +
        "</div></div>",
    );
  };
  const closeModal = () => {
    const m = document.getElementById("vehModal");
    if (m) {
      m.classList.remove("open");
      setTimeout(() => m.remove(), 200);
    }
  };
  const STYLES =
    "<style>.veh-header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:20px;padding:1.8rem 2rem;color:#fff;margin-bottom:var(--spacing-lg);position:relative;overflow:hidden}.veh-header__title{display:flex;align-items:center;gap:10px;font-size:1.4rem;font-weight:700;margin-bottom:1.2rem}.veh-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.veh-kpi{background:rgba(255,255,255,.08);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 16px;cursor:pointer;transition:background .2s}.veh-kpi:hover{background:rgba(255,255,255,.14)}.veh-kpi__label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;opacity:.7;margin-bottom:4px}.veh-kpi__value{font-size:1.35rem;font-weight:800}.veh-kpi__sub{font-size:10px;opacity:.5;margin-top:2px}.veh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--spacing-md);margin-bottom:var(--spacing-xl)}@media(max-width:900px){.veh-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:540px){.veh-grid{grid-template-columns:1fr}}.veh-tile{background:var(--bg-surface,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:16px;padding:1.4rem;display:flex;flex-direction:column;align-items:center;text-align:center;cursor:pointer;transition:all .25s ease}.veh-tile:hover{transform:translateY(-5px);box-shadow:0 12px 28px rgba(0,0,0,.1)}.veh-tile__icon{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:24px}.veh-tile__name{font-size:14px;font-weight:700;margin-bottom:4px}.veh-tile__desc{font-size:11px;color:var(--text-muted);margin-bottom:8px}.veh-tile__metric{font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px}.veh-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:var(--spacing-md)}.veh-toolbar input,.veh-toolbar select{padding:8px 12px;border:1px solid var(--border-color);border-radius:8px;font-size:13px;background:var(--bg-surface)}.veh-card{background:var(--bg-surface,#fff);border:1px solid var(--border-color);border-radius:16px;padding:1.2rem;margin-bottom:12px;transition:all .2s}.veh-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}.veh-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.veh-tabs{display:flex;gap:4px;margin-bottom:var(--spacing-md);border-bottom:2px solid var(--border-color);padding-bottom:0}.veh-tab{padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s}.veh-tab.active{color:var(--color-primary,#3b82f6);border-bottom-color:var(--color-primary)}.veh-stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px}.veh-chart-bar{height:20px;border-radius:4px;transition:width .5s ease;min-width:2px}.veh-timeline{position:relative;padding-left:24px}.veh-timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:2px;background:var(--border-color)}.veh-timeline-item{position:relative;margin-bottom:16px;padding:12px;border-radius:12px;background:var(--bg-surface);border:1px solid var(--border-color)}.veh-timeline-item::before{content:'';position:absolute;left:-20px;top:16px;width:10px;height:10px;border-radius:50%;background:var(--color-primary);border:2px solid #fff}.form__grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form__group{display:flex;flex-direction:column;gap:4px}.form__label{font-size:12px;font-weight:600;color:var(--text-secondary,#475569)}.form__input{padding:8px 12px;border:1px solid var(--border-color);border-radius:8px;font-size:13px}@media(max-width:540px){.form__grid{grid-template-columns:1fr}}</style>";
  const getMetrics = () => {
    const v = getData("vehiculos"),
      f = getData("facturas"),
      now = new Date(),
      ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Gastos y Combustibles ahora viven dentro de facturas
    const fMes = f.filter(x => x.fecha >= ms);
    
    const totalGastosMes = fMes.reduce((s, x) => s + parseFloat(x.monto || x.total || x.subtotal || 0), 0);
    const totalCombMes = fMes.filter(x => x.tipo_gasto === 'Combustible').reduce((s, x) => s + parseFloat(x.monto || x.total || x.subtotal || 0), 0);
      activos = v.filter((x) => x.estado === "Activo").length;
    let topV = "N/A",
      topC = 0;
    const byV = {};
    f.forEach((x) => {
      byV[x.vehiculo_id] = (byV[x.vehiculo_id] || 0) + parseFloat(x.monto || 0);
    });
    Object.entries(byV).forEach(function (e) {
      if (e[1] > topC) {
        topC = e[1];
        const vh = v.find((x) => x.id === e[0]);
        topV = vh ? vh.apodo || vh.placa : "?";
      }
    });
    return {
      total: v.length,
      activos: activos,
      totalGastosMes: totalGastosMes,
      totalCombMes: totalCombMes,
      topV: topV,
      topC: topC,
    };
  };
  const renderTile = function (vid, icon, name, desc, color, bg, metric) {
    return (
      '<div class="veh-tile" onclick="GestionVehiculosModule.navigateTo(' +
      SQ +
      vid +
      SQ +
      ')"><div class="veh-tile__icon" style="background:' +
      bg +
      ";color:" +
      color +
      '">' +
      icon +
      '</div><div class="veh-tile__name">' +
      name +
      '</div><div class="veh-tile__desc">' +
      desc +
      '</div><div class="veh-tile__metric" style="background:' +
      bg +
      ";color:" +
      color +
      '">' +
      metric +
      "</div></div>"
    );
  };
  const renderBackBtn = function (label) {
    return (
      '<button onclick="GestionVehiculosModule.navigateTo(' +
      SQ +
      "dashboard" +
      SQ +
      ')" class="btn btn--secondary btn--sm" style="margin-bottom:12px">← ' +
      (label || "Volver") +
      "</button>"
    );
  };
  const renderDashboard = function () {
    const m = getMetrics();
    return (
      '<div class="veh-header"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="veh-header__title">🚗 Gestión de Vehículos</div><button onclick="GestionFinancieraModule.navigateTo(' +
      SQ +
      "dashboard" +
      SQ +
      ')" class="btn btn--secondary btn--sm" style="background:rgba(255,255,255,.1);border:none;color:#fff">⬅ Volver a Finanzas</button></div><div class="veh-kpis"><div class="veh-kpi" onclick="GestionVehiculosModule.navigateTo(' +
      SQ +
      "vehiculos" +
      SQ +
      ')"><div class="veh-kpi__label">Flota Activa</div><div class="veh-kpi__value" style="color:#38bdf8">' +
      m.activos +
      "/" +
      m.total +
      '</div><div class="veh-kpi__sub">Vehículos activos</div></div><div class="veh-kpi" onclick="GestionVehiculosModule.navigateTo(' +
      SQ +
      "gastos" +
      SQ +
      ')"><div class="veh-kpi__label">Gastos del Mes</div><div class="veh-kpi__value" style="color:#f43f5e">C$' +
      fmt(m.totalGastosMes) +
      '</div><div class="veh-kpi__sub">Inversión mensual</div></div><div class="veh-kpi" onclick="GestionVehiculosModule.navigateTo(' +
      SQ +
      "combustible" +
      SQ +
      ')"><div class="veh-kpi__label">Combustible</div><div class="veh-kpi__value" style="color:#fbbf24">C$' +
      fmt(m.totalCombMes) +
      '</div><div class="veh-kpi__sub">Costo gas/diesel</div></div><div class="veh-kpi"><div class="veh-kpi__label">Mayor Gasto</div><div class="veh-kpi__value" style="color:#a78bfa;font-size:1.1rem">' +
      m.topV +
      '</div><div class="veh-kpi__sub">C$' +
      fmt(m.topC) +
      ' total</div></div></div></div><div class="veh-grid">' +
      renderTile(
        "vehiculos",
        "🚗",
        "Vehículos",
        "Registrar y administrar flota",
        "#3b82f6",
        "#eff6ff",
        m.total + " registrados",
      ) +
      renderTile(
        "conductores",
        "👨‍✈️",
        "Conductores",
        "Asignaciones e historial",
        "#8b5cf6",
        "#f5f3ff",
        getData("conductores").length + " conductores",
      ) +
      
      
      renderTile(
        "facturas",
        "🧾",
        "Facturas",
        "Comprobantes de compra",
        "#06b6d4",
        "#ecfeff",
        getData("facturas").length + " facturas",
      ) +
      renderTile(
        "estadisticas",
        "📊",
        "Estadísticas",
        "Reportes y análisis",
        "#6366f1",
        "#eef2ff",
        "Ver reportes",
      ) +
      "</div>"
    );
  };
  const renderVehiculos = function () {
    const v = getData("vehiculos");
    const q = searchQuery.toLowerCase();
    const filtered = v.filter(function (x) {
      return (
        (!q ||
          (x.placa || "").toLowerCase().includes(q) ||
          (x.marca || "").toLowerCase().includes(q) ||
          (x.apodo || "").toLowerCase().includes(q)) &&
        (!filterType || x.tipo === filterType)
      );
    });
    var html = renderBackBtn("Dashboard");
    html +=
      '<div class="veh-toolbar"><input placeholder="🔍 Buscar placa, marca..." value="' +
      searchQuery +
      '" oninput="GestionVehiculosModule.setSearch(this.value)"><select onchange="GestionVehiculosModule.setFilterType(this.value)"><option value="">Todos los tipos</option><option value="Automóvil">Automóvil</option><option value="Camioneta">Camioneta</option><option value="Camión">Camión</option><option value="Motocicleta">Motocicleta</option><option value="Otro">Otro</option></select><button class="btn btn--primary btn--sm" onclick="GestionVehiculosModule.openVehicleForm()">+ Nuevo Vehículo</button></div>';
    if (filtered.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">No hay vehículos registrados</div>'
      );
    html += '<div style="display:grid;gap:12px">';
    filtered.forEach(function (x) {
      var gs = getData("gastos").filter(function (g) {
        return g.vehiculo_id === x.id;
      });
      var fcts = getData("facturas").filter(function (f) {
        return f.vehiculo_id === x.id;
      });
      var totalG = gs.reduce(function (s, g) {
        return s + parseFloat(g.monto || 0);
      }, 0) + fcts.reduce(function (s, f) {
        return s + parseFloat(f.monto || f.total || f.subtotal || 0);
      }, 0);
      var asig = getData("asignaciones").find(function (a) {
        return a.vehiculo_id === x.id && !a.fecha_fin;
      });
      var cond = asig
        ? getData("conductores").find(function (c) {
            return c.id === asig.conductor_id;
          })
        : null;
      var stColor =
        x.estado === "Activo"
          ? "#dcfce7;color:#16a34a"
          : "#fef2f2;color:#ef4444";
      html +=
        '<div class="veh-card" style="cursor:pointer" onclick="GestionVehiculosModule.viewVehicle(' +
        SQ +
        x.id +
        SQ +
        ')"><div style="display:flex;justify-content:space-between;align-items:center"><div><strong style="font-size:15px">' +
        (x.apodo || x.placa) +
        '</strong> <span class="veh-badge" style="background:' +
        stColor +
        '">' +
        x.estado +
        '</span><div style="font-size:12px;color:var(--text-muted);margin-top:4px">' +
        (x.marca || "") +
        " " +
        (x.modelo || "") +
        " " +
        (x.anio || "") +
        " &bull; " +
        (x.tipo || "") +
        " &bull; " +
        (x.color || "") +
        '</div><div style="font-size:11px;color:var(--text-muted)">Placa: ' +
        x.placa +
        " &bull; KM: " +
        fmt(x.km_actual || 0) +
        (cond ? " &bull; 👤 " + cond.nombre : "") +
        '</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:700;color:#ef4444">C$' +
        fmt(totalG) +
        '</div><div style="font-size:10px;color:var(--text-muted)">invertido</div></div></div></div>';
    });
    html += "</div>";
    return html;
  };
  const setSearch = function (v) {
    searchQuery = v;
    App.render();
  };
  const setFilterType = function (v) {
    filterType = v;
    App.render();
  };
  const viewVehicle = function (id) {
    selectedVehicle = id;
    selectedTab = "facturas";
    navigateTo("vehiculo_detail");
  };
  const switchTab = function (t) {
    selectedTab = t;
    App.render();
  };
  const openVehicleForm = function (editId) {
    var v = editId
      ? getData("vehiculos").find(function (x) {
          return x.id === editId;
        })
      : null;
    showModal(
      '<div class="modal__header"><h3 class="modal__title">' +
        (v ? "Editar" : "Nuevo") +
        ' Vehículo</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div><div class="modal__body"><form id="vehForm" class="form__grid" onsubmit="GestionVehiculosModule.saveVehicle(event,' +
        SQ +
        (editId || "") +
        SQ +
        ')"><div class="form__group"><label class="form__label">Placa *</label><input name="placa" class="form__input" required value="' +
        (v ? v.placa : "") +
        '"></div><div class="form__group"><label class="form__label">Tipo *</label><select name="tipo" class="form__input" required><option value="Automóvil"' +
        (v && v.tipo === "Automóvil" ? " selected" : "") +
        '>Automóvil</option><option value="Camioneta"' +
        (v && v.tipo === "Camioneta" ? " selected" : "") +
        '>Camioneta</option><option value="Camión"' +
        (v && v.tipo === "Camión" ? " selected" : "") +
        '>Camión</option><option value="Motocicleta"' +
        (v && v.tipo === "Motocicleta" ? " selected" : "") +
        '>Motocicleta</option><option value="Otro"' +
        (v && v.tipo === "Otro" ? " selected" : "") +
        '>Otro</option></select></div><div class="form__group"><label class="form__label">Marca</label><input name="marca" class="form__input" value="' +
        (v ? v.marca : "") +
        '"></div><div class="form__group"><label class="form__label">Modelo</label><input name="modelo" class="form__input" value="' +
        (v ? v.modelo : "") +
        '"></div><div class="form__group"><label class="form__label">Color</label><input name="color" class="form__input" value="' +
        (v ? v.color : "") +
        '"></div><div class="form__group"><label class="form__label">Apodo</label><input name="apodo" class="form__input" value="' +
        (v ? v.apodo : "") +
        '"></div><div class="form__group"><label class="form__label">Año</label><input name="anio" type="number" class="form__input" value="' +
        (v ? v.anio : "") +
        '"></div><div class="form__group"><label class="form__label">Kilometraje</label><input name="km_actual" type="number" step="0.01" class="form__input" value="' +
        (v ? v.km_actual : "0") +
        '"></div><div class="form__group"><label class="form__label">Estado</label><select name="estado" class="form__input"><option value="Activo"' +
        (v && v.estado === "Activo" ? " selected" : "") +
        '>Activo</option><option value="Inactivo"' +
        (v && v.estado === "Inactivo" ? " selected" : "") +
        '>Inactivo</option><option value="En taller"' +
        (v && v.estado === "En taller" ? " selected" : "") +
        '>En taller</option></select></div></form></div><div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' +
        SQ +
        "vehForm" +
        SQ +
        ').requestSubmit()">Guardar</button></div>',
    );
  };
  const saveVehicle = function (e, editId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    fd.km_actual = parseFloat(fd.km_actual || 0);
    if (editId) {
      updateRec("vehiculos", editId, fd);
    } else {
      fd.estado = "Activo";
      fd.fecha_registro = today();
      addRec("vehiculos", fd);
    }
    closeModal();
    navigateTo("vehiculos");
  };
  const deleteVehicle = function (id) {
    if (confirm("¿Eliminar este vehículo?")) {
      deleteRec("vehiculos", id);
      navigateTo("vehiculos");
    }
  };
  const renderConductores = function () {
    var c = getData("conductores");
    var html = renderBackBtn("Dashboard");
    html +=
      '<div class="veh-toolbar"><button class="btn btn--primary btn--sm" onclick="GestionVehiculosModule.openConductorForm()">+ Nuevo Conductor</button></div>';
    if (c.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin conductores</div>'
      );
    html += '<div style="display:grid;gap:12px">';
    c.forEach(function (x) {
      var asig = getData("asignaciones").find(function (a) {
        return a.conductor_id === x.id && !a.fecha_fin;
      });
      var veh = asig
        ? getData("vehiculos").find(function (v) {
            return v.id === asig.vehiculo_id;
          })
        : null;
      html +=
        '<div class="veh-card"><div style="display:flex;justify-content:space-between;align-items:center"><div><strong>' +
        x.nombre +
        "</strong> " +
        (veh
          ? '<span class="veh-badge" style="background:#dbeafe;color:#2563eb">🚗 ' +
            (veh.apodo || veh.placa) +
            "</span>"
          : "") +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">ID: ' +
        (x.identificacion || "-") +
        " &bull; Tel: " +
        (x.telefono || "-") +
        " &bull; Lic: " +
        (x.licencia || "-") +
        (x.lic_vencimiento ? " (Vence: " + fmtD(x.lic_vencimiento) + ")" : "") +
        '</div></div><div style="display:flex;gap:4px"><button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.openConductorForm(' +
        SQ +
        x.id +
        SQ +
        ')">✏️</button><button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.deleteConductor(' +
        SQ +
        x.id +
        SQ +
        ')">🗑️</button></div></div></div>';
    });
    html += "</div>";
    return html;
  };
  const openConductorForm = function (editId) {
    var c = editId
      ? getData("conductores").find(function (x) {
          return x.id === editId;
        })
      : null;
    showModal(
      '<div class="modal__header"><h3 class="modal__title">' +
        (c ? "Editar" : "Nuevo") +
        ' Conductor</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div><div class="modal__body"><form id="condForm" class="form__grid" onsubmit="GestionVehiculosModule.saveConductor(event,' +
        SQ +
        (editId || "") +
        SQ +
        ')"><div class="form__group"><label class="form__label">Nombre *</label><input name="nombre" class="form__input" required value="' +
        (c ? c.nombre : "") +
        '"></div><div class="form__group"><label class="form__label">Identificación</label><input name="identificacion" class="form__input" value="' +
        (c ? c.identificacion : "") +
        '"></div><div class="form__group"><label class="form__label">Teléfono</label><input name="telefono" class="form__input" value="' +
        (c ? c.telefono : "") +
        '"></div><div class="form__group"><label class="form__label">Dirección</label><input name="direccion" class="form__input" value="' +
        (c ? c.direccion : "") +
        '"></div><div class="form__group"><label class="form__label">Licencia</label><input name="licencia" class="form__input" value="' +
        (c ? c.licencia : "") +
        '"></div><div class="form__group"><label class="form__label">Vencimiento Licencia</label><input type="date" name="lic_vencimiento" class="form__input" value="' +
        (c ? c.lic_vencimiento || "" : "") +
        '"></div></form></div><div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' +
        SQ +
        "condForm" +
        SQ +
        ').requestSubmit()">Guardar</button></div>',
    );
  };
  const saveConductor = function (e, editId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    if (editId) updateRec("conductores", editId, fd);
    else addRec("conductores", fd);
    closeModal();
    navigateTo("conductores");
  };
  const deleteConductor = function (id) {
    if (confirm("¿Eliminar conductor?")) {
      deleteRec("conductores", id);
      navigateTo("conductores");
    }
  };
  const openGastoForm = function (vId) {
    showModal(
      '<div class="modal__header"><h3 class="modal__title">Registrar Gasto</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div><div class="modal__body"><form id="gastoForm" class="form__grid" onsubmit="GestionVehiculosModule.saveGasto(event,' +
        SQ +
        vId +
        SQ +
        ')"><div class="form__group"><label class="form__label">Tipo *</label><select name="tipo" class="form__input" required><option value="Combustible">Combustible</option><option value="Llantas">Llantas</option><option value="Repuestos">Repuestos</option><option value="Accesorios">Accesorios</option><option value="Mantenimiento">Mantenimiento</option><option value="Reparaciones">Reparaciones</option><option value="Servicios mecánicos">Servicios mecánicos</option><option value="Otros">Otros</option></select></div><div class="form__group"><label class="form__label">Monto (C$) *</label><input type="number" step="0.01" name="monto" class="form__input" required></div><div class="form__group"><label class="form__label">Fecha *</label><input type="date" name="fecha" class="form__input" required value="' +
        today() +
        '"></div><div class="form__group"><label class="form__label">Descripción</label><input name="descripcion" class="form__input"></div><div class="form__group"><label class="form__label">Proveedor</label><input name="proveedor" class="form__input"></div><div class="form__group"><label class="form__label">Observaciones</label><textarea name="observaciones" class="form__input" rows="2"></textarea></div></form></div><div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' +
        SQ +
        "gastoForm" +
        SQ +
        ').requestSubmit()">Guardar</button></div>',
    );
  };
  const saveGasto = function (e, vId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    fd.vehiculo_id = vId;
    fd.monto = parseFloat(fd.monto || 0);
    addRec("gastos", fd);
    closeModal();
    App.render();
  };
  const deleteGasto = function (id) {
    if (confirm("¿Eliminar gasto?")) {
      deleteRec("gastos", id);
      App.render();
    }
  };
  const openCombustibleForm = function (vId) {
    var v = getData("vehiculos").find(function (x) {
      return x.id === vId;
    });
    showModal(
      '<div class="modal__header"><h3 class="modal__title">Registrar Carga</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div><div class="modal__body"><form id="combForm" class="form__grid" onsubmit="GestionVehiculosModule.saveCombustible(event,' +
        SQ +
        vId +
        SQ +
        ')"><div class="form__group"><label class="form__label">Fecha *</label><input type="date" name="fecha" class="form__input" required value="' +
        today() +
        '"></div><div class="form__group"><label class="form__label">Galones *</label><input type="number" step="0.01" name="cantidad" class="form__input" required></div><div class="form__group"><label class="form__label">Precio/Galón *</label><input type="number" step="0.01" name="precio_unidad" class="form__input" required></div><div class="form__group"><label class="form__label">KM antes *</label><input type="number" step="0.01" name="km_antes" class="form__input" required value="' +
        (v ? v.km_actual || 0 : 0) +
        '"></div><div class="form__group"><label class="form__label">KM después *</label><input type="number" step="0.01" name="km_despues" class="form__input" required></div><div class="form__group"><label class="form__label">Proveedor</label><input name="proveedor" class="form__input"></div></form></div><div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' +
        SQ +
        "combForm" +
        SQ +
        ').requestSubmit()">Guardar</button></div>',
    );
  };
  const saveCombustible = function (e, vId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    fd.vehiculo_id = vId;
    fd.cantidad = parseFloat(fd.cantidad || 0);
    fd.precio_unidad = parseFloat(fd.precio_unidad || 0);
    fd.total = fd.cantidad * fd.precio_unidad;
    fd.km_antes = parseFloat(fd.km_antes || 0);
    fd.km_despues = parseFloat(fd.km_despues || 0);
    addRec("combustible", fd);
    updateRec("vehiculos", vId, { km_actual: fd.km_despues });
    closeModal();
    App.render();
  };
  const deleteCombustible = function (id) {
    if (confirm("¿Eliminar?")) {
      deleteRec("combustible", id);
      App.render();
    }
  };
  const openAsignacionForm = function (vId) {
    var conds = getData("conductores");
    var v = getData("vehiculos").find(function (x) {
      return x.id === vId;
    });
    var opts = "";
    conds.forEach(function (c) {
      opts += '<option value="' + c.id + '">' + c.nombre + "</option>";
    });
    showModal(
      '<div class="modal__header"><h3 class="modal__title">Asignar Conductor a ' +
        (v ? v.apodo || v.placa : "") +
        '</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div><div class="modal__body"><form id="asigForm" class="form__grid" onsubmit="GestionVehiculosModule.saveAsignacion(event,' +
        SQ +
        vId +
        SQ +
        ')"><div class="form__group"><label class="form__label">Conductor *</label><select name="conductor_id" class="form__input" required>' +
        opts +
        '</select></div><div class="form__group"><label class="form__label">Fecha Inicio *</label><input type="date" name="fecha_inicio" class="form__input" required value="' +
        today() +
        '"></div><div class="form__group"><label class="form__label">KM al asignar</label><input type="number" step="0.01" name="km_inicio" class="form__input" value="' +
        (v ? v.km_actual || 0 : 0) +
        '"></div></form></div><div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' +
        SQ +
        "asigForm" +
        SQ +
        ').requestSubmit()">Asignar</button></div>',
    );
  };
  const saveAsignacion = function (e, vId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    fd.vehiculo_id = vId;
    fd.km_inicio = parseFloat(fd.km_inicio || 0);
    addRec("asignaciones", fd);
    closeModal();
    App.render();
  };
  const finalizarAsignacion = function (aId, vId) {
    var v = getData("vehiculos").find(function (x) {
      return x.id === vId;
    });
    var km = prompt("Kilometraje al finalizar:", v ? v.km_actual : "");
    if (km !== null) {
      updateRec("asignaciones", aId, {
        fecha_fin: today(),
        km_fin: parseFloat(km || 0),
      });
      App.render();
    }
  };
  const handleTipoGastoChange = function(val) {
      const container = document.getElementById('vehFieldsCombustible');
      const reqs = document.querySelectorAll('.combustible-req');
      if(val === 'Combustible') {
          container.style.display = 'grid';
          reqs.forEach(el => el.setAttribute('required', 'true'));
      } else {
          container.style.display = 'none';
          reqs.forEach(el => {
              el.removeAttribute('required');
              el.value = '';
          });
      }
  };

  const handleMetodoPagoChange = function(val) {
      const container = document.getElementById('vehFieldsPagoDynamic');
      const divTarjeta = document.getElementById('vehFieldTarjeta');
      const divTransferencia = document.getElementById('vehFieldTransferencia');
      const divCredito = document.getElementById('vehFieldCredito');

      document.querySelectorAll('.pago-req-tar, .pago-req-tra, .pago-req-cre').forEach(e => {
          e.removeAttribute('required');
          e.value = '';
      });

      container.style.display = 'flex';
      divTarjeta.style.display = 'none';
      divTransferencia.style.display = 'none';
      divCredito.style.display = 'none';

      if (val === 'Tarjeta') {
          divTarjeta.style.display = 'flex';
          document.querySelector('.pago-req-tar').setAttribute('required', 'true');
      } else if (val === 'Transferencia') {
          divTransferencia.style.display = 'flex';
          document.querySelector('.pago-req-tra').setAttribute('required', 'true');
      } else if (val === 'Crédito') {
          divCredito.style.display = 'flex';
          document.querySelector('.pago-req-cre').setAttribute('required', 'true');
      } else {
          container.style.display = 'none';
      }
  };

  const openFacturaForm = function (vId) {
    let proveedoresServicios = [];
    if (typeof DataService !== 'undefined' && DataService.getProveedoresSync) {
        proveedoresServicios = DataService.getProveedoresSync().filter(p => !p.inactivo);
    } else {
        try { proveedoresServicios = JSON.parse(localStorage.getItem('sys_proveedores')||'[]'); } catch(e){}
    }
    
    
    // Show all providers (any provider can be a service provider for vehicles)
    // No need to filter by type - let user choose any registered provider

    let optsProveedores = '<option value="">Seleccione proveedor...</option>';
    proveedoresServicios.forEach(p => {
        const provName = p.razonSocial || p.razon_social || p.nombre || p.proveedor || 'Sin Nombre';
        optsProveedores += '<option value="' + provName + '">' + provName + '</option>';
    });

    const getTarjetas = () => { try { return JSON.parse(localStorage.getItem('pos_tarjetas')||'[]'); } catch(e){return [];} };
    let optsTarjetas = '<option value="">Seleccione tarjeta...</option>';
    getTarjetas().forEach(t => {
        optsTarjetas += '<option value="' + t.nombre + '">' + t.nombre + '</option>';
    });

    const getTransferencias = () => {
        try {
            // Try empresa-specific key first, then global key
            const empSuffix = (typeof State !== 'undefined' && State.getCurrentUser && State.getCurrentUser()?.empresa_id) ? '_' + State.getCurrentUser().empresa_id : '';
            let trans = JSON.parse(localStorage.getItem('pos_transferencias' + empSuffix) || '[]');
            if (trans.length === 0) trans = JSON.parse(localStorage.getItem('pos_transferencias') || '[]');
            return trans;
        } catch(e) { return []; }
    };
    let optsBancos = '<option value="">Seleccione cuenta...</option>';
    getTransferencias().forEach(t => {
        const label = (t.banco || t.nombre || '') + ' - ' + (t.numeroCuenta || t.numero_cuenta || '') + ' - ' + (t.divisa || 'NIO');
        optsBancos += '<option value="' + label + '">' + label + '</option>';
    });

    var v = getData("vehiculos").find(function (x) {
      return x.id === vId;
    });
    const kmActual = v ? (v.km_actual || 0) : 0;

    showModal(
      '<div class="modal__header"><h3 class="modal__title">Nueva Factura</h3><button class="modal__close" onclick="GestionVehiculosModule.closeModal()">✕</button></div>' +
      '<div class="modal__body">' +
      '<form id="factForm" class="form__grid" onsubmit="GestionVehiculosModule.saveFactura(event,' + SQ + vId + SQ + ')">' +
      '<div class="form__group"><label class="form__label">Número Factura</label><input name="numero" class="form__input"></div>' +
      '<div class="form__group"><label class="form__label">Fecha *</label><input type="date" name="fecha" class="form__input" required value="' + today() + '"></div>' +
      '<div class="form__group"><label class="form__label">Tipo *</label>' +
      '<select name="tipo_gasto" class="form__input" required onchange="GestionVehiculosModule.handleTipoGastoChange(this.value)">' +
      '<option value="Mantenimiento">Mantenimiento</option><option value="Combustible">Combustible</option><option value="Repuestos">Repuestos</option><option value="Reparaciones">Reparaciones</option><option value="Otros">Otros</option>' +
      '</select></div>' +
      '<div class="form__group"><label class="form__label">Proveedor</label>' +
      '<div style="display:flex;gap:4px;"><select name="proveedor" class="form__input" style="flex:1;">' + optsProveedores + '</select>' +
      '<button type="button" class="btn btn--secondary btn--sm" onclick="GestionVehiculosModule.closeModal(); setTimeout(()=>GestionVehiculosModule.openNewProveedorForm(), 300)" title="Nuevo Proveedor">+</button></div></div>' +
      '<div class="form__group"><label class="form__label">Detalle</label><input name="detalle" class="form__input"></div>' +
      '<div class="form__group"><label class="form__label">Monto Total *</label><input type="number" step="0.01" name="monto" class="form__input" required></div>' +
      
      '<div id="vehFieldsCombustible" style="display:none; grid-column:1/-1; background:#f8fafc; padding:12px; border-radius:8px; gap:12px; grid-template-columns:1fr 1fr; margin-top:8px;">' +
      '<div class="form__group"><label class="form__label">Galones *</label><input type="number" step="0.01" name="cantidad" class="form__input combustible-req"></div>' +
      '<div class="form__group"><label class="form__label">Precio/Galón *</label><input type="number" step="0.01" name="precio_unidad" class="form__input combustible-req"></div>' +
      '<div class="form__group"><label class="form__label">KM Antes</label><input type="number" step="0.01" name="km_antes" class="form__input" readonly value="' + kmActual + '" style="background:#e2e8f0;cursor:not-allowed;"></div>' +
      '<div class="form__group"><label class="form__label">KM Actual *</label><input type="number" step="0.01" name="km_despues" class="form__input combustible-req"></div>' +
      '</div>' +

      '<div class="form__group" style="grid-column:1/-1; margin-top:8px;">' +
      '<label class="form__label">Método Pago *</label>' +
      '<select name="metodo_pago" class="form__input" required onchange="GestionVehiculosModule.handleMetodoPagoChange(this.value)">' +
      '<option value="Efectivo">Efectivo</option><option value="Tarjeta">Tarjeta</option><option value="Transferencia">Transferencia</option><option value="Crédito">Crédito</option>' +
      '</select></div>' +

      '<div id="vehFieldsPagoDynamic" style="grid-column:1/-1; display:none; flex-direction:column; gap:8px;">' +
      '<div class="form__group" id="vehFieldTarjeta" style="display:none;"><label class="form__label">Tipo de Tarjeta *</label><select name="tarjeta_id" class="form__input pago-req-tar">' + optsTarjetas + '</select></div>' +
      '<div class="form__group" id="vehFieldTransferencia" style="display:none;"><label class="form__label">Cuenta Bancaria *</label><select name="banco_id" class="form__input pago-req-tra">' + optsBancos + '</select></div>' +
      '<div class="form__group" id="vehFieldCredito" style="display:none;"><label class="form__label">Fecha de Vencimiento de Crédito *</label><input type="date" name="fecha_vencimiento" class="form__input pago-req-cre"></div>' +
      '</div>' +

      '</form></div>' +
      '<div class="modal__footer"><button class="btn btn--secondary" onclick="GestionVehiculosModule.closeModal()">Cancelar</button><button class="btn btn--primary" onclick="document.getElementById(' + SQ + 'factForm' + SQ + ').requestSubmit()">Guardar</button></div>'
    );
  };

  const saveFactura = function (e, vId) {
    e.preventDefault();
    var fd = Object.fromEntries(new FormData(e.target));
    fd.vehiculo_id = vId;
    fd.monto = parseFloat(fd.monto || 0);

    if (fd.tipo_gasto === 'Combustible') {
        fd.cantidad = parseFloat(fd.cantidad || 0);
        fd.precio_unidad = parseFloat(fd.precio_unidad || 0);
        fd.km_antes = parseFloat(fd.km_antes || 0);
        fd.km_despues = parseFloat(fd.km_despues || 0);
        updateRec("vehiculos", vId, { km_actual: fd.km_despues });
    }

    addRec("facturas", fd);
    closeModal();
    App.render();
  };
  const renderDetailGastos = function (v, gs) {
    var html =
      '<button class="btn btn--primary btn--sm" style="margin-bottom:12px" onclick="GestionVehiculosModule.openGastoForm(' +
      SQ +
      v.id +
      SQ +
      ')">+ Añadir Gasto</button>';
    if (gs.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin gastos</div>'
      );
    html +=
      '<table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Proveedor</th><th style="text-align:right">Monto</th><th></th></tr></thead><tbody>';
    gs.forEach(function (g) {
      html +=
        "<tr><td>" +
        fmtD(g.fecha) +
        '</td><td><span class="veh-badge" style="background:#f0f9ff;color:#0369a1">' +
        g.tipo +
        "</span></td><td>" +
        (g.descripcion || "-") +
        "</td><td>" +
        (g.proveedor || "-") +
        '</td><td style="text-align:right;font-weight:700;color:#ef4444">C$' +
        fmt(g.monto) +
        '</td><td><button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.deleteGasto(' +
        SQ +
        g.id +
        SQ +
        ')">🗑️</button></td></tr>';
    });
    html += "</tbody></table>";
    return html;
  };
  const renderDetailCombustible = function (v, cs) {
    var html =
      '<button class="btn btn--primary btn--sm" style="margin-bottom:12px" onclick="GestionVehiculosModule.openCombustibleForm(' +
      SQ +
      v.id +
      SQ +
      ')">+ Registrar Carga</button>';
    if (cs.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin registros</div>'
      );
    html +=
      '<table class="data-table"><thead><tr><th>Fecha</th><th>Galones</th><th>Precio/U</th><th>Total</th><th>KM Antes</th><th>KM Después</th><th>Rendimiento</th><th></th></tr></thead><tbody>';
    cs.forEach(function (c) {
      var diff = parseFloat(c.km_despues || 0) - parseFloat(c.km_antes || 0);
      var rend =
        parseFloat(c.cantidad || 0) > 0
          ? (diff / parseFloat(c.cantidad)).toFixed(1)
          : "--";
      html +=
        "<tr><td>" +
        fmtD(c.fecha) +
        "</td><td>" +
        c.cantidad +
        "</td><td>C$" +
        fmt(c.precio_unidad) +
        '</td><td style="font-weight:700;color:#f59e0b">C$' +
        fmt(c.total) +
        "</td><td>" +
        fmt(c.km_antes) +
        "</td><td>" +
        fmt(c.km_despues) +
        "</td><td>" +
        rend +
        ' km/gal</td><td><button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.deleteCombustible(' +
        SQ +
        c.id +
        SQ +
        ')">🗑️</button></td></tr>';
    });
    html += "</tbody></table>";
    return html;
  };
  const renderDetailConductores = function (v, as) {
    var conds = getData("conductores");
    var html =
      '<button class="btn btn--primary btn--sm" style="margin-bottom:12px" onclick="GestionVehiculosModule.openAsignacionForm(' +
      SQ + v.id + SQ +
      ')">+ Asignar Conductor</button>';
    // Filters
    html += '<div class="veh-toolbar" style="margin-bottom:12px;">' +
      '<input placeholder="🔍 Buscar conductor..." value="' + condFiltroNombre + '" oninput="GestionVehiculosModule.setCondFiltro(' + SQ + 'nombre' + SQ + ',this.value)" style="min-width:180px;">' +
      '<select onchange="GestionVehiculosModule.setCondFiltro(' + SQ + 'estado' + SQ + ',this.value)">' +
      '<option value="all"' + (condFiltroEstado==='all'?' selected':'') + '>Todos</option>' +
      '<option value="activo"' + (condFiltroEstado==='activo'?' selected':'') + '>Activos</option>' +
      '<option value="finalizado"' + (condFiltroEstado==='finalizado'?' selected':'') + '>Finalizados</option></select>' +
      '<button class="btn btn--ghost btn--sm" onclick="GestionVehiculosModule.printReport(' + SQ + 'conductores' + SQ + ')" title="Imprimir reporte">🖨️ Reporte</button>' +
      '</div>';
    var filtered = as.filter(function(a) {
      var c = conds.find(function(x) { return x.id === a.conductor_id; });
      var nameMatch = !condFiltroNombre || (c && c.nombre.toLowerCase().includes(condFiltroNombre.toLowerCase()));
      var estadoMatch = condFiltroEstado === 'all' || (condFiltroEstado === 'activo' && !a.fecha_fin) || (condFiltroEstado === 'finalizado' && a.fecha_fin);
      return nameMatch && estadoMatch;
    });
    if (filtered.length === 0)
      return (html + '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin asignaciones con este filtro</div>');
    // Stats
    var activos = filtered.filter(function(a) { return !a.fecha_fin; }).length;
    var totalKm = filtered.reduce(function(s,a) { return s + (a.km_fin ? (a.km_fin - (a.km_inicio||0)) : 0); }, 0);
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
      '<div class="veh-card" style="flex:1;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Asignaciones</div><div style="font-size:1.3rem;font-weight:800;">' + filtered.length + '</div></div>' +
      '<div class="veh-card" style="flex:1;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Activos</div><div style="font-size:1.3rem;font-weight:800;color:#16a34a;">' + activos + '</div></div>' +
      '<div class="veh-card" style="flex:1;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">KM Recorridos</div><div style="font-size:1.3rem;font-weight:800;color:#3b82f6;">' + fmt(totalKm) + '</div></div>' +
      '</div>';
    html += '<table class="data-table"><thead><tr><th>Conductor</th><th>Teléfono</th><th>Inicio</th><th>Fin</th><th>KM Inicio</th><th>KM Fin</th><th>KM Recorrido</th><th>Estado</th><th></th></tr></thead><tbody>';
    filtered.forEach(function (a) {
      var c = conds.find(function (x) { return x.id === a.conductor_id; });
      var kmRec = a.km_fin ? (a.km_fin - (a.km_inicio||0)) : 0;
      html += "<tr><td><strong>" + (c ? c.nombre : "?") + "</strong></td><td>" + (c ? c.telefono || '-' : '-') + "</td><td>" +
        fmtD(a.fecha_inicio) + "</td><td>" +
        (a.fecha_fin ? fmtD(a.fecha_fin) : '<span class="veh-badge" style="background:#dcfce7;color:#16a34a">Activo</span>') +
        "</td><td>" + fmt(a.km_inicio) + "</td><td>" + (a.km_fin ? fmt(a.km_fin) : "-") +
        "</td><td style=\"font-weight:600;\">" + (kmRec > 0 ? fmt(kmRec) : '-') + "</td><td>" +
        (a.fecha_fin ? "Finalizado" : "En uso") + "</td><td>" +
        (!a.fecha_fin ? '<button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.finalizarAsignacion(' + SQ + a.id + SQ + "," + SQ + v.id + SQ + ')">Finalizar</button>' : "") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  };

  const renderDetailFacturas = function (v, fs) {
    // Get unique providers and types for filters
    var tiposUnicos = [...new Set(fs.map(function(f) { return f.tipo_gasto || f.tipo || ''; }).filter(Boolean))];
    var provsUnicos = [...new Set(fs.map(function(f) { return f.proveedor || ''; }).filter(Boolean))];

    var html = '<button class="btn btn--primary btn--sm" style="margin-bottom:12px" onclick="GestionVehiculosModule.openFacturaForm(' +
      SQ + v.id + SQ + ')">+ Nueva Factura</button>';

    // Filters toolbar
    html += '<div class="veh-toolbar" style="margin-bottom:12px;flex-wrap:wrap;">' +
      '<select onchange="GestionVehiculosModule.setFactFiltro(' + SQ + 'tipo' + SQ + ',this.value)" style="min-width:130px;">' +
      '<option value="all"' + (factFiltroTipo==='all'?' selected':'') + '>Todos los tipos</option>' +
      tiposUnicos.map(function(t) { return '<option value="' + t + '"' + (factFiltroTipo===t?' selected':'') + '>' + t + '</option>'; }).join('') +
      '</select>' +
      '<select onchange="GestionVehiculosModule.setFactFiltro(' + SQ + 'prov' + SQ + ',this.value)" style="min-width:140px;">' +
      '<option value="all"' + (factFiltroProv==='all'?' selected':'') + '>Todos proveedores</option>' +
      provsUnicos.map(function(p) { return '<option value="' + p + '"' + (factFiltroProv===p?' selected':'') + '>' + p + '</option>'; }).join('') +
      '</select>' +
      '<select onchange="GestionVehiculosModule.setFactFiltro(' + SQ + 'mes' + SQ + ',this.value)" style="min-width:120px;">' +
      '<option value="all"' + (factFiltroMes==='all'?' selected':'') + '>Cualquier mes</option>' +
      '<option value="01"' + (factFiltroMes==='01'?' selected':'') + '>Enero</option><option value="02"' + (factFiltroMes==='02'?' selected':'') + '>Febrero</option><option value="03"' + (factFiltroMes==='03'?' selected':'') + '>Marzo</option>' +
      '<option value="04"' + (factFiltroMes==='04'?' selected':'') + '>Abril</option><option value="05"' + (factFiltroMes==='05'?' selected':'') + '>Mayo</option><option value="06"' + (factFiltroMes==='06'?' selected':'') + '>Junio</option>' +
      '<option value="07"' + (factFiltroMes==='07'?' selected':'') + '>Julio</option><option value="08"' + (factFiltroMes==='08'?' selected':'') + '>Agosto</option><option value="09"' + (factFiltroMes==='09'?' selected':'') + '>Septiembre</option>' +
      '<option value="10"' + (factFiltroMes==='10'?' selected':'') + '>Octubre</option><option value="11"' + (factFiltroMes==='11'?' selected':'') + '>Noviembre</option><option value="12"' + (factFiltroMes==='12'?' selected':'') + '>Diciembre</option>' +
      '</select>' +
      '<input type="date" value="' + factFiltroDesde + '" onchange="GestionVehiculosModule.setFactFiltro(' + SQ + 'desde' + SQ + ',this.value)" title="Desde" style="min-width:130px;">' +
      '<input type="date" value="' + factFiltroHasta + '" onchange="GestionVehiculosModule.setFactFiltro(' + SQ + 'hasta' + SQ + ',this.value)" title="Hasta" style="min-width:130px;">' +
      '<button class="btn btn--ghost btn--sm" onclick="GestionVehiculosModule.resetFactFiltros()">🔄 Limpiar</button>' +
      '<button class="btn btn--ghost btn--sm" onclick="GestionVehiculosModule.printReport(' + SQ + 'facturas' + SQ + ')" title="Imprimir reporte">🖨️ Reporte</button>' +
      '</div>';

    // Apply filters
    var filtered = fs.filter(function(f) {
      if (factFiltroTipo !== 'all' && (f.tipo_gasto || f.tipo || '') !== factFiltroTipo) return false;
      if (factFiltroProv !== 'all' && (f.proveedor || '') !== factFiltroProv) return false;
      if (factFiltroMes !== 'all') {
        var parts = (f.fecha || '').split('-');
        if (parts.length >= 2 && parts[1] !== factFiltroMes) return false;
      }
      if (factFiltroDesde && (f.fecha || '') < factFiltroDesde) return false;
      if (factFiltroHasta && (f.fecha || '') > factFiltroHasta) return false;
      return true;
    });

    // Summary stats
    var totalMonto = filtered.reduce(function(s, f) { return s + parseFloat(f.monto || f.total || 0); }, 0);
    var byTipo = {};
    filtered.forEach(function(f) { var t = f.tipo_gasto || f.tipo || 'Otros'; byTipo[t] = (byTipo[t]||0) + parseFloat(f.monto || f.total || 0); });
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">' +
      '<div class="veh-card" style="flex:1;min-width:120px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Facturas</div><div style="font-size:1.3rem;font-weight:800;">' + filtered.length + '</div></div>' +
      '<div class="veh-card" style="flex:1;min-width:120px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total</div><div style="font-size:1.3rem;font-weight:800;color:#ef4444;">C$' + fmt(totalMonto) + '</div></div>';
    Object.entries(byTipo).forEach(function(e) {
      html += '<div class="veh-card" style="flex:1;min-width:120px;padding:12px;text-align:center;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">' + e[0] + '</div><div style="font-size:1.1rem;font-weight:700;color:#0369a1;">C$' + fmt(e[1]) + '</div></div>';
    });
    html += '</div>';

    if (filtered.length === 0)
      return (html + '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin facturas con este filtro</div>');
    html +=
      '<table class="data-table"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Proveedor</th><th>Detalle</th><th style="text-align:right">Monto</th><th>Pago</th><th></th></tr></thead><tbody>';
    filtered.forEach(function (f) {
      html += "<tr><td>" + (f.numero || "-") + "</td><td>" + fmtD(f.fecha) + "</td><td>" +
        '<span class="veh-badge" style="background:#f0f9ff;color:#0369a1">' + (f.tipo_gasto || "-") + '</span>' +
        "</td><td>" + (f.proveedor || "-") +
        "</td><td style=\"font-size:12px;color:var(--text-muted);\">" + (f.detalle || "-") +
        '</td><td style="text-align:right;font-weight:700">C$' + fmt(f.monto) +
        "</td><td>" + (f.metodo_pago || "-") +
        '</td><td><button class="btn btn--ghost btn--xs" onclick="GestionVehiculosModule.deleteFactura(' + SQ + f.id + SQ + ')">🗑️</button></td></tr>';
    });
    html += "</tbody></table>";
    return html;
  };

  const renderTimeline = function (v) {
    // Timeline filters
    var html = '<div class="veh-toolbar" style="margin-bottom:12px;">' +
      '<select onchange="GestionVehiculosModule.setHistFiltro(' + SQ + 'tipo' + SQ + ',this.value)">' +
      '<option value="all"' + (histFiltroTipo==='all'?' selected':'') + '>Todos los eventos</option>' +
      '<option value="factura"' + (histFiltroTipo==='factura'?' selected':'') + '>🧾 Facturas</option>' +
      '<option value="combustible"' + (histFiltroTipo==='combustible'?' selected':'') + '>⛽ Combustible</option>' +
      '<option value="gasto"' + (histFiltroTipo==='gasto'?' selected':'') + '>💸 Gastos</option>' +
      '<option value="asignacion"' + (histFiltroTipo==='asignacion'?' selected':'') + '>👤 Asignaciones</option>' +
      '</select>' +
      '<input type="date" value="' + histFiltroDesde + '" onchange="GestionVehiculosModule.setHistFiltro(' + SQ + 'desde' + SQ + ',this.value)" title="Desde">' +
      '<input type="date" value="' + histFiltroHasta + '" onchange="GestionVehiculosModule.setHistFiltro(' + SQ + 'hasta' + SQ + ',this.value)" title="Hasta">' +
      '<button class="btn btn--ghost btn--sm" onclick="GestionVehiculosModule.printReport(' + SQ + 'historial' + SQ + ')">🖨️ Reporte</button>' +
      '</div>';

    var all = [];
    getData("gastos").filter(function (g) { return g.vehiculo_id === v.id; }).forEach(function (g) {
      all.push({ tipo: "gasto", fecha: g.fecha, text: "💸 " + g.tipo + ": C$" + fmt(g.monto), desc: g.descripcion || "", monto: parseFloat(g.monto||0) });
    });
    getData("combustible").filter(function (c) { return c.vehiculo_id === v.id; }).forEach(function (c) {
      all.push({ tipo: "combustible", fecha: c.fecha, text: "⛽ " + c.cantidad + " gal - C$" + fmt(c.total), desc: "", monto: parseFloat(c.total||0) });
    });
    getData("asignaciones").filter(function (a) { return a.vehiculo_id === v.id; }).forEach(function (a) {
      var c = getData("conductores").find(function(x) { return x.id === a.conductor_id; });
      all.push({ tipo: "asignacion", fecha: a.fecha_inicio, text: "👤 " + (c ? c.nombre : "Conductor") + " asignado", desc: a.fecha_fin ? "Finalizado: " + fmtD(a.fecha_fin) : "Activo", monto: 0 });
    });
    getData("facturas").filter(function (f) { return f.vehiculo_id === v.id; }).forEach(function (f) {
      all.push({ tipo: "factura", fecha: f.fecha, text: "🧾 " + (f.tipo_gasto||'Factura') + " #" + (f.numero || "?") + " - C$" + fmt(f.monto), desc: (f.proveedor ? "Prov: " + f.proveedor : "") + (f.detalle ? " | " + f.detalle : ""), monto: parseFloat(f.monto||0) });
    });

    // Apply filters
    all = all.filter(function(x) {
      if (histFiltroTipo !== 'all' && x.tipo !== histFiltroTipo) return false;
      if (histFiltroDesde && (x.fecha || '') < histFiltroDesde) return false;
      if (histFiltroHasta && (x.fecha || '') > histFiltroHasta) return false;
      return true;
    });

    all.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });

    // Stats
    var totalHist = all.reduce(function(s,x) { return s + x.monto; }, 0);
    html += '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
      '<div class="veh-card" style="flex:1;padding:10px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Eventos</div><div style="font-size:1.2rem;font-weight:800;">' + all.length + '</div></div>' +
      '<div class="veh-card" style="flex:1;padding:10px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total</div><div style="font-size:1.2rem;font-weight:800;color:#ef4444;">C$' + fmt(totalHist) + '</div></div>' +
      '</div>';

    if (all.length === 0)
      return html + '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin historial con este filtro</div>';
    html += '<div class="veh-timeline">';
    var colors = { gasto: '#ef4444', combustible: '#f59e0b', asignacion: '#3b82f6', factura: '#06b6d4' };
    all.forEach(function (x) {
      html += '<div class="veh-timeline-item" style="border-left:3px solid ' + (colors[x.tipo]||'#94a3b8') + ';"><div style="display:flex;justify-content:space-between"><strong>' +
        x.text + '</strong><span style="font-size:11px;color:var(--text-muted)">' + fmtD(x.fecha) + "</span></div>" +
        (x.desc ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">' + x.desc + "</div>" : "") +
        "</div>";
    });
    html += "</div>";
    return html;
  };

  // ========== DEPRECIATION TAB ==========
  const renderDepreciacion = function(v) {
    var html = '<div class="veh-card" style="padding:20px;">';
    html += '<h4 style="margin:0 0 16px;">📉 Depreciación del Vehículo: ' + (v.apodo || v.placa) + '</h4>';

    // Depreciation type selector
    html += '<div class="form__grid" style="margin-bottom:16px;">' +
      '<div class="form__group"><label class="form__label">Tipo de Depreciación</label>' +
      '<select class="form__input" onchange="GestionVehiculosModule.setDepTipo(this.value)">' +
      '<option value="lineal"' + (depTipo==='lineal'?' selected':'') + '>Línea Recta (Lineal)</option>' +
      '<option value="doble_saldo"' + (depTipo==='doble_saldo'?' selected':'') + '>Doble Saldo Decreciente</option>' +
      '<option value="suma_anios"' + (depTipo==='suma_anios'?' selected':'') + '>Suma de los Dígitos de los Años</option>' +
      '<option value="unidades_produccion"' + (depTipo==='unidades_produccion'?' selected':'') + '>Unidades de Producción (KM)</option>' +
      '</select></div>' +
      '<div class="form__group"><label class="form__label">Valor de Adquisición (C$) *</label>' +
      '<input type="number" step="0.01" class="form__input" id="depValorAdq" value="' + (depData.valorAdq || v.valor_adquisicion || '') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'valorAdq' + SQ + ',this.value)"></div>' +
      '<div class="form__group"><label class="form__label">Valor Residual (C$)</label>' +
      '<input type="number" step="0.01" class="form__input" id="depValorRes" value="' + (depData.valorRes || v.valor_residual || '0') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'valorRes' + SQ + ',this.value)"></div>' +
      '<div class="form__group"><label class="form__label">Vida Útil (años) *</label>' +
      '<input type="number" class="form__input" id="depVidaUtil" value="' + (depData.vidaUtil || '5') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'vidaUtil' + SQ + ',this.value)"></div>' +
      '<div class="form__group"><label class="form__label">Fecha de Adquisición</label>' +
      '<input type="date" class="form__input" id="depFechaAdq" value="' + (depData.fechaAdq || v.fecha_registro || '') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'fechaAdq' + SQ + ',this.value)"></div>';
    if (depTipo === 'unidades_produccion') {
      html += '<div class="form__group"><label class="form__label">KM de Vida Útil Total</label>' +
        '<input type="number" step="0.01" class="form__input" value="' + (depData.kmVidaUtil || '300000') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'kmVidaUtil' + SQ + ',this.value)"></div>' +
        '<div class="form__group"><label class="form__label">KM Recorridos Actualmente</label>' +
        '<input type="number" step="0.01" class="form__input" value="' + (depData.kmActual || v.km_actual || '0') + '" onchange="GestionVehiculosModule.setDepField(' + SQ + 'kmActual' + SQ + ',this.value)"></div>';
    }
    html += '</div>';

    // Calculate button
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
      '<button class="btn btn--primary" onclick="GestionVehiculosModule.calcularDepreciacion()">📊 Calcular Depreciación</button>' +
      '<button class="btn btn--secondary" onclick="GestionVehiculosModule.printReport(' + SQ + 'depreciacion' + SQ + ')">📄 Generar PDF</button>' +
      '</div>';

    // Generate table if data is provided
    var valorAdq = parseFloat(depData.valorAdq || v.valor_adquisicion || 0);
    var valorRes = parseFloat(depData.valorRes || v.valor_residual || 0);
    var vidaUtil = parseInt(depData.vidaUtil || 5);
    var depreciable = valorAdq - valorRes;

    if (valorAdq > 0 && vidaUtil > 0) {
      html += '<div id="depResultado">';
      // Description
      var desc = {
        lineal: 'Método de Línea Recta: Distribuye el costo de forma uniforme durante la vida útil.',
        doble_saldo: 'Método de Doble Saldo Decreciente: Aplica el doble de la tasa lineal sobre el valor en libros.',
        suma_anios: 'Método de Suma de Dígitos de los Años: Depreciación acelerada basada en fracción decreciente.',
        unidades_produccion: 'Método de Unidades de Producción: Basado en kilómetros recorridos vs. vida útil en KM.'
      };
      html += '<div style="background:#f0f9ff;padding:12px;border-radius:8px;margin-bottom:12px;font-size:13px;color:#0369a1;border:1px solid #bae6fd;">ℹ️ ' + desc[depTipo] + '</div>';

      html += '<table class="data-table"><thead><tr><th>Año</th><th>Valor Inicio</th><th>Depreciación</th><th>Dep. Acumulada</th><th>Valor en Libros</th></tr></thead><tbody>';
      var valorLibro = valorAdq;
      var depAcum = 0;
      var sumaDigitos = (vidaUtil * (vidaUtil + 1)) / 2;
      var tasaLineal = 1 / vidaUtil;

      for (var i = 1; i <= vidaUtil; i++) {
        var depAnual = 0;
        var valorInicio = valorLibro;
        if (depTipo === 'lineal') {
          depAnual = depreciable / vidaUtil;
        } else if (depTipo === 'doble_saldo') {
          depAnual = valorLibro * (tasaLineal * 2);
          if (valorLibro - depAnual < valorRes) depAnual = valorLibro - valorRes;
        } else if (depTipo === 'suma_anios') {
          depAnual = depreciable * ((vidaUtil - i + 1) / sumaDigitos);
        } else if (depTipo === 'unidades_produccion') {
          var kmTotal = parseFloat(depData.kmVidaUtil || 300000);
          var kmAnual = parseFloat(depData.kmActual || v.km_actual || 0) / (vidaUtil > 0 ? i : 1);
          depAnual = (depreciable / kmTotal) * kmAnual;
          if (depAnual > valorLibro - valorRes) depAnual = valorLibro - valorRes;
        }
        if (depAnual < 0) depAnual = 0;
        depAcum += depAnual;
        valorLibro = valorAdq - depAcum;
        if (valorLibro < valorRes) { valorLibro = valorRes; depAnual = valorInicio - valorRes; depAcum = valorAdq - valorRes; }

        var fechaAnio = depData.fechaAdq ? (parseInt(depData.fechaAdq.split('-')[0]) + i) : (new Date().getFullYear() + i);
        html += '<tr><td style="font-weight:700;">' + fechaAnio + ' (Año ' + i + ')</td>' +
          '<td>C$' + fmt(valorInicio) + '</td>' +
          '<td style="color:#ef4444;font-weight:600;">C$' + fmt(depAnual) + '</td>' +
          '<td>C$' + fmt(depAcum) + '</td>' +
          '<td style="font-weight:700;color:#059669;">C$' + fmt(valorLibro) + '</td></tr>';
      }
      html += '</tbody></table>';

      // Summary card
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px;">' +
        '<div class="veh-card" style="padding:14px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Valor Adquisición</div><div style="font-size:1.1rem;font-weight:800;">C$' + fmt(valorAdq) + '</div></div>' +
        '<div class="veh-card" style="padding:14px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Depreciación Total</div><div style="font-size:1.1rem;font-weight:800;color:#ef4444;">C$' + fmt(depAcum) + '</div></div>' +
        '<div class="veh-card" style="padding:14px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Valor Residual</div><div style="font-size:1.1rem;font-weight:800;color:#059669;">C$' + fmt(valorRes) + '</div></div>' +
        '<div class="veh-card" style="padding:14px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Dep. Anual (Lineal)</div><div style="font-size:1.1rem;font-weight:800;color:#f59e0b;">C$' + fmt(depreciable/vidaUtil) + '</div></div>' +
        '</div>';
      html += '</div>';
    } else {
      html += '<div style="padding:2rem;text-align:center;color:var(--text-muted);background:var(--bg-body);border-radius:8px;">Ingrese el valor de adquisición y vida útil para calcular la depreciación</div>';
    }
    html += '</div>';
    return html;
  };


  const renderVehicleDetail = function () {
    var v = getData("vehiculos").find(function (x) {
      return x.id === selectedVehicle;
    });
    if (!v) return renderBackBtn() + "<div>Vehículo no encontrado</div>";
    var gs = getData("gastos").filter(function (g) {
      return g.vehiculo_id === v.id;
    });
    var cs = getData("combustible").filter(function (c) {
      return c.vehiculo_id === v.id;
    });
    var as = getData("asignaciones").filter(function (a) {
      return a.vehiculo_id === v.id;
    });
    var fs = getData("facturas").filter(function (f) {
      return f.vehiculo_id === v.id;
    });
    // Include facturas in totals since new data flows through facturas
    var totalG = gs.reduce(function (s, g) {
      return s + parseFloat(g.monto || 0);
    }, 0) + fs.reduce(function (s, f) {
      return s + parseFloat(f.monto || f.total || f.subtotal || 0);
    }, 0);
    var totalC = cs.reduce(function (s, c) {
      return s + parseFloat(c.total || 0);
    }, 0) + fs.filter(function(f) {
      return f.tipo_gasto === 'Combustible';
    }).reduce(function(s, f) {
      return s + parseFloat(f.monto || f.total || f.subtotal || 0);
    }, 0);
    var stColor =
      v.estado === "Activo" ? "#dcfce7;color:#16a34a" : "#fef2f2;color:#ef4444";
    var html = renderBackBtn("Vehículos");
    html +=
      '<div class="veh-card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><h2 style="margin:0">' +
      (v.apodo || v.placa) +
      ' <span class="veh-badge" style="background:' +
      stColor +
      '">' +
      v.estado +
      '</span></h2><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' +
      (v.marca || "") +
      " " +
      (v.modelo || "") +
      " " +
      (v.anio || "") +
      " &bull; " +
      v.tipo +
      " &bull; " +
      (v.color || "") +
      " &bull; Placa: " +
      v.placa +
      '</div><div style="font-size:13px;margin-top:4px">KM actual: <strong>' +
      fmt(v.km_actual || 0) +
      "</strong> &bull; Registrado: " +
      fmtD(v.fecha_registro) +
      '</div></div><div style="display:flex;gap:6px"><button class="btn btn--secondary btn--sm" onclick="GestionVehiculosModule.openVehicleForm(' +
      SQ +
      v.id +
      SQ +
      ')">✏️ Editar</button><button class="btn btn--sm" style="background:#fef2f2;color:#ef4444;border:1px solid #fca5a5" onclick="GestionVehiculosModule.deleteVehicle(' +
      SQ +
      v.id +
      SQ +
      ')">🗑️</button></div></div>';
    html +=
      '<div class="veh-kpis" style="margin-top:12px"><div class="veh-kpi" style="background:var(--bg-secondary,#f8fafc)"><div class="veh-kpi__label" style="color:var(--text-muted)">Total Gastado</div><div class="veh-kpi__value" style="color:#ef4444">C$' +
      fmt(totalG) +
      '</div></div><div class="veh-kpi" style="background:var(--bg-secondary)"><div class="veh-kpi__label" style="color:var(--text-muted)">Combustible</div><div class="veh-kpi__value" style="color:#f59e0b">C$' +
      fmt(totalC) +
      '</div></div><div class="veh-kpi" style="background:var(--bg-secondary)"><div class="veh-kpi__label" style="color:var(--text-muted)">Costo/KM</div><div class="veh-kpi__value" style="color:#6366f1">C$' +
      (v.km_actual > 0 ? fmt((totalG + totalC) / v.km_actual) : "0.00") +
      '</div></div><div class="veh-kpi" style="background:var(--bg-secondary)"><div class="veh-kpi__label" style="color:var(--text-muted)">Facturas</div><div class="veh-kpi__value" style="color:#06b6d4">' +
      fs.length +
      "</div></div></div></div>";
    var tabActive = function (t) {
      return selectedTab === t ? " active" : "";
    };
    html +=
      '<div class="veh-tabs">' +
      '<button class="veh-tab' + tabActive("facturas") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'facturas' + SQ + ')">🧾 Facturas</button>' +
      '<button class="veh-tab' + tabActive("conductores") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'conductores' + SQ + ')">👤 Conductores</button>' +
      '<button class="veh-tab' + tabActive("historial") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'historial' + SQ + ')">📋 Historial</button>' +
      '<button class="veh-tab' + tabActive("depreciacion") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'depreciacion' + SQ + ')">📉 Depreciación</button>' +
      '</div>';
    if (selectedTab === "conductores") html += renderDetailConductores(v, as);
    else if (selectedTab === "facturas") html += renderDetailFacturas(v, fs);
    else if (selectedTab === "depreciacion") html += renderDepreciacion(v);
    else html += renderTimeline(v);
    return html;
  };
  const renderGastosGlobal = function () {
    var gs = getData("gastos");
    var vs = getData("vehiculos");
    var html = renderBackBtn("Dashboard");
    html +=
      '<div class="veh-toolbar"><select onchange="GestionVehiculosModule.setFilterType(this.value)"><option value="">Todos los tipos</option><option value="Combustible">Combustible</option><option value="Llantas">Llantas</option><option value="Repuestos">Repuestos</option><option value="Mantenimiento">Mantenimiento</option><option value="Reparaciones">Reparaciones</option><option value="Otros">Otros</option></select></div>';
    var filtered = gs
      .filter(function (g) {
        return !filterType || g.tipo === filterType;
      })
      .sort(function (a, b) {
        return new Date(b.fecha) - new Date(a.fecha);
      });
    if (filtered.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin gastos</div>'
      );
    html +=
      '<table class="data-table"><thead><tr><th>Fecha</th><th>Vehículo</th><th>Tipo</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead><tbody>';
    filtered.forEach(function (g) {
      var v = vs.find(function (x) {
        return x.id === g.vehiculo_id;
      });
      html +=
        "<tr><td>" +
        fmtD(g.fecha) +
        "</td><td>" +
        (v ? v.apodo || v.placa : "?") +
        '</td><td><span class="veh-badge" style="background:#f0f9ff;color:#0369a1">' +
        g.tipo +
        "</span></td><td>" +
        (g.descripcion || "-") +
        '</td><td style="text-align:right;font-weight:700;color:#ef4444">C$' +
        fmt(g.monto) +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  };
  const renderCombustibleGlobal = function () {
    var cs = getData("combustible");
    var vs = getData("vehiculos");
    var html = renderBackBtn("Dashboard");
    if (cs.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin registros</div>'
      );
    html +=
      '<table class="data-table"><thead><tr><th>Fecha</th><th>Vehículo</th><th>Galones</th><th>Total</th><th>KM Recorridos</th><th>Rendimiento</th></tr></thead><tbody>';
    cs.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    }).forEach(function (c) {
      var v = vs.find(function (x) {
        return x.id === c.vehiculo_id;
      });
      var diff = parseFloat(c.km_despues || 0) - parseFloat(c.km_antes || 0);
      var rend =
        parseFloat(c.cantidad || 0) > 0
          ? (diff / parseFloat(c.cantidad)).toFixed(1)
          : "--";
      html +=
        "<tr><td>" +
        fmtD(c.fecha) +
        "</td><td>" +
        (v ? v.apodo || v.placa : "?") +
        "</td><td>" +
        c.cantidad +
        '</td><td style="font-weight:700;color:#f59e0b">C$' +
        fmt(c.total) +
        "</td><td>" +
        fmt(diff) +
        " km</td><td>" +
        rend +
        " km/gal</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  };
  const renderFacturasGlobal = function () {
    var fs = getData("facturas");
    var vs = getData("vehiculos");
    var html = renderBackBtn("Dashboard");
    if (fs.length === 0)
      return (
        html +
        '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Sin facturas</div>'
      );
    html +=
      '<table class="data-table"><thead><tr><th>#</th><th>Fecha</th><th>Vehículo</th><th>Tipo</th><th>Proveedor</th><th style="text-align:right">Monto</th><th>Pago</th></tr></thead><tbody>';
    fs.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    }).forEach(function (f) {
      var v = vs.find(function (x) {
        return x.id === f.vehiculo_id;
      });
      html +=
        "<tr><td>" +
        (f.numero || "-") +
        "</td><td>" +
        fmtD(f.fecha) +
        "</td><td>" +
        (v ? v.apodo || v.placa : "?") +
        "</td><td>" +
        (f.tipo_gasto || "-") +
        "</td><td>" +
        (f.proveedor || "-") +
        '</td><td style="text-align:right;font-weight:700">C$' +
        fmt(f.monto) +
        "</td><td>" +
        (f.metodo_pago || "-") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  };

  const renderEstadisticas = function () {
    var vs = getData("vehiculos"),
      gs = getData("gastos"),
      cs = getData("combustible"),
      facts = getData("facturas");
    var html = renderBackBtn("Dashboard");
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="margin:0;">📊 Estadísticas Globales</h3><button class="btn btn--secondary btn--sm" onclick="GestionVehiculosModule.printReport(' + SQ + 'estadisticas' + SQ + ')">📄 Generar Reporte</button></div>';

    // === GLOBAL KPIs ===
    var totalGastos = gs.reduce(function(s,g) { return s + parseFloat(g.monto||0); }, 0);
    var totalComb = cs.reduce(function(s,c) { return s + parseFloat(c.total||0); }, 0);
    var totalFact = facts.reduce(function(s,f) { return s + parseFloat(f.monto||f.total||f.subtotal||0); }, 0);
    var totalCombFact = facts.filter(function(f) { return f.tipo_gasto === 'Combustible'; }).reduce(function(s,f) { return s + parseFloat(f.monto||f.total||0); }, 0);
    var totalInvertido = totalGastos + totalComb + totalFact;
    var totalCombustible = totalComb + totalCombFact;
    var vehiculosActivos = vs.filter(function(v) { return v.estado === 'Activo'; }).length;
    var vehiculosInactivos = vs.length - vehiculosActivos;
    var kmTotalFlota = vs.reduce(function(s,v) { return s + parseFloat(v.km_actual||0); }, 0);
    var promedioXVehiculo = vs.length > 0 ? totalInvertido / vs.length : 0;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total Invertido</div><div style="font-size:1.4rem;font-weight:800;color:#ef4444;">C$' + fmt(totalInvertido) + '</div></div>' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Combustible Total</div><div style="font-size:1.4rem;font-weight:800;color:#f59e0b;">C$' + fmt(totalCombustible) + '</div></div>' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Vehículos Activos</div><div style="font-size:1.4rem;font-weight:800;color:#16a34a;">' + vehiculosActivos + ' / ' + vs.length + '</div></div>' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">KM Flota Total</div><div style="font-size:1.4rem;font-weight:800;color:#6366f1;">' + fmt(kmTotalFlota) + '</div></div>' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Promedio por Vehículo</div><div style="font-size:1.4rem;font-weight:800;color:#0369a1;">C$' + fmt(promedioXVehiculo) + '</div></div>' +
      '<div class="veh-card" style="padding:16px;text-align:center;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total Facturas</div><div style="font-size:1.4rem;font-weight:800;color:#06b6d4;">' + facts.length + '</div></div>' +
      '</div>';

    // === BY TYPE ===
    var byType = {};
    gs.forEach(function (g) { byType[g.tipo] = (byType[g.tipo] || 0) + parseFloat(g.monto || 0); });
    facts.forEach(function (f) { var tipo = f.tipo_gasto || f.tipo || 'Otros'; byType[tipo] = (byType[tipo] || 0) + parseFloat(f.monto || f.total || f.subtotal || 0); });
    var maxType = Math.max.apply(null, Object.values(byType).concat([1]));

    // === BY VEHICLE ===
    var byVeh = {};
    gs.forEach(function (g) { var v = vs.find(function (x) { return x.id === g.vehiculo_id; }); var name = v ? v.apodo || v.placa : "?"; byVeh[name] = (byVeh[name] || 0) + parseFloat(g.monto || 0); });
    cs.forEach(function (c) { var v = vs.find(function (x) { return x.id === c.vehiculo_id; }); var name = v ? v.apodo || v.placa : "?"; byVeh[name] = (byVeh[name] || 0) + parseFloat(c.total || 0); });
    facts.forEach(function (f) { var v = vs.find(function (x) { return x.id === f.vehiculo_id; }); var name = v ? v.apodo || v.placa : "?"; byVeh[name] = (byVeh[name] || 0) + parseFloat(f.monto || f.total || f.subtotal || 0); });
    var maxVeh = Math.max.apply(null, Object.values(byVeh).concat([1]));

    // === MONTHLY TREND ===
    var byMonth = {};
    var allItems = [];
    gs.forEach(function(g) { allItems.push({ fecha: g.fecha, monto: parseFloat(g.monto||0) }); });
    cs.forEach(function(c) { allItems.push({ fecha: c.fecha, monto: parseFloat(c.total||0) }); });
    facts.forEach(function(f) { allItems.push({ fecha: f.fecha, monto: parseFloat(f.monto||f.total||0) }); });
    allItems.forEach(function(item) {
      if (item.fecha) {
        var parts = item.fecha.split('-');
        var key = parts[0] + '-' + parts[1];
        byMonth[key] = (byMonth[key] || 0) + item.monto;
      }
    });
    var monthKeys = Object.keys(byMonth).sort();
    var maxMonth = Math.max.apply(null, Object.values(byMonth).concat([1]));
    var meses = {
      '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
      '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic'
    };

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';

    // Gastos por Tipo card
    html += '<div class="veh-card"><h4 style="margin:0 0 12px">Gastos por Tipo</h4>';
    Object.entries(byType).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (e) {
      html += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>' +
        e[0] + "</span><strong>C$" + fmt(e[1]) +
        '</strong></div><div style="background:var(--border-color);border-radius:4px;overflow:hidden"><div class="veh-chart-bar" style="width:' +
        ((e[1] / maxType) * 100).toFixed(1) + '%;background:#3b82f6"></div></div></div>';
    });
    html += '</div>';

    // Comparación Vehículos card
    html += '<div class="veh-card"><h4 style="margin:0 0 12px">Comparación entre Vehículos</h4>';
    Object.entries(byVeh).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (e) {
      html += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>' +
        e[0] + "</span><strong>C$" + fmt(e[1]) +
        '</strong></div><div style="background:var(--border-color);border-radius:4px;overflow:hidden"><div class="veh-chart-bar" style="width:' +
        ((e[1] / maxVeh) * 100).toFixed(1) + '%;background:#8b5cf6"></div></div></div>';
    });
    html += '</div></div>';

    // Monthly trend
    html += '<div class="veh-card" style="margin-bottom:16px;"><h4 style="margin:0 0 12px">Tendencia Mensual</h4>';
    if (monthKeys.length === 0) {
      html += '<div style="padding:1rem;text-align:center;color:var(--text-muted);">Sin datos</div>';
    } else {
      html += '<div style="display:flex;align-items:flex-end;gap:3px;height:180px;padding-bottom:24px;position:relative;">';
      monthKeys.forEach(function(k) {
        var pct = (byMonth[k] / maxMonth * 100).toFixed(1);
        var parts = k.split('-');
        var label = meses[parts[1]] || parts[1];
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">' +
          '<div style="font-size:9px;font-weight:700;color:#ef4444;margin-bottom:2px;">C$' + fmt(byMonth[k]) + '</div>' +
          '<div style="width:100%;max-width:40px;background:linear-gradient(to top,#3b82f6,#60a5fa);border-radius:4px 4px 0 0;height:' + pct + '%;min-height:4px;"></div>' +
          '<div style="font-size:9px;color:var(--text-muted);margin-top:4px;">' + label + ' ' + parts[0].slice(2) + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Top vehicles table
    html += '<div class="veh-card"><h4 style="margin:0 0 12px">Detalle por Vehículo</h4>';
    html += '<table class="data-table"><thead><tr><th>Vehículo</th><th>Tipo</th><th>Estado</th><th>KM</th><th style="text-align:right">Gastos</th><th style="text-align:right">Combustible</th><th style="text-align:right">Total</th><th style="text-align:right">Costo/KM</th></tr></thead><tbody>';
    vs.forEach(function(v) {
      var gv = gs.filter(function(g) { return g.vehiculo_id === v.id; }).reduce(function(s,g) { return s + parseFloat(g.monto||0); }, 0);
      var cv = cs.filter(function(c) { return c.vehiculo_id === v.id; }).reduce(function(s,c) { return s + parseFloat(c.total||0); }, 0);
      var fv = facts.filter(function(f) { return f.vehiculo_id === v.id; }).reduce(function(s,f) { return s + parseFloat(f.monto||f.total||0); }, 0);
      var cfv = facts.filter(function(f) { return f.vehiculo_id === v.id && f.tipo_gasto === 'Combustible'; }).reduce(function(s,f) { return s + parseFloat(f.monto||f.total||0); }, 0);
      var totalV = gv + cv + fv;
      var combV = cv + cfv;
      var costoKm = v.km_actual > 0 ? totalV / v.km_actual : 0;
      var stColor = v.estado === "Activo" ? "background:#dcfce7;color:#16a34a" : "background:#fef2f2;color:#ef4444";
      html += '<tr><td><strong>' + (v.apodo || v.placa) + '</strong></td><td>' + (v.tipo||'-') + '</td>' +
        '<td><span class="veh-badge" style="' + stColor + '">' + v.estado + '</span></td>' +
        '<td>' + fmt(v.km_actual||0) + '</td>' +
        '<td style="text-align:right;">C$' + fmt(gv + fv - cfv) + '</td>' +
        '<td style="text-align:right;color:#f59e0b;">C$' + fmt(combV) + '</td>' +
        '<td style="text-align:right;font-weight:700;color:#ef4444;">C$' + fmt(totalV) + '</td>' +
        '<td style="text-align:right;color:#6366f1;">C$' + fmt(costoKm) + '</td></tr>';
    });
    html += '</tbody></table></div>';

    return html;
  };

  // ========== HANDLER FUNCTIONS ==========
  const setFactFiltro = function(field, val) {
    if (field === 'tipo') factFiltroTipo = val;
    else if (field === 'prov') factFiltroProv = val;
    else if (field === 'mes') factFiltroMes = val;
    else if (field === 'desde') factFiltroDesde = val;
    else if (field === 'hasta') factFiltroHasta = val;
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const resetFactFiltros = function() {
    factFiltroTipo = 'all'; factFiltroProv = 'all'; factFiltroMes = 'all'; factFiltroDesde = ''; factFiltroHasta = '';
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const setCondFiltro = function(field, val) {
    if (field === 'nombre') condFiltroNombre = val;
    else if (field === 'estado') condFiltroEstado = val;
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const setHistFiltro = function(field, val) {
    if (field === 'tipo') histFiltroTipo = val;
    else if (field === 'desde') histFiltroDesde = val;
    else if (field === 'hasta') histFiltroHasta = val;
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const setDepTipo = function(val) {
    depTipo = val;
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const setDepField = function(field, val) {
    depData[field] = val;
  };
  const calcularDepreciacion = function() {
    if (typeof App !== 'undefined' && App.render) App.render();
  };
  const deleteFactura = function(id) {
    if (!confirm('¿Eliminar esta factura?')) return;
    var arr = getData('facturas').filter(function(f) { return f.id !== id; });
    setData('facturas', arr);
    if (typeof App !== 'undefined' && App.render) App.render();
  };

  // ========== PRINT/REPORT FUNCTION ==========
  const printReport = function(type) {
    var v = selectedVehicle ? getData("vehiculos").find(function(x) { return x.id === selectedVehicle; }) : null;
    var empresa = '';
    try { var u = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null; empresa = u ? u.empresa || u.nombre_empresa || '' : ''; } catch(e) {}
    var title = 'Reporte - Gestión de Vehículos';
    var subtitle = '';
    var content = '';

    if (type === 'facturas' && v) {
      title = 'Reporte de Facturas';
      subtitle = 'Vehículo: ' + (v.apodo || v.placa) + ' | Placa: ' + v.placa;
      var fs = getData("facturas").filter(function(f) { return f.vehiculo_id === v.id; });
      content = '<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="background:#f8fafc;"><th>#</th><th>Fecha</th><th>Tipo</th><th>Proveedor</th><th>Detalle</th><th style="text-align:right">Monto</th><th>Pago</th></tr></thead><tbody>';
      var total = 0;
      fs.forEach(function(f) { total += parseFloat(f.monto||0); content += '<tr><td>' + (f.numero||'-') + '</td><td>' + fmtD(f.fecha) + '</td><td>' + (f.tipo_gasto||'-') + '</td><td>' + (f.proveedor||'-') + '</td><td>' + (f.detalle||'-') + '</td><td style="text-align:right">C$' + fmt(f.monto) + '</td><td>' + (f.metodo_pago||'-') + '</td></tr>'; });
      content += '</tbody><tfoot><tr style="background:#f8fafc;font-weight:bold;"><td colspan="5">TOTAL</td><td style="text-align:right">C$' + fmt(total) + '</td><td></td></tr></tfoot></table>';
    } else if (type === 'conductores' && v) {
      title = 'Reporte de Conductores';
      subtitle = 'Vehículo: ' + (v.apodo || v.placa);
      var as = getData("asignaciones").filter(function(a) { return a.vehiculo_id === v.id; });
      var conds = getData("conductores");
      content = '<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="background:#f8fafc;"><th>Conductor</th><th>Inicio</th><th>Fin</th><th>KM Inicio</th><th>KM Fin</th><th>Estado</th></tr></thead><tbody>';
      as.forEach(function(a) { var c = conds.find(function(x) { return x.id === a.conductor_id; }); content += '<tr><td>' + (c?c.nombre:'?') + '</td><td>' + fmtD(a.fecha_inicio) + '</td><td>' + (a.fecha_fin?fmtD(a.fecha_fin):'Activo') + '</td><td>' + fmt(a.km_inicio) + '</td><td>' + (a.km_fin?fmt(a.km_fin):'-') + '</td><td>' + (a.fecha_fin?'Finalizado':'En uso') + '</td></tr>'; });
      content += '</tbody></table>';
    } else if (type === 'historial' && v) {
      title = 'Reporte de Historial';
      subtitle = 'Vehículo: ' + (v.apodo || v.placa);
      content = '<p>Historial completo de eventos registrados.</p>';
    } else if (type === 'depreciacion' && v) {
      title = 'Reporte de Depreciación';
      subtitle = 'Vehículo: ' + (v.apodo || v.placa);
      var depEl = document.getElementById('depResultado');
      content = depEl ? depEl.innerHTML : '<p>No hay tabla de depreciación calculada. Calcule primero la depreciación.</p>';
    } else if (type === 'estadisticas') {
      title = 'Reporte Estadístico Global';
      subtitle = 'Flota completa: ' + getData("vehiculos").length + ' vehículos';
      var vs = getData("vehiculos"), gs2 = getData("gastos"), cs2 = getData("combustible"), fts2 = getData("facturas");
      var tG = gs2.reduce(function(s,g){return s+parseFloat(g.monto||0);},0) + cs2.reduce(function(s,c){return s+parseFloat(c.total||0);},0) + fts2.reduce(function(s,f){return s+parseFloat(f.monto||f.total||0);},0);
      content = '<h3>Resumen Global</h3><p>Total invertido en flota: <strong>C$' + fmt(tG) + '</strong></p>';
      content += '<table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;">' +
        '<thead><tr style="background:#f8fafc;"><th>Vehículo</th><th>Tipo</th><th>Estado</th><th>KM</th><th style="text-align:right">Total Gastado</th></tr></thead><tbody>';
      vs.forEach(function(vv) {
        var tv = gs2.filter(function(g){return g.vehiculo_id===vv.id;}).reduce(function(s,g){return s+parseFloat(g.monto||0);},0) + cs2.filter(function(c){return c.vehiculo_id===vv.id;}).reduce(function(s,c){return s+parseFloat(c.total||0);},0) + fts2.filter(function(f){return f.vehiculo_id===vv.id;}).reduce(function(s,f){return s+parseFloat(f.monto||f.total||0);},0);
        content += '<tr><td>' + (vv.apodo||vv.placa) + '</td><td>' + (vv.tipo||'-') + '</td><td>' + vv.estado + '</td><td>' + fmt(vv.km_actual||0) + '</td><td style="text-align:right;font-weight:bold;">C$' + fmt(tv) + '</td></tr>';
      });
      content += '</tbody></table>';
    }

    var w = window.open('', '_blank', 'width=900,height=700');
    w.document.write('<!DOCTYPE html><html><head><title>' + title + '</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;} h2{color:#1e40af;} .report-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #3b82f6;padding-bottom:16px;} .meta{font-size:12px;color:#64748b;} table{margin-top:16px;} th{background:#f1f5f9;text-align:left;} td,th{padding:8px 12px;border:1px solid #e2e8f0;} @media print { button{display:none!important;} body{padding:15px;}}</style></head><body>' +
      '<div class="report-header"><div><h2>' + title + '</h2>' + (subtitle ? '<p class="meta">' + subtitle + '</p>' : '') + '</div><div style="text-align:right;"><div style="font-weight:bold;">' + empresa + '</div><div class="meta">Fecha: ' + new Date().toLocaleDateString("es-NI") + '</div></div></div>' +
      content +
      '<br><button onclick="window.print()" style="padding:8px 24px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">🖨️ Imprimir / PDF</button>' +
      '</body></html>');
    w.document.close();
  };

  // ========== NEW PROVIDER FORM INTEGRATION ==========
  const openNewProveedorForm = function() {
    // Open the same provider form as the proveedores module
    if (typeof window.ProductosModule !== 'undefined' && window.ProductosModule.openProveedorForm) {
      window.ProductosModule.openProveedorForm();
    } else {
      // Inline simple provider form
      var html = '<div class="modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)GestionVehiculosModule.closeProveedorModal()">' +
        '<div class="modal__content" style="background:var(--bg-body,#fff);border-radius:12px;padding:24px;max-width:500px;width:95%;max-height:90vh;overflow:auto;">' +
        '<h3 style="margin:0 0 16px;">➕ Nuevo Proveedor</h3>' +
        '<div class="form__grid">' +
        '<div class="form__group"><label class="form__label">Razón Social *</label><input class="form__input" id="npRazonSocial"></div>' +
        '<div class="form__group"><label class="form__label">RUC / Cédula</label><input class="form__input" id="npRuc"></div>' +
        '<div class="form__group"><label class="form__label">Teléfono</label><input class="form__input" id="npTelefono"></div>' +
        '<div class="form__group"><label class="form__label">Email</label><input class="form__input" id="npEmail" type="email"></div>' +
        '<div class="form__group"><label class="form__label">Dirección</label><input class="form__input" id="npDireccion"></div>' +
        '<div class="form__group"><label class="form__label">Tipo Proveedor</label><select class="form__input" id="npTipoProveedor"><option value="Servicios">Servicios</option><option value="Repuestos">Repuestos</option><option value="Combustible">Combustible</option><option value="General">General</option></select></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">' +
        '<button class="btn btn--ghost" onclick="GestionVehiculosModule.closeProveedorModal()">Cancelar</button>' +
        '<button class="btn btn--primary" onclick="GestionVehiculosModule.saveNewProveedor()">💾 Guardar</button>' +
        '</div></div></div>';
      document.getElementById('proveedorVehModal') ? document.getElementById('proveedorVehModal').innerHTML = html :
        (function() { var d = document.createElement('div'); d.id = 'proveedorVehModal'; d.innerHTML = html; document.body.appendChild(d); })();
    }
  };
  const closeProveedorModal = function() {
    var el = document.getElementById('proveedorVehModal');
    if (el) el.remove();
  };
  const saveNewProveedor = function() {
    var razon = document.getElementById('npRazonSocial')?.value?.trim();
    if (!razon) { alert('La razón social es obligatoria'); return; }
    var prov = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      razonSocial: razon,
      ruc: document.getElementById('npRuc')?.value?.trim() || '',
      telefono: document.getElementById('npTelefono')?.value?.trim() || '',
      email: document.getElementById('npEmail')?.value?.trim() || '',
      direccion: document.getElementById('npDireccion')?.value?.trim() || '',
      tipoProveedor: document.getElementById('npTipoProveedor')?.value || 'Servicios',
      tipo_proveedor: document.getElementById('npTipoProveedor')?.value || 'Servicios',
      fechaRegistro: new Date().toISOString().split('T')[0],
      estado: 'Activo'
    };
    try {
      var provs = JSON.parse(localStorage.getItem('sys_proveedores') || '[]');
      provs.push(prov);
      localStorage.setItem('sys_proveedores', JSON.stringify(provs));
      // Also save to Supabase DataService if available
      if (typeof DataService !== 'undefined' && DataService.addProveedor) {
        DataService.addProveedor(prov).catch(function(e) { console.error('Error guardando proveedor en Supabase:', e); });
      }
      alert('✅ Proveedor guardado');
      closeProveedorModal();
      if (typeof App !== 'undefined' && App.render) App.render();
    } catch(e) { alert('Error al guardar: ' + e.message); }
  };

  const render = function () {
    var views = {
      dashboard: renderDashboard,
      vehiculos: renderVehiculos,
      vehiculo_detail: renderVehicleDetail,
      conductores: renderConductores,
      gastos: renderGastosGlobal,
      combustible: renderCombustibleGlobal,
      facturas: renderFacturasGlobal,
      estadisticas: renderEstadisticas,
    };
    return STYLES + (views[currentView] || renderDashboard)();
  };
  return {
    render: render,
    navigateTo: navigateTo,
    closeModal: closeModal,
    openVehicleForm: openVehicleForm,
    saveVehicle: saveVehicle,
    deleteVehicle: deleteVehicle,
    viewVehicle: viewVehicle,
    switchTab: switchTab,
    setSearch: setSearch,
    setFilterType: setFilterType,
    openConductorForm: openConductorForm,
    saveConductor: saveConductor,
    deleteConductor: deleteConductor,
    openAsignacionForm: openAsignacionForm,
    saveAsignacion: saveAsignacion,
    finalizarAsignacion: finalizarAsignacion,
    openFacturaForm: openFacturaForm,
    saveFactura: saveFactura,
    handleTipoGastoChange: handleTipoGastoChange,
    handleMetodoPagoChange: handleMetodoPagoChange,
    getMetrics: getMetrics,
    // New filter handlers
    setFactFiltro: setFactFiltro,
    resetFactFiltros: resetFactFiltros,
    setCondFiltro: setCondFiltro,
    setHistFiltro: setHistFiltro,
    setDepTipo: setDepTipo,
    setDepField: setDepField,
    calcularDepreciacion: calcularDepreciacion,
    deleteFactura: deleteFactura,
    printReport: printReport,
    // Provider form
    openNewProveedorForm: openNewProveedorForm,
    closeProveedorModal: closeProveedorModal,
    saveNewProveedor: saveNewProveedor,
  };
})();
window.GestionVehiculosModule = GestionVehiculosModule;
console.log("✅ Módulo Gestión de Vehículos cargado");
