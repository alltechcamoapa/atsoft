/**
 * ALLTECH - Report Editor Module
 * Visual report designer similar to Crystal Reports
 * Allows creating, editing, and saving report templates for each module
 */

const ReportEditorModule = (() => {
    // ========== STORAGE KEY ==========
    const REPORT_TEMPLATES_KEY = 'alltech_report_templates';

    // ========== AVAILABLE FIELDS PER MODULE ==========
    const moduleFields = {
        contratos: {
            label: 'Contratos',
            fields: [
                { id: 'contratoId', label: 'ID Contrato', type: 'text' },
                { id: 'clienteNombre', label: 'Nombre Cliente', type: 'text' },
                { id: 'clienteEmpresa', label: 'Empresa', type: 'text' },
                { id: 'clienteTelefono', label: 'Teléfono', type: 'text' },
                { id: 'clienteCorreo', label: 'Correo', type: 'text' },
                { id: 'clienteDireccion', label: 'Dirección', type: 'text' },
                { id: 'fechaInicio', label: 'Fecha Inicio', type: 'date' },
                { id: 'fechaFin', label: 'Fecha Fin', type: 'date' },
                { id: 'tarifa', label: 'Tarifa', type: 'currency' },
                { id: 'moneda', label: 'Moneda', type: 'text' },
                { id: 'tipoContrato', label: 'Tipo Contrato', type: 'text' },
                { id: 'estadoContrato', label: 'Estado', type: 'text' },
                { id: 'fechaActual', label: 'Fecha Actual', type: 'date' },
                { id: 'horaActual', label: 'Hora Actual', type: 'time' }
            ]
        },
        visitas: {
            label: 'Visitas',
            fields: [
                { id: 'visitaId', label: 'ID Visita', type: 'text' },
                { id: 'clienteNombre', label: 'Nombre Cliente', type: 'text' },
                { id: 'clienteEmpresa', label: 'Empresa', type: 'text' },
                { id: 'tipoVisita', label: 'Tipo Visita', type: 'text' },
                { id: 'fechaInicio', label: 'Fecha Inicio', type: 'datetime' },
                { id: 'fechaFin', label: 'Fecha Fin', type: 'datetime' },
                { id: 'descripcionTrabajo', label: 'Descripción', type: 'text' },
                { id: 'trabajoRealizado', label: 'Completado', type: 'boolean' },
                { id: 'costoServicio', label: 'Costo', type: 'currency' },
                { id: 'moneda', label: 'Moneda', type: 'text' },
                { id: 'usuarioSoporte', label: 'Técnico', type: 'text' },
                { id: 'fechaActual', label: 'Fecha Actual', type: 'date' }
            ]
        },
        equipos: {
            label: 'Equipos',
            fields: [
                { id: 'equipoId', label: 'ID Equipo', type: 'text' },
                { id: 'clienteNombre', label: 'Nombre Cliente', type: 'text' },
                { id: 'clienteEmpresa', label: 'Empresa', type: 'text' },
                { id: 'nombreEquipo', label: 'Nombre Equipo', type: 'text' },
                { id: 'marca', label: 'Marca', type: 'text' },
                { id: 'modelo', label: 'Modelo', type: 'text' },
                { id: 'serie', label: 'N° Serie', type: 'text' },
                { id: 'ubicacion', label: 'Ubicación', type: 'text' },
                { id: 'estado', label: 'Estado', type: 'text' },
                { id: 'fechaActual', label: 'Fecha Actual', type: 'date' }
            ]
        },
        proformas: {
            label: 'Proformas',
            fields: [
                { id: 'proformaId', label: 'ID Proforma', type: 'text' },
                { id: 'numero', label: 'Número', type: 'number' },
                { id: 'clienteNombre', label: 'Nombre Cliente', type: 'text' },
                { id: 'clienteEmpresa', label: 'Empresa', type: 'text' },
                { id: 'clienteTelefono', label: 'Teléfono', type: 'text' },
                { id: 'clienteCorreo', label: 'Correo', type: 'text' },
                { id: 'fecha', label: 'Fecha', type: 'date' },
                { id: 'validezDias', label: 'Días Validez', type: 'number' },
                { id: 'estado', label: 'Estado', type: 'text' },
                { id: 'subtotal', label: 'Subtotal', type: 'currency' },
                { id: 'iva', label: 'IVA', type: 'currency' },
                { id: 'total', label: 'Total', type: 'currency' },
                { id: 'moneda', label: 'Moneda', type: 'text' },
                { id: 'notas', label: 'Notas', type: 'text' },
                { id: 'creadoPor', label: 'Creado Por', type: 'text' },
                { id: 'fechaActual', label: 'Fecha Actual', type: 'date' }
            ]
        }
    };

    // ========== DEFAULT REPORT TEMPLATES ==========
    const getDefaultTemplates = () => ({
        contratos: {
            id: 'rpt_contratos_default',
            name: 'Reporte de Contrato Estándar',
            module: 'contratos',
            pageSize: 'letter',
            orientation: 'portrait',
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            sections: {
                header: {
                    height: 120,
                    backgroundColor: '#1a73e8',
                    elements: [
                        { id: 'el1', type: 'image', x: 20, y: 15, width: 80, height: 80, src: 'logo', styles: { borderRadius: '8px' } },
                        { id: 'el2', type: 'text', x: 120, y: 25, content: 'ALLTECH', styles: { fontSize: '28px', fontWeight: 'bold', color: '#ffffff' } },
                        { id: 'el3', type: 'text', x: 120, y: 60, content: 'Reporte de Contrato', styles: { fontSize: '16px', color: '#ffffff' } },
                        { id: 'el4', type: 'field', x: 400, y: 25, fieldId: 'contratoId', styles: { fontSize: '14px', color: '#ffffff', fontWeight: 'bold' } },
                        { id: 'el5', type: 'field', x: 400, y: 50, fieldId: 'fechaActual', styles: { fontSize: '12px', color: '#e0e0e0' } }
                    ]
                },
                detail: {
                    height: 400,
                    backgroundColor: '#ffffff',
                    elements: [
                        { id: 'el6', type: 'text', x: 20, y: 20, content: 'Información del Cliente', styles: { fontSize: '16px', fontWeight: 'bold', color: '#1a73e8' } },
                        { id: 'el7', type: 'label', x: 20, y: 50, content: 'Empresa:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el8', type: 'field', x: 120, y: 50, fieldId: 'clienteEmpresa', styles: { fontSize: '12px', fontWeight: '500' } },
                        { id: 'el9', type: 'label', x: 20, y: 75, content: 'Contacto:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el10', type: 'field', x: 120, y: 75, fieldId: 'clienteNombre', styles: { fontSize: '12px' } },
                        { id: 'el11', type: 'label', x: 20, y: 100, content: 'Teléfono:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el12', type: 'field', x: 120, y: 100, fieldId: 'clienteTelefono', styles: { fontSize: '12px' } },
                        { id: 'el13', type: 'label', x: 300, y: 100, content: 'Correo:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el14', type: 'field', x: 360, y: 100, fieldId: 'clienteCorreo', styles: { fontSize: '12px' } },
                        { id: 'el15', type: 'line', x: 20, y: 130, width: 540, height: 1, styles: { backgroundColor: '#e0e0e0' } },
                        { id: 'el16', type: 'text', x: 20, y: 150, content: 'Detalles del Contrato', styles: { fontSize: '16px', fontWeight: 'bold', color: '#1a73e8' } },
                        { id: 'el17', type: 'label', x: 20, y: 180, content: 'Tipo:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el18', type: 'field', x: 120, y: 180, fieldId: 'tipoContrato', styles: { fontSize: '12px', fontWeight: '500' } },
                        { id: 'el19', type: 'label', x: 20, y: 205, content: 'Vigencia:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el20', type: 'field', x: 120, y: 205, fieldId: 'fechaInicio', styles: { fontSize: '12px' } },
                        { id: 'el21', type: 'text', x: 220, y: 205, content: 'al', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el22', type: 'field', x: 250, y: 205, fieldId: 'fechaFin', styles: { fontSize: '12px' } },
                        { id: 'el23', type: 'label', x: 20, y: 230, content: 'Tarifa:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el24', type: 'field', x: 120, y: 230, fieldId: 'moneda', styles: { fontSize: '14px', fontWeight: 'bold' } },
                        { id: 'el25', type: 'field', x: 160, y: 230, fieldId: 'tarifa', styles: { fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' } },
                        { id: 'el26', type: 'label', x: 20, y: 260, content: 'Estado:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el27', type: 'field', x: 120, y: 260, fieldId: 'estadoContrato', styles: { fontSize: '12px', fontWeight: '500' } }
                    ]
                },
                footer: {
                    height: 60,
                    backgroundColor: '#f5f5f5',
                    elements: [
                        { id: 'el28', type: 'text', x: 20, y: 20, content: 'ALLTECH - Sistema de Gestión Empresarial | Camoapa, Nicaragua', styles: { fontSize: '10px', color: '#666' } },
                        { id: 'el29', type: 'text', x: 450, y: 20, content: 'Página 1 de 1', styles: { fontSize: '10px', color: '#666' } }
                    ]
                }
            }
        },
        visitas: {
            id: 'rpt_visitas_default',
            name: 'Reporte de Visita Técnica',
            module: 'visitas',
            pageSize: 'letter',
            orientation: 'portrait',
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            sections: {
                header: {
                    height: 100,
                    backgroundColor: '#1a73e8',
                    elements: [
                        { id: 'el1', type: 'image', x: 20, y: 10, width: 80, height: 80, src: 'logo', styles: {} },
                        { id: 'el2', type: 'text', x: 120, y: 25, content: 'REPORTE DE VISITA TÉCNICA', styles: { fontSize: '22px', fontWeight: 'bold', color: '#ffffff' } },
                        { id: 'el3', type: 'field', x: 120, y: 55, fieldId: 'visitaId', styles: { fontSize: '14px', color: '#e0e0e0' } }
                    ]
                },
                detail: {
                    height: 350,
                    backgroundColor: '#ffffff',
                    elements: [
                        { id: 'el4', type: 'text', x: 20, y: 20, content: 'Datos del Servicio', styles: { fontSize: '16px', fontWeight: 'bold', color: '#1a73e8' } },
                        { id: 'el5', type: 'label', x: 20, y: 50, content: 'Cliente:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el6', type: 'field', x: 100, y: 50, fieldId: 'clienteEmpresa', styles: { fontSize: '14px', fontWeight: '500' } },
                        { id: 'el7', type: 'label', x: 20, y: 80, content: 'Tipo:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el8', type: 'field', x: 100, y: 80, fieldId: 'tipoVisita', styles: { fontSize: '12px' } },
                        { id: 'el9', type: 'label', x: 20, y: 110, content: 'Técnico:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el10', type: 'field', x: 100, y: 110, fieldId: 'usuarioSoporte', styles: { fontSize: '12px' } },
                        { id: 'el11', type: 'label', x: 20, y: 150, content: 'Trabajo Realizado:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el12', type: 'field', x: 20, y: 175, fieldId: 'descripcionTrabajo', styles: { fontSize: '12px', width: '520px' } }
                    ]
                },
                footer: {
                    height: 50,
                    backgroundColor: '#f5f5f5',
                    elements: [
                        { id: 'el13', type: 'text', x: 20, y: 15, content: 'ALLTECH - Camoapa, Nicaragua', styles: { fontSize: '10px', color: '#666' } }
                    ]
                }
            }
        },
        equipos: {
            id: 'rpt_equipos_default',
            name: 'Ficha Técnica de Equipo',
            module: 'equipos',
            pageSize: 'letter',
            orientation: 'portrait',
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            sections: {
                header: {
                    height: 100,
                    backgroundColor: '#2e7d32',
                    elements: [
                        { id: 'el1', type: 'image', x: 20, y: 10, width: 80, height: 80, src: 'logo', styles: {} },
                        { id: 'el2', type: 'text', x: 120, y: 30, content: 'FICHA TÉCNICA DE EQUIPO', styles: { fontSize: '22px', fontWeight: 'bold', color: '#ffffff' } }
                    ]
                },
                detail: {
                    height: 300,
                    backgroundColor: '#ffffff',
                    elements: [
                        { id: 'el3', type: 'label', x: 20, y: 20, content: 'Equipo:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el4', type: 'field', x: 100, y: 20, fieldId: 'nombreEquipo', styles: { fontSize: '16px', fontWeight: 'bold' } },
                        { id: 'el5', type: 'label', x: 20, y: 50, content: 'Marca:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el6', type: 'field', x: 100, y: 50, fieldId: 'marca', styles: { fontSize: '14px' } },
                        { id: 'el7', type: 'label', x: 250, y: 50, content: 'Modelo:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el8', type: 'field', x: 310, y: 50, fieldId: 'modelo', styles: { fontSize: '14px' } },
                        { id: 'el9', type: 'label', x: 20, y: 80, content: 'Serie:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el10', type: 'field', x: 100, y: 80, fieldId: 'serie', styles: { fontSize: '14px', fontFamily: 'monospace' } }
                    ]
                },
                footer: {
                    height: 50,
                    backgroundColor: '#f5f5f5',
                    elements: [
                        { id: 'el11', type: 'text', x: 20, y: 15, content: 'ALLTECH - Sistema de Gestión Empresarial | Camoapa, Nicaragua', styles: { fontSize: '10px', color: '#666' } }
                    ]
                }
            }
        },
        proformas: {
            id: 'rpt_proformas_default',
            name: 'Proforma Comercial',
            module: 'proformas',
            pageSize: 'letter',
            orientation: 'portrait',
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            sections: {
                header: {
                    height: 120,
                    backgroundColor: '#1565c0',
                    elements: [
                        { id: 'el1', type: 'image', x: 20, y: 20, width: 80, height: 80, src: 'logo', styles: {} },
                        { id: 'el2', type: 'text', x: 120, y: 30, content: 'PROFORMA', styles: { fontSize: '32px', fontWeight: 'bold', color: '#ffffff' } },
                        { id: 'el3', type: 'text', x: 120, y: 70, content: 'N°', styles: { fontSize: '16px', color: '#bbdefb' } },
                        { id: 'el4', type: 'field', x: 145, y: 70, fieldId: 'numero', styles: { fontSize: '16px', fontWeight: 'bold', color: '#ffffff' } },
                        { id: 'el5', type: 'field', x: 450, y: 30, fieldId: 'fecha', styles: { fontSize: '14px', color: '#ffffff' } }
                    ]
                },
                detail: {
                    height: 380,
                    backgroundColor: '#ffffff',
                    elements: [
                        { id: 'el6', type: 'text', x: 20, y: 20, content: 'Cliente', styles: { fontSize: '14px', fontWeight: 'bold', color: '#1565c0' } },
                        { id: 'el7', type: 'field', x: 20, y: 45, fieldId: 'clienteEmpresa', styles: { fontSize: '16px', fontWeight: '500' } },
                        { id: 'el8', type: 'field', x: 20, y: 70, fieldId: 'clienteNombre', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el9', type: 'line', x: 20, y: 100, width: 540, height: 2, styles: { backgroundColor: '#1565c0' } },
                        { id: 'el10', type: 'text', x: 20, y: 280, content: 'Notas:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el11', type: 'field', x: 20, y: 300, fieldId: 'notas', styles: { fontSize: '11px', fontStyle: 'italic' } },
                        { id: 'el12', type: 'label', x: 400, y: 200, content: 'Subtotal:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el13', type: 'field', x: 480, y: 200, fieldId: 'subtotal', styles: { fontSize: '12px' } },
                        { id: 'el14', type: 'label', x: 400, y: 225, content: 'IVA:', styles: { fontSize: '12px', color: '#666' } },
                        { id: 'el15', type: 'field', x: 480, y: 225, fieldId: 'iva', styles: { fontSize: '12px' } },
                        { id: 'el16', type: 'line', x: 400, y: 250, width: 160, height: 1, styles: { backgroundColor: '#333' } },
                        { id: 'el17', type: 'label', x: 400, y: 260, content: 'TOTAL:', styles: { fontSize: '14px', fontWeight: 'bold' } },
                        { id: 'el18', type: 'field', x: 450, y: 260, fieldId: 'moneda', styles: { fontSize: '14px', fontWeight: 'bold' } },
                        { id: 'el19', type: 'field', x: 480, y: 260, fieldId: 'total', styles: { fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' } }
                    ]
                },
                footer: {
                    height: 60,
                    backgroundColor: '#f5f5f5',
                    elements: [
                        { id: 'el20', type: 'text', x: 20, y: 15, content: 'ALLTECH - Sistema de Gestión Empresarial', styles: { fontSize: '10px', color: '#666' } },
                        { id: 'el21', type: 'text', x: 20, y: 30, content: 'Camoapa, Nicaragua | www.alltech.com.ni', styles: { fontSize: '9px', color: '#999' } },
                        { id: 'el22', type: 'field', x: 450, y: 20, fieldId: 'creadoPor', styles: { fontSize: '9px', color: '#666' } }
                    ]
                }
            }
        }
    });

    // ========== STATE ==========
    let currentTemplate = null;
    let selectedElement = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let templates = {};

    // ========== STORAGE ==========
    const loadTemplates = () => {
        try {
            const stored = localStorage.getItem(REPORT_TEMPLATES_KEY);
            if (stored) {
                templates = JSON.parse(stored);
            } else {
                templates = getDefaultTemplates();
                saveTemplates();
            }
        } catch (e) {
            console.error('Error loading report templates:', e);
            templates = getDefaultTemplates();
        }
        return templates;
    };

    const saveTemplates = () => {
        try {
            localStorage.setItem(REPORT_TEMPLATES_KEY, JSON.stringify(templates));
            console.log('✅ Plantillas de reportes guardadas');
        } catch (e) {
            console.error('Error saving report templates:', e);
        }
    };

    const getTemplateForModule = (moduleId) => {
        return templates[moduleId] || null;
    };

    const saveTemplateForModule = (moduleId, template) => {
        templates[moduleId] = template;
        saveTemplates();
    };

    // ========== RENDER MAIN VIEW ==========
    const render = () => {
        loadTemplates();
        const modulesList = Object.keys(moduleFields);

        return `
            <div class="report-editor">
                <div class="report-editor__header">
                    <h2 class="report-editor__title">${Icons.fileText} Editor de Reportes</h2>
                    <p class="report-editor__subtitle">Diseña y personaliza los reportes de cada módulo</p>
                </div>

                <div class="report-editor__content">
                    <!-- Module Selection -->
                    <div class="report-editor__modules">
                        <h3 class="report-editor__section-title">Seleccionar Módulo</h3>
                        <div class="report-editor__module-grid">
                            ${modulesList.map(moduleId => `
                                <button class="report-editor__module-btn" data-module="${moduleId}">
                                    <span class="report-editor__module-icon">${getModuleIcon(moduleId)}</span>
                                    <span class="report-editor__module-name">${moduleFields[moduleId].label}</span>
                                    <span class="report-editor__module-status ${templates[moduleId] ? 'has-template' : ''}">
                                        ${templates[moduleId] ? '✓ Personalizado' : 'Por defecto'}
                                    </span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Editor Workspace (hidden initially) -->
                    <div class="report-editor__workspace" id="reportEditorWorkspace" style="display: none;">
                        <!-- Will be populated when a module is selected -->
                    </div>
                </div>
            </div>
        `;
    };

    const getModuleIcon = (moduleId) => {
        const icons = {
            contratos: Icons.fileText,
            visitas: Icons.wrench,
            equipos: Icons.monitor,
            proformas: Icons.fileText
        };
        return icons[moduleId] || Icons.file;
    };

    // ========== RENDER EDITOR WORKSPACE ==========
    const renderEditorWorkspace = (moduleId) => {
        currentTemplate = templates[moduleId] ?
            JSON.parse(JSON.stringify(templates[moduleId])) :
            JSON.parse(JSON.stringify(getDefaultTemplates()[moduleId]));

        if (!currentTemplate) {
            return '<p class="text-muted">No hay plantilla disponible para este módulo.</p>';
        }

        const fields = moduleFields[moduleId]?.fields || [];

        return `
            <div class="report-editor__toolbar">
                <div class="report-editor__toolbar-left">
                    <button class="btn btn--secondary btn--sm" onclick="ReportEditorModule.backToModules()">
                        ${Icons.arrowLeft} Volver
                    </button>
                    <h3 class="report-editor__template-name">${currentTemplate.name}</h3>
                </div>
                <div class="report-editor__toolbar-right">
                    <button class="btn btn--secondary btn--sm" onclick="ReportEditorModule.previewReport()">
                        ${Icons.eye} Vista Previa
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="ReportEditorModule.resetToDefault('${moduleId}')">
                        ${Icons.refresh} Restablecer
                    </button>
                    <button class="btn btn--primary btn--sm" onclick="ReportEditorModule.saveCurrentTemplate('${moduleId}')">
                        ${Icons.save} Guardar Plantilla
                    </button>
                </div>
            </div>

            <div class="report-editor__main">
                <!-- Left Panel - Fields & Elements -->
                <div class="report-editor__panel report-editor__panel--left">
                    <div class="report-editor__panel-section">
                        <h4 class="report-editor__panel-title">Campos Disponibles</h4>
                        <div class="report-editor__fields-list" id="fieldsList">
                            ${fields.map(field => `
                                <div class="report-editor__field-item" 
                                     draggable="true" 
                                     data-field-id="${field.id}"
                                     data-field-type="${field.type}">
                                    <span class="report-editor__field-icon">${getFieldTypeIcon(field.type)}</span>
                                    <span class="report-editor__field-label">${field.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="report-editor__panel-section">
                        <h4 class="report-editor__panel-title">Elementos</h4>
                        <div class="report-editor__elements-list">
                            <div class="report-editor__element-item" draggable="true" data-element-type="text">
                                ${Icons.edit} Texto
                            </div>
                            <div class="report-editor__element-item" draggable="true" data-element-type="label">
                                ${Icons.info} Etiqueta
                            </div>
                            <div class="report-editor__element-item" draggable="true" data-element-type="line">
                                ─ Línea
                            </div>
                            <div class="report-editor__element-item" draggable="true" data-element-type="box">
                                ☐ Caja
                            </div>
                            <div class="report-editor__element-item" draggable="true" data-element-type="image">
                                ${Icons.image} Imagen
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Center - Canvas -->
                <div class="report-editor__canvas-container">
                    <div class="report-editor__canvas" id="reportCanvas">
                        ${renderReportCanvas()}
                    </div>
                </div>

                <!-- Right Panel - Properties -->
                <div class="report-editor__panel report-editor__panel--right">
                    <h4 class="report-editor__panel-title">Propiedades</h4>
                    <div id="elementProperties">
                        <p class="text-muted text-sm">Selecciona un elemento para ver sus propiedades</p>
                    </div>
                </div>
            </div>
        `;
    };

    const getFieldTypeIcon = (type) => {
        const icons = {
            text: '📝',
            date: '📅',
            datetime: '📆',
            time: '🕐',
            currency: '💰',
            number: '#',
            boolean: '✓'
        };
        return icons[type] || '📄';
    };

    // ========== RENDER REPORT CANVAS ==========
    const renderReportCanvas = () => {
        if (!currentTemplate) return '';

        const sections = currentTemplate.sections;

        return `
            <!-- Header Section -->
            <div class="report-section report-section--header" 
                 data-section="header"
                 style="height: ${sections.header.height}px; background-color: ${sections.header.backgroundColor};">
                <div class="report-section__label">ENCABEZADO</div>
                ${renderSectionElements(sections.header.elements)}
                <div class="report-section__resize" data-section="header"></div>
            </div>

            <!-- Detail Section -->
            <div class="report-section report-section--detail" 
                 data-section="detail"
                 style="height: ${sections.detail.height}px; background-color: ${sections.detail.backgroundColor};">
                <div class="report-section__label">DETALLE</div>
                ${renderSectionElements(sections.detail.elements)}
                <div class="report-section__resize" data-section="detail"></div>
            </div>

            <!-- Footer Section -->
            <div class="report-section report-section--footer" 
                 data-section="footer"
                 style="height: ${sections.footer.height}px; background-color: ${sections.footer.backgroundColor};">
                <div class="report-section__label">PIE DE PÁGINA</div>
                ${renderSectionElements(sections.footer.elements)}
            </div>
        `;
    };

    const renderSectionElements = (elements) => {
        return elements.map(el => {
            const styleStr = Object.entries(el.styles || {})
                .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
                .join('; ');

            let content = '';
            let elementClass = 'report-element';

            switch (el.type) {
                case 'text':
                case 'label':
                    content = el.content || '';
                    break;
                case 'field':
                    content = `{{${el.fieldId}}}`;
                    elementClass += ' report-element--field';
                    break;
                case 'image':
                    if (el.src === 'logo') {
                        content = `<img src="assets/logo.png" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    } else {
                        content = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #ddd;">📷</div>`;
                    }
                    break;
                case 'line':
                    content = '';
                    elementClass += ' report-element--line';
                    break;
                case 'box':
                    content = '';
                    elementClass += ' report-element--box';
                    break;
            }

            return `
                <div class="${elementClass}" 
                     data-element-id="${el.id}"
                     style="left: ${el.x}px; top: ${el.y}px; ${el.width ? `width: ${el.width}px;` : ''} ${el.height ? `height: ${el.height}px;` : ''} ${styleStr}"
                     onclick="ReportEditorModule.selectElement('${el.id}')">
                    ${content}
                </div>
            `;
        }).join('');
    };

    const camelToKebab = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

    // ========== ELEMENT SELECTION & PROPERTIES ==========
    const selectElement = (elementId) => {
        selectedElement = findElement(elementId);

        // Update visual selection
        document.querySelectorAll('.report-element').forEach(el => el.classList.remove('selected'));
        const elDom = document.querySelector(`[data-element-id="${elementId}"]`);
        if (elDom) elDom.classList.add('selected');

        // Render properties panel
        renderPropertiesPanel();
    };

    const findElement = (elementId) => {
        if (!currentTemplate) return null;
        for (const section of ['header', 'detail', 'footer']) {
            const el = currentTemplate.sections[section].elements.find(e => e.id === elementId);
            if (el) return { ...el, section };
        }
        return null;
    };

    const renderPropertiesPanel = () => {
        const container = document.getElementById('elementProperties');
        if (!container || !selectedElement) {
            if (container) container.innerHTML = '<p class="text-muted text-sm">Selecciona un elemento para ver sus propiedades</p>';
            return;
        }

        container.innerHTML = `
            <div class="property-group">
                <label class="property-label">Tipo</label>
                <input type="text" class="property-input" value="${selectedElement.type}" disabled>
            </div>
            
            <div class="property-group">
                <label class="property-label">Posición X</label>
                <input type="number" class="property-input" id="propX" value="${selectedElement.x}" 
                       onchange="ReportEditorModule.updateElementProperty('x', this.value)">
            </div>
            
            <div class="property-group">
                <label class="property-label">Posición Y</label>
                <input type="number" class="property-input" id="propY" value="${selectedElement.y}"
                       onchange="ReportEditorModule.updateElementProperty('y', this.value)">
            </div>
            
            ${selectedElement.width ? `
                <div class="property-group">
                    <label class="property-label">Ancho</label>
                    <input type="number" class="property-input" id="propWidth" value="${selectedElement.width}"
                           onchange="ReportEditorModule.updateElementProperty('width', this.value)">
                </div>
            ` : ''}
            
            ${selectedElement.height ? `
                <div class="property-group">
                    <label class="property-label">Alto</label>
                    <input type="number" class="property-input" id="propHeight" value="${selectedElement.height}"
                           onchange="ReportEditorModule.updateElementProperty('height', this.value)">
                </div>
            ` : ''}
            
            ${selectedElement.content !== undefined ? `
                <div class="property-group">
                    <label class="property-label">Contenido</label>
                    <input type="text" class="property-input" id="propContent" value="${selectedElement.content || ''}"
                           onchange="ReportEditorModule.updateElementProperty('content', this.value)">
                </div>
            ` : ''}
            
            <div class="property-group">
                <label class="property-label">Tamaño Fuente</label>
                <input type="text" class="property-input" id="propFontSize" value="${selectedElement.styles?.fontSize || '12px'}"
                       onchange="ReportEditorModule.updateElementStyle('fontSize', this.value)">
            </div>
            
            <div class="property-group">
                <label class="property-label">Color</label>
                <input type="color" class="property-input" id="propColor" 
                       value="${rgbToHex(selectedElement.styles?.color) || '#000000'}"
                       onchange="ReportEditorModule.updateElementStyle('color', this.value)">
            </div>
            
            <div class="property-group">
                <label class="property-label">Negrita</label>
                <select class="property-input" id="propFontWeight"
                        onchange="ReportEditorModule.updateElementStyle('fontWeight', this.value)">
                    <option value="normal" ${selectedElement.styles?.fontWeight !== 'bold' ? 'selected' : ''}>Normal</option>
                    <option value="bold" ${selectedElement.styles?.fontWeight === 'bold' ? 'selected' : ''}>Negrita</option>
                    <option value="500" ${selectedElement.styles?.fontWeight === '500' ? 'selected' : ''}>Semi-negrita</option>
                </select>
            </div>
            
            <div class="property-actions">
                <button class="btn btn--danger btn--sm" onclick="ReportEditorModule.deleteSelectedElement()">
                    ${Icons.trash} Eliminar
                </button>
            </div>
        `;
    };

    const rgbToHex = (color) => {
        if (!color) return '#000000';
        if (color.startsWith('#')) return color.length === 4 ?
            `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color;
        return '#000000';
    };

    const updateElementProperty = (prop, value) => {
        if (!selectedElement) return;

        const section = currentTemplate.sections[selectedElement.section];
        const element = section.elements.find(e => e.id === selectedElement.id);

        if (element) {
            element[prop] = prop === 'x' || prop === 'y' || prop === 'width' || prop === 'height'
                ? parseInt(value)
                : value;
            selectedElement[prop] = element[prop];
            refreshCanvas();
        }
    };

    const updateElementStyle = (prop, value) => {
        if (!selectedElement) return;

        const section = currentTemplate.sections[selectedElement.section];
        const element = section.elements.find(e => e.id === selectedElement.id);

        if (element) {
            if (!element.styles) element.styles = {};
            element.styles[prop] = value;
            if (!selectedElement.styles) selectedElement.styles = {};
            selectedElement.styles[prop] = value;
            refreshCanvas();
        }
    };

    const deleteSelectedElement = () => {
        if (!selectedElement) return;

        const section = currentTemplate.sections[selectedElement.section];
        section.elements = section.elements.filter(e => e.id !== selectedElement.id);
        selectedElement = null;
        refreshCanvas();
        renderPropertiesPanel();
    };

    const refreshCanvas = () => {
        const canvas = document.getElementById('reportCanvas');
        if (canvas) {
            canvas.innerHTML = renderReportCanvas();
            if (selectedElement) {
                const elDom = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
                if (elDom) elDom.classList.add('selected');
            }
        }
    };

    // ========== MODULE SELECTION ==========
    const openModuleEditor = (moduleId) => {
        const workspace = document.getElementById('reportEditorWorkspace');
        const modulesSection = document.querySelector('.report-editor__modules');

        if (workspace && modulesSection) {
            modulesSection.style.display = 'none';
            workspace.style.display = 'block';
            workspace.innerHTML = renderEditorWorkspace(moduleId);
            initDragAndDrop();
        }
    };

    const backToModules = () => {
        const workspace = document.getElementById('reportEditorWorkspace');
        const modulesSection = document.querySelector('.report-editor__modules');

        if (workspace && modulesSection) {
            workspace.style.display = 'none';
            modulesSection.style.display = 'block';
            currentTemplate = null;
            selectedElement = null;
        }
    };

    // ========== DRAG AND DROP ==========
    const initDragAndDrop = () => {
        // Make canvas sections droppable
        document.querySelectorAll('.report-section').forEach(section => {
            section.addEventListener('dragover', handleDragOver);
            section.addEventListener('drop', handleDrop);
        });

        // Make field items draggable
        document.querySelectorAll('.report-editor__field-item').forEach(item => {
            item.addEventListener('dragstart', handleFieldDragStart);
        });

        // Make element items draggable
        document.querySelectorAll('.report-editor__element-item').forEach(item => {
            item.addEventListener('dragstart', handleElementDragStart);
        });

        // Make existing elements draggable within canvas
        document.querySelectorAll('.report-element').forEach(el => {
            el.addEventListener('mousedown', handleElementMouseDown);
        });

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    let dragData = null;

    const handleFieldDragStart = (e) => {
        dragData = {
            type: 'field',
            fieldId: e.target.dataset.fieldId,
            fieldType: e.target.dataset.fieldType
        };
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleElementDragStart = (e) => {
        dragData = {
            type: 'element',
            elementType: e.target.dataset.elementType
        };
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!dragData || !currentTemplate) return;

        const section = e.target.closest('.report-section');
        if (!section) return;

        const sectionName = section.dataset.section;
        const rect = section.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        const newId = 'el' + Date.now();
        let newElement = null;

        if (dragData.type === 'field') {
            newElement = {
                id: newId,
                type: 'field',
                x,
                y,
                fieldId: dragData.fieldId,
                styles: { fontSize: '12px' }
            };
        } else if (dragData.type === 'element') {
            switch (dragData.elementType) {
                case 'text':
                    newElement = { id: newId, type: 'text', x, y, content: 'Nuevo texto', styles: { fontSize: '12px' } };
                    break;
                case 'label':
                    newElement = { id: newId, type: 'label', x, y, content: 'Etiqueta:', styles: { fontSize: '12px', color: '#666' } };
                    break;
                case 'line':
                    newElement = { id: newId, type: 'line', x, y, width: 200, height: 1, styles: { backgroundColor: '#ccc' } };
                    break;
                case 'box':
                    newElement = { id: newId, type: 'box', x, y, width: 100, height: 50, styles: { border: '1px solid #ccc' } };
                    break;
                case 'image':
                    newElement = { id: newId, type: 'image', x, y, width: 80, height: 80, src: '', styles: {} };
                    break;
            }
        }

        if (newElement) {
            currentTemplate.sections[sectionName].elements.push(newElement);
            refreshCanvas();
            selectElement(newId);
        }

        dragData = null;
    };

    let draggedElement = null;

    const handleElementMouseDown = (e) => {
        if (e.target.classList.contains('report-element') || e.target.closest('.report-element')) {
            const el = e.target.classList.contains('report-element') ? e.target : e.target.closest('.report-element');
            isDragging = true;
            draggedElement = el.dataset.elementId;
            const rect = el.getBoundingClientRect();
            dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            e.preventDefault();
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !draggedElement) return;

        const canvas = document.getElementById('reportCanvas');
        if (!canvas) return;

        const el = document.querySelector(`[data-element-id="${draggedElement}"]`);
        if (!el) return;

        const section = el.closest('.report-section');
        if (!section) return;

        const sectionRect = section.getBoundingClientRect();
        const x = Math.max(0, e.clientX - sectionRect.left - dragOffset.x);
        const y = Math.max(0, e.clientY - sectionRect.top - dragOffset.y);

        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    };

    const handleMouseUp = (e) => {
        if (isDragging && draggedElement) {
            // Update element position in template
            const el = document.querySelector(`[data-element-id="${draggedElement}"]`);
            if (el && currentTemplate) {
                const newX = parseInt(el.style.left);
                const newY = parseInt(el.style.top);

                for (const section of ['header', 'detail', 'footer']) {
                    const element = currentTemplate.sections[section].elements.find(e => e.id === draggedElement);
                    if (element) {
                        element.x = newX;
                        element.y = newY;
                        if (selectedElement && selectedElement.id === draggedElement) {
                            selectedElement.x = newX;
                            selectedElement.y = newY;
                            renderPropertiesPanel();
                        }
                        break;
                    }
                }
            }
        }
        isDragging = false;
        draggedElement = null;
    };

    // ========== SAVE / RESET ==========
    const saveCurrentTemplate = (moduleId) => {
        if (!currentTemplate) return;

        templates[moduleId] = JSON.parse(JSON.stringify(currentTemplate));
        saveTemplates();

        // Show success notification
        App.showNotification('Plantilla guardada exitosamente', 'success');
    };

    const resetToDefault = (moduleId) => {
        if (confirm('¿Estás seguro de restablecer la plantilla a los valores por defecto?')) {
            currentTemplate = JSON.parse(JSON.stringify(getDefaultTemplates()[moduleId]));
            refreshCanvas();
            selectedElement = null;
            renderPropertiesPanel();
            App.showNotification('Plantilla restablecida', 'info');
        }
    };

    // ========== PREVIEW ==========
    const previewReport = () => {
        if (!currentTemplate) return;

        // Generate sample data
        const sampleData = generateSampleData(currentTemplate.module);

        // Create preview HTML
        const previewHtml = generateReportHtml(currentTemplate, sampleData);

        // Open in new window
        const previewWindow = window.open('', '_blank', 'width=800,height=900');
        previewWindow.document.write(previewHtml);
        previewWindow.document.close();
    };

    const generateSampleData = (moduleId) => {
        const now = new Date();
        const baseData = {
            fechaActual: now.toLocaleDateString('es-NI'),
            horaActual: now.toLocaleTimeString('es-NI')
        };

        switch (moduleId) {
            case 'contratos':
                return {
                    ...baseData,
                    contratoId: 'CON001',
                    clienteNombre: 'Carlos Mendoza',
                    clienteEmpresa: 'Tecnología Nica S.A.',
                    clienteTelefono: '+505 8845-7721',
                    clienteCorreo: 'carlos@tecnica.com.ni',
                    clienteDireccion: 'Managua, Carretera Norte km 5',
                    fechaInicio: '15/01/2024',
                    fechaFin: '15/01/2025',
                    tarifa: '150.00',
                    moneda: 'USD',
                    tipoContrato: 'Mensual',
                    estadoContrato: 'Activo'
                };
            case 'visitas':
                return {
                    ...baseData,
                    visitaId: 'VIS001',
                    clienteNombre: 'Carlos Mendoza',
                    clienteEmpresa: 'Tecnología Nica S.A.',
                    tipoVisita: 'Física',
                    fechaInicio: '25/01/2025 09:00',
                    fechaFin: '25/01/2025 12:00',
                    descripcionTrabajo: 'Mantenimiento preventivo de servidores',
                    trabajoRealizado: 'Sí',
                    costoServicio: '0.00',
                    moneda: 'USD',
                    usuarioSoporte: 'Técnico Juan'
                };
            case 'equipos':
                return {
                    ...baseData,
                    equipoId: 'EQU001',
                    clienteNombre: 'Carlos Mendoza',
                    clienteEmpresa: 'Tecnología Nica S.A.',
                    nombreEquipo: 'Servidor Principal',
                    marca: 'Dell',
                    modelo: 'PowerEdge R740',
                    serie: 'SRV-2024-001',
                    ubicacion: 'Data Center',
                    estado: 'Operativo'
                };
            case 'proformas':
                return {
                    ...baseData,
                    proformaId: 'PRO001',
                    numero: '1',
                    clienteNombre: 'Carlos Mendoza',
                    clienteEmpresa: 'Tecnología Nica S.A.',
                    clienteTelefono: '+505 8845-7721',
                    clienteCorreo: 'carlos@tecnica.com.ni',
                    fecha: '15/01/2026',
                    validezDias: '15',
                    estado: 'Activa',
                    subtotal: '195.00',
                    iva: '0.00',
                    total: '195.00',
                    moneda: 'USD',
                    notas: 'Incluye mano de obra y materiales básicos',
                    creadoPor: 'Roberto Wilson'
                };
            default:
                return baseData;
        }
    };

    const generateReportHtml = (template, data) => {
        const replaceFields = (text) => {
            if (!text) return '';
            return text.replace(/\{\{(\w+)\}\}/g, (match, field) => data[field] || match);
        };

        const renderElement = (el) => {
            const styleStr = Object.entries(el.styles || {})
                .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
                .join('; ');

            let content = '';
            switch (el.type) {
                case 'text':
                case 'label':
                    content = replaceFields(el.content || '');
                    break;
                case 'field':
                    content = data[el.fieldId] || `[${el.fieldId}]`;
                    break;
                case 'image':
                    if (el.src === 'logo') {
                        content = `<img src="assets/logo.png" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    }
                    break;
                case 'line':
                    return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; background-color: ${el.styles?.backgroundColor || '#ccc'};"></div>`;
                case 'box':
                    return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; ${styleStr}"></div>`;
            }

            return `<div style="position: absolute; left: ${el.x}px; top: ${el.y}px; ${el.width ? `width: ${el.width}px;` : ''} ${el.height ? `height: ${el.height}px;` : ''} ${styleStr}">${content}</div>`;
        };

        const renderSection = (section) => {
            return section.elements.map(el => renderElement(el)).join('');
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${template.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; background: #f0f0f0; padding: 20px; }
        .page {
            width: 612px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section { position: relative; overflow: hidden; }
        @media print {
            body { background: white; padding: 0; }
            .page { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="section" style="height: ${template.sections.header.height}px; background-color: ${template.sections.header.backgroundColor};">
            ${renderSection(template.sections.header)}
        </div>
        <div class="section" style="height: ${template.sections.detail.height}px; background-color: ${template.sections.detail.backgroundColor};">
            ${renderSection(template.sections.detail)}
        </div>
        <div class="section" style="height: ${template.sections.footer.height}px; background-color: ${template.sections.footer.backgroundColor};">
            ${renderSection(template.sections.footer)}
        </div>
    </div>
</body>
</html>
        `;
    };

    // ========== GENERATE REPORT WITH REAL DATA ==========
    const generateReport = (moduleId, data) => {
        loadTemplates();
        const template = templates[moduleId] || getDefaultTemplates()[moduleId];
        if (!template) return null;

        return generateReportHtml(template, data);
    };

    // ========== EVENT HANDLING ==========
    const handleEvent = (event) => {
        const { action } = event;
        const target = event.target;

        switch (action) {
            case 'openEditor':
                const moduleId = target.dataset.module;
                if (moduleId) {
                    openModuleEditor(moduleId);
                }
                break;
        }
    };

    // ========== INIT ==========
    const init = () => {
        loadTemplates();

        // Setup event listeners for module buttons
        document.querySelectorAll('.report-editor__module-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openModuleEditor(btn.dataset.module);
            });
        });
    };

    // ========== PUBLIC API ==========
    return {
        render,
        init,
        handleEvent,
        openModuleEditor,
        backToModules,
        selectElement,
        updateElementProperty,
        updateElementStyle,
        deleteSelectedElement,
        saveCurrentTemplate,
        resetToDefault,
        previewReport,
        generateReport,
        getTemplateForModule,
        saveTemplateForModule
    };
})();

// Export for module registration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportEditorModule;
}
