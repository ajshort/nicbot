import * as bom from "./bom";

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
  if (req.body.command === "/radar") {
    res.json(getRadarResponse());
  } else if (req.body.command === "/wind") {
    const gif = await bom.createRadarGif("IDR03I", "IDR033");

    return {
      attachments: [{
        fallback: "http://www.bom.gov.au/products/IDR03I.loop.shtml",
        image_url: gif,
        title: "Doppler Wind",
        title_link: "http://www.bom.gov.au/products/IDR03I.loop.shtml",
      }],
      response_type: "in_channel",
    };
  } else {
    res.status(400).send("I don't know that command");
  }
};
