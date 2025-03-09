# Cloudflare Applytics

A lightweight, privacy-focused analytics tracking and reporting system built for Cloudflare Workers.

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

```javascript
// Track app installation
client.track("install", { value: 1, category: "lifecycle" });

// Track app update
client.track("update", { qualifier: "1.2.0", category: "lifecycle" });

// Track app uninstall
client.track("uninstall", { category: "lifecycle" });
```

### User Engagement

Measure how users interact with your app without tracking personal data:

```javascript
// Track page views
client.track("page_view", { qualifier: "home" });

// Track feature usage
client.track("feature_used", { qualifier: "dark_mode" });

// Track button clicks
client.track("button_click", { qualifier: "signup" });
```

### Revenue Events

Monitor purchase and subscription events:

```javascript
// Track one-time purchase
client.track("purchase", { qualifier: "premium_upgrade", value: 999 });

// Track subscription start
client.track("subscription", { qualifier: "monthly_plan", value: 499 });

// Track in-app purchase
client.track("iap", { qualifier: "coins_pack", value: 299 });
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

When an event is tracked, it creates or updates a corresponding stat with the key format `event_type.qualifier`.

### Practical Examples

**Example 1: Tracking App Usage**

Track daily active users by recording a "session" event when your app starts:

```javascript
// User opens the app
client.track("session", { qualifier: "start" });

// Later, analyze daily active users
const dailyActiveUsers = await client.getTimeseries({
    metric: "session.start",
    period: "day",
    limit: 30
});
```

**Example 2: Feature Adoption**

Track how many users enable a new feature:

```javascript
// User enables dark mode
client.track("feature_enabled", { qualifier: "dark_mode" });

// Get total count of feature enablement
const featureStats = await client.getStats({ prefix: "feature_enabled" });
console.log(`Dark mode enabled ${featureStats["feature_enabled.dark_mode"]} times`);
```

**Example 3: Conversion Funnel**

Track user progression through a signup flow:

```javascript
// Track each step
client.track("signup_step", { qualifier: "view_form" });
client.track("signup_step", { qualifier: "submit_email" });
client.track("signup_step", { qualifier: "verify_email" });
client.track("signup_step", { qualifier: "complete" });

// Compare conversion rates between steps
const funnelData = await client.compareMetrics({
    metrics: [
        "signup_step.view_form",
        "signup_step.submit_email",
        "signup_step.verify_email",
        "signup_step.complete"
    ],
    period: "day"
});
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
  "category": "engagement"
}
```

**Parameters:**
- `event_type` (required): Type of event
- `qualifier` (optional): Event qualifier
- `value` (optional): Numeric value, defaults to 1
- `category` (optional): Event category

**Response:**
```json
{
  "success": true,
  "app_id": "app1",
  "metric": "page_view.home",
  "category": "engagement",
  "value": 42
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

### Stats Endpoints

#### GET /stats
Get all stats for an application.

**Query Parameters:**
- `prefix` (optional): Filter metrics starting with prefix
- `category` (optional): Filter metrics by category
- `format` (optional): Response format, either 'simple' (default) or 'detailed'
- `groupBy` (optional): Group metrics, supports 'category'
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
    "category": "engagement"
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

#### GET /stats/top
Get top metrics by value.

**Query Parameters:**
- `category` (optional): Filter by category
- `limit` (optional): Maximum number of results, defaults to 10
- `sort` (optional): Sort direction, 'asc' or 'desc' (default)

### Timeseries Endpoints

#### GET /timeseries
Get time-based data for a specific metric.

**Query Parameters:**
- `metric` (required): Metric name
- `period` (optional): Time grouping, one of 'hour', 'day', 'week', 'month', defaults to 'day'
- `limit` (optional): Maximum number of data points, defaults to 30
- `from` (optional): Start date (ISO format)
- `to` (optional): End date (ISO format)

**Response:**
```json
{
  "app_id": "app1",
  "metric": "page_view.home",
  "period": "day",
  "from": "2025-02-07T00:00:00Z",
  "to": "2025-03-09T00:00:00Z",
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

#### GET /timeseries/compare
Compare multiple metrics over time.

**Query Parameters:**
- `metrics` (required): Comma-separated list of metrics to compare
- `period` (optional): Time grouping, defaults to 'day'
- `limit` (optional): Maximum number of data points, defaults to 30
- `from` (optional): Start date (ISO format)
- `to` (optional): End date (ISO format)

### Events Endpoints

#### GET /events
Get event history for an application.

**Query Parameters:**
- `type` (optional): Filter by event type
- `category` (optional): Filter by event category
- `limit` (optional): Maximum number of events to return, defaults to 50
- `from` (optional): Start date (ISO format), defaults to 24 hours ago

### App Endpoints

#### GET /app/summary
Get a summary of an application.

#### GET /app/dashboard
Get dashboard data for an application.

#### GET /metrics
Get metadata about available metrics.

## Client Libraries

- [ApplyticsKit](https://github.com/arraypress/ApplyticsKit) - Swift client for iOS/macOS
- More coming soon!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.