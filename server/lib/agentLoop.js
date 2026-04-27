import { openai, LLM_MODEL, LLM_MAX_TOKENS, LLM_TEMPERATURE, LLM_PROVIDER } from './llmClient.js';
import { executeTool } from '../tools/executor.js';

const MAX_ITERATIONS = 6;

// Merge streamed tool_call delta chunks into a complete tool_calls array
const mergeDeltaToolCalls = (existing, deltaToolCalls) => {
  const result = [...existing];
  for (const delta of deltaToolCalls) {
    const i = delta.index ?? 0;
    if (!result[i]) {
      result[i] = { id: delta.id || '', type: 'function', function: { name: '', arguments: '' } };
    }
    if (delta.id) result[i].id = delta.id;
    if (delta.function?.name) result[i].function.name += delta.function.name;
    if (delta.function?.arguments) result[i].function.arguments += delta.function.arguments;
  }
  return result;
};

/**
 * Run the full agentic tool-execution loop.
 *
 * @param {object[]} messages - Full message history (including system prompt).
 * @param {object[]} tools    - OpenAI function schemas to expose to the LLM.
 * @param {object}   res      - Express response object (SSE already configured by caller).
 * @param {Function} [onSkillLoad] - Optional callback when load_skill executes.
 *                                   Receives (skillContent) so caller can inject as system msg.
 */
export async function runAgentLoop(messages, tools, res, onSkillLoad) {
  // Work on a local copy so we can append tool results without mutating caller's array
  const msgs = [...messages];
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: msgs,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
      max_tokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      stream: true,
      extra_body: { provider: LLM_PROVIDER },
    });

    let accText = '';
    let accToolCalls = [];
    let finishReason = null;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      finishReason = choice.finish_reason || finishReason;

      const delta = choice.delta;

      // Stream text content directly to client
      if (delta?.content) {
        accText += delta.content;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`);
      }

      // Buffer tool call fragments
      if (delta?.tool_calls?.length) {
        accToolCalls = mergeDeltaToolCalls(accToolCalls, delta.tool_calls);
      }
    }

    if (finishReason === 'tool_calls' && accToolCalls.length) {
      // Append the assistant's tool-call message (content null, tool_calls populated)
      msgs.push({ role: 'assistant', content: null, tool_calls: accToolCalls });

      // Execute each tool call and collect results
      for (const call of accToolCalls) {
        let result;
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          result = await executeTool(call.function.name, args);

          // Special: load_skill injects skill content as a system message
          if (call.function.name === 'load_skill' && result?.content) {
            const skillMsg = { role: 'system', content: `[SKILL ACTIVATED]\n\n${result.content}` };
            msgs.push(skillMsg);
            if (onSkillLoad) onSkillLoad(result);
          }
        } catch (err) {
          result = { error: err.message };
        }

        msgs.push({
          role: 'tool',
          tool_call_id: call.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }

      // Loop back — LLM will now see tool results and continue
      continue;
    }

    // finish_reason === 'stop' or no tool calls — done
    break;
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
