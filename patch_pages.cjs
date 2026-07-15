const fs = require('fs');
const path = require('path');

const pages = [
  'Dashboard.tsx',
  'Rooms.tsx',
  'Tenants.tsx',
  'TenantAccounts.tsx',
  'MeterReadings.tsx',
  'Invoices.tsx',
  'Repairs.tsx'
];

pages.forEach(page => {
  const file = path.join(__dirname, 'src/pages', page);
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // We want to wrap set*(someVar) into set*(someVar?.data || someVar || [])
    // But only for specific state setters: setRooms, setTenants, setInvoices, setRepairs, setReadings, setUsers
    
    const setters = ['setRooms', 'setTenants', 'setInvoices', 'setRequests', 'setRepairs', 'setReadings', 'setUsers', 'setRoommates'];
    
    setters.forEach(setter => {
      // Regex to find: setter(variableName)
      // Make sure we only replace simple variable names or array/object accesses
      const regex = new RegExp(`${setter}\\(([a-zA-Z0-9_]+)\\)`, 'g');
      content = content.replace(regex, `${setter}($1?.data || $1 || [])`);
    });
    
    fs.writeFileSync(file, content);
    console.log(`Patched ${page}`);
  }
});
