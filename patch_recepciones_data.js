const fs = require('fs');
const path = require('path');

// ======================== PATCH DATA-SERVICE.JS ========================
const dataServicePath = path.join(__dirname, 'js/services/data-service.js');
let dsContent = fs.readFileSync(dataServicePath, 'utf8');

// Insert the Recepciones CRUD into data-service.js
const recepcionesCode = `
    // ========== CRUD RECEPCIONES ==========
    const getRecepcionesSync = () => cache.recepciones;

    const getRecepcionesFiltered = (filter) => {
        let items = cache.recepciones;
        if (filter.search) {
            const term = filter.search.toLowerCase();
            items = items.filter(r => 
                (r.numero_recepcion || r.codigo_recepcion || '').toLowerCase().includes(term) ||
                (r.equipo?.numero_serie || r.equipo?.serie || '').toLowerCase().includes(term) ||
                (r.cliente?.nombre_cliente || r.cliente?.nombreCliente || r.cliente?.empresa || '').toLowerCase().includes(term)
            );
        }
        if (filter.estado && filter.estado !== 'all') {
            items = items.filter(r => r.estado === filter.estado);
        }
        return items.sort((a, b) => new Date(b.created_at || b.fecha_recepcion) - new Date(a.created_at || a.fecha_recepcion));
    };

    const getRecepcionById = (id) => cache.recepciones.find(r => r.id === id || r.recepcionId === id);

    const createRecepcion = async (data) => {
        if (!SupabaseDataService) throw new Error('Servicio no inicializado');
        const newData = await SupabaseDataService.createRecepcion(data);
        if (newData) {
            cache.recepciones.push(newData);
            dispatchRefreshEvent();
        }
        return newData;
    };

    const updateRecepcion = async (id, data) => {
        if (!SupabaseDataService) throw new Error('Servicio no inicializado');
        const updatedData = await SupabaseDataService.updateRecepcion(id, data);
        if (updatedData) {
            const index = cache.recepciones.findIndex(r => r.id === id || r.recepcionId === id);
            if (index !== -1) cache.recepciones[index] = { ...cache.recepciones[index], ...updatedData };
            dispatchRefreshEvent();
        }
        return updatedData;
    };

    const deleteRecepcion = async (id) => {
        if (!SupabaseDataService) throw new Error('Servicio no inicializado');
        const success = await SupabaseDataService.deleteRecepcion(id);
        if (success) {
            cache.recepciones = cache.recepciones.filter(r => r.id !== id && r.recepcionId !== id);
            dispatchRefreshEvent();
        }
        return success;
    };
`;

if (!dsContent.includes('getRecepcionesFiltered')) {
    const splitIndex = dsContent.indexOf('// ========== UTILIDAD PARA MAPEO ==========');
    if (splitIndex !== -1) {
        dsContent = dsContent.slice(0, splitIndex) + recepcionesCode + "\\n" + dsContent.slice(splitIndex);
    } else {
        const insertPosition = dsContent.indexOf('return {');
        dsContent = dsContent.slice(0, insertPosition) + recepcionesCode + "\\n    " + dsContent.slice(insertPosition);
    }
}

// Add the methods to the exported object
const exportsMatch = dsContent.match(/return \{([\s\S]*?)\};/);
if (exportsMatch) {
    let exportsList = exportsMatch[1];
    if (!exportsList.includes('getRecepcionesFiltered')) {
        const replacement = exportsList.trim() + ",\n        getRecepcionesSync,\n        getRecepcionesFiltered,\n        getRecepcionById,\n        createRecepcion,\n        updateRecepcion,\n        deleteRecepcion\n    ";
        dsContent = dsContent.replace(exportsMatch[1], "\n        " + replacement);
    }
}
fs.writeFileSync(dataServicePath, dsContent, 'utf8');

// ======================== PATCH SUPABASE-DATA-SERVICE.JS ========================
const supabaseDsPath = path.join(__dirname, 'js/services/supabase-data-service.js');
let sdsContent = fs.readFileSync(supabaseDsPath, 'utf8');

const supabaseRecepcionesCode = `
    // ========== CRUD RECEPCIONES ==========
    const getRecepcionesSync = async () => {
        if (!client) return [];
        const { data, error } = await client.from('recepciones_equipos').select('*, cliente:clientes(*), equipo:equipos(*)').order('created_at', { ascending: false });
        if (error) { console.error('Error fetching recepciones:', error); return []; }
        return data || [];
    };

    const getRecepcionById = async (id) => {
        if (!client) return null;
        const { data, error } = await client.from('recepciones_equipos').select('*, cliente:clientes(*), equipo:equipos(*)').eq('id', id).single();
        if (error) { console.error('Error fetching recepcion:', error); return null; }
        return data;
    };

    const createRecepcion = async (recepcionData) => {
        if (!client) return null;
        
        // Asignar numero_recepcion auto incremental o UUID-based si no viene
        if (!recepcionData.numero_recepcion) {
            const prefix = 'REC-';
            const rnd = Math.floor(Math.random() * 900000) + 100000;
            recepcionData.numero_recepcion = prefix + rnd;
        }

        const { data, error } = await client.from('recepciones_equipos').insert([recepcionData]).select('*, cliente:clientes(*), equipo:equipos(*)').single();
        if (error) { console.error('Error creating recepcion:', error); throw error; }
        return data;
    };

    const updateRecepcion = async (id, updates) => {
        if (!client) return null;
        const { data, error } = await client.from('recepciones_equipos').update(updates).eq('id', id).select('*, cliente:clientes(*), equipo:equipos(*)').single();
        if (error) { console.error('Error updating recepcion:', error); throw error; }
        return data;
    };

    const deleteRecepcion = async (id) => {
        if (!client) return false;
        const { error } = await client.from('recepciones_equipos').delete().eq('id', id);
        if (error) { console.error('Error deleting recepcion:', error); return false; }
        return true;
    };
`;

if (!sdsContent.includes('getRecepcionesSync')) {
    const insertPosition2 = sdsContent.indexOf('return {');
    if (insertPosition2 !== -1) {
        sdsContent = sdsContent.slice(0, insertPosition2) + supabaseRecepcionesCode + "\\n    " + sdsContent.slice(insertPosition2);
    }
}

const sdsExportsMatch = sdsContent.match(/return \{([\s\S]*?)\};/);
if (sdsExportsMatch) {
    let sdsExportsList = sdsExportsMatch[1];
    if (!sdsExportsList.includes('getRecepcionesSync')) {
        const replacement = sdsExportsList.trim() + ",\n        getRecepcionesSync,\n        getRecepcionById,\n        createRecepcion,\n        updateRecepcion,\n        deleteRecepcion\n    ";
        sdsContent = sdsContent.replace(sdsExportsMatch[1], "\n        " + replacement);
    }
}
fs.writeFileSync(supabaseDsPath, sdsContent, 'utf8');

console.log('Recepciones patched to data services successfully.');
