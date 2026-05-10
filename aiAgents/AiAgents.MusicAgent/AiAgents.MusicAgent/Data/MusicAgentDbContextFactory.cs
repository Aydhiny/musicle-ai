using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System.IO;

namespace AiAgents.MusicAgent.Infrastructure
{
    public class MusicAgentDbContextFactory : IDesignTimeDbContextFactory<MusicAgentDbContext>
    {
        public MusicAgentDbContext CreateDbContext(string[] args)
        {
            // Use the folder where appsettings.json exists
            var basePath = Path.Combine(Directory.GetCurrentDirectory(), "..\\AiAgents.Web");

            var config = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json")
                .Build();

            var optionsBuilder = new DbContextOptionsBuilder<MusicAgentDbContext>();
            optionsBuilder.UseSqlServer(config.GetConnectionString("DefaultConnection"));

            return new MusicAgentDbContext(optionsBuilder.Options);
        }
    }
}