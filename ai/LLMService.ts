// src/ai/LLMService.ts
export async function LLMService(
  modelId: string,
  prompt: string,
  options: { stream: boolean },
  onToken: (token: string) => void
): Promise<void> {
  const endpoint = 'http://localhost:11434/api/generate';
  const response = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      model: modelId,
      prompt,
      stream: options.stream,
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok || !response.body) {
    throw new Error(`[${response.status}] ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {break;}
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(Boolean);

    for (const line of lines) {
      const data = JSON.parse(line);
      if (data.response) {
        onToken(data.response);
      }
    }
  }
}
