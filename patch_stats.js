const fs = require('fs');

let ds = fs.readFileSync('js/services/data-service.js', 'utf8');

const statsCode = `
    const getRecepcionesStats = () => {
        const reps = cache.recepciones || [];
        return {
            pendientes: reps.filter(r => r.estado === 'Recibido').length,
            enRevision: reps.filter(r => r.estado === 'En Revisión').length,
            total: reps.length
        };
    };
`;

if (!ds.includes('getRecepcionesStats = ()')) {
    const insertPos = ds.indexOf('const getRecepcionesFiltered =');
    if (insertPos !== -1) {
        ds = ds.slice(0, insertPos) + statsCode + "\n    " + ds.slice(insertPos);
    }

    const lastReturnIndex = ds.lastIndexOf('return {');
    if (lastReturnIndex !== -1) {
        ds = ds.slice(0, lastReturnIndex + 8) + "\n        getRecepcionesStats," + ds.slice(lastReturnIndex + 8);
    }
    fs.writeFileSync('js/services/data-service.js', ds, 'utf8');
}

console.log("Patched getRecepcionesStats");
