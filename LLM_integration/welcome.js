import welcomePrompt from './prompts/welcome_prompt.md?raw';
import { callLLM } from './client.js';

export async function getWelcomeMessage(history) {
  const messages = [
    history.messages[0], // system prompt already has user context
    { role: 'user', content: welcomePrompt.trim() },
  ];

  const greeting = await callLLM(messages);
  history.add('assistant', greeting);
  return greeting;
}
