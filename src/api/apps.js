// Apps API endpoints
import { errorResponse, successResponse } from '../utils.js';
import { getAvailableApps, getAppSummary } from '../database.js';

/**
 * Handles apps listing requests
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @returns {Response} - The API response
 */
export async function handleAppsQuery(request, db) {
    try {
        const url = new URL(request.url);
        const withStats = url.searchParams.get('stats') === 'true';

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
    } catch (error) {
        console.error('Apps query error:', error);
        return errorResponse('Failed to retrieve apps data', 500, error.message);
    }
}

/**
 * Handles app summary requests
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleAppSummary(request, db, app_id) {
    try {
        const summary = await getAppSummary(db, app_id);

        // Get recent activity
        const { results: recentEvents } = await db.prepare(`
            SELECT 
                event_type, 
                qualifier, 
                event_category as category,
                datetime(timestamp, 'unixepoch') as timestamp
            FROM events 
            WHERE app_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 5
        `).bind(app_id).all();

        // Get top metrics
        const { results: topMetrics } = await db.prepare(`
            SELECT metric, value, category
            FROM stats
            WHERE app_id = ?
            ORDER BY value DESC
            LIMIT 5
        `).bind(app_id).all();

        return successResponse({
            ...summary,
            recent_events: recentEvents || [],
            top_metrics: topMetrics || []
        });
    } catch (error) {
        console.error('App summary error:', error);
        return errorResponse('Failed to retrieve app summary', 500, error.message);
    }
}

/**
 * Handles app dashboard data requests (aggregates multiple data points)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleAppDashboard(request, db, app_id) {
    try {
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

        // Get trending metrics (highest increase in last 7 days)
        const lastWeek = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 7);
        const { results: trendingMetrics } = await db.prepare(`
            SELECT 
                event_type as metric,
                COUNT(*) as count,
                SUM(value) as value_sum
            FROM events
            WHERE app_id = ? AND timestamp >= ?
            GROUP BY event_type
            ORDER BY count DESC, value_sum DESC
            LIMIT 5
        `).bind(app_id, lastWeek).all();

        return successResponse({
            app_id,
            summary,
            recent_activity: {
                last_24h_events: recentActivity?.[0]?.count || 0,
                last_24h_value: recentActivity?.[0]?.total_value || 0
            },
            categories: categoryBreakdown || [],
            trending: trendingMetrics || []
        });
    } catch (error) {
        console.error('App dashboard error:', error);
        return errorResponse('Failed to retrieve app dashboard data', 500, error.message);
    }
}