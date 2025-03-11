# Cloudflare Applytics

A lightweight, privacy-focused analytics tracking and reporting system built on Cloudflare Workers and D1.

## Privacy-First Analytics

Cloudflare Applytics is designed to be a privacy-aware tracking solution for app developers who need minimal metrics like app installs, purchases, and user engagement without compromising user privacy.

**Privacy features:**
- No personal information tracking
- No cookies or persistent identifiers
- No cross-site tracking
- No IP address storage
- Fully compliant with privacy regulations
- Data stored in your own Cloudflare account

This solution is ideal for developers who want basic app metrics without becoming entangled in complex privacy requirements or third-party analytics that might compromise user data.

## Features

- Simple API key authentication
- Track single events or batches
- Category-based event organization
- Cumulative stats with filtering options
- Timeseries data with custom periods
- Multiple metric comparison
- Event history and detailed reporting
- Dashboard with trending metrics

## Use Cases

### App Lifecycle Events

Track critical milestones in your app's lifecycle:

```bash
# Track app installation
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "install", "value": 1, "category": "lifecycle"}'

# Track app update
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "update", "qualifier": "1.2.0", "category": "lifecycle"}'

# Track app uninstall
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "uninstall", "category": "lifecycle"}'
```

### User Engagement

Measure how users interact with your app without tracking personal data:

```bash
# Track page views
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "page_view", "qualifier": "home"}'

# Track feature usage
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "feature_used", "qualifier": "dark_mode"}'

# Track button clicks
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "button_click", "qualifier": "signup"}'
```

### Revenue Events

Monitor purchase and subscription events:

```bash
# Track one-time purchase
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "purchase", "qualifier": "premium_upgrade", "value": 999}'

# Track subscription start
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "subscription", "qualifier": "monthly_plan", "value": 499}'

# Track in-app purchase
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "iap", "qualifier": "coins_pack", "value": 299}'
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/)

### Installation

1. Clone this repository
```bash
git clone https://github.com/arraypress/cloudflare-applytics.git
cd cloudflare-applytics
```

2. Install dependencies
```bash
npm install
```

3. Update your `wrangler.toml` configuration
```toml
name = "cloudflare-applytics"
main = "src/index.js"
compatibility_date = "2023-10-02"

[vars]
ENVIRONMENT = "development"
API_KEY = "your-development-api-key"

[[d1_databases]]
binding = "DB"
database_name = "applytics_local"
database_id = "applytics-local"
```

### Database Setup

1. Create the D1 database (only needed once)
```bash
wrangler d1 create applytics_local
# Update the database_id in wrangler.toml with the ID returned
```

2. Initialize the database with schema
```bash
npm run setup
```

3. Check that tables were created successfully
```bash
npm run db
```

### Development

Start the local development server:
```bash
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev         # Start local development server
npm run build       # Build the project

# Deployment
npm run deploy      # Deploy to development environment
npm run deploy:prod # Deploy to production environment

# Database Setup & Management
npm run setup       # Setup local database with schema
npm run setup:prod  # Setup production database with schema
npm run db          # Show database tables
npm run db:info     # Show database table information
npm run db:events   # Show all events
npm run db:stats    # Show all stats
npm run db:reset    # Reset database (deletes all data)
```

### Production Deployment

1. Update production configuration in `wrangler.toml`

2. Set API key as a secret:
```bash
wrangler secret put API_KEY --env production
```

3. Deploy to production:
```bash
npm run deploy:prod
```

## Understanding Events and Stats

### Events vs. Stats

**Events** are individual occurrences tracked in real-time:
- Each event is recorded with a timestamp
- Events have types, optional qualifiers, and values
- Events are stored in the events table
- Used for historical analysis and timeseries data

**Stats** are cumulative counters derived from events:
- Automatically updated when events are tracked
- Represent aggregate metrics (e.g., total page views)
- Stored in the stats table for efficient querying
- Used for dashboards and overall analytics

### Event Anatomy

Events consist of:
- `event_type`: The main action being tracked (e.g., "page_view", "purchase")
- `qualifier`: Optional sub-type or specific instance (e.g., "home", "premium_plan")
- `value`: Numeric value associated with the event (default: 1)
- `category`: Organizational group (e.g., "engagement", "revenue")
- `country`: Country code (automatically detected or can be provided)
- `timestamp`: When the event occurred (defaults to current time)

When an event is tracked, it creates or updates a corresponding stat with the key format `event_type.qualifier`.

### Practical Examples

**Example 1: Tracking App Usage**

Track daily active users by recording a "session" event when your app starts:

```bash
# User opens the app - track a session start
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "session", "qualifier": "start"}'

# Later, analyze daily active users
curl "https://your-worker.workers.dev/timeseries?metric=session.start&period=day&limit=30" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key"
```

**Example 2: Feature Adoption**

Track how many users enable a new feature:

```bash
# User enables dark mode
curl -X POST "https://your-worker.workers.dev/track" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "feature_enabled", "qualifier": "dark_mode"}'

# Get total count of feature enablement
curl "https://your-worker.workers.dev/stats?prefix=feature_enabled" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key"
```

**Example 3: Conversion Funnel**

Track user progression through a signup flow:

```bash
# Track each step in the signup flow
curl -X POST "https://your-worker.workers.dev/track/batch" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {"event_type": "signup_step", "qualifier": "view_form"},
      {"event_type": "signup_step", "qualifier": "submit_email"},
      {"event_type": "signup_step", "qualifier": "verify_email"},
      {"event_type": "signup_step", "qualifier": "complete"}
    ]
  }'

# Compare conversion rates between steps
curl "https://your-worker.workers.dev/timeseries?metrics=signup_step.view_form,signup_step.submit_email,signup_step.verify_email,signup_step.complete&period=day" \
  -H "X-App-ID: your-app-id" \
  -H "X-API-Key: your-api-key"
```

## API Documentation

### Authentication

All API requests require the following headers:
- `X-App-ID`: Your application ID
- `X-API-Key`: Your API key

### Event Tracking

#### POST /track
Track a single event.

**Request Body:**
```json
{
  "event_type": "page_view",
  "qualifier": "home",
  "value": 1,
  "category": "engagement",
  "timestamp": 1678912345,
  "country": "US"
}
```

**Parameters:**
- `event_type` (required): Type of event
- `qualifier` (optional): Event qualifier
- `value` (optional): Numeric value, defaults to 1
- `category` (optional): Event category
- `timestamp` (optional): Unix timestamp, defaults to current time
- `country` (optional): Country code, automatically detected from request if not provided

**Response:**
```json
{
  "success": true,
  "app_id": "app1",
  "metric": "page_view.home",
  "category": "engagement",
  "value": 42,
  "timestamp": 1678912345,
  "country": "US"
}
```

#### POST /track/batch
Track multiple events in a single request.

**Request Body:**
```json
{
  "events": [
    {
      "event_type": "page_view",
      "qualifier": "home",
      "value": 1
    },
    {
      "event_type": "button_click",
      "qualifier": "signup",
      "category": "interaction"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "app_id": "app1",
  "processed": 2,
  "events": [
    {
      "event_type": "page_view",
      "qualifier": "home",
      "metric": "page_view.home",
      "category": "engagement",
      "country": "US"
    },
    {
      "event_type": "button_click",
      "qualifier": "signup",
      "metric": "button_click.signup",
      "category": "interaction",
      "country": "US"
    }
  ]
}
```

### Stats Endpoints

#### GET /stats
Get all stats for an application.

**Query Parameters:**
- `prefix` (optional): Filter metrics starting with prefix
- `category` (optional): Filter metrics by category
- `format` (optional): Response format, either 'simple' (default) or 'detailed'
- `view` (optional): View type, supports 'default', 'category', 'top'
- `paginate` (optional): Enable pagination (true/false)
- `page` (optional): Page number for pagination
- `pageSize` (optional): Items per page for pagination

**Response (simple format):**
```json
{
  "page_view.home": 42,
  "button_click.signup": 18
}
```

**Response (detailed format):**
```json
{
  "app_id": "app1",
  "filters": {
    "prefix": null,
    "category": "engagement",
    "country": null
  },
  "data": [
    {
      "metric": "page_view.home",
      "value": 42,
      "category": "engagement",
      "last_updated": "2025-03-09T12:34:56Z"
    }
  ]
}
```

#### GET /stats?view=top
Get top metrics by value.

**Query Parameters:**
- `category` (optional): Filter by category
- `limit` (optional): Maximum number of results, defaults to 10
- `sort` (optional): Sort direction, 'asc' or 'desc' (default)

**Response:**
```json
{
  "app_id": "app1",
  "category": "all",
  "sort": "desc",
  "metrics": [
    {
      "metric": "page_view.home",
      "value": 42,
      "category": "engagement",
      "last_updated": "2025-03-09T12:34:56Z"
    }
  ]
}
```

#### GET /stats?view=category
Get stats grouped by category.

**Response:**
```json
{
  "app_id": "app1",
  "groupBy": "category",
  "data": {
    "engagement": 156,
    "revenue": 2850,
    "lifecycle": 42
  }
}
```

### Timeseries Endpoints

#### GET /timeseries
Get time-based data for a specific metric or multiple metrics.

**Query Parameters:**
- `metric` (required if metrics not provided): Single metric name
- `metrics` (required if metric not provided): Comma-separated list of metrics to compare
- `period` (optional): Time grouping, one of 'hour', 'day', 'week', 'month', defaults to 'day'
- `limit` (optional): Maximum number of data points, defaults to 30
- `from` (optional): Start date (Unix timestamp or ISO format)
- `to` (optional): End date (Unix timestamp or ISO format)
- `country` (optional): Filter by country code

**Response for single metric:**
```json
{
  "app_id": "app1",
  "metric": "page_view.home",
  "period": "day",
  "from": "2025-02-07T00:00:00Z",
  "to": "2025-03-09T00:00:00Z",
  "country": null,
  "data": [
    {
      "time_period": "2025-03-08",
      "total": 15
    },
    {
      "time_period": "2025-03-09",
      "total": 27
    }
  ]
}
```

**Response for multiple metrics:**
```json
{
  "app_id": "app1",
  "metrics": ["page_view.home", "page_view.settings"],
  "period": "day",
  "from": "2025-02-07T00:00:00Z",
  "to": "2025-03-09T00:00:00Z",
  "country": null,
  "data": [
    {
      "time_period": "2025-03-08",
      "page_view.home": 15,
      "page_view.settings": 8
    },
    {
      "time_period": "2025-03-09",
      "page_view.home": 27,
      "page_view.settings": 12
    }
  ]
}
```

### Events Endpoints

#### GET /events
Get event history for an application.

**Query Parameters:**
- `type` (optional): Filter by event type
- `category` (optional): Filter by event category
- `country` (optional): Filter by country code
- `limit` (optional): Maximum number of events to return, defaults to 50
- `from` (optional): Start date (Unix timestamp or ISO format), defaults to 24 hours ago

**Response:**
```json
{
  "app_id": "app1",
  "from": "2025-03-08T12:34:56Z",
  "count": 2,
  "events": [
    {
      "id": 123,
      "event_type": "page_view",
      "event_category": "engagement",
      "qualifier": "home",
      "value": 1,
      "country": "US",
      "timestamp": "2025-03-09T12:34:56Z"
    },
    {
      "id": 124,
      "event_type": "button_click",
      "event_category": "interaction",
      "qualifier": "signup",
      "value": 1,
      "country": "US",
      "timestamp": "2025-03-09T12:35:23Z"
    }
  ]
}
```

### App Endpoints

#### GET /app
Get information about a specific app.

**Query Parameters:**
- `view` (optional): View type, either 'summary' (default) or 'dashboard'

**Response (summary view):**
```json
{
  "app_id": "app1",
  "total_events": 1542,
  "first_event": "2025-01-15T08:23:45Z",
  "last_event": "2025-03-09T12:34:56Z",
  "metrics_count": 25,
  "recent_events": [
    {
      "event_type": "page_view",
      "qualifier": "home",
      "category": "engagement",
      "country": "US",
      "timestamp": "2025-03-09T12:34:56Z"
    }
  ]
}
```

#### GET /app?view=dashboard
Get dashboard data for an application.

**Response:**
```json
{
  "app_id": "app1",
  "summary": {
    "total_events": 1542,
    "first_event": "2025-01-15T08:23:45Z",
    "last_event": "2025-03-09T12:34:56Z",
    "metrics_count": 25
  },
  "recent_activity": {
    "last_24h_events": 145,
    "last_24h_value": 198
  },
  "categories": [
    {
      "category": "engagement",
      "total": 856
    },
    {
      "category": "revenue",
      "total": 3540
    }
  ],
  "top_countries": [
    {
      "country": "US",
      "event_count": 523,
      "value_sum": 1245
    },
    {
      "country": "GB",
      "event_count": 218,
      "value_sum": 532
    }
  ]
}
```

#### GET /apps
Get a list of all available apps.

**Query Parameters:**
- `stats` (optional): Include stats summary for each app (true/false)

**Response:**
```json
{
  "apps": ["app1", "app2", "app3"]
}
```

**Response with stats:**
```json
{
  "apps": [
    {
      "app_id": "app1",
      "total_events": 1542,
      "first_event": "2025-01-15T08:23:45Z",
      "last_event": "2025-03-09T12:34:56Z",
      "metrics_count": 25
    },
    {
      "app_id": "app2",
      "total_events": 856,
      "first_event": "2025-02-03T10:15:32Z",
      "last_event": "2025-03-09T11:22:33Z",
      "metrics_count": 18
    }
  ]
}
```

## Client Libraries

- [ApplyticsKit](https://github.com/arraypress/ApplyticsKit) - Swift client for iOS/macOS
- More coming soon!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.