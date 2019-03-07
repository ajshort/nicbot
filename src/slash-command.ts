import { RequestHandler, Response } from "express";

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

export const handler: RequestHandler = (req, res) => {
  if (req.body.command === "/radar") {
    res.json(getRadarResponse());
  } else {
    res.status(400).send("I don't know that command");
  }
};
