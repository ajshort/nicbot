import { RequestHandler } from "express";
import { getLatestGif, RADARS } from "./bom";

export const handler: RequestHandler = async (req, res) => {
  const data = req.body;

  if (data.command === "/radar") {
    const input = parseInt(data.text, 10);
    const range = (input in RADARS) ? input : 128;

    // Create the gif - this can take a while.
    const id = RADARS[range];
    const gif = await getLatestGif(id);

    res.json({
      attachments: [{
        fallback: `http://www.bom.gov.au/products/${id}.loop.shtml`,
        image_url: gif,
        title: `${range}km Radar`,
        title_link: `http://www.bom.gov.au/products/${id}.loop.shtml`,
      }],
      response_type: "in_channel",
    });
  } else if (data.command === "/wind") {
    // Create the gif - this can take a while.
    const gif = await getLatestGif(RADARS.wind);

    res.json({
      attachments: [{
        fallback: `http://www.bom.gov.au/products/${RADARS.wind}.loop.shtml`,
        image_url: gif,
        title: "Doppler Wind",
        title_link: `http://www.bom.gov.au/products/${RADARS.wind}.loop.shtml`,
      }],
      response_type: "in_channel",
    });
  } else {
    res.status(400).send("I don't know that command");
  }
};
