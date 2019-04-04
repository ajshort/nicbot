import { Bucket, Storage } from "@google-cloud/storage";
import { createCanvas, loadImage } from "canvas";
import * as fs from "fs";
import * as GifEncoder from "gif-encoder";
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

async function download(ftp: FtpClient, filename: string, bucket: Bucket) {
  const file = bucket.file(path.basename(filename));
  const exists = (await file.exists())[0];

  if (!exists) {
    const stream = await ftp.get(filename);

    await new Promise((resolve, reject) => {
      stream.on("close", resolve);
      stream.on("error", reject);
      stream.pipe(file.createWriteStream());
    });
  }

  return (await file.download())[0];
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
    .map((filename) => download(ftp, filename, bucket).then(loadImage)));

  const foregrounds = await Promise.all(overlays
    .map((overlay) => path.join("/anon/gen/radar_transparencies", `${background}.${overlay}.png`))
    .map((filename) => download(ftp, filename, bucket).then(loadImage)));

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
    .map((image) => download(ftp, image.filename, bucket).then(loadImage)));

  // Gifelate.
  const basename = `${id}.${Date.now()}.gif`;
  const target = bucket.file(basename);
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

  gif.finish();
  stream.end();

  await upload;
  await target.makePublic();

  return `https://storage.googleapis.com/nicbot-radar/${basename}`;
}
