/**
 * Utility functions for Applytics API
 */

/**
 * Create a consistent error response
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string|Object} details - Additional error details
 * @returns {Response} - Error response
 */
export function errorResponse(message, status = 500, details = null) {
    const error = {
        error: message
    };
    if (details) {
        error.details = details;
    }
    return new Response(
        JSON.stringify(error),
        {
            status: status,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Create a successful response
 *
 * @param {Object|Array} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response} - Success response
 */
export function successResponse(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status: status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            }
        }
    );
}

/**
 * Determine the category based on event type
 *
 * @param {string} eventType - The event type
 * @returns {string} - The determined category
 */
export function determineCategory(eventType) {
    // Common categorization patterns
    if (eventType.startsWith('purchase') || eventType.includes('payment') || eventType.includes('subscription')) {
        return 'revenue';
    }
    if (eventType === 'install' || eventType === 'uninstall' || eventType.includes('update')) {
        return 'lifecycle';
    }
    if (eventType.includes('view') || eventType.includes('screen') || eventType.includes('page')) {
        return 'engagement';
    }
    if (eventType.includes('click') || eventType.includes('tap') || eventType.includes('swipe')) {
        return 'interaction';
    }
    if (eventType.includes('error') || eventType.includes('crash') || eventType.includes('exception')) {
        return 'error';
    }
    if (eventType.includes('user') || eventType.includes('account') || eventType.includes('login')) {
        return 'user';
    }
    // Default category
    return 'general';
}

/**
 * Parse pagination parameters from request URL
 *
 * @param {URL} url - The request URL
 * @returns {Object} - Pagination parameters
 */
export function getPaginationParams(url) {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;
    return { page, pageSize, offset };
}

/**
 * Parse a date parameter and return a timestamp
 *
 * @param {string|null} dateParam - The date parameter from URL
 * @param {number} daysAgo - Default days ago if param is not provided
 * @returns {number} Unix timestamp
 */
export function parseDateParam(dateParam, daysAgo = 0) {
    if (dateParam) {
        return Math.floor(new Date(dateParam).getTime() / 1000);
    }

    // Default: Current time minus specified days
    return Math.floor(Date.now() / 1000) - (60 * 60 * 24 * daysAgo);
}

/**
 * Get SQL time grouping expression for the given period
 *
 * @param {string} period - The time period ('hour', 'day', 'week', 'month')
 * @returns {string|null} The SQLite time grouping expression or null if invalid
 */
export function getTimeGroupExpression(period) {
    switch (period) {
        case 'hour':
            return "strftime('%Y-%m-%d %H:00:00', datetime(timestamp, 'unixepoch'))";
        case 'day':
            return "strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch'))";
        case 'week':
            return "strftime('%Y-%W', datetime(timestamp, 'unixepoch'))";
        case 'month':
            return "strftime('%Y-%m', datetime(timestamp, 'unixepoch'))";
        default:
            return null;
    }
}

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

/**
 * Insert an event and update associated stats
 *
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - Application ID
 * @param {string} event_type - Event type
 * @param {string} event_category - Event category
 * @param {string|null} qualifier - Event qualifier
 * @param {number} value - Event value
 * @param {number} timestamp - Event timestamp
 * @param {string|null} country - Country code
 * @returns {Array} - Array of database statements
 */
export function createEventStatements(db, app_id, event_type, event_category, qualifier, value, timestamp, country) {
    // Create the metric key
    const metric = qualifier ? `${event_type}.${qualifier}` : event_type;

    // Statement for events table
    const eventStmt = db.prepare(
        "INSERT INTO events (app_id, event_type, event_category, qualifier, value, timestamp, country) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(app_id, event_type, event_category, qualifier, value, timestamp, country);

    // Statement for stats table
    const statsStmt = db.prepare(`
    INSERT INTO stats (app_id, metric, category, value, last_updated)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT (app_id, metric) DO
    UPDATE
      SET value = value + ?, last_updated = ?
  `).bind(app_id, metric, event_category, value, timestamp, value, timestamp);

    return [eventStmt, statsStmt];
}