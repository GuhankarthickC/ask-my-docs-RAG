using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AskMyDocs.Models;
using AskMyDocs.Services;
using Microsoft.AspNetCore.Mvc;

namespace AskMyDocs.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly AzureSearchService _searchService;
    private readonly AzureAIService _aiService;

    public ChatController(AzureSearchService searchService, AzureAIService aiService)
    {
        _searchService = searchService;
        _aiService = aiService;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] ChatRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest("Question is required.");
        }

        var relevantChunks = await _searchService.SearchRelevantChunksAsync(request.Message);
        var context = string.Join("\n\n", relevantChunks);
        var answer = await _aiService.AskQuestionAsync(context, request.Message);

        return Ok(new ChatResponse(request.Message, answer, relevantChunks.ToList()));
    }
}
