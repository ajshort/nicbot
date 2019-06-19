const axios = require('axios');
const { createRadarGif, RADARS } = require('./bom');

exports.handler = async function(data, _context) {
  let title;
  let id;
  let background;

  if (data.command === '/radar') {
    const input = parseInt(data.text, 10);
    const range = (input in RADARS) ? input : 128;
    title = `${range}km Radar (for <@${data.user_id}>)`;
    id = RADARS[range];
  } else {
    title = `Doppler Wind (for <@${data.user_id}>)`;
    id = RADARS['wind'];
    background = RADARS[128];
  }

  const url = await createRadarGif(id, background);

  await axios.post(data.response_url, {
    attachments: [{
      fallback: `http://www.bom.gov.au/products/${id}.loop.shtml`,
      image_url: url,
      title: title,
      title_link: `http://www.bom.gov.au/products/${id}.loop.shtml`,
    }],
    response_type: 'in_channel',
  });

  return { body: url, statusCode: 200 };
};
