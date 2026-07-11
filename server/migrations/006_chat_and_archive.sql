CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    receiver_id TEXT, -- NULL if group chat
    is_group_chat INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Thêm cột is_deleted và deleted_at vào notifications
ALTER TABLE notifications ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN deleted_at DATETIME;

-- Thêm cột is_deleted và deleted_at vào notification_recipients
ALTER TABLE notification_recipients ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE notification_recipients ADD COLUMN deleted_at DATETIME;

-- Thêm cột is_deleted và deleted_at vào notification_replies
ALTER TABLE notification_replies ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE notification_replies ADD COLUMN deleted_at DATETIME;
