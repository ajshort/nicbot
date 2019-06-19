const { S3 } = require('aws-sdk');
const { createCanvas, loadImage } = require('canvas');
const GifEncoder = require('gif-encoder');
const { WritableStream } = require('memory-streams');
const moment = require('moment');
const path = require('path');
const FtpClient = require('promise-ftp');

exports.RADARS = {
  64: 'IDR034',
  128: 'IDR033',
  256: 'IDR032',
  512: 'IDR031',
  wind: 'IDR03I',
};

async function download(ftp, filename) {
  const result = new WritableStream();
  const stream = await ftp.get(filename);

  await new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
    stream.pipe(result);
  });

  return result.toBuffer();
}

exports.createRadarGif = async function(id, background = undefined) {
  const folder = '/anon/gen/radar';
  const underlays = ['background', 'topography'];
  const overlays = ['range', 'locations'];

  if (background === undefined) {
    background = id;
  }

  const ftp = new FtpClient();
  await ftp.connect({ host: 'ftp.bom.gov.au' });

  // Get the overlays.
  const backgrounds = await Promise.all(underlays
    .map((underlay) => path.join('/anon/gen/radar_transparencies', `${background}.${underlay}.png`))
    .map((file) => download(ftp, file).then(loadImage)));

  const foregrounds = await Promise.all(overlays
    .map((overlay) => path.join('/anon/gen/radar_transparencies', `${background}.${overlay}.png`))
    .map((file) => download(ftp, file).then(loadImage)));

  // Get all remote images.
  const all = [];
  const entries = await ftp.list(folder);

  for (const entry of entries) {
    const match = entry.name.match(/([a-zA-Z0-9]+)\.T\.([0-9]+)\.png/);

    if (!match || match[1] !== id) {
      continue;
    }

    all.push({
      date: moment(match[2], 'YYYYMMDDHHmm'),
      filename: folder + '/' + entry.name,
    });
  }

  // Get the latest 6 frames.
  const frames = await Promise.all(all
    .sort((a, b) => a.date.valueOf() - b.date.valueOf())
    .slice(-6)
    .map((image) => download(ftp, image.filename).then(loadImage)));

  // Gifelate.
  const stream = new WritableStream();

  // Giffify.
  const gif = new GifEncoder(512, 512);

  const create = new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    gif.pipe(stream);
  });

  gif.setDelay(250);
  gif.setRepeat(0);
  gif.writeHeader();

  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');

  const draw = (frame) => {
    backgrounds.forEach((image) => ctx.drawImage(image, 0, 0));
    ctx.drawImage(frame, 0, 0);
    foregrounds.forEach((image) => ctx.drawImage(image, 0, 0));

    gif.addFrame(ctx.getImageData(0, 0, 512, 512).data);
    gif.read();
  };

  for (let i = 0; i < frames.length; ++i) {
    // Draw the last frame a few times so it sticks.
    if (i === frames.length - 1) {
      draw(frames[i]);
      draw(frames[i]);
      draw(frames[i]);
    }

    draw(frames[i]);
  }

  ftp.end();
  gif.finish();
  stream.end();

  await create;

  const s3 = new S3();
  const bucket = process.env.RADAR_BUCKET;
  const key = `${id}.${new Date().getTime()}.gif`;

  await s3.putObject({
    ACL: 'public-read',
    Body: stream.toBuffer(),
    Bucket: bucket,
    ContentType: 'image/gif',
    Key: key,
  }).promise();

  return `http://${bucket}.s3.amazonaws.com/${key}`;
}
