CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_tenant_id TEXT,
    notification_type TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL,
    tenant_id TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    read_at DATETIME,
    FOREIGN KEY (notification_id) REFERENCES notifications(id),
    FOREIGN KEY (tenant_id) REFERENCES khach_thue(id)
);

CREATE TABLE IF NOT EXISTS notification_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL,
    sender_user_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id)
);
