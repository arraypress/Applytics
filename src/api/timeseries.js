// Timeseries API endpoint
import { errorResponse, successResponse } from '../utils.js';

/**
 * Handles timeseries queries (GET requests)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleTimeseriesQuery(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Required parameters
        const metric = url.searchParams.get('metric');
        if (!metric) {
            return errorResponse('Missing metric parameter', 400);
        }

        // Optional parameters
        const period = url.searchParams.get('period') || 'day';
        const limit = parseInt(url.searchParams.get('limit') || '30');
        const fromDate = url.searchParams.get('from') ?
            Math.floor(new Date(url.searchParams.get('from')).getTime() / 1000) :
            Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 30); // 30 days ago
        const toDate = url.searchParams.get('to') ?
            Math.floor(new Date(url.searchParams.get('to')).getTime() / 1000) :
            Math.floor(Date.now() / 1000);

        // Split the metric into event_type and qualifier
        let event_type, qualifier;
        if (metric.includes('.')) {
            [event_type, qualifier] = metric.split('.', 2);
        } else {
            event_type = metric;
            qualifier = null;
        }

        // Build time grouping expression based on period
        let timeGroup;
        if (period === 'hour') {
            timeGroup = "strftime('%Y-%m-%d %H:00:00', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'day') {
            timeGroup = "strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'week') {
            timeGroup = "strftime('%Y-%W', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'month') {
            timeGroup = "strftime('%Y-%m', datetime(timestamp, 'unixepoch'))";
        } else {
            return errorResponse('Invalid period parameter', 400);
        }

        // Query for timeseries data
        let query = `
            SELECT ${timeGroup} AS time_period, SUM(value) AS total
            FROM events
            WHERE app_id = ?
              AND event_type = ?
              AND timestamp >= ?
              AND timestamp <= ?
        `;

        let params = [app_id, event_type, fromDate, toDate];

        if (qualifier !== null) {
            query += " AND qualifier = ?";
            params.push(qualifier);
        } else {
            query += " AND qualifier IS NULL";
        }

        query += " GROUP BY time_period ORDER BY time_period DESC LIMIT ?";
        params.push(limit);

        // Execute query
        const { results } = await db.prepare(query).bind(...params).all();

        // Return timeseries data
        return successResponse({
            app_id,
            metric,
            period,
            from: new Date(fromDate * 1000).toISOString(),
            to: new Date(toDate * 1000).toISOString(),
            data: results ? results.reverse() : [] // Return in chronological order
        });
    } catch (error) {
        console.error('Timeseries query error:', error);
        return errorResponse('Failed to retrieve timeseries data', 500, error.message);
    }
}

/**
 * Handles comparison timeseries queries (GET requests)
 * Allows comparing multiple metrics in a single request
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleComparisonQuery(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Required parameters
        const metricsParam = url.searchParams.get('metrics');
        if (!metricsParam) {
            return errorResponse('Missing metrics parameter', 400);
        }

        // Parse metrics (comma-separated list)
        const metrics = metricsParam.split(',').map(m => m.trim()).filter(Boolean);
        if (metrics.length < 1 || metrics.length > 5) {
            return errorResponse('Please provide between 1 and 5 metrics to compare', 400);
        }

        // Optional parameters
        const period = url.searchParams.get('period') || 'day';
        const limit = parseInt(url.searchParams.get('limit') || '30');
        const fromDate = url.searchParams.get('from') ?
            Math.floor(new Date(url.searchParams.get('from')).getTime() / 1000) :
            Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 30); // 30 days ago
        const toDate = url.searchParams.get('to') ?
            Math.floor(new Date(url.searchParams.get('to')).getTime() / 1000) :
            Math.floor(Date.now() / 1000);

        // Build time grouping expression based on period
        let timeGroup;
        if (period === 'hour') {
            timeGroup = "strftime('%Y-%m-%d %H:00:00', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'day') {
            timeGroup = "strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'week') {
            timeGroup = "strftime('%Y-%W', datetime(timestamp, 'unixepoch'))";
        } else if (period === 'month') {
            timeGroup = "strftime('%Y-%m', datetime(timestamp, 'unixepoch'))";
        } else {
            return errorResponse('Invalid period parameter', 400);
        }

        // Get data for each metric
        const results = {};

        for (const metric of metrics) {
            // Split the metric into event_type and qualifier
            let event_type, qualifier;
            if (metric.includes('.')) {
                [event_type, qualifier] = metric.split('.', 2);
            } else {
                event_type = metric;
                qualifier = null;
            }

            // Query for timeseries data
            let query = `
                SELECT ${timeGroup} AS time_period, SUM(value) AS total
                FROM events
                WHERE app_id = ?
                  AND event_type = ?
                  AND timestamp >= ?
                  AND timestamp <= ?
            `;

            let params = [app_id, event_type, fromDate, toDate];

            if (qualifier !== null) {
                query += " AND qualifier = ?";
                params.push(qualifier);
            } else {
                query += " AND qualifier IS NULL";
            }

            query += " GROUP BY time_period ORDER BY time_period";

            // Execute query
            const { results: metricResults } = await db.prepare(query).bind(...params).all();
            results[metric] = metricResults || [];
        }

        // Combine all time periods from all metrics
        const allTimePeriods = new Set();
        for (const metric in results) {
            for (const dataPoint of results[metric]) {
                allTimePeriods.add(dataPoint.time_period);
            }
        }

        // Sort time periods chronologically
        const sortedTimePeriods = Array.from(allTimePeriods).sort();

        // Limit if needed
        const limitedTimePeriods = sortedTimePeriods.slice(-limit);

        // Create combined dataset
        const combinedData = limitedTimePeriods.map(period => {
            const dataPoint = { time_period: period };

            for (const metric in results) {
                const metricDataPoint = results[metric].find(dp => dp.time_period === period);
                dataPoint[metric] = metricDataPoint ? metricDataPoint.total : 0;
            }

            return dataPoint;
        });

        // Return comparison data
        return successResponse({
            app_id,
            metrics,
            period,
            from: new Date(fromDate * 1000).toISOString(),
            to: new Date(toDate * 1000).toISOString(),
            data: combinedData
        });
    } catch (error) {
        console.error('Comparison query error:', error);
        return errorResponse('Failed to retrieve comparison data', 500, error.message);
    }
}