// Stats API endpoint
import { errorResponse, successResponse, getPaginationParams } from '../utils.js';

/**
 * Handles stats queries (GET requests)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleStatsQuery(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Query parameters
        const prefix = url.searchParams.get('prefix');
        const category = url.searchParams.get('category');
        const groupBy = url.searchParams.get('groupBy');
        const format = url.searchParams.get('format') || 'simple';

        // Handle special case for grouping by category
        if (groupBy === 'category') {
            const query = "SELECT category, SUM(value) as total FROM stats WHERE app_id = ? GROUP BY category";
            const { results } = await db.prepare(query).bind(app_id).all();

            // Format results as category groups
            const stats = {};
            if (results) {
                for (const row of results) {
                    stats[row.category || 'general'] = row.total;
                }
            }

            return successResponse({
                app_id,
                groupBy: 'category',
                data: stats
            });
        }

        // Standard metrics query with filters
        let query = "SELECT metric, value, category, last_updated FROM stats WHERE app_id = ?";
        let params = [app_id];

        if (prefix) {
            query += " AND metric LIKE ?";
            params.push(`${prefix}%`);
        }

        if (category) {
            query += " AND category = ?";
            params.push(category);
        }

        // Check if pagination is requested
        const usePagination = url.searchParams.get('paginate') === 'true';
        let totalCount = 0;

        if (usePagination) {
            const { page, pageSize, offset } = getPaginationParams(url);

            // Get total count first
            const countQuery = query.replace("SELECT metric, value, category, last_updated", "SELECT COUNT(*) as count");
            const countResult = await db.prepare(countQuery).bind(...params).first();
            totalCount = countResult?.count || 0;

            // Add pagination to query
            query += " ORDER BY metric LIMIT ? OFFSET ?";
            params.push(pageSize, offset);
        } else {
            // Default sorting
            query += " ORDER BY metric";
        }

        // Execute query
        const { results } = await db.prepare(query).bind(...params).all();

        // Return results based on format
        if (format === 'detailed') {
            // Format dates for each result
            const formattedResults = results ? results.map(row => ({
                ...row,
                last_updated: row.last_updated ?
                    new Date(row.last_updated * 1000).toISOString() : null
            })) : [];

            const response = {
                app_id,
                filters: {
                    prefix: prefix || null,
                    category: category || null
                },
                data: formattedResults
            };

            // Add pagination info if requested
            if (usePagination) {
                const { page, pageSize } = getPaginationParams(url);
                response.pagination = {
                    page,
                    pageSize,
                    totalItems: totalCount,
                    totalPages: Math.ceil(totalCount / pageSize)
                };
            }

            return successResponse(response);
        } else {
            // Format results as key-value pairs (simple format)
            const stats = {};
            if (results) {
                for (const row of results) {
                    stats[row.metric] = row.value;
                }
            }

            return successResponse(stats);
        }
    } catch (error) {
        console.error('Stats query error:', error);
        return errorResponse('Failed to retrieve stats', 500, error.message);
    }
}

/**
 * Handles top metrics queries (GET)
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleTopMetrics(request, db, app_id) {
    try {
        const url = new URL(request.url);

        // Query parameters
        const category = url.searchParams.get('category');
        const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '10'));
        const sort = url.searchParams.get('sort')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Build query
        let query = `
            SELECT metric, value, category, datetime(last_updated, 'unixepoch') as last_updated
            FROM stats 
            WHERE app_id = ?
        `;

        let params = [app_id];

        if (category) {
            query += " AND category = ?";
            params.push(category);
        }

        query += ` ORDER BY value ${sort} LIMIT ?`;
        params.push(limit);

        // Execute query
        const { results } = await db.prepare(query).bind(...params).all();

        return successResponse({
            app_id,
            category: category || 'all',
            sort: sort.toLowerCase(),
            metrics: results || []
        });
    } catch (error) {
        console.error('Top metrics error:', error);
        return errorResponse('Failed to retrieve top metrics', 500, error.message);
    }
}

/**
 * Handles metrics metadata requests
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
export async function handleMetricsMetadata(request, db, app_id) {
    try {
        const { results } = await db.prepare(`
            SELECT 
                s.metric,
                s.category,
                s.last_updated,
                COUNT(DISTINCT e.qualifier) as qualifier_count
            FROM stats s
            LEFT JOIN events e ON 
                s.app_id = e.app_id AND
                s.metric LIKE (e.event_type || '%')
            WHERE s.app_id = ?
            GROUP BY s.metric
            ORDER BY s.category, s.metric
        `).bind(app_id).all();

        // Process results to create metadata
        const metricsByCategory = {};

        if (results) {
            for (const row of results) {
                const category = row.category || 'general';

                if (!metricsByCategory[category]) {
                    metricsByCategory[category] = [];
                }

                metricsByCategory[category].push({
                    name: row.metric,
                    last_updated: row.last_updated ?
                        new Date(row.last_updated * 1000).toISOString() : null,
                    has_qualifiers: row.qualifier_count > 0
                });
            }
        }

        return successResponse({
            app_id,
            categories: metricsByCategory
        });
    } catch (error) {
        console.error('Metrics metadata error:', error);
        return errorResponse('Failed to retrieve metrics metadata', 500, error.message);
    }
}