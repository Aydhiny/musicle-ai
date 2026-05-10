.PHONY: help up down build logs \
        dev-backend dev-frontend \
        migrate restore lint

# ── Default ───────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Musicle — available targets"
	@echo ""
	@echo "  Local development"
	@echo "    make dev-backend      Run the .NET API in watch mode"
	@echo "    make dev-frontend     Run the Next.js dev server"
	@echo ""
	@echo "  Docker"
	@echo "    make build            Build all Docker images"
	@echo "    make up               Start the full stack (detached)"
	@echo "    make down             Stop and remove containers"
	@echo "    make logs             Stream logs from all services"
	@echo ""
	@echo "  Database"
	@echo "    make migrate          Apply EF Core migrations (local dev DB)"
	@echo "    make migration NAME=  Create a new EF Core migration"
	@echo ""
	@echo "  Code"
	@echo "    make restore          dotnet restore"
	@echo "    make lint             eslint on the frontend"
	@echo ""

# ── Local dev ─────────────────────────────────────────────────────────────────
BACKEND_DIR = aiAgents/AiAgents.MusicAgent
FRONTEND_DIR = musicle

dev-backend:
	cd $(BACKEND_DIR) && dotnet watch run --project AiAgents.Web/AiAgents.Web.csproj

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# ── Docker ────────────────────────────────────────────────────────────────────
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

# ── Database ──────────────────────────────────────────────────────────────────
migrate:
	cd $(BACKEND_DIR) && \
	dotnet ef database update --project AiAgents.MusicAgent/AiAgents.MusicAgent.csproj \
	                          --startup-project AiAgents.Web/AiAgents.Web.csproj

migration:
	@test -n "$(NAME)" || (echo "Usage: make migration NAME=<MigrationName>" && exit 1)
	cd $(BACKEND_DIR) && \
	dotnet ef migrations add $(NAME) \
	    --project AiAgents.MusicAgent/AiAgents.MusicAgent.csproj \
	    --startup-project AiAgents.Web/AiAgents.Web.csproj

# ── Code quality ──────────────────────────────────────────────────────────────
restore:
	cd $(BACKEND_DIR) && dotnet restore AiAgents.MusicAgent.slnx

lint:
	cd $(FRONTEND_DIR) && npm run lint
