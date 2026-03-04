const fs = require('fs');

// Patch data-service.js
let ds = fs.readFileSync('js/services/data-service.js', 'utf8');

const recepcionesExports = `
        // Recepciones
        getRecepcionesSync, getRecepcionesFiltered, getRecepcionById, createRecepcion, updateRecepcion, deleteRecepcion,
`;

if (!ds.includes('// Recepciones\n        getRecepcionesSync')) {
    const splitIndex = ds.indexOf('return {');
    // find the LAST return {
    const lastReturnIndex = ds.lastIndexOf('return {');
    ds = ds.slice(0, lastReturnIndex + 8) + "\n" + recepcionesExports + ds.slice(lastReturnIndex + 8);
    fs.writeFileSync('js/services/data-service.js', ds, 'utf8');
}

// Patch supabase-data-service.js
let sds = fs.readFileSync('js/services/supabase-data-service.js', 'utf8');

const getRecepcionesFilteredCode = `
    const getRecepcionesFiltered = async (filter) => {
        if (!client) return [];
        let query = client.from('recepciones_equipos').select('*, cliente:clientes(*), equipo:equipos(*)');
        if (filter.search) {
            query = query.or(\`numero_recepcion.ilike.%\${filter.search}%,codigo_recepcion.ilike.%\${filter.search}%\`);
        }
        if (filter.estado && filter.estado !== 'all') {
            query = query.eq('estado', filter.estado);
        }
        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) { console.error('Error fetching recepciones filtered:', error); return []; }
        return data || [];
    };
`;

if (!sds.includes('getRecepcionesFiltered')) {
    const insertPos = sds.indexOf('const getRecepcionesSync =');
    if (insertPos !== -1) {
        sds = sds.slice(0, insertPos) + getRecepcionesFilteredCode + "\n    " + sds.slice(insertPos);
    }

    // Add to exports in supabase-data-service.js
    const lastReturnIndex2 = sds.lastIndexOf('return {');
    if (lastReturnIndex2 !== -1) {
        sds = sds.slice(0, lastReturnIndex2 + 8) + "\n        getRecepcionesFiltered," + sds.slice(lastReturnIndex2 + 8);
    }
    fs.writeFileSync('js/services/supabase-data-service.js', sds, 'utf8');
}

console.log('Fixed exports');
