# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Restore dependencies first (layer-cache friendly)
COPY AiAgents.Core/AiAgents.Core.csproj         AiAgents.Core/
COPY AiAgents.Shared/AiAgents.Shared.csproj     AiAgents.Shared/
COPY AiAgents.MusicAgent/AiAgents.MusicAgent.csproj AiAgents.MusicAgent/
COPY AiAgents.Web/AiAgents.Web.csproj           AiAgents.Web/
RUN dotnet restore AiAgents.Web/AiAgents.Web.csproj

COPY . .
RUN dotnet publish AiAgents.Web/AiAgents.Web.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# SpotifySongs.csv is optionally volume-mounted at /app/SpotifySongs.csv
# If absent, the API falls back to rule-based genre classification.

EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "AiAgents.Web.dll"]
