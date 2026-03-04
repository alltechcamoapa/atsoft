const fs = require('fs');
let content = fs.readFileSync('js/services/data-service.js', 'utf8');

// Insert recepciones into loadDefaultPermissions for each role
content = content.replace(
    /"equipos": { create: true, read: true, update: true, delete: true },/g,
    '"equipos": { create: true, read: true, update: true, delete: true },\n            "recepciones": { create: true, read: true, update: true, delete: true },'
);
content = content.replace(
    /"equipos": { create: false, read: true, update: false, delete: false },/g,
    '"equipos": { create: false, read: true, update: false, delete: false },\n            "recepciones": { create: false, read: true, update: false, delete: false },'
);

fs.writeFileSync('js/services/data-service.js', content, 'utf8');
console.log('Patched permissions successfully');
