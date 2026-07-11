const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./csdl_hostelmate.sqlite');

db.run("INSERT INTO chat_messages (sender_id, sender_role, receiver_id, is_group_chat, content) VALUES ('admin-id-1', 'ADMIN', 'ALL', 1, 'Chào mọi người, đây là tin nhắn nhóm Tất cả khu trọ!')", (err) => {
  if (err) console.error(err);
  else console.log("Seeded group chat");
});
