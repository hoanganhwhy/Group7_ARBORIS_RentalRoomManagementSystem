const fs = require('fs');

let roomsCode = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

const oldHeaderRegex = /<div\s+onClick=\{onView\}\s+className=\{`\$\{room\.image_url \? '' : config\.bg\} px-6 py-5 border-b border-charcoal-100 cursor-pointer \nhover:brightness-\[0\.97\] transition-all relative overflow-hidden`\}\s+>\s+\{room\.image_url && \(\s+<div \s+className="absolute inset-0 bg-cover bg-center z-0 opacity-40" \s+style=\{\{ backgroundImage: `url\(\$\{getImageUrl\(room\.image_url\)\}\)` \}\} \s+\/>\s+\)\}\s+<div className="relative z-10 flex items-center justify-between">\s+<div className="flex items-center gap-4">\s+<div className=\{`w-12 h-12 rounded-xl flex items-center justify-center \$\{config\.iconBg\}`\}>\s+<DoorOpen className="w-5 h-5" \/>\s+<\/div>\s+<div>\s+<h3 className="text-xl font-semibold text-charcoal-900 truncate max-w-\[150px\]" title=\{`\$\{room\.area\} - \nP\.\$\{room\.room_number\}`\}>\{room\.area\} - P\.\{room\.room_number\}<\/h3>\s+<p className="text-sm text-charcoal-400">Tầng \{room\.floor\}<\/p>\s+<\/div>\s+<\/div>\s+<div className="flex items-center gap-2">\s+<Badge status=\{room\.status\} variant=\{config\.variant\} size="sm" \/>\s+<div className="w-7 h-7 rounded-lg bg-white\/60 flex items-center justify-center">\s+<Info className="w-3\.5 h-3\.5 text-charcoal-400" \/>\s+<\/div>\s+<\/div>\s+<\/div>\s+<\/div>/;

const primaryTenant = "room.active_assignments?.find(a => a.is_primary)?.tenant?.full_name || room.active_assignments?.[0]?.tenant?.full_name || 'Khách thuê'";

const newHeader = `<div onClick={onView} className="room-card-image cursor-pointer hover:brightness-[0.97] transition-all">
          <img
            src={room.image_url ? getImageUrl(room.image_url) : "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80"}
            alt={\`Phòng \${room.room_number}\`}
          />

          <div className="room-card-overlay">
            <div>
              <div className="room-location">⌖ {room.area}</div>
              <div className="room-number truncate">P.{room.room_number}</div>
              <div className="room-owner truncate">{${primaryTenant}}</div>
            </div>

            <div className="room-rent">
              <strong>
                {Number(room.monthly_rent || 0).toLocaleString("vi-VN")}đ
              </strong>
              <span>GIÁ THUÊ / THÁNG</span>
            </div>
          </div>
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <Badge status={room.status} variant={config.variant} size="sm" />
          </div>
        </div>`;

if (roomsCode.match(oldHeaderRegex)) {
  roomsCode = roomsCode.replace(oldHeaderRegex, newHeader);
} else {
  const parts = roomsCode.split('{/* Header — clickable to view detail */}');
  if (parts.length > 1) {
    const afterHeader = parts[1].split('{/* Body */}');
    if (afterHeader.length > 1) {
      roomsCode = parts[0] + '{/* Header — clickable to view detail */}\n        ' + newHeader + '\n\n        {/* Body */}' + afterHeader[1];
    }
  }
}

fs.writeFileSync('src/pages/Rooms.tsx', roomsCode);
console.log("PropertyCard Patched");
