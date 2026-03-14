const fs = require('fs');
const path = require('path');

const fileApp = path.join(__dirname, 'js/app.js');
let codeApp = fs.readFileSync(fileApp, 'utf8');

// The `render()` method might use `switch(currentModule)` or `if(currentModule === ...)`
// Let's find exactly where content is evaluated
// We will look for "renderModulePlaceholder" inside `render()`

if (!codeApp.includes("ConfigModule.render()")) {
    const placeholderRegex = /else if \(currentModule === 'reportes'\) content = typeof ReportesModule !== 'undefined' \? ReportesModule\.render\(\) : renderModulePlaceholder\('reportes'\);/;
    
    // First try a replace based on reportes
    if (codeApp.match(placeholderRegex)) {
        codeApp = codeApp.replace(placeholderRegex, 
            `else if(currentModule === 'reportes') content = typeof ReportesModule !== 'undefined' ? ReportesModule.render() : renderModulePlaceholder('reportes');
      else if(currentModule === 'configuracion') content = typeof ConfigModule !== 'undefined' ? ConfigModule.render() : renderModulePlaceholder('configuracion');`
        );
        fs.writeFileSync(fileApp, codeApp);
        console.log("Configuración añadida exitosamente cerca de reportes");
    } else {
        // If it doesn't match 'reportes', let's find 'gestion-tecnicos' or something
        const gtRegex = /else if \(currentModule === 'gestion-tecnicos'\) [^\n]+/;
        if (codeApp.match(gtRegex)) {
             codeApp = codeApp.replace(gtRegex, match => {
                 return match + `\n      else if(currentModule === 'configuracion') content = typeof ConfigModule !== 'undefined' ? ConfigModule.render() : renderModulePlaceholder('configuracion');`
             });
             fs.writeFileSync(fileApp, codeApp);
             console.log("Configuración añadida exitosamente cerca de gestion-tecnicos");
        } else {
            console.log("Fallo al inyectar configuracion - no se encontro punto de inyeccion en App.js. Revisar App.js manualmente.");
        }
    }
} else {
    console.log("Configuración ya está inyectada.");
}
