/**
 * ALLTECH - Contract Editor Module
 * Module to manage contract templates and print contracts
 */

const ContractEditorModule = (() => {

  // Variables disponibles para las plantillas
  const AVAILABLE_VARIABLES = [
    { name: 'empresa_cliente', desc: 'Nombre de la empresa del cliente' },
    { name: 'nombre_cliente', desc: 'Nombre del contacto del cliente' },
    { name: 'direccion_cliente', desc: 'Dirección del cliente' },
    { name: 'fecha_inicio', desc: 'Fecha de inicio del contrato' },
    { name: 'fecha_fin', desc: 'Fecha de fin del contrato' },
    { name: 'tarifa', desc: 'Monto de la tarifa' },
    { name: 'moneda', desc: 'Moneda (USD/NIO)' },
    { name: 'tipo_contrato', desc: 'Tipo (Mensual, Anual, etc.)' },
    { name: 'fecha_actual', desc: 'Fecha actual' }
  ];

  // ==================== TEMPLATES LIST ====================

  const renderTemplatesList = () => {
    const templates = DataService.getContractTemplates();

    return `
      <div class="modal-overlay open" onclick="ContractEditorModule.closeModal(event)">
        <div class="modal modal--lg" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${Icons.fileText} Plantillas de Contratos</h3>
            <button class="modal__close" onclick="ContractEditorModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
              <p class="text-sm text-muted">Gestiona los formatos de contrato disponibles para imprimir.</p>
              <button class="btn btn--primary" onclick="ContractEditorModule.openEditor()">
                ${Icons.plus} Nueva Plantilla
              </button>
            </div>

            <div class="card">
              <div class="card__body" style="padding: 0;">
                <table class="table" style="width: 100%;">
                  <thead>
                    <tr style="background: var(--bg-tertiary);">
                      <th style="padding: var(--spacing-md);">Nombre de Plantilla</th>
                      <th style="padding: var(--spacing-md);">ID</th>
                      <th style="padding: var(--spacing-md);">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${templates.length > 0 ? templates.map(t => `
                      <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: var(--spacing-md); font-weight: 500;">${t.name}</td>
                        <td style="padding: var(--spacing-md); font-family: monospace;">${t.id}</td>
                        <td style="padding: var(--spacing-md);">
                          <button class="btn btn--ghost btn--icon btn--sm" 
                                  onclick="ContractEditorModule.openEditor('${t.id}')" title="Editar">
                            ${Icons.edit}
                          </button>
                          <button class="btn btn--ghost btn--icon btn--sm text-danger" 
                                  onclick="ContractEditorModule.deleteTemplate('${t.id}')" title="Eliminar">
                            ${Icons.trash}
                          </button>
                        </td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-muted);">
                          No hay plantillas creadas.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ==================== EDITOR ====================

  const renderEditor = (templateId = null) => {
    const template = templateId ? DataService.getContractTemplateById(templateId) : null;
    const isEdit = !!template;

    return `
      <div class="modal-overlay open" onclick="ContractEditorModule.closeModal(event)">
        <div class="modal modal--xl" onclick="event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">${isEdit ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
            <button class="modal__close" onclick="ContractEditorModule.closeModal()">${Icons.x}</button>
          </div>
          <form class="modal__body" onsubmit="ContractEditorModule.handleSave(event)">
            <input type="hidden" name="id" value="${template?.id || ''}">
            
            <div class="form-group">
              <label class="form-label form-label--required">Nombre de la Plantilla</label>
              <input type="text" name="name" class="form-input" value="${template?.name || ''}" required placeholder="Ej: Contrato de Servicio Mensual">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 250px; gap: var(--spacing-md); height: 500px;">
              
              <!-- Editor Area -->
              <div class="form-group" style="display: flex; flex-direction: column;">
                <label class="form-label form-label--required">Contenido del Contrato</label>
                <textarea name="content" class="form-input" 
                          style="flex: 1; font-family: monospace; line-height: 1.5; resize: none;" 
                          required 
                          placeholder="Escribe aquí el contenido del contrato...">${template?.content || ''}</textarea>
              </div>

              <!-- Sidebar Variables -->
              <div class="card" style="display: flex; flex-direction: column; background: var(--bg-tertiary);">
                <div class="card__header" style="padding: var(--spacing-sm) var(--spacing-md);">
                  <h5 class="card__title text-sm">Variables Disponibles</h5>
                </div>
                <div class="card__body" style="padding: var(--spacing-sm); overflow-y: auto;">
                  <p class="text-xs text-muted" style="margin-bottom: var(--spacing-sm);">
                    Haz clic para copiar la variable al portapapeles.
                  </p>
                  <div style="display: flex; flex-direction: column; gap: var(--spacing-xs);">
                    ${AVAILABLE_VARIABLES.map(v => `
                      <button type="button" class="btn btn--sm btn--ghost" 
                              style="justify-content: flex-start; text-align: left; border: 1px solid var(--border-color); background: var(--bg-primary);"
                              onclick="navigator.clipboard.writeText('{{${v.name}}}');">
                        <div>
                          <code style="font-weight: bold; color: var(--color-primary);">{{${v.name}}}</code>
                          <div class="text-xs text-muted">${v.desc}</div>
                        </div>
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>

            </div>

            <div class="modal__footer">
              <button type="button" class="btn btn--secondary" onclick="ContractEditorModule.openTemplatesList()">Volver a Lista</button>
              <button type="submit" class="btn btn--primary">${Icons.save} Guardar Plantilla</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  // ==================== LOGIC ====================

  const openTemplatesList = () => {
    document.getElementById('contratoModal').innerHTML = renderTemplatesList();
  };

  const openEditor = (id = null) => {
    document.getElementById('contratoModal').innerHTML = renderEditor(id);
  };

  const handleSave = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const id = formData.get('id') || 'TPL_' + Date.now();

    const template = {
      id: id,
      name: formData.get('name'),
      content: formData.get('content')
    };

    DataService.saveContractTemplate(template);
    openTemplatesList();
  };

  const deleteTemplate = (id) => {
    if (confirm('¿Estás seguro de eliminar esta plantilla?')) {
      DataService.deleteContractTemplate(id);
      openTemplatesList();
    }
  };

  const closeModal = (event) => {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('contratoModal').innerHTML = '';
  };

  // ==================== PRINT LOGIC ====================

  const printContract = (contratoId, templateId) => {
    const contrato = DataService.getContratoById(contratoId);
    if (!contrato) return alert('Contrato no encontrado');

    const template = DataService.getContractTemplateById(templateId);
    if (!template) return alert('Plantilla no encontrada');

    const cliente = DataService.getClienteById(contrato.clienteId);

    // Replace variables
    let content = template.content;
    const vars = {
      'empresa_cliente': cliente?.empresa || 'N/A',
      'nombre_cliente': cliente?.nombreCliente || 'N/A',
      'direccion_cliente': cliente?.direccion || 'N/A',
      'fecha_inicio': new Date(contrato.fechaInicio).toLocaleDateString('es-NI'),
      'fecha_fin': new Date(contrato.fechaFin).toLocaleDateString('es-NI'),
      'tarifa': contrato.tarifa.toFixed(2),
      'moneda': contrato.moneda,
      'tipo_contrato': contrato.tipoContrato,
      'fecha_actual': new Date().toLocaleDateString('es-NI')
    };

    Object.keys(vars).forEach(key => {
      // Usar replaceAll o regex global
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
    });

    // Generate HTML for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Contrato</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: black; }
            h1, h2, h3 { text-align: center; }
            p { margin-bottom: 1em; text-align: justify; }
            .signature-box { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-line { border-top: 1px solid #000; width: 40%; padding-top: 10px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div style="white-space: pre-wrap;">${content}</div>
          <script>
            window.onload = () => { setTimeout(() => window.print(), 500); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const selectTemplateToPrint = (contratoId) => {
    const templates = DataService.getContractTemplates();

    // Si no hay plantillas, mostrar error
    if (templates.length === 0) {
      alert('No hay plantillas de contrato creadas. Por favor crea una primero en "Gestión de Plantillas".');
      return;
    }

    // Si solo hay una plantilla, imprimir directamente (opcional, pero mejor dejar elegir)

    const optionsHtml = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    document.getElementById('contratoModal').innerHTML = `
      <div class="modal-overlay open" onclick="ContractEditorModule.closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()" style="width: 400px; max-width: 90%;">
          <div class="modal__header">
            <h3 class="modal__title">Imprimir Contrato</h3>
            <button class="modal__close" onclick="ContractEditorModule.closeModal()">${Icons.x}</button>
          </div>
          <div class="modal__body">
            <div class="form-group">
              <label class="form-label">Selecciona la plantilla a usar:</label>
              <select id="templateSelect" class="form-select">
                ${optionsHtml}
              </select>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="ContractEditorModule.closeModal()">Cancelar</button>
            <button class="btn btn--primary" onclick="ContractEditorModule.confirmPrint('${contratoId}')">
              ${Icons.printer} Imprimir
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const confirmPrint = (contratoId) => {
    const templateId = document.getElementById('templateSelect').value;
    printContract(contratoId, templateId);
    closeModal();
  };

  return {
    openTemplatesList,
    openEditor,
    handleSave,
    deleteTemplate,
    closeModal,
    selectTemplateToPrint,
    confirmPrint
  };
})();
