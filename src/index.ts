import * as dotenv from "dotenv";

dotenv.config();

import * as bom from "./bom";
import * as event from "./event";
import * as slashCommand from "./slash-command";

import * as bodyParser from "body-parser";
import * as express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get("/", (req, res) => {
  res.send("🤖 Hello, world");
});

app.get("/update-bom", async (req, res) => {
  await bom.createRadarGif(bom.RADARS[64]);
  await bom.createRadarGif(bom.RADARS[128]);
  await bom.createRadarGif(bom.RADARS[256]);
  await bom.createRadarGif(bom.RADARS[512]);
  await bom.createRadarGif(bom.RADARS.wind, bom.RADARS[128]);

  res.send("🛰️ BOM has been gifified");
});

app.post("/slash-command", bodyParser.urlencoded({ extended: true }), slashCommand.handler);

app.use("/event", event.handler);

const listener = app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
