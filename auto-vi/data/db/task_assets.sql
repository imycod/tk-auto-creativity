CREATE TABLE task_assets (
    asset_id INTEGER PRIMARY KEY AUTOINCREMENT,

    task_id INTEGER NOT NULL,

    asset_type TEXT CHECK(asset_type IN (
        'image',
        'video',
        'audio'
    )) NOT NULL,

    asset_path TEXT NOT NULL,

    sort_order INTEGER DEFAULT 0,

    meta TEXT, -- JSON 扩展字段（宽高/时长/来源）

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);