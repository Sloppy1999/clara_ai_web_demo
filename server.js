/***********************************************
 * server.js
 * ---------------------------------------------
 * This file sets up an Express server that:
 *  - Receives an uploaded .mp3 from the frontend
 *  - Calls "transcribeAndExtract" to transcribe
 *    and then extract structured data.
 *  - Saves the extracted JSON data to data.json.
 ***********************************************/

import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { transcribeAndExtract } from "./assets/js/transcribeAndExtract.js";


dotenv.config();
// Set up basic server
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configure Multer to store the uploaded .mp3 in a temp folder
const upload = multer({ dest: "temp_uploads/" });

// Serve static files (for images, etc.)
app.use(express.static(__dirname));

// Serve rt_voice.html at the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "rt_voice.html"));
});

// Endpoint to receive the .mp3 from client
app.post("/upload-conversation", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path; // The path to the temporarily uploaded file
    
    // 1) Transcribe & 2) Extract structured data
    const extractedData = await transcribeAndExtract(filePath);

    // 1) Write data.json to __dirname (where server.js is located)
    const outPath = path.join(__dirname, "data.json");
    fs.writeFileSync(outPath, JSON.stringify(extractedData, null, 2), "utf-8");

    // 2) Clean up
    fs.unlinkSync(filePath);

    // Return success message
    res.json({
      status: "success",
      message: "Audio processed successfully.",
      data: extractedData
    });
  } catch (err) {
    console.error("Error processing conversation:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

// Example route to mint ephemeral key for the browser
app.get("/session", async (req, res, next) => {
  try {
    const standardKey = process.env.OPENAI_API_KEY;
    if (!standardKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const createKeyResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${standardKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "coral"
      })
    });

    if (!createKeyResponse.ok) {
      const text = await createKeyResponse.text();
      throw new Error(`Failed to create ephemeral key: ${text}`);
    }

    const data = await createKeyResponse.json();
    res.json({ client_secret: data.client_secret });
  } catch (error) {
    next(error);
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: "error",
    message: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});