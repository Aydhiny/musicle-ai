using AiAgents.MusicAgent.Application.Exceptions;
using AiAgents.MusicAgent.Application.Interfaces;
using AiAgents.Shared.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace AiAgents.Web.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IUserAuthService _authService;

        public AuthController(IUserAuthService authService)
        {
            _authService = authService;
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto, CancellationToken ct)
        {
            try
            {
                var result = await _authService.RegisterAsync(dto, ct);
                return Ok(result);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto dto, CancellationToken ct)
        {
            try
            {
                var result = await _authService.LoginAsync(dto, ct);
                return Ok(result);
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me(CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var profile = await _authService.GetProfileAsync(userId, ct);
                return Ok(profile);
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequestDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var profile = await _authService.UpdateProfileAsync(userId, dto, ct);
                return Ok(profile);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateUserSettingsDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                var profile = await _authService.UpdateSettingsAsync(userId, dto, ct);
                return Ok(profile);
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto dto, CancellationToken ct)
        {
            if (!TryGetCurrentUserId(out var userId))
            {
                return Unauthorized(new { error = "Missing or invalid token subject." });
            }

            try
            {
                await _authService.ChangePasswordAsync(userId, dto, ct);
                return Ok(new { message = "Password updated" });
            }
            catch (AppValidationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (UnauthorizedException ex)
            {
                return Unauthorized(new { error = ex.Message });
            }
            catch (NotFoundException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        private bool TryGetCurrentUserId(out Guid userId)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(id, out userId);
        }
    }
}
