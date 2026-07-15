const fs = require('fs');

let cssCode = fs.readFileSync('src/index.css', 'utf8');

const newCss = `
/* CSS cho ảnh phòng từ user */
.room-image-selector {
  position: relative;
  display: block;
  width: 100%;
  height: 210px;
  margin-top: 8px;
  padding: 0;
  overflow: hidden;

  cursor: pointer;
  border: 1px solid #ddd;
  border-radius: 18px;
  background: #f7f7f7;
}

.room-image-selector img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.change-image-overlay {
  position: absolute;
  inset: 0;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  color: white;
  background: rgba(0, 0, 0, 0);
  opacity: 0;
  transition: 0.2s;
}

.room-image-selector:hover .change-image-overlay {
  background: rgba(0, 0, 0, 0.45);
  opacity: 1;
}

.change-image-overlay span {
  font-size: 28px;
}

.change-image-overlay strong {
  margin-top: 5px;
  font-size: 14px;
}

.image-help {
  margin: 7px 0 0;
  color: #888;
  font-size: 12px;
}
`;

if (!cssCode.includes('.room-image-selector')) {
  cssCode += '\n' + newCss;
  fs.writeFileSync('src/index.css', cssCode);
}

let roomsCode = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// The new UI uses useRef. Let's make sure useRef is imported if not already.
if (!roomsCode.includes('useRef')) {
  roomsCode = roomsCode.replace(/import React, \{ useState, useMemo/g, 'import React, { useState, useMemo, useRef');
  roomsCode = roomsCode.replace(/import \{ useState, useEffect/g, 'import { useState, useEffect, useRef');
}

// Add the fileInputRef inside the component
if (!roomsCode.includes('fileInputRef = useRef')) {
  roomsCode = roomsCode.replace(
    /const \[imageFile, setImageFile\] = useState<File \| null>\(null\);/g,
    `const fileInputRef = useRef<HTMLInputElement>(null);\n  const [imageFile, setImageFile] = useState<File | null>(null);`
  );
}

// Replace the old form image upload UI with the new one
const oldFormImageUI = /<div className="space-y-2 col-span-2">[\s\S]*?<\/div>\s*<div className="flex justify-end gap-3 mt-8">/;

const defaultImage = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80";

const newFormImageUI = `<div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-charcoal-700">Ảnh phòng</label>

              <button
                type="button"
                className="room-image-selector"
                onClick={() => fileInputRef.current?.click()}
              >
                <img 
                  src={imageFile ? URL.createObjectURL(imageFile) : (editingRoom?.image_url && !removeImage ? getImageUrl(editingRoom.image_url) : "${defaultImage}")} 
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
            </div>
            
            <div className="flex justify-end gap-3 mt-8">`;

if (roomsCode.match(oldFormImageUI)) {
  roomsCode = roomsCode.replace(oldFormImageUI, newFormImageUI);
} else {
  console.log("Could not find the old image form UI!");
}

fs.writeFileSync('src/pages/Rooms.tsx', roomsCode);
console.log("Applied User CSS and UI changes to Rooms.tsx form image selector");
