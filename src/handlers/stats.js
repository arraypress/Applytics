/**
 * Stats API handlers
 */
import { errorResponse, successResponse, getPaginationParams } from '../utils.js';

/**
 * Handles stats queries (GET /stats)
 * Supports different views:
 * - Default: Basic stats with filtering
 * - ?view=top: Top metrics by value
 * - ?view=category: Group by category
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
        const view = url.searchParams.get('view') || 'default';
        const prefix = url.searchParams.get('prefix');
        const category = url.searchParams.get('category');
        const country = url.searchParams.get('country');
        const format = url.searchParams.get('format') || 'simple';

        // Handle different view types
        if (view === 'category') {
            return handleCategoryGrouping(db, app_id);
        } else if (view === 'top') {
            return handleTopMetrics(request, db, app_id);
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
                    category: category || null,
                    country: country || null
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
 * Handles grouping stats by category
 *
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
async function handleCategoryGrouping(db, app_id) {
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

/**
 * Handles top metrics queries
 *
 * @param {Request} request - The incoming request
 * @param {D1Database} db - The D1 database instance
 * @param {string} app_id - The application ID
 * @returns {Response} - The API response
 */
async function handleTopMetrics(request, db, app_id) {
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
}