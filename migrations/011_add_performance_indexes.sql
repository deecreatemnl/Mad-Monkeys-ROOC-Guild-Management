-- Migration 011: Add performance indexes

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_uid ON members(uid);
CREATE INDEX IF NOT EXISTS idx_member_logs_member_id ON member_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_event_share_links_event_id ON event_share_links(event_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_raffle_stats_date ON raffle_stats(year, month, week);
