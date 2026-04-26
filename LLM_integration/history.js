import { getSystemPrompt } from './config.js';

export class ConversationHistory {
  constructor(user = { name: 'User' }, userId = null) {
    this.user = user;
    this.userId = userId || user.email || 'unknown';
    this.maxMessages = 20;
    this.messages = [];
  }

  add(role, content) {
    this.messages.push({ role, content });
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  injectSkill(skillContent) {
    this.messages.push({ role: 'system', content: `[SKILL ACTIVATED]\n\n${skillContent}` });
  }

  clearSkill() {
    this.messages = this.messages.filter(m => !m.content?.startsWith('[SKILL ACTIVATED]'));
  }

  getWithSystem() {
    // Rebuilt each call so newly stored memories are always included
    return [
      { role: 'system', content: getSystemPrompt(this.user, this.userId) },
      ...this.messages,
    ];
  }

  clear() {
    this.messages = [];
  }
}
