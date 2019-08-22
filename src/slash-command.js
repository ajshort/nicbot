const bomObs = require('./bom-obs');
const { Lambda } = require('aws-sdk');
const querystring = require('querystring');

exports.handler = async (event, _context) => {
  const data = querystring.parse(event.body);
  const command = data.command ? data.command.trim() : undefined;

  if (command === '/radar' || command === '/wind') {
    const lambda = new Lambda();

    await lambda.invoke({
      FunctionName: process.env.RADAR_LAMBDA,
      InvocationType: 'Event',
      Payload: JSON.stringify(data),
    }).promise();

    return {
      body: 'Getting your radar image (beep beep beep) :satellite_antenna:',
      statusCode: 200 ,
    };
  } else if (command === '/obs') {
    let obs = await bomObs.reportObservations();

    return {
      body: `:satellite_antenna: ${obs.name} observations
  :clock1: *${obs.latestTime.format('h:mm:ssa')}:* rain: ${obs.latestEntry.rain_trace}mm wind: ${obs.latestEntry.wind_spd_kmh}km/h ${obs.latestEntry.wind_dir} gust: ${obs.latestEntry.gust_kmh}km/h
  :tornado_cloud: *Max Gust:* ${obs.maxGust.date.format('Do h:mm:ssa')} ${obs.maxGust.gustKmh}km/h ${obs.maxGust.direction}
  :cloud: *Max Wind:* ${obs.maxWind.date.format('Do h:mm:ssa')} ${obs.maxWind.windSpdKmh}km/h ${obs.maxGust.direction}
  :rain_cloud: *Max Rain:* ${obs.rain.date.format('Do h:mm:ssa')} ${obs.rain.rain}mm `
    };
  } else {
    return { body: 'I don\'t know that command :(', statusCode: 200 };
  }
};
