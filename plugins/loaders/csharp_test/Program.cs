using System.Text.Json;

using var input = Console.OpenStandardInput();
using var document = await JsonDocument.ParseAsync(input);

await JsonSerializer.SerializeAsync(
    Console.OpenStandardOutput(),
    new
    {
        result = new
        {
            language = "csharp",
            payload = document.RootElement.Clone()
        }
    }
);
