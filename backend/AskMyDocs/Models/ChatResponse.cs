using System.Collections.Generic;

namespace AskMyDocs.Models;

public record ChatResponse(string Question, string Answer, IReadOnlyList<string> Context);
