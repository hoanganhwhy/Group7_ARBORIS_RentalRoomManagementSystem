const fs = require('fs');
let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// 1. Add getImageUrl to imports
if (!code.includes('getImageUrl} from \'../lib/api\'')) {
  code = code.replace(
    /extendContract,\s*\}\s*from\s*'..\/lib\/api';/,
    "extendContract,\n  getImageUrl,\n} from '../lib/api';"
  );
}

fs.writeFileSync('src/pages/Rooms.tsx', code);
console.log("Added getImageUrl to imports");
