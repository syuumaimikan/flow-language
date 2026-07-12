using System.Text.Json;

using var input = Console.OpenStandardInput();
using var document = await JsonDocument.ParseAsync(input);

var result = new
{
    result = new
    {
        language = "csharp",
        payload = document.RootElement.Clone()
    }
};

await JsonSerializer.SerializeAsync(
    Console.OpenStandardOutput(),
    result
);
