CREATE TABLE task_queue (
    queue_id INTEGER PRIMARY KEY AUTOINCREMENT,

    task_id INTEGER NOT NULL,

    stage TEXT CHECK(stage IN (
        'init',
        'preprocess',
        'rendering',
        'postprocess'
    )) DEFAULT 'init',

    status TEXT CHECK(status IN (
        'pending',
        'processing',
        'submitted',
        'completed',
        'failed',
        'retrying'
    )) DEFAULT 'pending',

    retry_count INTEGER DEFAULT 0,

    worker_id TEXT,

    profile_index INTEGER,

    render_index INTEGER,

    error_message TEXT,

    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
