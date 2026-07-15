const fs = require('fs');

function applyAllPatches() {
  let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

  // 1. Add imageFile states and useRef
  if (!code.includes('useRef')) {
    code = code.replace(/import \{ useEffect, useState \} from 'react';/, "import { useEffect, useState, useRef } from 'react';");
  }

  if (!code.includes('imageFile')) {
    code = code.replace(
      /const \[saving, setSaving\] = useState\(false\);/,
      `const [saving, setSaving] = useState(false);\n  const [imageFile, setImageFile] = useState<File | null>(null);\n  const [removeImage, setRemoveImage] = useState(false);\n  const fileInputRef = useRef<HTMLInputElement>(null);`
    );
  }

  // 2. Fix the handleSave payload logic!
  const oldHandleSaveTargetRegex = /const payload = \{\s*\.\.\.formData,\s*floor: parseInt\(formData\.floor as any\) \|\| 1,\s*max_occupants: parseInt\(formData\.max_occupants as any\) \|\| 1,\s*area_sqm: parseFloat\(formData\.area_sqm as any\) \|\| 0,\s*monthly_rent: parseFloat\(formData\.monthly_rent as any\) \|\| 0,\s*\};\s*if \(editingRoom\) \{\s*await updateRoom\(editingRoom\.id, payload\);\s*\} else \{\s*await createRoom\(payload\);\s*\}/;

  const newHandleSaveTarget = `const payload = {
          ...formData,
          floor: parseInt(formData.floor as any) || 1,
          max_occupants: parseInt(formData.max_occupants as any) || 1,
          area_sqm: parseFloat(formData.area_sqm as any) || 0,
          monthly_rent: parseFloat(formData.monthly_rent as any) || 0,
        };
        
        const formDataPayload = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formDataPayload.append(key, value as string);
        });
        if (imageFile) {
          formDataPayload.append('image', imageFile);
        }
        if (removeImage) {
          formDataPayload.append('remove_image', 'true');
        }

        if (editingRoom) {
          await updateRoom(editingRoom.id, formDataPayload as any);
        } else {
          await createRoom(formDataPayload as any);
        }`;

  if (code.match(oldHandleSaveTargetRegex)) {
    code = code.replace(oldHandleSaveTargetRegex, newHandleSaveTarget);
  }

  // 3. Add image upload UI to form
  const formUI = `            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-charcoal-700">Ảnh phòng</label>

              <button
                type="button"
                className="room-image-selector"
                onClick={() => fileInputRef.current?.click()}
              >
                <img 
                  src={imageFile ? URL.createObjectURL(imageFile) : (editingRoom?.image_url && !removeImage ? getImageUrl(editingRoom.image_url) : "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80")} 
                  alt="Ảnh phòng" 
                />

                <div className="change-image-overlay">
                  <span>📷</span>
                  <strong>Thay ảnh</strong>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                  if (!allowedTypes.includes(file.type)) {
                    alert("Chỉ được chọn ảnh JPG, PNG hoặc WEBP");
                    e.target.value = "";
                    return;
                  }
              
                  if (file.size > 5 * 1024 * 1024) {
                    alert("Ảnh không được lớn hơn 5MB");
                    e.target.value = "";
                    return;
                  }
              
                  setImageFile(file);
                  setRemoveImage(false);
                }}
                className="hidden"
                style={{ display: 'none' }}
              />

              <p className="image-help">
                Bấm vào ảnh để chọn ảnh khác. Tối đa 5MB.
              </p>
              {editingRoom?.image_url && !removeImage && !imageFile && (
                <button type="button" onClick={() => setRemoveImage(true)} className="text-rose-600 text-sm mt-1">Xóa ảnh hiện tại</button>
              )}
            </div>
            
            <Input label="Ghi chú"`;

  if (!code.includes('Ảnh phòng')) {
    code = code.replace(/<Input label="Ghi chú"/, formUI);
  }

  // 4. PropertyCard UI
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

  if (code.match(oldHeaderRegex)) {
    code = code.replace(oldHeaderRegex, newHeader);
  } else {
    const parts = code.split('{/* Header — clickable to view detail */}');
    if (parts.length > 1) {
      const afterHeader = parts[1].split('{/* Body */}');
      if (afterHeader.length > 1) {
        code = parts[0] + '{/* Header — clickable to view detail */}\n        ' + newHeader + '\n\n        {/* Body */}' + afterHeader[1];
      }
    }
  }

  // 5. Add getImageUrl to imports
  if (!code.includes('getImageUrl} from \'../lib/api\'')) {
    code = code.replace(
      /extendContract,\s*\}\s*from\s*'..\/lib\/api';/,
      "extendContract,\n  getImageUrl,\n} from '../lib/api';"
    );
  }

  // 6. Reset imageFile state in openEditModal and openCreateModal
  const openCreateModalRegex = /function openCreateModal\(\) \{\s*setEditingRoom\(null\);/;
  if (code.match(openCreateModalRegex)) {
    code = code.replace(openCreateModalRegex, "function openCreateModal() {\n    setEditingRoom(null);\n    setImageFile(null);\n    setRemoveImage(false);");
  }

  const openEditModalRegex = /function openEditModal\(room: Room\) \{\s*setEditingRoom\(room\);/;
  if (code.match(openEditModalRegex)) {
    code = code.replace(openEditModalRegex, "function openEditModal(room: Room) {\n    setEditingRoom(room);\n    setImageFile(null);\n    setRemoveImage(false);");
  }

  fs.writeFileSync('src/pages/Rooms.tsx', code);
  console.log("All patches applied successfully");
}

applyAllPatches();
