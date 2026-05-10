using AiAgents.Shared.Dtos;

namespace AiAgents.MusicAgent.Application.Interfaces
{
    public interface IHighlightSocialService
    {
        Task<FeedResultDto> GetFeedAsync(Guid? currentUserId, int page, int pageSize, string? mode, CancellationToken ct);
        Task<HighlightPostViewDto> GetPostByIdAsync(Guid postId, Guid? currentUserId, CancellationToken ct);
        Task<HighlightPostViewDto> CreatePostAsync(Guid currentUserId, CreateHighlightPostDto dto, CancellationToken ct);
        Task<HighlightPostViewDto> UpdatePostAsync(Guid currentUserId, Guid postId, UpdateHighlightPostDto dto, CancellationToken ct);
        Task DeletePostAsync(Guid currentUserId, Guid postId, CancellationToken ct);
        Task<PostCommentViewDto> AddCommentAsync(Guid currentUserId, Guid postId, CreatePostCommentDto dto, CancellationToken ct);
        Task DeleteCommentAsync(Guid currentUserId, Guid commentId, CancellationToken ct);
        Task<ToggleLikeResultDto> TogglePostLikeAsync(Guid currentUserId, Guid postId, CancellationToken ct);
        Task<ToggleLikeResultDto> ToggleCommentLikeAsync(Guid currentUserId, Guid commentId, CancellationToken ct);
        Task<ToggleReactionResultDto> TogglePostReactionAsync(Guid currentUserId, Guid postId, string reaction, CancellationToken ct);
    }
}
