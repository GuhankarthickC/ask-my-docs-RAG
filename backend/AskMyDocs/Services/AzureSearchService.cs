using Azure;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;

namespace AskMyDocs.Services;

public class AzureSearchService
{
    private readonly SearchClient _searchClient;
    private readonly int _maxResults;

    public AzureSearchService(IConfiguration configuration)
    {
        var endpoint = configuration["AzureSearch:Endpoint"]
            ?? throw new InvalidOperationException("AzureSearch:Endpoint is not configured");
        var indexName = configuration["AzureSearch:IndexName"]
            ?? throw new InvalidOperationException("AzureSearch:IndexName is not configured");
        var apiKey = configuration["AzureSearch:ApiKey"]
            ?? throw new InvalidOperationException("AzureSearch:ApiKey is not configured");

        _maxResults = configuration.GetValue("AzureSearch:MaxResults", 1);

        var credential = new AzureKeyCredential(apiKey);
        _searchClient = new SearchClient(new Uri(endpoint), indexName, credential);
    }

    public async Task<IReadOnlyList<string>> SearchRelevantChunksAsync(string query, CancellationToken cancellationToken = default)
    {
        var options = new SearchOptions
        {
            Size = _maxResults,
            IncludeTotalCount = true
        };
        options.Select.Add("content");

        var results = new List<string>();
        var response = await _searchClient.SearchAsync<SearchDocument>(query, options, cancellationToken);

        await foreach (var result in response.Value.GetResultsAsync())
        {
            if (result.Document.TryGetValue("content", out var contentObj) && contentObj is string content)
            {
                results.Add(content);
            }
        }

        return results;
    }
}
