const fs = require('fs');
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
const oldHandleSaveTarget = `      setSaving(true);
      try {
        const payload = {
          ...formData,
          floor: parseInt(formData.floor as any) || 1,
          max_occupants: parseInt(formData.max_occupants as any) || 1,
          area_sqm: parseFloat(formData.area_sqm as any) || 0,
          monthly_rent: parseFloat(formData.monthly_rent as any) || 0,
        };
        if (editingRoom) {
          await updateRoom(editingRoom.id, payload);
        } else {
          await createRoom(payload);
        }`;

const newHandleSaveTarget = `      setSaving(true);
      try {
        const payload = {
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

code = code.replace(oldHandleSaveTarget, newHandleSaveTarget);

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

fs.writeFileSync('src/pages/Rooms.tsx', code);
console.log("States, handleSave payload, and Form UI patched");
