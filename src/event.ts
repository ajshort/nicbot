import { BOT_ID, BOT_USER_ID, CHANNELS, VEHICLES } from "./config";
import { parseProtoStruct } from "./utils";
import { setVehicleReturned, setVehicleWith } from "./vehicles";

import { WebClient } from "@slack/client";
import { createEventAdapter } from "@slack/events-api";
import { SessionsClient } from "dialogflow";
import * as uuid from "uuid";

const events = createEventAdapter(process.env.SLACK_SIGNING_SECRET);

// Keep track of the most recent seen message GUIDs so we only respond once.
let seen = [];

events.on("message", async (event) => {
  // Ignore messags we've already seen.
  if (seen.includes(event.client_msg_id)) {
    return;
  }

  seen.unshift(event.client_msg_id);
  seen = seen.slice(0, 10);

  // Ignore messages from ourselves.
  if (event.bot_id === BOT_ID) {
    return;
  }

  const direct = event.channel_type === "im";
  const mentioned = event.text.includes(`<@${BOT_USER_ID}>`);
  const lurk = event.channel === CHANNELS["sms-gateway"];

  if (!direct && !mentioned && !lurk) {
    return;
  }

  // Break up input into sentences and put each through dialogflow in a sesson.
  let text: string = event.text;

  // Other bots (gateway etc) send messages as attachments so read those.
  if (!text && event.attachments && event.attachments.length === 1) {
    text = event.attachments[0].title;
  }

  const sentences = text.split(/[.?!]/).map((s) => s.trim()).filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return;
  }

  // Response sentences.
  const output = [];

  const sessions = new SessionsClient();
  const sessionPath = sessions.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, uuid.v4());

  for (const sentence of sentences) {
    const response = await sessions.detectIntent({
      queryInput: {
        text: { languageCode: "en-AU", text: sentence },
      },
      session: sessionPath,
    });

    const result = response[0].queryResult;

    if (result.intentDetectionConfidence < 0.66) {
      continue;
    }

    const intent = result.intent.displayName;
    const parameters = parseProtoStruct(result.parameters);

    if (intent === "Take Vehicles") {
      const { name, date } = parameters;
      const vehicles = parameters.vehicles.filter((v) => VEHICLES.includes(v));

      if (vehicles.length === 0) {
        continue;
      }

      await Promise.all(vehicles.map((vehicle) => {
        return setVehicleWith(vehicle, name, new Date(date), sentence);
      }));

      output.push(`:car: I've marked ${vehicles.join(", ")} as taken`);
    } else if (intent === "Return Vehicles") {
      const vehicles = parameters.vehicles.filter((v) => VEHICLES.includes(v));

      if (vehicles.length === 0) {
        continue;
      }

      await Promise.all(vehicles.map((vehicle) => setVehicleReturned(vehicle)));

      output.push(`:house: I've marked ${vehicles.join(", ")} as returned`);
    }
  }

  if (output.length > 0) {
    const client = new WebClient(process.env.SLACK_BOT_ACCESS_TOKEN);

    await client.chat.postMessage({
      channel: event.channel,
      text: output.join("\n"),
      thread_ts: event.ts,
    });
  }
});

events.on("error", console.error);

export const handler = events.expressMiddleware();
