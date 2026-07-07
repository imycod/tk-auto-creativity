-- 3. 视频成品表
CREATE TABLE IF NOT EXISTS videos (
    video_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER UNIQUE NOT NULL,   -- 一个任务对应一个成功视频
    file_path       TEXT NOT NULL,
    duration        INTEGER,                     -- 秒
    resolution      TEXT,                        -- 如 '1080x1920'
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);