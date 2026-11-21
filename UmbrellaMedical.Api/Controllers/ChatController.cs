using System.ComponentModel.DataAnnotations;
using Anthropic.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using UmbrellaMedical.Api.Services;

namespace UmbrellaMedical.Api.Controllers;

public class ChatTurnDto
{
    [Required, RegularExpression("^(user|assistant)$", ErrorMessage = "Role must be user or assistant.")]
    public string Role { get; set; } = string.Empty;

    [Required, StringLength(2000, MinimumLength = 1, ErrorMessage = "Messages must be 1 to 2000 characters.")]
    public string Content { get; set; } = string.Empty;
}

public class ChatRequest
{
    [Required, MinLength(1), MaxLength(40)]
    public List<ChatTurnDto> Messages { get; set; } = new();

    /// <summary>The site language the visitor is using (en, ka, de, fr, it, es, ru); answers follow it.</summary>
    [StringLength(5)]
    public string? Language { get; set; }
}

public class ChatReplyDto
{
    public string Reply { get; set; } = string.Empty;
    /// <summary>Follow-up questions the chat can show as buttons.</summary>
    public List<string> Suggestions { get; set; } = new();
}

/// <summary>The AI help chat. Open to everyone, including visitors who are not logged in.</summary>
[ApiController]
[Route("api/chat")]
[AllowAnonymous]
[EnableRateLimiting("chat")]
public class ChatController : ControllerBase
{
    private const int MaxTurnsSent = 20;

    private readonly IChatAssistant _assistant;
    private readonly ILogger<ChatController> _logger;

    public ChatController(IChatAssistant assistant, ILogger<ChatController> logger)
    {
        _assistant = assistant;
        _logger = logger;
    }

    /// <summary>mode "ai" = Claude answers; "faq" = the built-in assistant (no API key needed).</summary>
    [HttpGet("status")]
    public ActionResult<object> Status() => Ok(new { available = _assistant.IsConfigured, mode = _assistant.Mode });

    [HttpPost]
    public async Task<ActionResult<ChatReplyDto>> Post(ChatRequest request, CancellationToken cancellationToken)
    {
        if (!_assistant.IsConfigured)
            return Problem(
                detail: "The assistant is not available right now. Please contact the reception desk.",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Chat unavailable");

        // Keep the latest turns only, starting with a user message, and require strict user/assistant alternation.
        var turns = request.Messages.Select(m => new ChatTurn(m.Role, m.Content.Trim())).TakeLast(MaxTurnsSent).ToList();
        while (turns.Count > 0 && turns[0].Role != "user") turns.RemoveAt(0);

        if (turns.Count == 0 || turns[^1].Role != "user")
            return Invalid("The last message must come from the user.");
        for (var i = 1; i < turns.Count; i++)
            if (turns[i].Role == turns[i - 1].Role)
                return Invalid("Messages must alternate between user and assistant.");
        if (turns.Any(t => t.Content.Length == 0))
            return Invalid("Messages cannot be empty.");

        try
        {
            var answer = await _assistant.ReplyAsync(turns, request.Language, cancellationToken);
            return Ok(new ChatReplyDto { Reply = answer.Text, Suggestions = answer.Suggestions.ToList() });
        }
        catch (AnthropicRateLimitException ex)
        {
            _logger.LogWarning(ex, "Chat assistant was rate limited.");
            return Busy();
        }
        catch (AnthropicApiException ex)
        {
            _logger.LogError(ex, "Chat assistant request failed.");
            return Busy();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Chat assistant could not be reached.");
            return Busy();
        }
    }

    private ActionResult Busy() =>
        Problem(
            detail: "The assistant is busy right now. Please try again in a moment.",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Chat busy");

    private ActionResult Invalid(string message)
    {
        ModelState.AddModelError("messages", message);
        return ValidationProblem(ModelState);
    }
}
