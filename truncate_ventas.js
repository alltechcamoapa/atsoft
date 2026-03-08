const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/modules/ventas.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the first occurrence of "window.VentasModule = VentasModule;"
// and truncate everything after its corresponding trailing logs.
const endSignature = "window.VentasModule = VentasModule;";
const index = content.indexOf(endSignature);

if (index !== -1) {
    const endStr = "console.log('✅ Módulo de Ventas cargado correctamente');\n";
    const finalIndex = content.indexOf(endStr, index) + endStr.length;
    content = content.substring(0, finalIndex);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Truncated successfully to length:", content.length);
} else {
    console.log("Could not find end signature.");
}
