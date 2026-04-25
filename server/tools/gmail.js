import { google } from 'googleapis';

const getGmailClient = () => {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
};

const buildRawMessage = ({ to, subject, body, body_type = 'plain', cc, bcc, sender_name }) => {
  const from = sender_name
    ? `${sender_name} <${process.env.GMAIL_USER_EMAIL}>`
    : process.env.GMAIL_USER_EMAIL;
  const toStr = Array.isArray(to) ? to.join(', ') : to;

  const lines = [
    `From: ${from}`,
    `To: ${toStr}`,
  ];
  if (subject) lines.push(`Subject: ${subject}`);
  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
  lines.push(`Content-Type: text/${body_type}; charset=UTF-8`);
  lines.push('');
  lines.push(body || '');

  return Buffer.from(lines.join('\r\n')).toString('base64url');
};

export async function send_email(params) {
  const gmail = getGmailClient();
  const raw = buildRawMessage(params);
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return { messageId: res.data.id, threadId: res.data.threadId, status: 'sent' };
}

export async function list_emails({ maxResults = 10, labelIds, q } = {}) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    ...(labelIds && { labelIds }),
    ...(q && { q }),
  });
  return res.data;
}

export async function search_email({ query, maxResults = 10 }) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  return res.data;
}
