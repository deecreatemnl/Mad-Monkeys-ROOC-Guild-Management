-- Fix schema and add member_logs table
-- 1. Add status to members if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='status') THEN
        ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- 2. Add raffle_winners to settings if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='raffle_winners') THEN
        ALTER TABLE settings ADD COLUMN raffle_winners INTEGER DEFAULT 2;
    END IF;
END $$;

-- 3. Create member_logs table
CREATE TABLE IF NOT EXISTS member_logs (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_member_logs_member_id ON member_logs(member_id);

-- 5. Fix member_logs id type if it was created as integer (SERIAL)
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='member_logs' 
        AND column_name='id' 
        AND data_type='integer'
    ) THEN
        -- If it's an integer, we need to change it to TEXT to support timestamp-based IDs
        -- Dropping and recreating is the cleanest way for this log table
        DROP TABLE member_logs;
        CREATE TABLE member_logs (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            details TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_member_logs_member_id ON member_logs(member_id);
    END IF;
END $$;
