const fs = require('fs');
const fileJS = 'js/modules/gestion-vehiculos.js';
let content = fs.readFileSync(fileJS, 'utf8');

const tDate = "today()";
const SQ = "SQ";

// Edit 1: change selectedTab default
content = content.replace('selectedTab = "gastos"', 'selectedTab = "facturas"');

// Edit 2: remove from dashboard tiles
content = content.replace(/renderTile\(\s*"gastos"[\s\S]*?getData\("gastos"\)\.length \+ " registros",\s*\)\s*\+/, '');
content = content.replace(/renderTile\(\s*"combustible"[\s\S]*?getData\("combustible"\)\.length \+ " cargas",\s*\)\s*\+/, '');

// Edit 3: change viewVehicle default tab
content = content.replace('selectedTab = "gastos";\n    navigateTo("vehiculo_detail");', 'selectedTab = "facturas";\n    navigateTo("vehiculo_detail");');

// Edit 4: tabs HTML
const tabsRegex = /html \+=\s*'<div class="veh-tabs"><button class="veh-tab' \+[\s\S]*?'\)">📋 Historial<\/button><\/div>';/;
const newTabs = `
    html +=
      '<div class="veh-tabs">' +
      '<button class="veh-tab' + tabActive("facturas") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'facturas' + SQ + ')">🧾 Facturas</button>' +
      '<button class="veh-tab' + tabActive("conductores") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'conductores' + SQ + ')">👤 Conductores</button>' +
      '<button class="veh-tab' + tabActive("historial") + '" onclick="GestionVehiculosModule.switchTab(' + SQ + 'historial' + SQ + ')">📋 Historial</button>' +
      '</div>';
`;
content = content.replace(tabsRegex, newTabs.trim());

// Edit 5: tabs logic
const tabLogicRegex = /if \(selectedTab === "gastos"\) html \+= renderDetailGastos\(v, gs\);[\s\S]*?else html \+= renderTimeline\(v\);/;
const newTabLogic = `
    if (selectedTab === "conductores") html += renderDetailConductores(v, as);
    else if (selectedTab === "facturas") html += renderDetailFacturas(v, fs);
    else html += renderTimeline(v);
`;
content = content.replace(tabLogicRegex, newTabLogic.trim());

// Edit 6: openFacturaForm & saveFactura
const formRegex = /const openFacturaForm = function \(vId\) \{[\s\S]*?const saveFactura = function \(e, vId\) \{[\s\S]*?App\.render\(\);\n  \};/;

const newFormCode = `
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
        proveedoresServicios = DataService.getProveedoresSync().filter(p => p.tipoProveedor === 'Servicios' || p.tipo_proveedor === 'Servicios' || p.tipo_proveedor === 'Servicio' || p.tipoProveedor === 'Servicio');
    } else {
        try {
            proveedoresServicios = (JSON.parse(localStorage.getItem('sys_proveedores')||'[]')).filter(p => p.tipo_proveedor === 'Servicios' || p.tipo_proveedor === 'Servicio');
        } catch(e) {}
    }
    
    let optsProveedores = '<option value="">Seleccione proveedor...</option>';
    proveedoresServicios.forEach(p => {
        optsProveedores += '<option value="' + (p.id||p.nombre) + '">' + p.nombre + '</option>';
    });

    const getBancos = () => { try { return JSON.parse(localStorage.getItem('pos_bancos')||'[]'); } catch(e){return [];} };
    let optsBancos = '<option value="">Seleccione banco...</option>';
    getBancos().forEach(b => {
        optsBancos += '<option value="' + b.nombre + ' - ' + b.numero + '">' + b.nombre + ' - ' + b.numero + '</option>';
    });

    const getTarjetas = () => { try { return JSON.parse(localStorage.getItem('pos_tarjetas')||'[]'); } catch(e){return [];} };
    let optsTarjetas = '<option value="">Seleccione tarjeta...</option>';
    getTarjetas().forEach(t => {
        optsTarjetas += '<option value="' + t.nombre + '">' + t.nombre + '</option>';
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
      '<button type="button" class="btn btn--secondary btn--sm" onclick="GestionVehiculosModule.closeModal(); setTimeout(()=>window.ProductosModule?ProductosModule.openProveedorModal():alert(' + SQ + 'Módulo no disponible' + SQ + '), 300)" title="Nuevo Proveedor">+</button></div></div>' +
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
`;
content = content.replace(formRegex, newFormCode.trim());

// Add exports mapping
content = content.replace('saveFactura: saveFactura,', 'saveFactura: saveFactura,\n    handleTipoGastoChange: handleTipoGastoChange,\n    handleMetodoPagoChange: handleMetodoPagoChange,');

// Delete unused module functions from export
content = content.replace('openGastoForm: openGastoForm,', '');
content = content.replace('saveGasto: saveGasto,', '');
content = content.replace('deleteGasto: deleteGasto,', '');
content = content.replace('openCombustibleForm: openCombustibleForm,', '');
content = content.replace('saveCombustible: saveCombustible,', '');
content = content.replace('deleteCombustible: deleteCombustible,', '');

fs.writeFileSync(fileJS, content, 'utf8');
fs.writeFileSync('modules/gestion-vehiculos.js', content, 'utf8');
console.log("Refactor complete.");
