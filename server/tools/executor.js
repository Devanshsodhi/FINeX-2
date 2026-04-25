import * as gmail from './gmail.js';
import * as calendar from './calendar.js';

const TOOL_MAP = {
  send_email: gmail.send_email,
  list_emails: gmail.list_emails,
  search_email: gmail.search_email,
  create_event: calendar.create_event,
  list_events: calendar.list_events,
};

export async function executeTool(toolId, params) {
  const fn = TOOL_MAP[toolId];
  if (!fn) throw new Error(`Unknown tool: ${toolId}`);
  return fn(params);
}

export const TOOL_IDS = Object.keys(TOOL_MAP);
