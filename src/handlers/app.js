/**
 * App information API handlers
 */
import { errorResponse, successResponse } from '../utils.js';
import { getAvailableApps, getAppSummary } from '../utils.js';

/**
 * Handles app information requests (GET /app)
 *
 * Supports different views:
 * - Default: Basic app summary
 * - ?view=dashboard: Detailed app dashboard
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID (optional for list endpoint)
 * @returns {Response} - The API response
 */
export async function handleAppInfo(request, db, app_id = null) {
    try {
        const url = new URL(request.url);
        const view = url.searchParams.get('view') || 'summary';

        // Handle apps listing (when no app_id is provided)
        if (!app_id) {
            const withStats = url.searchParams.get('stats') === 'true';
            return handleAppsList(db, withStats);
        }

        // Handle specific app views
        if (view === 'dashboard') {
            return handleAppDashboard(request, db, app_id);
        } else {
            // Default to summary view
            const summary = await getAppSummary(db, app_id);

            // Get recent activity
            const { results: recentEvents } = await db.prepare(`
        SELECT 
          event_type, 
          qualifier, 
          event_category as category,
          country,
          datetime(timestamp, 'unixepoch') as timestamp
        FROM events 
        WHERE app_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 5
      `).bind(app_id).all();

            return successResponse({
                ...summary,
                recent_events: recentEvents || []
            });
        }
    } catch (error) {
        console.error('App info error:', error);
        return errorResponse('Failed to retrieve app information', 500, error.message);
    }
}

/**
 * Handles apps listing requests
 *
 * @param {D1Database} db - The D1 database instance
 * @param {boolean} withStats - Whether to include stats for each app
 * @returns {Response} - The API response
 */
async function handleAppsList(db, withStats) {
    // Basic app list query
    const appIds = await getAvailableApps(db);

    if (!withStats) {
        return successResponse({
            apps: appIds
        });
    }

    // With stats summary
    const appStats = [];

    for (const appId of appIds) {
        const summary = await getAppSummary(db, appId);
        appStats.push(summary);
    }

    return successResponse({
        apps: appStats
    });
}

/**
 * Handles app dashboard data requests (aggregates multiple data points)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
async function handleAppDashboard(request, db, app_id) {
    // Get app summary
    const summary = await getAppSummary(db, app_id);

    // Get recent events (last 24 hours)
    const yesterday = Math.floor(Date.now() / 1000) - (60 * 60 * 24);
    const { results: recentActivity } = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      SUM(value) as total_value
    FROM events 
    WHERE app_id = ? AND timestamp >= ?
  `).bind(app_id, yesterday).all();

    // Get category breakdown
    const { results: categoryBreakdown } = await db.prepare(`
    SELECT category, SUM(value) as total
    FROM stats
    WHERE app_id = ?
    GROUP BY category
    ORDER BY total DESC
  `).bind(app_id).all();

    // Get country breakdown
    const { results: countryBreakdown } = await db.prepare(`
    SELECT 
      country, 
      COUNT(*) as event_count,
      SUM(value) as value_sum
    FROM events
    WHERE app_id = ? AND country IS NOT NULL
    GROUP BY country
    ORDER BY event_count DESC
    LIMIT 10
  `).bind(app_id).all();

    return successResponse({
        app_id,
        summary,
        recent_activity: {
            last_24h_events: recentActivity?.[0]?.count || 0,
            last_24h_value: recentActivity?.[0]?.total_value || 0
        },
        categories: categoryBreakdown || [],
        top_countries: countryBreakdown || []
    });
}