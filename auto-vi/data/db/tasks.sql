/*
描述“业务意图”
不关心素材细节
不关心执行过程
*/
CREATE TABLE tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,

    prompt_text TEXT NOT NULL,

    status TEXT CHECK(status IN (
        'pending',
        'queued',
        'processing',
        'completed',
        'failed'
    )) DEFAULT 'pending',

    product_id TEXT,
    batch_date DATE,

    duration INTEGER NOT NULL DEFAULT 10 CHECK(duration >= 4 AND duration <= 15),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);