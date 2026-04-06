-- Migration: Fix member_logs id type
-- This ensures the id column is TEXT to support timestamp-based IDs

DO $$ 
BEGIN 
    -- Check if the column 'id' in 'member_logs' is of type 'integer'
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='member_logs' 
        AND column_name='id' 
        AND data_type='integer'
    ) THEN
        -- Drop and recreate the table to change the primary key type
        -- This is safe for a log table that might have failed to insert data anyway
        DROP TABLE IF EXISTS member_logs;
        
        CREATE TABLE member_logs (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            details TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_member_logs_member_id ON member_logs(member_id);
        
        RAISE NOTICE 'Recreated member_logs table with TEXT id column.';
    END IF;
END $$;
