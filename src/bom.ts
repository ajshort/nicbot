import { Bucket, Storage } from "@google-cloud/storage";
import { createCanvas, loadImage } from "canvas";
import * as GifEncoder from "gif-encoder";
import { WritableStream } from "memory-streams";
import * as moment from "moment";
import * as path from "path";
import * as FtpClient from "promise-ftp";

export const RADARS = {
  64: "IDR034",
  128: "IDR033",
  256: "IDR032",
  512: "IDR031",
  wind: "IDR03I",
};

async function download(ftp: FtpClient, filename: string) {
  const result = new WritableStream();
  const stream = await ftp.get(filename);

  await new Promise((resolve, reject) => {
    stream.on("close", resolve);
    stream.on("error", reject);
    stream.pipe(result);
  });

  return result.toBuffer();
}

export async function createRadarGif(id: string, background?: string) {
  const folder = "/anon/gen/radar";
  const underlays = ["background", "topography"];
  const overlays = ["range", "locations"];

  if (background === undefined) {
    background = id;
  }

  const storage = new Storage();
  const bucket = await storage.bucket("nicbot-radar");

  const ftp = new FtpClient();
  await ftp.connect({ host: "ftp.bom.gov.au" });

  // Get the overlays.
  const backgrounds = await Promise.all(underlays
    .map((underlay) => path.join("/anon/gen/radar_transparencies", `${background}.${underlay}.png`))
    .map((file) => download(ftp, file).then(loadImage)));

  const foregrounds = await Promise.all(overlays
    .map((overlay) => path.join("/anon/gen/radar_transparencies", `${background}.${overlay}.png`))
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
      date: moment(match[2], "YYYYMMDDHHmm"),
      filename: folder + "/" + entry.name,
    });
  }

  // Get the latest 6 frames.
  const frames = await Promise.all(all
    .sort((a, b) => a.date.valueOf() - b.date.valueOf())
    .slice(-6)
    .map((image) => download(ftp, image.filename).then(loadImage)));

  // Gifelate.
  const filename = `latest/${id}.gif`;
  const target = bucket.file(filename);
  const stream = target.createWriteStream();

  // Giffify.
  const gif = new GifEncoder(512, 512);

  const upload = new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    gif.pipe(stream);
  });

  gif.setDelay(250);
  gif.setRepeat(0);
  gif.writeHeader();

  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext("2d");

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

  await upload;

  return target;
}

export async function getPublicGif(id: string) {
  const storage = new Storage();
  const bucket = await storage.bucket("nicbot-radar");
  const file = bucket.file(`latest/${id}.gif`);
  const updated = new Date((await file.getMetadata())[0].updated).getTime();

  const filename = `public/${id}.${updated}.gif`;
  const pub = bucket.file(filename);
  const exists = (await pub.exists())[0];

  if (!exists) {
    await file.copy(pub);
    await pub.makePublic();
  }

  return `https://storage.googleapis.com/nicbot-radar/${filename}`;
}
