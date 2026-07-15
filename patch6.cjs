const fs = require('fs');

let cssCode = fs.readFileSync('src/index.css', 'utf8');

const newCss = `
/* CSS cho ảnh phòng từ user */
.image-upload {
  display: block;
  width: 100%;
  height: 190px;
  margin-top: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px dashed #c9c9c9;
  border-radius: 18px;
  background: #fafafa;
}

.image-upload input {
  display: none;
}

.image-upload img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.image-upload-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.image-upload-placeholder span {
  font-size: 30px;
}

.image-upload-placeholder p {
  margin: 5px 0 0;
}

/* CSS cho card hiển thị */
.room-card-image {
  position: relative;
  width: 100%;
  height: 210px;
  overflow: hidden;
}

.room-card-image > img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.room-card-image::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.75),
    rgba(0, 0, 0, 0) 70%
  );
}

.room-card-overlay {
  position: absolute;
  z-index: 1;
  right: 18px;
  bottom: 15px;
  left: 18px;

  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(100px, auto);
  gap: 12px;
  align-items: end;
  color: white;
}

.room-number {
  font-size: 28px;
  font-weight: 600;
}

.room-location,
.room-owner,
.room-rent span {
  font-size: 11px;
}

.room-rent {
  min-width: 0;
  text-align: right;
}

.room-rent strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(17px, 4vw, 25px);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.room-rent span {
  display: block;
  margin-top: 3px;
}
`;

if (!cssCode.includes('.room-card-image')) {
  cssCode += '\n' + newCss;
  fs.writeFileSync('src/index.css', cssCode);
}

let roomsCode = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// Replace the old header with the new room-card-image structure
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
  // If the previous regex fails due to line breaks, fallback replace logic using split
  const parts = roomsCode.split('{/* Header — clickable to view detail */}');
  if (parts.length > 1) {
    const afterHeader = parts[1].split('{/* Body */}');
    if (afterHeader.length > 1) {
      roomsCode = parts[0] + '{/* Header — clickable to view detail */}\n        ' + newHeader + '\n\n        {/* Body */}' + afterHeader[1];
    }
  }
}

// Replace the form image upload UI with the user's new CSS-based UI
const oldFormImageUI = /<div className="space-y-2 col-span-2">\s*<label className="text-sm font-medium text-charcoal-700">Ảnh đại diện phòng<\/label>[\s\S]*?<p className="text-xs text-charcoal-400 mt-1">Hỗ trợ định dạng JPG, PNG, WEBP \(Tối đa 5MB\)<\/p>\s*<\/div>/;

const newFormImageUI = `<div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-charcoal-700">Ảnh phòng</label>

              <label className="image-upload">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImageFile(e.target.files[0]);
                      setRemoveImage(false);
                    }
                  }}
                />

                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="Ảnh xem trước" />
                ) : editingRoom?.image_url && !removeImage ? (
                  <img src={getImageUrl(editingRoom.image_url)} alt="Ảnh hiện tại" />
                ) : (
                  <div className="image-upload-placeholder">
                    <span>＋</span>
                    <p>Chọn ảnh phòng</p>
                  </div>
                )}
              </label>
              {editingRoom?.image_url && !removeImage && !imageFile && (
                <button type="button" onClick={() => setRemoveImage(true)} className="text-rose-600 text-sm mt-1">Xóa ảnh hiện tại</button>
              )}
            </div>`;

if (roomsCode.match(oldFormImageUI)) {
  roomsCode = roomsCode.replace(oldFormImageUI, newFormImageUI);
}

fs.writeFileSync('src/pages/Rooms.tsx', roomsCode);
console.log("Applied User CSS and UI changes to Rooms.tsx");
