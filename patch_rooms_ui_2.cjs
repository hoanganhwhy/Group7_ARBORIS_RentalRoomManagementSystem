const fs = require('fs');

let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// Add getImageUrl if not present
if (!code.includes('getImageUrl,')) {
  code = code.replace(
    /import \{\n\s*getRooms,/,
    `import {\n  getRooms,\n  getImageUrl,`
  );
}

fs.writeFileSync('src/pages/Rooms.tsx', code);
console.log('Patched Rooms.tsx with getImageUrl');
