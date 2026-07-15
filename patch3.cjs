const fs = require('fs');

let code = fs.readFileSync('src/pages/Rooms.tsx', 'utf8');

code = code.replace(
  /const payload = \{\n\s+\.\.\.formData,\n\s+floor: parseInt\(formData\.floor as any\) \|\| 1,\n\s+max_occupants: parseInt\(formData\.max_occupants as any\) \|\| 1,\n\s+area_sqm: parseFloat\(formData\.area_sqm as any\) \|\| 0,\n\s+monthly_rent: parseFloat\(formData\.monthly_rent as any\) \|\| 0,\n\s+\};\n\s+if \(editingRoom\) \{\n\s+await updateRoom\(editingRoom\.id, payload\);\n\s+\} else \{\n\s+await createRoom\(payload\);\n\s+\}/,
  `const payload = {
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
        }`
);

fs.writeFileSync('src/pages/Rooms.tsx', code);
console.log('Done patching Rooms.tsx!');
