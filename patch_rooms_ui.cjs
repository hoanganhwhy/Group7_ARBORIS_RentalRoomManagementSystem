const fs = require('fs');

let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// 1. Import getImageUrl
if (!code.includes('getImageUrl')) {
  code = code.replace(
    /import \{\n  getRooms,\n  createRoom,/,
    `import {\n  getRooms,\n  createRoom,\n  getImageUrl,`
  );
}

// 2. Add state for image file
if (!code.includes('const [imageFile, setImageFile]')) {
  code = code.replace(
    /const \[formData, setFormData\] = useState\(\{/,
    `const [imageFile, setImageFile] = useState<File | null>(null);\n    const [removeImage, setRemoveImage] = useState(false);\n    const [formData, setFormData] = useState({`
  );
}

// 3. Reset image file when opening modal
if (!code.includes('setImageFile(null);')) {
  code = code.replace(
    /setFormData\(\{ room_number: '', floor: 1, area_sqm: '', monthly_rent: '', max_occupants: 2, status: 'available', description: '', location: 'Cơ sở chính' \}\);\n\s*setIsModalOpen\(true\);/,
    `setFormData({ room_number: '', floor: 1, area_sqm: '', monthly_rent: '', max_occupants: 2, status: 'available', description: '', location: 'Cơ sở chính' });\n      setImageFile(null);\n      setRemoveImage(false);\n      setIsModalOpen(true);`
  );
  
  code = code.replace(
    /setEditingRoom\(room\);\n\s*setFormData\(\{/,
    `setEditingRoom(room);\n      setImageFile(null);\n      setRemoveImage(false);\n      setFormData({`
  );
}

// 4. Update handleSubmit
const submitRegex = /const payload = \{\n\s*\.\.\.formData,\n\s*area_sqm: parseFloat\(formData\.area_sqm as any\) \|\| 0,\n\s*monthly_rent: parseFloat\(formData\.monthly_rent as any\) \|\| 0,\n\s*\};\n\s*let savedRoom: Room;/;
if (code.match(submitRegex)) {
  code = code.replace(
    submitRegex,
    `const payload = new FormData();\n        payload.append('area', formData.location);\n        payload.append('room_number', formData.room_number);\n        payload.append('floor', formData.floor.toString());\n        payload.append('area_sqm', (parseFloat(formData.area_sqm as any) || 0).toString());\n        payload.append('monthly_rent', (parseFloat(formData.monthly_rent as any) || 0).toString());\n        payload.append('max_occupants', formData.max_occupants.toString());\n        payload.append('status', formData.status);\n        payload.append('description', formData.description);\n        if (imageFile) payload.append('image', imageFile);\n        if (removeImage) payload.append('remove_image', 'true');\n\n        let savedRoom: Room;`
  );
}

// 5. Update PropertyCard logic
const cardRegex = /const imageUrl = roomImages\[imageIndex\];/;
if (code.match(cardRegex)) {
  code = code.replace(
    cardRegex,
    `const imageUrl = getImageUrl(room.image_url) || roomImages[imageIndex];`
  );
}

// 6. Update Detail Modal
const detailImgRegex = /<img src=\{roomImages\[imageIndex\]\}/;
if (code.match(detailImgRegex)) {
  code = code.replace(
    detailImgRegex,
    `<img src={getImageUrl(viewingRoom?.image_url) || roomImages[imageIndex]}`
  );
}

// 7. Add file input to the form
const formRegex = /<Input label="Ghi chú"/;
if (code.match(formRegex)) {
  code = code.replace(
    formRegex,
    `<div className="space-y-1">
              <label className="block text-sm font-medium text-wood-800">Ảnh phòng (Tùy chọn)</label>
              {editingRoom?.image_url && !removeImage && !imageFile && (
                <div className="relative w-32 h-32 mb-2 rounded-lg overflow-hidden border border-cream-200">
                  <img src={getImageUrl(editingRoom.image_url) || ''} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setRemoveImage(true)} className="absolute top-1 right-1 bg-white/80 p-1 rounded hover:bg-red-50 text-red-500">
                    <PiTrashLight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {(removeImage || !editingRoom?.image_url || imageFile) && (
                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={(e) => {
                  setImageFile(e.target.files?.[0] || null);
                  setRemoveImage(false);
                }} className="w-full text-sm text-charcoal-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-wood-50 file:text-wood-700 hover:file:bg-wood-100" />
              )}
            </div>
            <Input label="Ghi chú"`
  );
}

fs.writeFileSync('src/pages/Rooms.tsx', code);
console.log('Patched Rooms.tsx successfully');
