// src/ai/localAI.ts
export async function generateLocalResponse(
  prompt: string,
  model: string,
  options: {
    stream?: boolean;
    maxTokens?: number; // Added this parameter to fix the TypeScript error
  } = {},
  onToken?: (token: string) => void
): Promise<string> {
  const useStream = options.stream ?? true;
  // Add timeout for fetch to fail faster on connection issues
  try {
    const res = await Promise.race([
      fetch(`http://localhost:11434/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: useStream,
          max_tokens: options.maxTokens, // Use the maxTokens parameter if provided
        }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection to Ollama timed out')), 5000)
      )
    ]) as Response;
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`[Ollama Error] ${res.status} - ${errorText}`);
    }
    // Non-streaming
    if (!useStream) {
      const data = await res.json();
      return data.response || '';
    }
    // Streaming mode
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    if (!reader) {
      throw new Error('No reader for streamed response');
    }
    let buffer = '';
    // Add a watchdog timer that will throw if nothing is received for 10 seconds
    // This prevents the client from hanging indefinitely
    let watchdogTimer: any = null;
    let lastReceiveTime = Date.now();
    const startWatchdog = () => {
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        const timeElapsed = Date.now() - lastReceiveTime;
        if (timeElapsed > 10000) { // 10 seconds timeout
          reader.cancel(); // Cancel the reader
          throw new Error('Response stream timed out after 10 seconds of inactivity');
        } else {
          startWatchdog(); // Reset the timer
        }
      }, 10000);
    };
    // Start the watchdog timer
    startWatchdog();
    try {
      while (true) {
        const { done, value } = await reader.read();
        // Update the last receive time
        lastReceiveTime = Date.now();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullText += json.response;
              onToken?.(json.response);
            }
            if (json.done === true) {
              clearTimeout(watchdogTimer); // Clear the watchdog timer
              return fullText;
            }
          } catch (parseError) {
            // Log the parse error but continue processing
            console.warn('Failed to parse JSON from Ollama:', parseError, 'Line:', line);
          }
        }
      }
      // Flush any remaining buffer
      if (buffer.trim()) {
        try {
          const final = JSON.parse(buffer);
          if (final.response) {
            fullText += final.response;
            onToken?.(final.response);
          }
        } catch (error) {
          // Ignore final parsing errors
        }
      }
    } finally {
      clearTimeout(watchdogTimer); // Make sure to clear the timer
    }
    return fullText;
  } catch (error) {
    console.error('Error connecting to Ollama:', error);
    // Format error for easier identification
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        throw new Error('Connection to Ollama timed out. Make sure Ollama is running and responsive.');
      }
      if (error.message.includes('fetch')) {
        throw new Error('Failed to connect to Ollama. Make sure the service is running on port 11434.');
      }
    }
    throw error; // Re-throw to be handled by caller
  }
}