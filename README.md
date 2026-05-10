# Musicle

AI-powered music analysis platform. Upload audio sketches, get real-time genre classification and audio-feature scoring from an ML.NET agent, then share and compare tracks with a social feed.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| Backend | ASP.NET Core 9 · C# · SignalR · JWT auth |
| ML | ML.NET 3 · LightGBM · NAudio |
| Database | SQL Server 2022 |
| Realtime | SignalR WebSockets |

## Architecture

```
musicle-app/
├── aiAgents/AiAgents.MusicAgent/   # .NET 9 solution
│   ├── AiAgents.Core/              # Abstract agent framework (SoftwareAgent base)
│   ├── AiAgents.MusicAgent/        # Domain, application, ML, background workers
│   ├── AiAgents.Shared/            # DTOs shared between API and agent logic
│   └── AiAgents.Web/               # ASP.NET Core host — controllers, SignalR hub
└── musicle/                        # Next.js frontend
    ├── app/                        # App router pages (feed, analysis, dashboard…)
    ├── components/                 # UI components
    ├── services/                   # API client helpers
    └── hooks/                      # Custom React hooks
```

The backend runs two `IHostedService` background workers:

- **AnalysisWorker** — pulls tracks from a queue, extracts audio features with NAudio, scores them, and pushes results over SignalR.
- **LearningWorker** — periodically retrains the LightGBM genre classifier using accumulated user feedback.

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9)
- [Node.js 20+](https://nodejs.org/)
- [SQL Server 2022](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (or Docker — see below)
- [EF Core CLI](https://learn.microsoft.com/en-us/ef/core/cli/dotnet): `dotnet tool install -g dotnet-ef`

## Local development

### 1. Clone & configure

```bash
git clone https://github.com/Aydhiny/musicle-app.git
cd musicle-app
cp .env.example .env          # fill in SA_PASSWORD, JWT_SIGNING_KEY, etc.
```

### 2. Backend

```bash
# From repo root
make dev-backend
# or manually:
cd aiAgents/AiAgents.MusicAgent
dotnet watch run --project AiAgents.Web/AiAgents.Web.csproj
```

API: `http://localhost:5000`  
Swagger: `http://localhost:5000/swagger`  
SignalR: `ws://localhost:5000/hubs/analysis`

> **Dataset** — place `SpotifySongs.csv` in `aiAgents/AiAgents.MusicAgent/AiAgents.Web/` (or the repo root).
> The API loads it on startup to train the initial genre model. Without it, rule-based classification is used as a fallback.

### 3. Frontend

```bash
make dev-frontend
# or:
cd musicle && npm install && npm run dev
```

App: `http://localhost:3000`

### 4. Database migrations

Migrations run automatically on startup. To add a new one:

```bash
make migration NAME=AddSomeFeature
make migrate
```

## Docker (full stack)

```bash
cp .env.example .env   # set SA_PASSWORD and JWT_SIGNING_KEY
make build
make up
make logs
```

Services:

| Service | Port |
|---|---|
| SQL Server | 1433 |
| .NET API | 5000 |
| Next.js | 3000 |

Stop everything:

```bash
make down
```

## Environment variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Description |
|---|---|
| `SA_PASSWORD` | SQL Server SA password (Docker only) |
| `JWT_SIGNING_KEY` | Secret used to sign JWT tokens — **change before deploying** |
| `ADMIN_TOKEN` | Bearer token for admin endpoints |
| `NEXT_PUBLIC_API_URL` | Frontend → backend base URL |
| `NEXT_PUBLIC_SIGNALR_URL` | Frontend → SignalR hub URL |

> The `appsettings.json` files contain placeholder values that are safe for local dev. Override them with environment variables or `appsettings.Production.json` (gitignored) in production.

## API overview

| Prefix | Description |
|---|---|
| `POST /api/auth/register` | Register a new user |
| `POST /api/auth/login` | Obtain a JWT |
| `POST /api/analysis/upload` | Upload audio for analysis |
| `GET  /api/analysis/{id}` | Poll analysis result |
| `GET  /api/dashboard` | Aggregated insights |
| `GET  /api/highlights` | Social feed |
| `POST /api/feedback` | Submit genre feedback (feeds retraining) |
| `GET  /api/admin/*` | Admin endpoints (require `Admin-Token` header) |

Full interactive docs at `/swagger` when the API is running.

## Makefile reference

```
make help          List all targets
make dev-backend   dotnet watch run the API
make dev-frontend  npm run dev the frontend
make build         docker compose build
make up            docker compose up -d
make down          docker compose down
make logs          Stream compose logs
make migrate       Apply EF migrations
make migration NAME=X  Create a new migration
make restore       dotnet restore
make lint          eslint frontend
```

## License

MIT
