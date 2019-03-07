import { createEventAdapter } from "@slack/events-api";

const events = createEventAdapter(process.env.SLACK_SIGNING_SECRET);

events.on("message", console.log);
events.on("error", console.error);

export const handler = events.expressMiddleware();
