// Event tracking API endpoint
import { determineCategory, errorResponse, successResponse } from '../utils.js';

/**
 * Handles event tracking requests (POST)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleTrackEvent(request, db, app_id) {
    try {
        // Parse the request body
        const data = await request.json();
        const {
            event_type,
            qualifier = null,
            value = 1,
            category = null,
            timestamp = Math.floor(Date.now() / 1000)
        } = data;

        // Validate inputs
        if (!event_type) {
            return errorResponse('Missing event_type', 400);
        }

        // Determine category if not provided
        const event_category = category || determineCategory(event_type);

        // Create the metric key (e.g., "install" or "purchase.lifetime")
        const metric = qualifier ? `${event_type}.${qualifier}` : event_type;

        // Start a transaction to update both tables
        const stmt1 = db.prepare(
            "INSERT INTO events (app_id, event_type, event_category, qualifier, value, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(app_id, event_type, event_category, qualifier, value, timestamp);

        const stmt2 = db.prepare(`
            INSERT INTO stats (app_id, metric, category, value, last_updated)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT (app_id, metric) DO
            UPDATE
                SET value = value + ?, last_updated = ?
        `).bind(app_id, metric, event_category, value, timestamp, value, timestamp);

        await db.batch([stmt1, stmt2]);

        // Get the updated counter value
        const result = await db.prepare(
            "SELECT value FROM stats WHERE app_id = ? AND metric = ?"
        ).bind(app_id, metric).first();

        const currentValue = result?.value || value;

        return successResponse({
            success: true,
            app_id,
            metric,
            category: event_category,
            value: currentValue,
            timestamp
        });
    } catch (error) {
        console.error('Track event error:', error);
        return errorResponse('Failed to track event', 500, error.message);
    }
}

/**
 * Handles batch event tracking requests (POST)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleBatchTrackEvents(request, db, app_id) {
    try {
        // Parse the request body
        const data = await request.json();

        if (!Array.isArray(data.events) || data.events.length === 0) {
            return errorResponse('Missing or empty events array', 400);
        }

        // Maximum batch size for safety
        if (data.events.length > 100) {
            return errorResponse('Batch size exceeds maximum (100)', 400);
        }

        const defaultTimestamp = Math.floor(Date.now() / 1000);
        const statements = [];
        const results = [];

        // Process each event
        for (const event of data.events) {
            if (!event.event_type) {
                return errorResponse('Missing event_type in batch item', 400);
            }

            const {
                event_type,
                qualifier = null,
                value = 1,
                category = null,
                timestamp = defaultTimestamp
            } = event;

            // Determine category if not provided
            const event_category = category || determineCategory(event_type);

            // Create the metric key (e.g., "install" or "purchase.lifetime")
            const metric = qualifier ? `${event_type}.${qualifier}` : event_type;

            // Add statements for events table
            statements.push(
                db.prepare(
                    "INSERT INTO events (app_id, event_type, event_category, qualifier, value, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
                ).bind(app_id, event_type, event_category, qualifier, value, timestamp)
            );

            // Add statements for stats table
            statements.push(
                db.prepare(`
                    INSERT INTO stats (app_id, metric, category, value, last_updated)
                    VALUES (?, ?, ?, ?, ?) ON CONFLICT (app_id, metric) DO
                    UPDATE
                        SET value = value + ?, last_updated = ?
                `).bind(app_id, metric, event_category, value, timestamp, value, timestamp)
            );

            results.push({
                event_type,
                qualifier,
                metric,
                category: event_category
            });
        }

        // Execute all statements in a batch
        await db.batch(statements);

        return successResponse({
            success: true,
            app_id,
            processed: results.length,
            events: results
        });
    } catch (error) {
        console.error('Batch track events error:', error);
        return errorResponse('Failed to track batch events', 500, error.message);
    }
}

/**
 * Handles event history retrieval (GET)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleEventHistory(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Optional parameters
        const event_type = url.searchParams.get('type');
        const category = url.searchParams.get('category');
        const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
        const fromDate = url.searchParams.get('from') ?
            Math.floor(new Date(url.searchParams.get('from')).getTime() / 1000) :
            Math.floor(Date.now() / 1000) - (60 * 60 * 24); // 24 hours ago

        // Build query
        let query = `
            SELECT id, event_type, event_category, qualifier, value, 
                   datetime(timestamp, 'unixepoch') as timestamp
            FROM events
            WHERE app_id = ?
              AND timestamp >= ?
        `;

        let params = [app_id, fromDate];

        if (event_type) {
            query += " AND event_type = ?";
            params.push(event_type);
        }

        if (category) {
            query += " AND event_category = ?";
            params.push(category);
        }

        query += " ORDER BY timestamp DESC LIMIT ?";
        params.push(limit);

        // Execute query
        const { results } = await db.prepare(query).bind(...params).all();

        return successResponse({
            app_id,
            from: new Date(fromDate * 1000).toISOString(),
            count: results.length,
            events: results || []
        });
    } catch (error) {
        console.error('Event history error:', error);
        return errorResponse('Failed to retrieve event history', 500, error.message);
    }
}