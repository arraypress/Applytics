-- Events table
DROP TABLE IF EXISTS events;
CREATE TABLE events (
                        id INTEGER PRIMARY KEY,
                        app_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        event_category TEXT DEFAULT 'general',
                        qualifier TEXT,
                        value INTEGER DEFAULT 1,
                        timestamp INTEGER NOT NULL,
                        country TEXT
);
CREATE INDEX idx_events_app ON events (app_id, event_type, qualifier);
CREATE INDEX idx_events_time ON events (timestamp);
CREATE INDEX idx_events_category ON events (app_id, event_category);
CREATE INDEX idx_events_country ON events (app_id, country, timestamp);

-- Stats table
DROP TABLE IF EXISTS stats;
CREATE TABLE stats (
                       id INTEGER PRIMARY KEY,
                       app_id TEXT NOT NULL,
                       metric TEXT NOT NULL,
                       category TEXT DEFAULT 'general',
                       value INTEGER DEFAULT 0,
                       last_updated INTEGER NOT NULL,
                       UNIQUE(app_id, metric)
);
CREATE INDEX idx_stats_lookup ON stats (app_id, metric);
CREATE INDEX idx_stats_category ON stats (app_id, category);