using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.MusicAgent.Application.Options;
using AiAgents.MusicAgent.Application.Runners;
using AiAgents.MusicAgent.Application.Services;
using AiAgents.MusicAgent.BackgroundServices;
using AiAgents.MusicAgent.Infrastructure;
using AiAgents.MusicAgent.ML;
using AiAgents.Web.Hubs;
using AiAgents.Web.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System;
using System.IO;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "AiAgents MusicAgent API",
        Version = "v1"
    });

    var bearerScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Enter token as: Bearer {token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
    };

    options.AddSecurityDefinition("Bearer", bearerScheme);
    options.MapType<IFormFile>(() => new OpenApiSchema { Type = "string", Format = "binary" });
    options.OperationFilter<FileUploadOperationFilter>();
});

builder.Services.AddDbContext<MusicAgentDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() ?? new JwtSettings();
if (string.IsNullOrWhiteSpace(jwtSettings.SigningKey))
{
    throw new InvalidOperationException("JWT signing key is not configured. Set Jwt:SigningKey in appsettings.");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddSingleton<ISpotifyDatasetLoader, SpotifyDatasetLoader>();
builder.Services.AddSingleton<CommercialScorePredictor>();
builder.Services.AddSingleton<AudioFeatureLearner>();

builder.Services.AddScoped<IGenreClassifier>(sp =>
{
    var logger = sp.GetRequiredService<ILogger<MLNetGenreClassifierWithFeedback>>();
    var datasetLoader = sp.GetRequiredService<ISpotifyDatasetLoader>();
    var db = sp.GetRequiredService<MusicAgentDbContext>();
    var modelPath = Path.Combine(builder.Environment.ContentRootPath, "Models", "genre_model.zip");

    return new MLNetGenreClassifierWithFeedback(logger, datasetLoader, db, modelPath);
});

builder.Services.AddScoped<AtomicQueueService>();
builder.Services.AddScoped<AiAgents.MusicAgent.Application.Services.IQueueService>(sp => sp.GetRequiredService<AtomicQueueService>());
builder.Services.AddScoped<AiAgents.MusicAgent.Application.Interfaces.IQueueService>(sp => sp.GetRequiredService<AtomicQueueService>());

builder.Services.AddScoped<IAudioProcessingService, AudioProcessingService>();
builder.Services.AddScoped<IGenreClassificationService, GenreClassificationService>();
builder.Services.AddScoped<IScoringService, ScoringService>();
builder.Services.AddScoped<IMusicScoringService, MusicScoringService>();
builder.Services.AddScoped<IRecommendationService, RecommendationService>();
builder.Services.AddScoped<IAudioFeatureExtractor, AudioFeatureExtractor>();

builder.Services.AddScoped<IPasswordHasherService, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IUserAuthService, UserAuthService>();
builder.Services.AddScoped<IHighlightSocialService, HighlightSocialService>();
builder.Services.AddScoped<IDashboardInsightsService, DashboardInsightsService>();

builder.Services.AddScoped<LearningDemonstrationService>();
builder.Services.AddScoped<AtomicClaimDemonstrationService>();

builder.Services.AddScoped<AnalysisAgentRunner>();
builder.Services.AddScoped<LearningAgentRunner>();

builder.Services.AddHostedService<AnalysisWorker>();
builder.Services.AddHostedService<LearningWorker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AnalysisHub>("/hubs/analysis");

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    var db = services.GetRequiredService<MusicAgentDbContext>();
    db.Database.Migrate();

    var datasetLoader = services.GetRequiredService<ISpotifyDatasetLoader>();
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        var csvPath = Path.Combine(app.Environment.ContentRootPath, "Data", "SpotifySongs.csv");

        if (!File.Exists(csvPath))
        {
            csvPath = Path.Combine(
                Directory.GetParent(app.Environment.ContentRootPath)?.FullName ?? app.Environment.ContentRootPath,
                "SpotifySongs.csv"
            );
        }

        if (!File.Exists(csvPath))
        {
            csvPath = "SpotifySongs.csv";
        }

        if (File.Exists(csvPath))
        {
            logger.LogInformation("Loading Spotify dataset from: {Path}", csvPath);
            var dataset = await datasetLoader.LoadDatasetAsync(csvPath);
            logger.LogInformation("Loaded {Count} tracks from Spotify dataset", dataset.Count);

            // Train ML regression models on Spotify dataset in parallel — both are
            // independent CPU-bound operations on the same read-only dataset.
            var featureLearner      = services.GetRequiredService<AudioFeatureLearner>();
            var commercialPredictor = services.GetRequiredService<CommercialScorePredictor>();

            await Task.WhenAll(
                Task.Run(() => featureLearner.Train(dataset)),      // Danceability, Valence, Acousticness, Speechiness, ViralPotential
                Task.Run(() => commercialPredictor.Train(dataset))  // Commercial score (Popularity proxy)
            );

            var classifier = services.GetRequiredService<IGenreClassifier>();
            var modelPath = Path.Combine(app.Environment.ContentRootPath, "Models", "genre_model.zip");

            if (!File.Exists(modelPath))
            {
                logger.LogInformation("No existing model found. Training initial model...");
                var metrics = await classifier.TrainAsync();
                logger.LogInformation("Initial model trained with {Accuracy:P2} accuracy", metrics.Accuracy);
            }
            else
            {
                logger.LogInformation("Existing model found at: {Path}", modelPath);
            }
        }
        else
        {
            logger.LogWarning("SpotifySongs.csv not found. Place it in Data/ folder or root directory.");
            logger.LogWarning("ML features will use fallback rule-based classification.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error loading dataset or training model");
        logger.LogWarning("Continuing with rule-based classification fallback");
    }
}

app.Logger.LogInformation("Music Agent started");
app.Logger.LogInformation("Backend: https://localhost:5001");
app.Logger.LogInformation("Swagger: https://localhost:5001/swagger");
app.Logger.LogInformation("SignalR Hub: wss://localhost:5001/hubs/analysis");

app.Run();
