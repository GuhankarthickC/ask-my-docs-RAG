using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Threading;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AskMyDocs.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FileUploadController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public FileUploadController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)] // prevent excessively large uploads
    public async Task<IActionResult> UploadAsync(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("File is empty.");
        }

        if (!TryGetContainerClient(out var containerClient, out var errorResult))
        {
            return errorResult!;
        }

        try
        {
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: HttpContext.RequestAborted);

            var blobName = $"{Guid.NewGuid():N}-{Path.GetFileName(file.FileName)}";
            var blobClient = containerClient.GetBlobClient(blobName);

            await using var stream = file.OpenReadStream();
            await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType },
                cancellationToken: HttpContext.RequestAborted);

            return Ok(new { blobName, blobUri = blobClient.Uri.ToString() });
        }
        catch (RequestFailedException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, $"Upload failed: {ex.Message}");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDocumentsAsync()
    {
        if (!TryGetContainerClient(out var containerClient, out var errorResult))
        {
            return errorResult!;
        }

        if (!await containerClient.ExistsAsync())
        {
            return Ok(Array.Empty<StoredDocument>());
        }

        var documents = new List<StoredDocument>();
        await foreach (var blob in containerClient.GetBlobsAsync())
        {
            documents.Add(new StoredDocument(
                blob.Name,
                blob.Properties.ContentLength ?? 0,
                blob.Properties.ContentType ?? "application/octet-stream",
                blob.Properties.CreatedOn));
        }

        return Ok(documents);
    }

    [HttpDelete("{blobName}")]
    public async Task<IActionResult> DeleteAsync(string blobName)
    {
        if (string.IsNullOrWhiteSpace(blobName))
        {
            return BadRequest("Blob name is required.");
        }

        if (!TryGetContainerClient(out var containerClient, out var errorResult))
        {
            return errorResult!;
        }

        if (!await containerClient.ExistsAsync())
        {
            return NotFound("Container not found.");
        }

        var blobClient = containerClient.GetBlobClient(blobName);
        var response = await blobClient.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots);

        if (!response.Value)
        {
            return NotFound();
        }

        return NoContent();
    }

    private bool TryGetContainerClient(out BlobContainerClient containerClient, out IActionResult? errorResult)
    {
        containerClient = default!;
        errorResult = null;

        var containerName = _configuration["AzureStorage:ContainerName"];
        if (string.IsNullOrWhiteSpace(containerName))
        {
            errorResult = BadRequest("Container name is required.");
            return false;
        }

        var connectionString = _configuration.GetConnectionString("AzureStorage")
            ?? _configuration["AzureStorage:ConnectionString"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            errorResult = StatusCode(StatusCodes.Status500InternalServerError, "Storage connection string is not configured.");
            return false;
        }

        containerClient = new BlobContainerClient(connectionString, containerName);
        return true;
    }

    private sealed record StoredDocument(string Name, long SizeBytes, string Format, DateTimeOffset? UploadedOn);
}
