const fs = require('fs');
let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

// Use a regular expression with \s* to ignore whitespace/newline differences
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
  fs.writeFileSync('src/pages/Rooms.tsx', code);
  console.log("Successfully replaced handleSave payload!");
} else {
  console.log("Regex did not match!");
}
