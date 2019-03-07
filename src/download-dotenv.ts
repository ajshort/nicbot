import { Storage } from "@google-cloud/storage";
import * as fs from "fs";

const BUCKET = "nicbot-secrets";

fs.exists(".env", async (exists) => {
  if (exists) {
    console.log(".env already exists, not downloading");
    return;
  }

  console.log(`Downloading .env from ${BUCKET}`);

  const storage = new Storage();
  await storage.bucket(BUCKET).file(".env").download({ destination: ".env" });
});
