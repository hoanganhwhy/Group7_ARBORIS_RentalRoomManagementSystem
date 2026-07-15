const fs = require('fs');

let tenantCode = fs.readFileSync('src/pages/TenantDashboard.tsx', 'utf8');
if (!tenantCode.includes('getImageUrl')) {
  tenantCode = tenantCode.replace(
    /import \{ getTenants \} from '\.\.\/lib\/api';/,
    "import { getTenants, getImageUrl } from '../lib/api';"
  );
}

tenantCode = tenantCode.replace(
  /const bgImg = ROOM_IMAGES\[index % ROOM_IMAGES\.length\];/,
  "const bgImg = (rental.room.image_url ? getImageUrl(rental.room.image_url) : null) || ROOM_IMAGES[index % ROOM_IMAGES.length];"
);
fs.writeFileSync('src/pages/TenantDashboard.tsx', tenantCode);

let roomsCode = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// Fix Inputs
roomsCode = roomsCode.replace(
  /<Input label="Tầng \(tối đa 50\)" name="floor" type="number" value=\{formData\.floor\} onChange=\{\(v\) => setFormData\(\{ \.\.\.formData, floor: Math\.min\(parseInt\(v\) \|\| 1, 50\) \}\)\} min=\{1\} max=\{50\} required \/>/,
  `<Input label="Tầng (tối đa 50)" name="floor" type="number" value={formData.floor} onChange={(v) => setFormData({ ...formData, floor: v === '' ? '' : Math.min(parseInt(v) || 1, 50) })} min={1} max={50} required />`
);

roomsCode = roomsCode.replace(
  /<Input label="Sức chứa \(người\)" name="max_occupants" type="number" value=\{formData\.max_occupants\} onChange=\{\(v\) => setFormData\(\{ \.\.\.formData, max_occupants: parseInt\(v\) \|\| 2 \}\)\} min=\{1\} max=\{10\} required \/>/,
  `<Input label="Sức chứa (người)" name="max_occupants" type="number" value={formData.max_occupants} onChange={(v) => setFormData({ ...formData, max_occupants: v === '' ? '' : Math.min(parseInt(v) || 2, 10) })} min={1} max={10} required />`
);

// Add getImageUrl to imports if missing
if (!roomsCode.includes('getImageUrl')) {
  roomsCode = roomsCode.replace(
    /import \{([^}]+)getRooms([^}]+)\} from '\.\.\/lib\/api';/,
    "import {$1getRooms$2, getImageUrl} from '../lib/api';"
  );
}

// Modify PropertyCard to show image
roomsCode = roomsCode.replace(
  /<div\n\s+onClick=\{onView\}\n\s+className=\{`\$\{config\.bg\} px-6 py-5 border-b border-charcoal-100 cursor-pointer hover:brightness-\[0\.97\] transition-all`\}\n\s+>/,
  `<div
          onClick={onView}
          className={\`\${room.image_url ? '' : config.bg} px-6 py-5 border-b border-charcoal-100 cursor-pointer hover:brightness-[0.97] transition-all relative overflow-hidden\`}
        >
          {room.image_url && (
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 opacity-40" 
              style={{ backgroundImage: \`url(\${getImageUrl(room.image_url)})\` }} 
            />
          )}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={\`w-12 h-12 rounded-xl flex items-center justify-center \${config.iconBg}\`}>
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-charcoal-900 truncate max-w-[150px]" title={\`\${room.area} - P.\${room.room_number}\`}>{\`\${room.area} - P.\${room.room_number}\`}</h3>
                <p className="text-sm text-charcoal-600 font-medium">Tầng {room.floor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={room.status} variant={config.variant} size="sm" />`
);

// We need to carefully remove the original header inner contents because we appended them above to keep structure.
roomsCode = roomsCode.replace(
  /<div className="flex items-center justify-between">\n\s*<div className="flex items-center gap-4">\n\s*<div className=\{`w-12 h-12 rounded-xl flex items-center justify-center \$\{config\.iconBg\}`\}>\n\s*<DoorOpen className="w-5 h-5" \/>\n\s*<\/div>\n\s*<div>\n\s*<h3 className="text-xl font-semibold text-charcoal-900 truncate max-w-\[150px\]" title=\{`\$\{room\.area\} - P\.\$\{room\.room_number\}`\}>\{room\.area\} - P\.\{room\.room_number\}<\/h3>\n\s*<p className="text-sm text-charcoal-400">Tầng \{room\.floor\}<\/p>\n\s*<\/div>\n\s*<\/div>\n\s*<div className="flex items-center gap-2">\n\s*<Badge status=\{room\.status\} variant=\{config\.variant\} size="sm" \/>/,
  ``
);

fs.writeFileSync('src/pages/Rooms.tsx', roomsCode);
console.log("Patched TenantDashboard and Rooms");
