const WolApi = require('./wol-api');
const { BOT_ID, BOT_USER_ID, CHANNELS } = require('./config');
const { parseProtoStruct } = require('./utils');

const { WebClient } = require('@slack/client');
const { SessionsClient } = require('dialogflow');
const uuid = require('uuid');

async function handleEvent(event) {
  // Ignore messages from ourselves.
  if (event.bot_id === BOT_ID) {
    return;
  }

  const direct = event.channel_type === 'im';
  const mentioned = event.text.includes(`<@${BOT_USER_ID}>`);
  const lurk = event.channel === CHANNELS['bot-testing'] ||
               event.channel === CHANNELS['sms-gateway'];

  if (!direct && !mentioned && !lurk) {
    return;
  }

  // GraphQL API.
  const endpoint = process.env.WOL_API_URL || 'https://wol-api.ajshort.now.sh/graphql';
  const token = process.env.WOL_API_TOKEN;
  const api = new WolApi(endpoint, token);

  // Break up input into sentences and put each through dialogflow in a sesson.
  let text = event.text;

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

  const sessions = new SessionsClient({
    client_email: process.env.GOOGLE_API_CLIENT_EMAIL,
    credentials: JSON.parse(process.env.GOOGLE_API_PRIVATE_KEY),
  });
  const sessionPath = sessions.sessionPath(process.env.DIALOGFLOW_PROJECT_ID, uuid.v4());

  for (const sentence of sentences) {
    const response = await sessions.detectIntent({
      queryInput: {
        text: { languageCode: 'en-AU', text: sentence },
      },
      session: sessionPath,
    });

    const result = response[0].queryResult;

    if (result.intentDetectionConfidence < 0.5) {
      continue;
    }

    const intent = result.intent.displayName;
    const parameters = parseProtoStruct(result.parameters);

    if (intent === 'Take Vehicles') {
      const { name } = parameters;
      const vehicles = parameters.vehicles;

      if (vehicles.length === 0) {
        continue;
      }

      await Promise.all(vehicles.map((vehicle) => {
        return api.setVehicleAway(vehicle, name, sentence);
      }));

      output.push(`:car: I've marked ${vehicles.join(', ')} as taken`);
    } else if (intent === 'Return Vehicles') {
      const vehicles = parameters.vehicles;

      if (vehicles.length === 0) {
        continue;
      }

      await Promise.all(vehicles.map(vehicle => api.returnVehicle(vehicle)));

      output.push(`:house: I've marked ${vehicles.join(', ')} as returned`);
    } else if (intent === 'Locate Vehicle') {
      if (!direct && !mentioned) {
        continue;
      }

      const vehicles = await api.fetchVehicles();
      const vehicle = vehicles.find(vehicle => vehicle.callsign === parameters.vehicle);

      if (!vehicle) {
        continue;
      }

      if (vehicle && vehicle.away) {
        if (vehicle.with) {
          output.push(`${vehicle.callsign} is out with ${vehicle.with} :information_desk_person:`);
        } else {
          output.push(`${vehicle.callsign} is away but I\'m not sure who with :shrug:`);
        }
      } else {
        output.push(`:house: AFAIK ${parameters.vehicle} is at HQ`);
      }
    } else if (intent === 'Locate Vehicles') {
      if (!direct && !mentioned) {
        continue;
      }

      const vehicles = await api.fetchVehicles();
      const out = vehicles.filter(vehicle => vehicle.away);

      if (out && out.length > 0) {
        output.push('The following vehicles are away: ' + out.map(vehicle => {
          if (vehicle.with) {
            return `${vehicle.callsign} with ${vehicle.with}`;
          } else {
            return vehicle.callsign;
          }
        }).join(', '));
      } else {
        output.push(':house: AFAIK all vehicles are at LHQ');
      }
    }
  }

  if (output.length > 0) {
    const client = new WebClient(process.env.SLACK_BOT_ACCESS_TOKEN);

    await client.chat.postMessage({
      channel: event.channel,
      text: output.join('\n'),
      thread_ts: event.ts,
    });
  }

  return output;
}

exports.handler = async function(event, _context) {
  const data = JSON.parse(event.body);

  if (!data.type) {
    return { statusCode: 400 };
  }

  if (data.type === 'url_verification') {
    return { body: data.challenge, statusCode: 200 };
  }

  if (data.type !== 'event_callback') {
    return { statusCode: 401 };
  }

  const output = await handleEvent(data.event);
  const body = JSON.stringify({ output })

  return {
    body,
    headers: { 'Content-Type': 'application/json' },
    statusCode: 200,
  };
};
