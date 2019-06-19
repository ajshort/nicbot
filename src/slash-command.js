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
  } else {
    return { body: 'I don\'t know that command :(', statusCode: 200 };
  }
};
