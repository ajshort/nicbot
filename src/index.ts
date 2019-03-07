import * as dotenv from "dotenv";

dotenv.config();

import * as event from "./event";
import * as slashCommand from "./slash-command";

import * as bodyParser from "body-parser";
import * as express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.send("Hello, world");
});

app.post("/slash-command", bodyParser.urlencoded({ extended: true }), slashCommand.handler);

app.use("/event", event.handler);

const listener = app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
