// Utility functions for Applytics API

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