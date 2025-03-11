/**
 * Event tracking API handlers
 */
import { errorResponse, successResponse, determineCategory, parseDateParam } from '../utils.js';
import { createEventStatements } from '../utils.js';

/**
 * Handles event tracking requests (POST /track)
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
            timestamp = Math.floor(Date.now() / 1000),
            // Allow country to be overridden in the payload if needed
            country = request.cf?.country || null
        } = data;

        // Validate inputs
        if (!event_type) {
            return errorResponse('Missing event_type', 400);
        }

        // Determine category if not provided
        const event_category = category || determineCategory(event_type);

        // Create statements for events and stats tables
        const statements = createEventStatements(
            db, app_id, event_type, event_category, qualifier, value, timestamp, country
        );

        // Execute statements in a batch
        await db.batch(statements);

        // Get the updated counter value
        const metric = qualifier ? `${event_type}.${qualifier}` : event_type;
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
            timestamp,
            country
        });
    } catch (error) {
        console.error('Track event error:', error);
        return errorResponse('Failed to track event', 500, error.message);
    }
}

/**
 * Handles batch event tracking requests (POST /track/batch)
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
        // Get default country from the request
        const defaultCountry = request.cf?.country || null;
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
                timestamp = defaultTimestamp,
                // Allow country to be specified per event, or use the request's country
                country = defaultCountry
            } = event;

            // Determine category if not provided
            const event_category = category || determineCategory(event_type);

            // Add statements for this event
            const eventStatements = createEventStatements(
                db, app_id, event_type, event_category, qualifier, value, timestamp, country
            );
            statements.push(...eventStatements);

            // Create the metric key for result tracking
            const metric = qualifier ? `${event_type}.${qualifier}` : event_type;
            results.push({
                event_type,
                qualifier,
                metric,
                category: event_category,
                country
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
 * Handles event history retrieval (GET /events)
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
        const country = url.searchParams.get('country');
        const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
        const fromDate = parseDateParam(url.searchParams.get('from'), 1); // Default 24 hours ago

        // Build query
        let query = `
            SELECT id, event_type, event_category, qualifier, value, country,
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

        if (country) {
            query += " AND country = ?";
            params.push(country);
        }

        query += " ORDER BY timestamp DESC LIMIT ?";
        params.push(limit);

        // Execute query
        const { results } = await db.prepare(query).bind(...params).all();

        return successResponse({
            app_id,
            from: new Date(fromDate * 1000).toISOString(),
            count: results?.length || 0,
            events: results || []
        });
    } catch (error) {
        console.error('Event history error:', error);
        return errorResponse('Failed to retrieve event history', 500, error.message);
    }
}