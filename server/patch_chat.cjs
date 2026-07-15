const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /WHERE is_group_chat = 1 AND \(receiver_id = \? OR receiver_id IS NULL\)/g,
  "WHERE is_group_chat = 1 AND (group_type = ? OR group_type IS NULL)"
);

code = code.replace(
  /WHERE c.is_group_chat = 1 AND \(c.receiver_id = \? OR c.receiver_id IS NULL\)/g,
  "WHERE c.is_group_chat = 1 AND (c.group_type = ? OR c.group_type IS NULL)"
);

code = code.replace(
  /WHERE is_group_chat = 0 AND sender_id = \? AND receiver_id = 'ADMIN' AND is_read = 0/g,
  "WHERE is_group_chat = 0 AND sender_id = ? AND group_type = 'ADMIN' AND is_read = 0"
);

code = code.replace(
  /WHERE is_group_chat = 0 AND receiver_id = 'ADMIN' AND is_read = 0 AND is_deleted = 0/g,
  "WHERE is_group_chat = 0 AND group_type = 'ADMIN' AND is_read = 0 AND is_deleted = 0"
);

// Fix insert
code = code.replace(
  /INSERT INTO chat_messages \(sender_id, sender_role, receiver_id, is_group_chat, content\)\s+VALUES \(\?, \?, \?, \?, \?\)/,
  `INSERT INTO chat_messages (sender_id, sender_role, receiver_id, is_group_chat, content, group_type)
        VALUES (?, ?, ?, ?, ?, ?)`
);

code = code.replace(
  /\[senderId, req\.user\.role, targetId, is_group \? 1 : 0, content\]/g,
  "[senderId, req.user.role, is_group || targetId === 'ADMIN' ? null : targetId, is_group ? 1 : 0, content, is_group || targetId === 'ADMIN' ? targetId : null]"
);

// Fix target check
code = code.replace(
  /AND \(\(sender_id = \? AND receiver_id = \?\) OR \(sender_id = \? AND receiver_id = \?\)\)/g,
  "AND ((sender_id = ? AND (receiver_id = ? OR group_type = ?)) OR (sender_id = ? AND (receiver_id = ? OR group_type = ?)))"
);
code = code.replace(
  /\[target1, target2, target2, target1\]/g,
  "[target1, target2, target2, target2, target1, target1]"
);

fs.writeFileSync('server.js', code);
console.log('Patched server.js');
