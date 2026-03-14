const fs = require('fs');
let content = fs.readFileSync('js/modules/prestaciones.js', 'utf8');

// Replace 1: Adelantos
content = content.replace(
    /if\s*\(!payload\.id\)\s*\{\s*await\s+DataService\[`create\$\{type\}`\]\(payload\);\s*\}\s*else\s*\{/,
    `if (!payload.id) {
        await DataService[\`create\${type}\`](payload);
        
        // Integración Gestión Financiera: Registrar Gasto automático para Adelantos
        if (key === 'adelantos' && DataService.addFinGasto) {
            const emp = DataService.getEmpleadoById(payload.empleadoId);
            DataService.addFinGasto({
                categoria: 'Adelantos de Salario',
                concepto: \`Adelanto de Salario - \${emp ? emp.nombre : 'Empleado'}\`,
                monto: parseFloat(payload.monto) || 0,
                fecha: payload.fecha || new Date().toISOString(),
                origen: 'prestaciones_adelanto'
            });
        }
      } else {`
);

// Replace 2: Aguinaldos
content = content.replace(
    /observaciones:\s*'Pago generado desde sistema'\s*\}\);\s*App\.refreshCurrentModule\(\);/,
    `observaciones: 'Pago generado desde sistema'
      });

      // Integración Gestión Financiera: Registrar Gasto de Aguinaldo
      if (DataService.addFinGasto) {
          DataService.addFinGasto({
              categoria: 'Nómina y Salarios',
              concepto: \`Pago de Aguinaldo \${new Date().getFullYear()} - \${emp.nombre}\`,
              monto: parseFloat(calculo.monto) || 0,
              fecha: new Date().toISOString(),
              origen: 'prestaciones_aguinaldo'
          });
      }

      await DataService.updateEmpleado(empleadoId, { aguinaldoPagado: true });

      App.refreshCurrentModule();`
);

// Replace 3: Nominas
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
console.log('Patch complete.');
