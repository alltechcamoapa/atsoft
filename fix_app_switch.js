const fs = require('fs');
const path = require('path');

const fileApp = path.join(__dirname, 'js/app.js');
let codeApp = fs.readFileSync(fileApp, 'utf8');

const regexSwitch = /case 'reportes':\s*moduleContent = ReportesModule\.render\(\);\s*break;/g;

if (codeApp.match(regexSwitch)) {
    codeApp = codeApp.replace(regexSwitch, match => {
        return match + `\n      case 'configuracion':\n        moduleContent = typeof ConfigModule !== 'undefined' ? ConfigModule.render() : renderModulePlaceholder(currentModule);\n        break;`;
    });
    fs.writeFileSync(fileApp, codeApp);
    console.log("App.js parcheado correctamente");
} else {
    console.log("No pude parchar App.js, o ya estaba parcheado");
}
