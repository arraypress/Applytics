// Authentication utilities

/**
 * Validates request authentication for API endpoints
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Object} - Authentication result with app_id if successful
 */
export function verifyApiRequest(request, env) {
    try {
        // Get app_id and API key from headers
        const app_id = request.headers.get('X-App-ID');
        const apiKey = request.headers.get('X-API-Key');

        // Validate app_id is present
        if (!app_id) {
            return {success: false, error: 'Missing app_id header'};
        }

        // Validate API key is present and matches
        if (!apiKey || apiKey !== env.API_KEY) {
            return {success: false, error: 'Invalid API key'};
        }

        // Authentication successful
        return {success: true, app_id};
    } catch (error) {
        console.error('Auth verification error:', error);
        return {success: false, error: 'Authentication error'};
    }
}