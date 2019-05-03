import axios from "axios";
import { RequestHandler } from "express";
import { getPublicGif, RADARS } from "./bom";

export const handler: RequestHandler = async (req, res) => {
  const data = req.body;

  if (data.command === "/radar") {
    res.status(200).send("Getting your radar image (beep beep beep) :satellite_antenna:");

    const input = parseInt(data.text, 10);
    const range = (input in RADARS) ? input : 128;

    const id = RADARS[range];
    const gif = await getPublicGif(id);

    await axios.post(data.response_url, {
      attachments: [{
        fallback: `http://www.bom.gov.au/products/${id}.loop.shtml`,
        image_url: gif,
        title: `${range}km Radar (for <@${data.user_id}>)`,
        title_link: `http://www.bom.gov.au/products/${id}.loop.shtml`,
      }],
      response_type: "in_channel",
    });
  } else if (data.command === "/wind") {
    res.status(200).send("Getting your radar image (beep beep beep) :satellite_antenna:");

    const gif = await getPublicGif(RADARS.wind);

    await axios.post(data.response_url, {
      attachments: [{
        fallback: `http://www.bom.gov.au/products/${RADARS.wind}.loop.shtml`,
        image_url: gif,
        title: `Doppler Wind (for <@${data.user_id}>)`,
        title_link: `http://www.bom.gov.au/products/${RADARS.wind}.loop.shtml`,
      }],
      response_type: "in_channel",
    });
  } else {
    res.status(400).send("I don't know that command");
  }
};
