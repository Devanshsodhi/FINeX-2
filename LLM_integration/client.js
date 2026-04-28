export async function callLLM(messages, { userId = '', sessionId = '', userName = 'User' } = {}) {
  const response = await fetch('/api/llm/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, user_id: userId, session_id: sessionId, user_name: userName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).replace(/\r$/, '');
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        if (json.type === 'handoff') continue;
        const text = json.choices?.[0]?.delta?.content ?? '';
        if (text) full += text;
      } catch {
        if (data) full += data; // plain text chunk from Python server
      }
    }
  }

  return full;
}

export async function streamLLM(messages, onChunk, { userId = '', sessionId = '', userName = 'User' } = {}) {
  const response = await fetch('/api/llm/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, user_id: userId, session_id: sessionId, user_name: userName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).replace(/\r$/, '');
      if (data === '[DONE]') continue;

      let text = '';
      try {
        const json = JSON.parse(data);
        if (json.type === 'handoff') continue; // SDK handoff event — skip
        text = json.choices?.[0]?.delta?.content ?? '';
      } catch {
        text = data; // plain text chunk from Python server
      }

      if (text) {
        full += text;
        onChunk(text, full);
      }
    }
  }

  return full;
}

