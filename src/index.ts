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
  for (const id of Object.keys(bom.RADARS)) {
    const foreground = bom.RADARS[id];
    const background = (foreground === bom.RADARS.wind) ? bom.RADARS[128] : undefined;

    for (let i = 0; i < 3; ++i) {
      console.log(`Giffing ${foreground} (attempt ${i + 1} / 3)`);

      try {
        const gif = await bom.createRadarGif(foreground, background);
        await bom.setLatestGif(foreground, gif);
        break;
      } catch (err) {
        console.error(err);
      }
    }
  }

  res.send("🛰️ BOM has been gifified");
});

app.post("/slash-command", bodyParser.urlencoded({ extended: true }), slashCommand.handler);

app.use("/event", event.handler);

const listener = app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
