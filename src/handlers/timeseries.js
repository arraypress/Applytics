/**
 * Timeseries API handlers
 */
import { errorResponse, successResponse, parseDateParam, getTimeGroupExpression } from '../utils.js';

/**
 * Handles timeseries queries (GET /timeseries)
 * Returns time-based analytics for metrics
 *
 * Supports:
 * - Single metric: ?metric=event_type
 * - Multiple metrics: ?metrics=event_type1,event_type2
 * - Country filtering: ?country=US
 * - Time periods: ?period=day|week|month|hour
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleTimeseriesQuery(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Check for either single metric or multiple metrics parameter
        const metric = url.searchParams.get('metric');
        const metricsParam = url.searchParams.get('metrics');

        // If neither is provided, return error
        if (!metric && !metricsParam) {
            return errorResponse('Missing metric or metrics parameter', 400);
        }

        // Optional parameters
        const period = url.searchParams.get('period') || 'day';
        const limit = parseInt(url.searchParams.get('limit') || '30');
        const fromDate = parseDateParam(url.searchParams.get('from'), 30); // Default 30 days ago
        const toDate = parseDateParam(url.searchParams.get('to'), 0); // Default now
        const country = url.searchParams.get('country');

        // Get time grouping expression
        const timeGroup = getTimeGroupExpression(period);
        if (!timeGroup) {
            return errorResponse('Invalid period parameter', 400);
        }

        // Handle single metric case
        if (metric) {
            return handleSingleMetricTimeseries(
                db, app_id, metric, timeGroup, period, fromDate, toDate, country, limit
            );
        }

        // Handle multiple metrics case
        const metrics = metricsParam.split(',').map(m => m.trim()).filter(Boolean);
        if (metrics.length < 1 || metrics.length > 5) {
            return errorResponse('Please provide between 1 and 5 metrics to compare', 400);
        }

        return handleMultipleMetricsTimeseries(
            db, app_id, metrics, timeGroup, period, fromDate, toDate, country, limit
        );
    } catch (error) {
        console.error('Timeseries query error:', error);
        return errorResponse('Failed to retrieve timeseries data', 500, error.message);
    }
}

/**
 * Handles timeseries for a single metric
 *
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @param {string} metric - The metric to analyze
 * @param {string} timeGroup - The SQL time grouping expression
 * @param {string} period - The time period
 * @param {number} fromDate - Start timestamp
 * @param {number} toDate - End timestamp
 * @param {string|null} country - Optional country filter
 * @param {number} limit - Maximum number of data points
 * @returns {Response} - The API response
 */
async function handleSingleMetricTimeseries(db, app_id, metric, timeGroup, period, fromDate, toDate, country, limit) {
    // Split the metric into event_type and qualifier
    let event_type, qualifier;
    if (metric.includes('.')) {
        [event_type, qualifier] = metric.split('.', 2);
    } else {
        event_type = metric;
        qualifier = null;
    }

    // Build query
    let query = `
    SELECT ${timeGroup} AS time_period, SUM(value) AS total
    FROM events
    WHERE app_id = ?
      AND event_type = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `;

    let params = [app_id, event_type, fromDate, toDate];

    // Add qualifier filter if provided
    if (qualifier !== null) {
        query += " AND qualifier = ?";
        params.push(qualifier);
    } else {
        query += " AND qualifier IS NULL";
    }

    // Add country filter if provided
    if (country) {
        query += " AND country = ?";
        params.push(country);
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
        country: country || null,
        data: results ? results.reverse() : [] // Return in chronological order
    });
}

/**
 * Handles timeseries for multiple metrics
 *
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @param {Array<string>} metrics - The metrics to analyze
 * @param {string} timeGroup - The SQL time grouping expression
 * @param {string} period - The time period
 * @param {number} fromDate - Start timestamp
 * @param {number} toDate - End timestamp
 * @param {string|null} country - Optional country filter
 * @param {number} limit - Maximum number of data points
 * @returns {Response} - The API response
 */
async function handleMultipleMetricsTimeseries(db, app_id, metrics, timeGroup, period, fromDate, toDate, country, limit) {
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

        // Add qualifier filter if provided
        if (qualifier !== null) {
            query += " AND qualifier = ?";
            params.push(qualifier);
        } else {
            query += " AND qualifier IS NULL";
        }

        // Add country filter if provided
        if (country) {
            query += " AND country = ?";
            params.push(country);
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
        country: country || null,
        data: combinedData
    });
}