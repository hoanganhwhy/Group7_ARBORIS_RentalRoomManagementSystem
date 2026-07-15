const fs = require('fs');

let roomsCode = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// Fix the flex layout issue
roomsCode = roomsCode.replace(
  /<div className="relative z-10 flex items-center justify-between">\n\s*<div className="flex items-center gap-4">/,
  `<div className="relative z-10 flex items-center justify-between gap-2">\n            <div className="flex items-center gap-4 min-w-0 flex-1">`
);

// Add the file input to the form
// Find the area after status select
const insertInputBefore = `            <div className="flex justify-end gap-3 mt-8">`;
const fileInputUI = `
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-charcoal-700">Ảnh đại diện phòng</label>
              <div className="flex items-center gap-4">
                {editingRoom?.image_url && !removeImage && !imageFile && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-charcoal-200">
                    <img src={getImageUrl(editingRoom.image_url)} alt="Room" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setRemoveImage(true)}
                      className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-rose-600 hover:bg-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImageFile(e.target.files[0]);
                      setRemoveImage(false);
                    }
                  }}
                  className="block w-full text-sm text-charcoal-500
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-xl file:border-0
                    file:text-sm file:font-semibold
                    file:bg-sage-50 file:text-sage-700
                    hover:file:bg-sage-100 transition-all
                    cursor-pointer"
                />
              </div>
              <p className="text-xs text-charcoal-400 mt-1">Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa 5MB)</p>
            </div>
`;

if (!roomsCode.includes('Ảnh đại diện phòng')) {
  roomsCode = roomsCode.replace(insertInputBefore, fileInputUI + insertInputBefore);
}

fs.writeFileSync('src/pages/Rooms.tsx', roomsCode);
console.log("Patched Rooms UI");
