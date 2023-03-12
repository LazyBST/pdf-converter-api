import express from "express";
import { PDFDocument } from "pdf-lib";
import BwipJs from "bwip-js";
import gm from "gm";

const barCodeYcoordinateAdjustment = -35;
const barCodeXcoordinateAdjustment = 5;

const additionalPageHeight = 5;
const app = express();

app.use(express.json({ limit: "900mb" }));

app.post("/api/pdf-converter", async (req, res) => {
  try {
    const body = req?.body;
    const params = body?.params;

    if (!params || !params.pdfBytes || !params.barCodeText) {
      return res.status(400).json({
        statusCode: 400,
        message: "Bad Request",
      });
    }

    const inputPdfBytes = Buffer.from(params.pdfBytes);
    const barCodeText = params.barCodeText;

    const pdfDoc = await PDFDocument.load(inputPdfBytes);

    const barCodeBuffer = await BwipJs.toBuffer({
      bcid: "interleaved2of5", // Barcode type
      text: barCodeText, // Text to encode
      scale: 3, // 3x scaling factor
      height: 5, // Bar height, in millimeters
      includetext: true, // Show human-readable text
      textxalign: "center",
      textsize: 12,
    }).catch((err) => {
      console.error(
        "There was an error generating barcode :: ",
        JSON.stringify(err)
      );
      throw err;
    });

    const barCodePngImage = await pdfDoc.embedPng(barCodeBuffer);

    const pngDims = barCodePngImage.scale(0.25);

    const page = pdfDoc.getPage(0);
    page.setHeight(page.getHeight() + additionalPageHeight);

    page.drawImage(barCodePngImage, {
      x: pngDims.width / 2 + barCodeXcoordinateAdjustment,
      y: page.getHeight() + pngDims.height / 2 + barCodeYcoordinateAdjustment,
      width: pngDims.width,
      height: pngDims.height,
    });

    const pdfBytes = await pdfDoc.save();
    const pdfByteBuffer = Buffer.from(pdfBytes);

    gm.subClass({ imageMagick: true })(pdfByteBuffer)
      .setFormat("tiff")
      .background("white")
      .density(100, 100)
      .toBuffer((err, buf) => {
        if (err) {
          console.error("Error getting tiff buffer", err);
          throw err;
        }
        return res.json({
          tiffBytes: buf,
        });
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

app.listen(8080, () => {
  console.log("server listening on port 8080");
});

export default app;
