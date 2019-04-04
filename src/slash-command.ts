import axios from "axios";
import { createRadarGif, RADARS } from "./bom";

function getRadarResponse() {
  return {
    attachments: [{
      fallback: "http://www.bom.gov.au/products/IDR034.loop.shtml",
      image_url: "http://www.sjcnet.id.au/dashboard/loop.gif?time=" + Date.now(),
      title: "Wollongong Radar",
      title_link: "http://www.bom.gov.au/products/IDR034.loop.shtml",
    }],
    response_type: "in_channel",
  };
}

export const handler = async (req, res) => {
  const data = req.body;

  if (data.command === "/radar") {
    res.json(getRadarResponse());
  } else if (data.command === "/wind") {
    // Send immediate response.
    req.status(200).send();

    // Create the gif - this can take a while.
    const gif = await createRadarGif(RADARS.wind, RADARS[128]);

    await axios.post(data.response_url, {
      attachments: [{
        fallback: "http://www.bom.gov.au/products/IDR03I.loop.shtml",
        image_url: gif,
        title: "Doppler Wind",
        title_link: "http://www.bom.gov.au/products/IDR03I.loop.shtml",
      }],
      response_type: "in_channel",
    });
  } else {
    res.status(400).send("I don't know that command");
  }
};
