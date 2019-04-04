import { Storage } from "@google-cloud/storage";
import { createCanvas, loadImage } from "canvas";
import * as fcd from "find-cache-dir";
import * as fs from "fs";
import * as GifEncoder from "gif-encoder";
import * as moment from "moment";
import * as path from "path";
import * as FtpClient from "promise-ftp";
import { promisify } from "util";

const cache = fcd({ create: true, name: "bom" });

async function download(ftp: FtpClient, filename: string) {
  const local = path.join(cache, path.basename(filename));
  const exists = promisify(fs.exists);

  if (!await exists(local)) {
    const stream = await ftp.get(filename);

    await new Promise((resolve, reject) => {
      stream.once("close", resolve);
      stream.once("error", reject);
      stream.pipe(fs.createWriteStream(local));
    });
  }

  return local;
}

export async function createRadarGif(id: string, background?: string) {
  const folder = "/anon/gen/radar";
  const underlays = ["background", "topography"];
  const overlays = ["range", "locations"];

  if (background === undefined) {
    background = id;
  }

  const ftp = new FtpClient();
  await ftp.connect({ host: "ftp.bom.gov.au" });

  // Get the overlays.
  const backgrounds = await Promise.all(underlays
    .map((underlay) => path.join("/anon/gen/radar_transparencies", `${background}.${underlay}.png`))
    .map((filename) => download(ftp, filename).then(loadImage)));

  const foregrounds = await Promise.all(overlays
    .map((overlay) => path.join("/anon/gen/radar_transparencies", `${background}.${overlay}.png`))
    .map((filename) => download(ftp, filename).then(loadImage)));

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
  const local = path.join(cache, `${id}.${Date.now()}.gif`);
  const stream = fs.createWriteStream(local);

  // Giffify.
  const gif = new GifEncoder(512, 512);
  gif.pipe(stream);
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

  // Upload.
  const storage = new Storage();
  const file = (await storage.bucket("nicbot-radar").upload(local))[0];
  await file.makePublic();

  return `https://storage.googleapis.com/nicbot-radar/${path.basename(local)}`;
}
