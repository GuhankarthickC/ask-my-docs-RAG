using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Configuration;
using OpenAI.Chat;

namespace AskMyDocs.Services;

public class AzureAIService
{
    private readonly string? endpoint;
    private readonly string? key;

    public AzureAIService(IConfiguration configuration)
    {
        endpoint = configuration["AzureOpenAI:Endpoint"]
            ?? throw new InvalidOperationException("AzureOpenAI:Endpoint is not configured");
        key = configuration["AzureOpenAI:ApiKey"]
            ?? throw new InvalidOperationException("AzureOpenAI:ApiKey is not configured");
    }

    public async Task<string> AskQuestionAsync(string context, string question)
    {
        if (string.IsNullOrEmpty(endpoint))
        {
            Console.WriteLine("Please set the AZURE_OPENAI_ENDPOINT environment variable.");
            return null;
        }

        if (string.IsNullOrEmpty(key))
        {
            Console.WriteLine("Please set the AZURE_OPENAI_KEY environment variable.");
            return null;
        }

        AzureKeyCredential credential = new(key);

        // Initialize the AzureOpenAIClient
        AzureOpenAIClient azureClient = new(new Uri(endpoint), credential);

        // Initialize the ChatClient with the specified deployment name
        ChatClient chatClient = azureClient.GetChatClient("gpt-4o");

        if (!string.IsNullOrEmpty(context) && context.Length > 6000)
        {
            context = context[..6000];
        }

        // Create a list of chat messages
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(@"You are an AI assistant. Use the provided document context to answer the user's question."),
            new UserChatMessage($"Document Content:\n{context}"),
            new UserChatMessage(question),
        };


        // Create chat completion options
        var options = new ChatCompletionOptions
        {
            Temperature = (float)0.7,
            MaxOutputTokenCount = 800,

            TopP = (float)0.95,
            FrequencyPenalty = (float)0,
            PresencePenalty = (float)0
        };


        try
        {
            // Create the chat completion request
            ChatCompletion completion = await chatClient.CompleteChatAsync(messages, options);

            // Print the response
            if (completion != null)
            {
                Console.WriteLine(JsonSerializer.Serialize(completion, new JsonSerializerOptions() { WriteIndented = true }));
                return JsonSerializer.Serialize(completion, new JsonSerializerOptions() { WriteIndented = true });
            }
            else
            {
                Console.WriteLine("No response received.");
                return "No response received.";
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
            return $"An error occurred: {ex.Message}";
        }
    }
}
