const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'js', 'modules');
fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.js')) {
        const fullPath = path.join(dir, file);
        let content = fs.readFileSync(fullPath, 'utf8');

        // Add id="searchInput"
        content = content.replace(/(<input type="text"\s+class="form-input"\s+placeholder="[^"]*"\s+)value=/g, '$1id="searchInput"\n                       value=');
        content = content.replace(/(<input type="text"\s+class="form-input"\s+placeholder="[^"]*"\s+oninput="[^"]*")/g, '$1\n                       id="searchInput"');

        // Remove duplicates if any
        content = content.replace(/id="searchInput"\s+id="searchInput"/g, 'id="searchInput"');

        // Replace single line handleSearch
        content = content.replace(/const handleSearch = \(value\) => \{ filterState\.search = value; App\.refreshCurrentModule\(\); \};/g,
            `let searchTimeout;
  const handleSearch = (value) => {
    filterState.search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      App.refreshCurrentModule();
    }, 300);
  };`);

        // Replace multiline handleSearch
        const multilineRegex = /const handleSearch = \(value\) => \{\s*filterState\.search = value;\s*App\.refreshCurrentModule\(\);\s*\};/g;
        content = content.replace(multilineRegex,
            `let searchTimeout;
  const handleSearch = (value) => {
    filterState.search = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      App.refreshCurrentModule();
    }, 300);
  };`);

        fs.writeFileSync(fullPath, content, 'utf8');
    }
});
console.log('Done!');
