import { BOT_ID, BOT_USER_ID } from "./config";

import { WebClient } from "@slack/client";
import { createEventAdapter } from "@slack/events-api";

const events = createEventAdapter(process.env.SLACK_SIGNING_SECRET);

events.on("message", async (event) => {
  // Ignore messages from ourselves.
  if (event.bot_id === BOT_ID) {
    return;
  }

  const direct = event.channel_type === "im";
  const mentioned = event.text.includes(`<@${BOT_USER_ID}>`);

  if (!direct && !mentioned) {
    return;
  }

  const client = new WebClient(process.env.SLACK_BOT_ACCESS_TOKEN);

  await client.chat.postMessage({
    channel: event.channel,
    text: JSON.stringify(event),
  });
});

events.on("error", console.error);

export const handler = events.expressMiddleware();
