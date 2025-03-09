// Main entry point for Cloudflare Applytics
import {handleTrackEvent, handleBatchTrackEvents, handleEventHistory} from './api/events.js';
import {handleStatsQuery, handleTopMetrics, handleMetricsMetadata} from './api/stats.js';
import {handleTimeseriesQuery, handleComparisonQuery} from './api/timeseries.js';
import {handleAppsQuery, handleAppSummary, handleAppDashboard} from './api/apps.js';
import {verifyApiRequest} from './auth.js';
import {errorResponse} from './utils.js';

export default {
    async fetch(request, env, ctx) {
        try {

            // Parse request info
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/').filter(Boolean);

            // Special case: Apps list endpoint doesn't require app-specific auth
            if (request.method === 'GET' && pathParts[0] === 'apps' && !pathParts[1]) {
                const authResult = verifyApiRequest(request, env);
                if (!authResult.success) {
                    return errorResponse('Authentication failed', 403, authResult.error);
                }

                return handleAppsQuery(request, env.DB);
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

                // App-related endpoints
                if (pathParts[0] === 'app') {
                    if (pathParts[1] === 'summary') {
                        return handleAppSummary(request, env.DB, app_id);
                    } else if (pathParts[1] === 'dashboard') {
                        return handleAppDashboard(request, env.DB, app_id);
                    } else {
                        return errorResponse('Invalid app endpoint', 404);
                    }
                }

                // Events endpoints
                else if (pathParts[0] === 'events') {
                    return handleEventHistory(request, env.DB, app_id);
                }

                // Stats endpoints
                else if (pathParts[0] === 'stats') {
                    if (pathParts[1] === 'top') {
                        return handleTopMetrics(request, env.DB, app_id);
                    } else {
                        return handleStatsQuery(request, env.DB, app_id);
                    }
                }

                // Metrics endpoints
                else if (pathParts[0] === 'metrics') {
                    return handleMetricsMetadata(request, env.DB, app_id);
                }

                // Timeseries endpoints
                else if (pathParts[0] === 'timeseries') {
                    if (pathParts[1] === 'compare') {
                        return handleComparisonQuery(request, env.DB, app_id);
                    } else {
                        return handleTimeseriesQuery(request, env.DB, app_id);
                    }
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