// Authentication utilities

/**
 * Validates request authentication for API endpoints
 *
 * @param {Request} request - The incoming request object containing headers
 * @param {Object} env - Environment variables containing API_KEY for validation
 * @param {boolean} [skipAppIdCheck=false] - Optional flag to bypass app_id validation
 * @returns {Object} Authentication result with properties:
 *   - {boolean} success - Indicates if authentication was successful
 *   - {string} [app_id] - The application ID from headers (if authentication successful)
 *   - {string} [error] - Error message (if authentication failed)
 * @throws {Error} Catches and handles any exceptions during verification
 */
export function verifyApiRequest(request, env, skipAppIdCheck = false) {
    try {
        // Get app_id and API key from headers
        const app_id = request.headers.get('X-App-ID');
        const apiKey = request.headers.get('X-API-Key');

        // Validate app_id is present (unless skipped)
        if (!skipAppIdCheck && !app_id) {
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