import { google } from 'googleapis';

const getCalendarClient = () => {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
};

export async function create_event({ summary, description, start, end, attendees, timeZone = 'UTC' }) {
  const calendar = getCalendarClient();
  const event = {
    summary,
    ...(description && { description }),
    start: { dateTime: start, timeZone },
    end: { dateTime: end, timeZone },
    ...(attendees?.length && { attendees: attendees.map(email => ({ email })) }),
  };
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });
  return { eventId: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary, status: 'created' };
}

export async function list_events({ maxResults = 10, timeMin, timeMax } = {}) {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: 'primary',
    maxResults,
    timeMin: timeMin || new Date().toISOString(),
    ...(timeMax && { timeMax }),
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data;
}
