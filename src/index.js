/**
 * Main entry point for Cloudflare Applytics
 * A lightweight analytics tracking system for applications
 */
import {handleTrackEvent, handleBatchTrackEvents, handleEventHistory} from './handlers/event.js';
import {handleStatsQuery} from './handlers/stats.js';
import {handleTimeseriesQuery} from './handlers/timeseries.js';
import {handleAppInfo} from './handlers/app.js';
import {verifyApiRequest} from './auth.js';
import {errorResponse} from './utils.js';

export default {

    /**
     * Main request handler for all Applytics API requests
     *
     * @param {Request} request - The incoming HTTP request
     * @param {Object} env - Environment variables and bindings
     * @param {Object} ctx - Execution context
     * @returns {Response} HTTP response
     */
    async fetch(request, env, ctx) {
        try {
            // Parse request info
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/').filter(Boolean);

            // Special case: Apps list endpoint doesn't require app-specific auth
            if (request.method === 'GET' && pathParts[0] === 'apps' && !pathParts[1]) {
                const authResult = verifyApiRequest(request, env, true); // Pass a flag to skip app_id check
                if (!authResult.success) {
                    return errorResponse('Authentication failed', 403, authResult.error);
                }

                return handleAppInfo(request, env.DB);
            }

            // All other API requests require authentication with valid app_id
            const authResult = verifyApiRequest(request, env);

            if (!authResult.success) {
                return errorResponse('Authentication failed', 403, authResult.error);
            }

            // Use the app_id from auth result
            const app_id = authResult.app_id;

            // Route based on request method and path
            if (request.method === 'POST') {
                // Event tracking endpoints
                if (pathParts[0] === 'track') {
                    if (pathParts[1] === 'batch') {
                        return handleBatchTrackEvents(request, env.DB, app_id);
                    } else {
                        return handleTrackEvent(request, env.DB, app_id);
                    }
                } else {
                    return errorResponse('Invalid endpoint', 404);
                }
            } else if (request.method === 'GET') {
                // Data retrieval endpoints

                // App information endpoint
                if (pathParts[0] === 'app') {
                    return handleAppInfo(request, env.DB, app_id);
                }

                // Events history endpoint
                else if (pathParts[0] === 'events') {
                    return handleEventHistory(request, env.DB, app_id);
                }

                // Stats endpoint
                else if (pathParts[0] === 'stats') {
                    return handleStatsQuery(request, env.DB, app_id);
                }

                // Timeseries endpoint
                else if (pathParts[0] === 'timeseries') {
                    return handleTimeseriesQuery(request, env.DB, app_id);
                } else {
                    return errorResponse('Invalid endpoint', 404);
                }
            } else {
                return errorResponse('Method not supported', 405);
            }
        } catch (error) {
            console.error('Request error:', error);
            return errorResponse('Internal server error', 500, error.message);
        }
    }
};