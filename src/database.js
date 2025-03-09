// Database utilities

/**
 * Get all available app IDs in the database
 *
 * @param {D1Database} db - The D1 database instance
 * @returns {Array} - List of app IDs
 */
export async function getAvailableApps(db) {
    try {
        const { results } = await db.prepare(
            "SELECT DISTINCT app_id FROM stats ORDER BY app_id"
        ).all();

        return results ? results.map(row => row.app_id) : [];
    } catch (error) {
        console.error("Error fetching app IDs:", error);
        return [];
    }
}

/**
 * Get application summary data
 *
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - Application ID
 * @returns {Object} - Application summary data
 */
export async function getAppSummary(db, app_id) {
    try {
        // Get event count
        const eventCount = await db.prepare(
            "SELECT COUNT(*) as count FROM events WHERE app_id = ?"
        ).bind(app_id).first();

        // Get metric count
        const metricCount = await db.prepare(
            "SELECT COUNT(*) as count FROM stats WHERE app_id = ?"
        ).bind(app_id).first();

        // Get last activity
        const lastActivity = await db.prepare(
            "SELECT MAX(timestamp) as last_activity FROM events WHERE app_id = ?"
        ).bind(app_id).first();

        // Get category breakdown
        const { results: categories } = await db.prepare(
            "SELECT category, COUNT(*) as count FROM stats WHERE app_id = ? GROUP BY category"
        ).bind(app_id).all();

        const categoryBreakdown = {};
        if (categories) {
            categories.forEach(row => {
                categoryBreakdown[row.category || 'general'] = row.count;
            });
        }

        return {
            app_id,
            event_count: eventCount?.count || 0,
            metric_count: metricCount?.count || 0,
            last_activity: lastActivity?.last_activity ?
                new Date(lastActivity.last_activity * 1000).toISOString() : null,
            categories: categoryBreakdown
        };
    } catch (error) {
        console.error(`Error getting app summary for ${app_id}:`, error);
        throw error;
    }
}