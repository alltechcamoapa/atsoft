const fs = require('fs');
let content = fs.readFileSync('js/modules/prestaciones.js', 'utf8');

content = content.replace(
    /notas:\s*notasAutogeneradas\s*\}\);\s*App\.showNotification\?\(\`Recibo generado exitosamente\`,\s*'success'\);/,
    `notas: notasAutogeneradas
      });

      // Integración Gestión Financiera: Registrar Gasto de Nómina
      if (DataService.addFinGasto) {
          DataService.addFinGasto({
              categoria: 'Nómina y Salarios',
              concepto: notasAutogeneradas,
              monto: parseFloat(neto) || 0,
              fecha: new Date().toISOString(),
              origen: 'prestaciones_nomina'
          });
      }

      App.showNotification?.(\`Recibo generado exitosamente\`, 'success');`
);

fs.writeFileSync('js/modules/prestaciones.js', content, 'utf8');
console.log('Patch 2 complete');
