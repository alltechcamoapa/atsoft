/**
 * ALLTECH - Pedidos Module
 * Gestión de pedidos de clientes con categorías, listas y reportes
 */

const PedidosModule = (() => {
    // ========== STATE ==========
    let filterState = { search: '', clienteId: 'all', estado: 'all', categoria: 'all' };
    let currentPedido = null;
    let currentItems = [];

    // ========== CATEGORÍAS PREDEFINIDAS ==========
    // ========== CATEGORÍAS ==========
    const DEFAULT_CATEGORIAS = [
        { id: 'hardware', nombre: 'Hardware', icon: '💻', color: '#3b82f6' },
        { id: 'software', nombre: 'Software', icon: '📀', color: '#8b5cf6' },
        { id: 'redes', nombre: 'Redes', icon: '🌐', color: '#06b6d4' },
        { id: 'impresoras', nombre: 'Impresoras', icon: '🖨️', color: '#d97706' }, // Darker amber for readability
        { id: 'accesorios', nombre: 'Accesorios', icon: '🔌', color: '#10b981' },
        { id: 'servicios', nombre: 'Servicios', icon: '🔧', color: '#ef4444' },
        { id: 'otros', nombre: 'Otros', icon: '📦', color: '#6b7280' }
    ];
    let categorias = JSON.parse(localStorage.getItem('pedidos_categorias')) || DEFAULT_CATEGORIAS;

    const saveCategorias = () => {
        localStorage.setItem('pedidos_categorias', JSON.stringify(categorias));
        const listContainer = document.getElementById('categoriasList');
        if (listContainer) listContainer.innerHTML = renderCategoriasList();
    };

    // ========== RENDER PRINCIPAL ==========
    const render = () => {
        const pedidos = getPedidosFiltered();
        const clientes = DataService.getClientesSync();
        const user = State.get('user');
        const canCreate = DataService.canPerformAction(user.role, 'pedidos', 'create');

        return `
            <div class="module-container animate-fadeIn">
                <div class="module-header">
                    <div class="module-header__left">
                        <h2 class="module-title">${Icons.shoppingCart} Pedidos</h2>
                        <p class="module-subtitle">${pedidos.length} pedidos registrados</p>
                    </div>
                    <div class="module-header__right">
                        <button class="btn btn--secondary" onclick="PedidosModule.openCategoriasModal()" title="Gestionar Categorías">
                            ${Icons.list} Categorías
                        </button>
                        <button class="btn btn--secondary" onclick="PedidosModule.openReportModal()">
                            ${Icons.barChart} Reportes
                        </button>
                        ${canCreate ? `
                        <button class="btn btn--primary" onclick="PedidosModule.openCreateModal()">
                            ${Icons.plus} Nuevo Pedido
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="module-stats">
                    ${renderStats()}
                </div>

                <!-- Filters -->
                <div class="module-filters card">
                    <div class="card__body">
                        <div class="filters-row" style="display: flex; gap: var(--spacing-md); flex-wrap: wrap; align-items: center;">
                            <div class="search-input" style="flex: 1; min-width: 200px; max-width: 300px;">
                                <span class="search-input__icon">${Icons.search}</span>
                                <input type="text" class="form-input" placeholder="Buscar pedido..." 
                                       value="${filterState.search}"
                                       onkeyup="PedidosModule.handleSearch(this.value)">
                            </div>
                            <select class="form-select" style="width: 180px;" 
                                    onchange="PedidosModule.handleClienteFilter(this.value)">
                                <option value="all">Todos los clientes</option>
                                ${clientes.map(c => `
                                    <option value="${c.clienteId || c.id}" ${filterState.clienteId === (c.clienteId || c.id) ? 'selected' : ''}>
                                        ${c.empresa || c.nombreCliente}
                                    </option>
                                `).join('')}
                            </select>
                            <select class="form-select" style="width: 150px;" 
                                    onchange="PedidosModule.handleCategoriaFilter(this.value)">
                                <option value="all">Todas las categorías</option>
                                 ${categorias.map(cat => `
                                    <option value="${cat.id}" ${filterState.categoria === cat.id ? 'selected' : ''}>
                                        ${cat.icon} ${cat.nombre}
                                    </option>
                                `).join('')}
                            </select>
                            <select class="form-select" style="width: 140px;" 
                                    onchange="PedidosModule.handleEstadoFilter(this.value)">
                                <option value="all">Todos los estados</option>
                                <option value="Pendiente" ${filterState.estado === 'Pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
                                <option value="En Proceso" ${filterState.estado === 'En Proceso' ? 'selected' : ''}>🔵 En Proceso</option>
                                <option value="Completado" ${filterState.estado === 'Completado' ? 'selected' : ''}>🟢 Completado</option>
                                <option value="Cancelado" ${filterState.estado === 'Cancelado' ? 'selected' : ''}>🔴 Cancelado</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Pedidos List -->
                <div class="card">
                    <div class="card__body" style="padding: 0;">
                        ${pedidos.length > 0 ? renderTable(pedidos) : renderEmptyState()}
                    </div>
                </div>
            </div>
            <div id="pedidoModal"></div>
        `;
    };

    // ========== RENDER STATS ==========
    const renderStats = () => {
        const pedidos = DataService.getPedidosSync ? DataService.getPedidosSync() : [];
        const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length;
        const enProceso = pedidos.filter(p => p.estado === 'En Proceso').length;
        const completados = pedidos.filter(p => p.estado === 'Completado').length;
        const totalValor = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

        return `
            <div class="stat-card stat-card--warning" onclick="PedidosModule.handleEstadoFilter('Pendiente')" style="cursor: pointer;">
                <div class="stat-card__icon">🟡</div>
                <span class="stat-card__label">Pendientes</span>
                <span class="stat-card__value">${pendientes}</span>
            </div>
            <div class="stat-card stat-card--info" onclick="PedidosModule.handleEstadoFilter('En Proceso')" style="cursor: pointer;">
                <div class="stat-card__icon">🔵</div>
                <span class="stat-card__label">En Proceso</span>
                <span class="stat-card__value">${enProceso}</span>
            </div>
            <div class="stat-card stat-card--success" onclick="PedidosModule.handleEstadoFilter('Completado')" style="cursor: pointer;">
                <div class="stat-card__icon">🟢</div>
                <span class="stat-card__label">Completados</span>
                <span class="stat-card__value">${completados}</span>
            </div>
            <div class="stat-card stat-card--primary">
                <div class="stat-card__icon">${Icons.wallet}</div>
                <span class="stat-card__label">Valor Total</span>
                <span class="stat-card__value">$${totalValor.toFixed(2)}</span>
            </div>
        `;
    };

    // ========== RENDER TABLE ==========
    const renderTable = (pedidos) => {
        const user = State.get('user');
        const canUpdate = DataService.canPerformAction(user.role, 'pedidos', 'update');
        const canDelete = DataService.canPerformAction(user.role, 'pedidos', 'delete');

        return `
            <table class="data-table">
                <thead class="data-table__head">
                    <tr>
                        <th style="width: 40px;">✓</th>
                        <th>Nº Pedido</th>
                        <th>Cliente</th>
                        <th>Categoría</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody class="data-table__body">
                    ${pedidos.map((pedido, index) => {
            const cliente = DataService.getClienteById(pedido.clienteId);
            const categoria = categorias.find(c => c.id === pedido.categoria) || categorias[0];
            const isCompleted = pedido.estado === 'Completado';

            return `
                            <tr class="animate-fadeInUp stagger-${Math.min(index + 1, 8)} ${isCompleted ? 'row--completed' : ''}" 
                                style="${isCompleted ? 'opacity: 0.7;' : ''}">
                                <td>
                                    <label class="checkbox-wrapper" style="cursor: pointer;">
                                        <input type="checkbox" 
                                               ${isCompleted ? 'checked' : ''} 
                                               onchange="PedidosModule.toggleComplete('${pedido.pedidoId}')"
                                               style="width: 18px; height: 18px; cursor: pointer;">
                                    </label>
                                </td>
                                <td>
                                    <span class="font-medium" style="${isCompleted ? 'text-decoration: line-through;' : ''}">${pedido.numeroPedido || pedido.pedidoId}</span>
                                </td>
                                <td>
                                    <div class="font-medium">${cliente?.empresa || cliente?.nombreCliente || 'N/A'}</div>
                                    <div class="text-xs text-muted">${cliente?.nombreCliente || ''}</div>
                                </td>
                                <td>
                                    <span class="badge" style="background: ${categoria.color}20; color: ${categoria.color};">
                                        ${categoria.icon} ${categoria.nombre}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge badge--info">${pedido.items?.length || 0} items</span>
                                </td>
                                <td>
                                    <span class="font-medium">$${(pedido.total || 0).toFixed(2)}</span>
                                </td>
                                <td>
                                    <div>${new Date(pedido.fecha).toLocaleDateString('es-NI')}</div>
                                    <div class="text-xs text-muted">${new Date(pedido.fecha).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td>
                                    <span class="badge ${getEstadoBadgeClass(pedido.estado)}">
                                        ${getEstadoIcon(pedido.estado)} ${pedido.estado}
                                    </span>
                                </td>
                                <td>
                                    <div class="flex gap-xs">
                                        <button class="btn btn--ghost btn--icon btn--sm" onclick="PedidosModule.viewDetail('${pedido.pedidoId}')" title="Ver">
                                            ${Icons.eye}
                                        </button>
                                        <button class="btn btn--ghost btn--icon btn--sm" onclick="PedidosModule.generatePDF('${pedido.pedidoId}')" title="PDF">
                                            ${Icons.fileText}
                                        </button>
                                        ${canUpdate && !isCompleted ? `
                                            <button class="btn btn--ghost btn--icon btn--sm" onclick="PedidosModule.openEditModal('${pedido.pedidoId}')" title="Editar">
                                                ${Icons.edit}
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="btn btn--ghost btn--icon btn--sm text-danger" onclick="PedidosModule.deletePedido('${pedido.pedidoId}')" title="Eliminar">
                                                ${Icons.trash}
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
    };

    // ========== HELPERS ==========
    const getEstadoBadgeClass = (estado) => {
        const classes = {
            'Pendiente': 'badge--warning',
            'En Proceso': 'badge--info',
            'Completado': 'badge--success',
            'Cancelado': 'badge--danger'
        };
        return classes[estado] || 'badge--secondary';
    };

    const getEstadoIcon = (estado) => {
        const icons = {
            'Pendiente': '🟡',
            'En Proceso': '🔵',
            'Completado': '🟢',
            'Cancelado': '🔴'
        };
        return icons[estado] || '⚪';
    };

    const renderEmptyState = () => {
        return `
            <div class="empty-state">
                <div class="empty-state__icon">🛒</div>
                <h3 class="empty-state__title">No hay pedidos</h3>
                <p class="empty-state__description">Crea un nuevo pedido para comenzar.</p>
                <button class="btn btn--primary" onclick="PedidosModule.openCreateModal()">
                    ${Icons.plus} Nuevo Pedido
                </button>
            </div>
        `;
    };

    // ========== FILTER FUNCTIONS ==========
    const getPedidosFiltered = () => {
        const pedidos = DataService.getPedidosSync ? DataService.getPedidosSync() : [];
        return pedidos.filter(p => {
            let matches = true;
            if (filterState.search) {
                const s = filterState.search.toLowerCase();
                const cliente = DataService.getClienteById(p.clienteId);
                matches = (p.pedidoId || '').toLowerCase().includes(s) ||
                    (p.numeroPedido || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s);
            }
            if (filterState.clienteId && filterState.clienteId !== 'all') {
                matches = matches && p.clienteId === filterState.clienteId;
            }
            if (filterState.estado && filterState.estado !== 'all') {
                matches = matches && p.estado === filterState.estado;
            }
            if (filterState.categoria && filterState.categoria !== 'all') {
                matches = matches && p.categoria === filterState.categoria;
            }
            return matches;
        }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    };

    const handleSearch = (value) => {
        filterState.search = value;
        App.render();
    };

    const handleClienteFilter = (value) => {
        filterState.clienteId = value;
        App.render();
    };

    const handleEstadoFilter = (value) => {
        filterState.estado = value;
        App.render();
    };

    const handleCategoriaFilter = (value) => {
        filterState.categoria = value;
        App.render();
    };

    // ========== TOGGLE COMPLETE ==========
    const toggleComplete = (pedidoId) => {
        const pedido = DataService.getPedidoById(pedidoId);
        if (pedido) {
            const nuevoEstado = pedido.estado === 'Completado' ? 'Pendiente' : 'Completado';
            DataService.updatePedido(pedidoId, {
                estado: nuevoEstado,
                fechaCompletado: nuevoEstado === 'Completado' ? new Date().toISOString() : null
            });

            if (typeof NotificationService !== 'undefined') {
                NotificationService.showToast(
                    nuevoEstado === 'Completado' ? '✅ Pedido marcado como completado' : '📝 Pedido marcado como pendiente',
                    nuevoEstado === 'Completado' ? 'success' : 'info',
                    2000
                );
            }

            App.render();
        }
    };

    // ========== MODAL FORM ==========
    const renderFormModal = (pedido = null) => {
        const isEdit = pedido !== null;
        const clientes = DataService.getClientesSync();

        // Obtener técnicos para el selector
        const tecnicos = DataService.getUsersSync ? DataService.getUsersSync().filter(u => u.role === 'Tecnico') : [];

        currentItems = isEdit ? [...(pedido.items || [])].map(item => ({ ...item, completado: item.completado || false })) : [{ descripcion: '', cantidad: 1, precioUnitario: 0, total: 0, completado: false }];

        return `
            <div class="modal-overlay open" onclick="PedidosModule.closeModal(event)">
                <div class="modal modal--lg animate-scaleIn" onclick="event.stopPropagation()">
                    <div class="modal__header">
                        <h3 class="modal__title">${isEdit ? 'Editar Pedido' : 'Nuevo Pedido'}</h3>
                        <button class="modal__close" onclick="PedidosModule.closeModal()">${Icons.x}</button>
                    </div>
                    <form class="modal__body" id="pedidoForm" onsubmit="PedidosModule.handleSubmit(event)">
                        <input type="hidden" name="pedidoId" value="${pedido?.pedidoId || ''}">
                        
                        <!-- Nombre de Lista -->
                        <div class="form-group">
                            <label class="form-label">📝 Nombre de la Lista</label>
                            <input type="text" name="nombreLista" class="form-input" 
                                   value="${pedido?.nombreLista || ''}"
                                   placeholder="Ej: Pedido Enero 2026, Lista oficina central, etc.">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group" style="flex: 2;">
                                <label class="form-label form-label--required">Cliente</label>
                                <select name="clienteId" class="form-select" required>
                                    <option value="">Seleccionar cliente...</option>
                                    ${clientes.map(c => `
                                        <option value="${c.clienteId || c.id}" ${pedido?.clienteId === (c.clienteId || c.id) ? 'selected' : ''}>
                                            ${c.empresa || c.nombreCliente} - ${c.nombreCliente}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label form-label--required">Categoría</label>
                                <select name="categoria" class="form-select" required>
                                    ${categorias.map(cat => `
                                        <option value="${cat.id}" ${pedido?.categoria === cat.id ? 'selected' : ''}>
                                            ${cat.icon} ${cat.nombre}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Fecha</label>
                                <input type="date" name="fecha" class="form-input" 
                                       value="${pedido?.fecha?.split('T')[0] || new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">👨‍🔧 Técnico Asignado</label>
                                <select name="tecnicoAsignado" class="form-select">
                                    <option value="">Sin asignar</option>
                                    ${tecnicos.map(tec => `
                                        <option value="${tec.username}" ${pedido?.tecnicoAsignado === tec.username ? 'selected' : ''}>
                                            ${tec.name || tec.username}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Prioridad</label>
                                <select name="prioridad" class="form-select">
                                    <option value="Normal" ${pedido?.prioridad === 'Normal' ? 'selected' : ''}>Normal</option>
                                    <option value="Alta" ${pedido?.prioridad === 'Alta' ? 'selected' : ''}>⚡ Alta</option>
                                    <option value="Urgente" ${pedido?.prioridad === 'Urgente' ? 'selected' : ''}>🔥 Urgente</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Estado</label>
                                <select name="estado" class="form-select">
                                    <option value="Pendiente" ${pedido?.estado === 'Pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
                                    <option value="En Proceso" ${pedido?.estado === 'En Proceso' ? 'selected' : ''}>🔵 En Proceso</option>
                                    <option value="Completado" ${pedido?.estado === 'Completado' ? 'selected' : ''}>🟢 Completado</option>
                                    <option value="Cancelado" ${pedido?.estado === 'Cancelado' ? 'selected' : ''}>🔴 Cancelado</option>
                                </select>
                            </div>
                        </div>

                        <!-- Lista de Items -->
                        <div class="form-group">
                            <label class="form-label form-label--required">Items del Pedido</label>
                            <div class="pedido-items" id="pedidoItems">
                                ${renderItemsEditor()}
                            </div>
                            <button type="button" class="btn btn--secondary btn--sm" style="margin-top: var(--spacing-sm);" onclick="PedidosModule.addItem()">
                                ${Icons.plus} Agregar Item
                            </button>
                        </div>

                        <!-- Totales -->
                        <div class="pedido-totals" style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-top: var(--spacing-md);">
                            <div style="display: flex; justify-content: space-between; font-size: var(--font-size-lg); font-weight: var(--font-weight-bold);">
                                <span>Total:</span>
                                <span id="pedidoTotal">$0.00</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Notas</label>
                            <textarea name="notas" class="form-textarea" rows="2" 
                                      placeholder="Notas adicionales del pedido...">${pedido?.notas || ''}</textarea>
                        </div>

                        <div class="modal__footer" style="margin: calc(-1 * var(--spacing-lg)); margin-top: var(--spacing-lg); padding: var(--spacing-lg); border-top: 1px solid var(--border-color);">
                            <button type="button" class="btn btn--secondary" onclick="PedidosModule.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar Cambios' : 'Crear Pedido'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    };

    // ========== ITEMS EDITOR ==========
    const renderItemsEditor = () => {
        return currentItems.map((item, index) => `
            <div class="pedido-item" data-index="${index}" style="display: flex; gap: var(--spacing-sm); align-items: center; margin-bottom: var(--spacing-sm); padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-md); ${item.completado ? 'opacity: 0.6;' : ''}">
                <input type="checkbox" 
                       ${item.completado ? 'checked' : ''}
                       onchange="PedidosModule.toggleItemComplete(${index}, this.checked)"
                       style="cursor: pointer; width: 20px; height: 20px;"
                       title="Marcar como completado">
                <input type="number" class="form-input" style="width: 70px; ${item.completado ? 'text-decoration: line-through;' : ''}" 
                       value="${item.cantidad}" min="1" step="1"
                       placeholder="Cant."
                       onchange="PedidosModule.updateItem(${index}, 'cantidad', this.value)">
                <input type="text" class="form-input" style="flex: 1; ${item.completado ? 'text-decoration: line-through;' : ''}" 
                       value="${item.descripcion}"
                       placeholder="Descripción del producto/servicio"
                       onchange="PedidosModule.updateItem(${index}, 'descripcion', this.value)">
                <input type="number" class="form-input" style="width: 100px; ${item.completado ? 'text-decoration: line-through;' : ''}" 
                       value="${item.precioUnitario}" min="0" step="0.01"
                       placeholder="Precio"
                       onchange="PedidosModule.updateItem(${index}, 'precioUnitario', this.value)">
                <span style="min-width: 80px; text-align: right; font-weight: var(--font-weight-semibold); ${item.completado ? 'text-decoration: line-through;' : ''}">$${(item.total || 0).toFixed(2)}</span>
                ${currentItems.length > 1 ? `
                    <button type="button" class="btn btn--ghost btn--icon btn--sm text-danger" onclick="PedidosModule.removeItem(${index})">
                        ${Icons.trash}
                    </button>
                ` : '<div style="width: 32px;"></div>'}
            </div>
        `).join('');
    };

    const addItem = () => {
        currentItems.push({ descripcion: '', cantidad: 1, precioUnitario: 0, total: 0, completado: false });
        document.getElementById('pedidoItems').innerHTML = renderItemsEditor();
    };

    const removeItem = (index) => {
        if (currentItems.length > 1) {
            currentItems.splice(index, 1);
            document.getElementById('pedidoItems').innerHTML = renderItemsEditor();
            calculateTotals();
        }
    };

    const toggleItemComplete = (index, checked) => {
        currentItems[index].completado = checked;
        document.getElementById('pedidoItems').innerHTML = renderItemsEditor();
    };

    const updateItem = (index, field, value) => {
        if (field === 'cantidad' || field === 'precioUnitario') {
            currentItems[index][field] = parseFloat(value) || 0;
            currentItems[index].total = currentItems[index].cantidad * currentItems[index].precioUnitario;
        } else {
            currentItems[index][field] = value;
        }
        document.getElementById('pedidoItems').innerHTML = renderItemsEditor();
        calculateTotals();
    };

    const calculateTotals = () => {
        const total = currentItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const totalEl = document.getElementById('pedidoTotal');
        if (totalEl) {
            totalEl.textContent = `$${total.toFixed(2)}`;
        }
    };

    // ========== MODAL ACTIONS ==========
    const openCreateModal = () => {
        currentPedido = null;
        currentItems = [{ descripcion: '', cantidad: 1, precioUnitario: 0, total: 0 }];
        document.getElementById('pedidoModal').innerHTML = renderFormModal();
        setTimeout(calculateTotals, 100);
    };

    const openEditModal = (pedidoId) => {
        currentPedido = DataService.getPedidoById(pedidoId);
        if (currentPedido) {
            document.getElementById('pedidoModal').innerHTML = renderFormModal(currentPedido);
            setTimeout(calculateTotals, 100);
        }
    };

    const closeModal = (event) => {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('pedidoModal').innerHTML = '';
        currentPedido = null;
    };

    // ========== HANDLE SUBMIT ==========
    const handleSubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const pedidoData = {
            nombreLista: formData.get('nombreLista'),
            clienteId: formData.get('clienteId'),
            categoria: formData.get('categoria'),
            fecha: formData.get('fecha'),
            prioridad: formData.get('prioridad'),
            estado: formData.get('estado'),
            tecnicoAsignado: formData.get('tecnicoAsignado'),
            notas: formData.get('notas'),
            items: currentItems.filter(i => i.descripcion.trim() !== ''),
            total: currentItems.reduce((sum, item) => sum + (item.total || 0), 0)
        };

        const pedidoId = formData.get('pedidoId');

        try {
            if (pedidoId) {
                // Editar
                await DataService.updatePedido(pedidoId, pedidoData);
                if (typeof NotificationService !== 'undefined') {
                    NotificationService.showToast('✅ Pedido actualizado correctamente', 'success');
                } else {
                    App.showNotification?.('Pedido actualizado correctamente', 'success');
                }
            } else {
                // Crear nuevo
                await DataService.createPedido(pedidoData);
                if (typeof NotificationService !== 'undefined') {
                    NotificationService.showToast('✅ Pedido creado correctamente', 'success');
                } else {
                    App.showNotification?.('Pedido creado correctamente', 'success');
                }
            }

            closeModal();
            App.render();
        } catch (e) {
            console.error(e);
            const msg = e.message || 'Error al guardar pedido';
            if (typeof NotificationService !== 'undefined') {
                NotificationService.showToast('❌ ' + msg, 'error');
            } else {
                App.showNotification?.(msg, 'error') || alert(msg);
            }
        }
    };

    // ========== VIEW DETAIL ==========
    const viewDetail = (pedidoId) => {
        const pedido = DataService.getPedidoById(pedidoId);
        if (!pedido) return;

        const cliente = DataService.getClienteById(pedido.clienteId);
        const categoria = categorias.find(c => c.id === pedido.categoria) || categorias[categorias.length - 1];

        document.getElementById('pedidoModal').innerHTML = `
            <div class="modal-overlay open" onclick="PedidosModule.closeModal(event)">
                <div class="modal modal--lg animate-scaleIn" onclick="event.stopPropagation()">
                    <div class="modal__header">
                        <div>
                            <h3 class="modal__title">Pedido ${pedido.numeroPedido || pedido.pedidoId}</h3>
                            <span class="badge ${getEstadoBadgeClass(pedido.estado)}">${getEstadoIcon(pedido.estado)} ${pedido.estado}</span>
                        </div>
                        <button class="modal__close" onclick="PedidosModule.closeModal()">${Icons.x}</button>
                    </div>
                    <div class="modal__body">
                        <div class="detail-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
                            <div class="detail-item">
                                <div class="detail-item__label">Cliente</div>
                                <div class="detail-item__value">${cliente?.empresa || 'N/A'}</div>
                                <div class="text-xs text-muted">${cliente?.nombreCliente || ''}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-item__label">Categoría</div>
                                <div class="detail-item__value">
                                    <span style="color: ${categoria.color}">${categoria.icon} ${categoria.nombre}</span>
                                </div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-item__label">Fecha</div>
                                <div class="detail-item__value">${new Date(pedido.fecha).toLocaleDateString('es-NI')}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-item__label">Prioridad</div>
                                <div class="detail-item__value">${pedido.prioridad || 'Normal'}</div>
                            </div>
                        </div>

                        <h4 style="margin-bottom: var(--spacing-sm);">Items del Pedido</h4>
                        <table class="data-table" style="margin-bottom: var(--spacing-lg);">
                            <thead class="data-table__head">
                                <tr>
                                    <th>Cant.</th>
                                    <th>Descripción</th>
                                    <th>P. Unit.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody class="data-table__body">
                                ${(pedido.items || []).map(item => `
                                    <tr>
                                        <td>${item.cantidad}</td>
                                        <td>${item.descripcion}</td>
                                        <td>$${(item.precioUnitario || 0).toFixed(2)}</td>
                                        <td class="font-medium">$${(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="background: var(--bg-tertiary);">
                                    <td colspan="3" class="font-bold" style="text-align: right;">TOTAL:</td>
                                    <td class="font-bold">$${(pedido.total || 0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        ${pedido.notas ? `
                            <div class="detail-item">
                                <div class="detail-item__label">Notas</div>
                                <div class="detail-item__value">${pedido.notas}</div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal__footer">
                        <button class="btn btn--secondary" onclick="PedidosModule.closeModal()">Cerrar</button>
                        <button class="btn btn--primary" onclick="PedidosModule.generatePDF('${pedido.pedidoId}')">${Icons.fileText} Generar PDF</button>
                    </div>
                </div>
            </div>
        `;
    };

    // ========== DELETE ==========
    const deletePedido = async (pedidoId) => {
        if (confirm('¿Estás seguro de eliminar este pedido?')) {
            try {
                await DataService.deletePedido(pedidoId);
                if (typeof NotificationService !== 'undefined') {
                    NotificationService.showToast('🗑️ Pedido eliminado', 'warning');
                } else {
                    App.showNotification?.('Pedido eliminado', 'success');
                }
                App.render();
            } catch (e) {
                console.error(e);
                const msg = e.message || 'Error al eliminar pedido';
                if (typeof NotificationService !== 'undefined') {
                    NotificationService.showToast('❌ ' + msg, 'error');
                } else {
                    App.showNotification?.(msg, 'error') || alert(msg);
                }
            }
        }
    };

    // ========== PDF GENERATION ==========
    const generatePDF = (pedidoId) => {
        const pedido = DataService.getPedidoById(pedidoId);
        if (!pedido) return;

        const cliente = DataService.getClienteById(pedido.clienteId);
        const categoria = categorias.find(c => c.id === pedido.categoria) || categorias[categorias.length - 1];

        const content = `
            <div class="header">
                <div class="company-info">
                    <h1>ALLTECH</h1>
                    <p>Soluciones en Tecnología</p>
                </div>
                <div class="pedido-info">
                    <h2>PEDIDO</h2>
                    <p><strong>Nº:</strong> ${pedido.numeroPedido || pedido.pedidoId}</p>
                    <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleDateString('es-NI')}</p>
                    <p><strong>Estado:</strong> ${pedido.estado}</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Cliente</div>
                <div class="client-info">
                    <p><strong>${cliente?.empresa || 'N/A'}</strong></p>
                    <p>${cliente?.nombreCliente || ''}</p>
                    <p>${cliente?.direccion || ''}</p>
                    <p>Tel: ${cliente?.telefono || ''}</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Categoría: ${categoria.icon} ${categoria.nombre}</div>
            </div>

            <div class="section">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">Cant.</th>
                            <th>Descripción</th>
                            <th style="width: 100px;">P. Unit.</th>
                            <th style="width: 100px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(pedido.items || []).map(item => `
                            <tr>
                                <td style="text-align: center;">${item.cantidad}</td>
                                <td>${item.descripcion}</td>
                                <td style="text-align: right;">$${(item.precioUnitario || 0).toFixed(2)}</td>
                                <td style="text-align: right;">$${(item.total || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="totals">
                <div class="totals-row totals-row--total">
                    <span>TOTAL:</span>
                    <span>$${(pedido.total || 0).toFixed(2)}</span>
                </div>
            </div>

            ${pedido.notas ? `
                <div class="section">
                    <div class="section-title">Notas</div>
                    <p>${pedido.notas}</p>
                </div>
            ` : ''}
        `;

        const htmlContent = generatePDFTemplate('Pedido', content);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    };

    // ========== REPORT MODAL ==========
    const openReportModal = () => {
        const clientes = DataService.getClientesSync();

        document.getElementById('pedidoModal').innerHTML = `
            <div class="modal-overlay open" onclick="PedidosModule.closeModal(event)">
                <div class="modal animate-scaleIn" onclick="event.stopPropagation()">
                    <div class="modal__header">
                        <h3 class="modal__title">${Icons.barChart} Reportes de Pedidos</h3>
                        <button class="modal__close" onclick="PedidosModule.closeModal()">${Icons.x}</button>
                    </div>
                    <div class="modal__body">
                        <div class="report-options">
                            <!-- Por Cliente -->
                            <div class="card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md);">
                                <h5 style="margin-bottom: var(--spacing-sm);">📋 Reporte por Cliente</h5>
                                <div class="form-row">
                                    <select id="reportClienteId" class="form-select" style="flex: 1;">
                                        <option value="">Seleccionar cliente...</option>
                                        ${clientes.map(c => `<option value="${c.clienteId || c.id}">${c.empresa || c.nombreCliente}</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn--primary" onclick="PedidosModule.generateClienteReport()">
                                        ${Icons.fileText} Generar
                                    </button>
                                </div>
                            </div>

                            <!-- Por Categoría -->
                            <div class="card" style="margin-bottom: var(--spacing-md); padding: var(--spacing-md);">
                                <h5 style="margin-bottom: var(--spacing-sm);">📊 Reporte por Categoría</h5>
                                <div class="form-row">
                                    <select id="reportCategoria" class="form-select" style="flex: 1;">
                                        <option value="">Seleccionar categoría...</option>
                                        ${categorias.map(cat => `<option value="${cat.id}">${cat.icon} ${cat.nombre}</option>`).join('')}
                                    </select>
                                    <button type="button" class="btn btn--primary" onclick="PedidosModule.generateCategoriaReport()">
                                        ${Icons.fileText} Generar
                                    </button>
                                </div>
                            </div>

                            <!-- Por Fecha -->
                            <div class="card" style="padding: var(--spacing-md);">
                                <h5 style="margin-bottom: var(--spacing-sm);">📅 Reporte por Rango de Fechas</h5>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Desde</label>
                                        <input type="date" id="reportFechaInicio" class="form-input">
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Hasta</label>
                                        <input type="date" id="reportFechaFin" class="form-input">
                                    </div>
                                    <div class="form-group" style="align-self: flex-end;">
                                        <button type="button" class="btn btn--primary" onclick="PedidosModule.generateFechaReport()">
                                            ${Icons.fileText} Generar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal__footer">
                        <button class="btn btn--secondary" onclick="PedidosModule.closeModal()">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
    };

    // ========== PDF TEMPLATE ==========
    const generatePDFTemplate = (title, content) => {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #1a73e8; padding-bottom: 20px; }
                    .header h1, .company-info h1 { color: #1a73e8; font-size: 24px; margin-bottom: 5px; }
                    .header h2, .pedido-info h2 { color: #333; font-size: 20px; text-align: right; }
                    .header p { color: #666; margin-top: 3px; }
                    .pedido-info { text-align: right; }
                    .section { margin-bottom: 25px; }
                    .section-title { font-size: 14px; font-weight: bold; color: #1a73e8; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    .client-info p { margin: 3px 0; }
                    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                    .info-item { padding: 10px; background: #f8f9fa; border-radius: 4px; }
                    .info-label { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 3px; }
                    .info-value { font-size: 16px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #1a73e8; color: white; font-weight: 600; }
                    tr:nth-child(even) { background: #f8f9fa; }
                    .totals { margin-top: 20px; margin-left: auto; width: 250px; }
                    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                    .totals-row--total { border-top: 2px solid #1a73e8; border-bottom: none; font-weight: bold; font-size: 16px; color: #1a73e8; padding-top: 12px; }
                    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 500; }
                    .badge-success { background: #d4edda; color: #155724; }
                    .badge-primary { background: #cce5ff; color: #004085; }
                    .badge-warning { background: #fff3cd; color: #856404; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                ${content}
                <div class="footer">
                    <p>ALLTECH - Sistema de Gestión Empresarial | Camoapa, Nicaragua</p>
                    <p>Creado por: Ing. Emilio Urbina - Alltech</p>
                </div>
            </body>
            </html>
        `;
    };

    // ========== REPORT GENERATORS ==========
    const generateClienteReport = () => {
        const clienteId = document.getElementById('reportClienteId').value;
        if (!clienteId) {
            alert('Por favor, selecciona un cliente.');
            return;
        }

        const cliente = DataService.getClienteById(clienteId);
        const pedidos = (DataService.getPedidosSync() || []).filter(p => p.clienteId === clienteId);

        if (pedidos.length === 0) {
            alert('No hay pedidos para este cliente.');
            return;
        }

        generateReportPDF('Reporte de Pedidos por Cliente', `Cliente: ${cliente?.empresa || 'N/A'}`, pedidos);
        closeModal();
    };

    const generateCategoriaReport = () => {
        const categoriaId = document.getElementById('reportCategoria').value;
        if (!categoriaId) {
            alert('Por favor, selecciona una categoría.');
            return;
        }

        const categoria = categorias.find(c => c.id === categoriaId);
        const pedidos = (DataService.getPedidosSync() || []).filter(p => p.categoria === categoriaId);

        if (pedidos.length === 0) {
            alert('No hay pedidos para esta categoría.');
            return;
        }

        generateReportPDF('Reporte de Pedidos por Categoría', `Categoría: ${categoria?.icon} ${categoria?.nombre}`, pedidos);
        closeModal();
    };

    // ========== GESTIÓN DE CATEGORÍAS ==========
    const openCategoriasModal = () => {
        const content = `
          <div class="modal-overlay open" onclick="PedidosModule.closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()" style="width: 500px; max-width: 95%;">
              <div class="modal__header">
                <h3 class="modal__title">Gestionar Categorías</h3>
                <button class="modal__close" onclick="PedidosModule.closeModal()">${Icons.x}</button>
              </div>
              <div class="modal__body">
                <p class="text-sm text-muted mb-4">Edita los nombres, iconos y colores de las categorías de pedidos.</p>
                 <div id="categoriasList" style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding: 5px;">
                    ${renderCategoriasList()}
                 </div>
                 <button class="btn btn--secondary btn--sm w-full mt-4" onclick="PedidosModule.addCategoria()">
                    ${Icons.plus} Añadir Categoría
                 </button>
              </div>
              <div class="modal__footer">
                 <button class="btn btn--primary" onclick="PedidosModule.closeModal(); App.render();">Listo</button>
              </div>
            </div>
          </div>
        `;
        document.getElementById('pedidoModal').innerHTML = content;
    };

    const renderCategoriasList = () => {
        return categorias.map((c, i) => `
            <div class="card" style="padding: 10px; display: flex; align-items: center; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <input type="text" value="${c.icon}" maxlength="2" class="form-input" style="width: 40px; text-align: center;" 
                       onchange="PedidosModule.updateCategoria(${i}, 'icon', this.value)" title="Icono">
                
                <input type="text" value="${c.nombre}" class="form-input" style="flex: 1;" 
                       onchange="PedidosModule.updateCategoria(${i}, 'nombre', this.value)" placeholder="Nombre">
                
                <input type="color" value="${c.color}" class="form-input" style="width: 40px; padding: 2px; height: 38px;" 
                       onchange="PedidosModule.updateCategoria(${i}, 'color', this.value)" title="Color">
                
                <button class="btn btn--ghost text-danger btn--icon" onclick="PedidosModule.deleteCategoria(${i})" title="Eliminar">
                    ${Icons.trash}
                </button>
            </div>
        `).join('');
    };

    const addCategoria = () => {
        categorias.push({
            id: 'cat_' + Date.now(),
            nombre: 'Nueva Categoría',
            icon: '📦',
            color: '#6b7280'
        });
        saveCategorias();
    };

    const updateCategoria = (index, field, value) => {
        categorias[index][field] = value;
        saveCategorias();
    };

    const deleteCategoria = (index) => {
        if (!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
        categorias.splice(index, 1);
        saveCategorias();
    };

    const generateFechaReport = () => {
        const fechaInicio = document.getElementById('reportFechaInicio').value;
        const fechaFin = document.getElementById('reportFechaFin').value;

        if (!fechaInicio || !fechaFin) {
            alert('Por favor, selecciona ambas fechas.');
            return;
        }

        const pedidos = (DataService.getPedidosSync() || []).filter(p => {
            const fecha = new Date(p.fecha);
            return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
        });

        if (pedidos.length === 0) {
            alert('No hay pedidos en este rango de fechas.');
            return;
        }

        generateReportPDF('Reporte de Pedidos por Fecha', `Del ${fechaInicio} al ${fechaFin}`, pedidos);
        closeModal();
    };

    const generateReportPDF = (titulo, subtitulo, pedidos) => {
        const totalValor = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);

        const content = `
            <div class="header">
                <h1>${titulo}</h1>
                <p>${subtitulo}</p>
                <p>Generado: ${new Date().toLocaleString('es-NI')}</p>
            </div>

            <div class="section">
                <div class="section-title">Resumen</div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Total Pedidos</div>
                        <div class="info-value">${pedidos.length}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Completados</div>
                        <div class="info-value">${pedidos.filter(p => p.estado === 'Completado').length}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Pendientes</div>
                        <div class="info-value">${pedidos.filter(p => p.estado === 'Pendiente').length}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Valor Total</div>
                        <div class="info-value">$${totalValor.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Listado de Pedidos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Categoría</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(p => {
            const cliente = DataService.getClienteById(p.clienteId);
            const cat = categorias.find(c => c.id === p.categoria) || categorias[0];
            return `
                                <tr>
                                    <td>${p.numeroPedido || p.pedidoId}</td>
                                    <td>${new Date(p.fecha).toLocaleDateString('es-NI')}</td>
                                    <td>${cliente?.empresa || 'N/A'}</td>
                                    <td>${cat.icon} ${cat.nombre}</td>
                                    <td>${p.items?.length || 0}</td>
                                    <td>$${(p.total || 0).toFixed(2)}</td>
                                    <td>${p.estado}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const htmlContent = generatePDFTemplate(titulo, content);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    };

    // ========== PUBLIC API ==========
    return {
        render,
        handleSearch,
        handleClienteFilter,
        handleEstadoFilter,
        handleCategoriaFilter,
        toggleComplete,
        openCreateModal,
        openEditModal,
        closeModal,
        handleSubmit,
        viewDetail,
        deletePedido,
        generatePDF,
        openReportModal,
        generateClienteReport,
        generateCategoriaReport,
        generateFechaReport,
        generateFechaReport,
        addItem,
        toggleItemComplete,
        // Categories
        openCategoriasModal,
        addCategoria,
        updateCategoria,
        deleteCategoria,
        removeItem,
        updateItem
    };
})();

// Make globally available
if (typeof window !== 'undefined') {
    window.PedidosModule = PedidosModule;
}
