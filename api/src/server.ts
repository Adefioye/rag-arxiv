import express from "express";
import { takeNotes } from "index.js";

function main() {
  const app = express();
  const port = process.env.PORT || 8000;

  // To get access to properties on request body
  app.use(express.json());

  app.get("/", (_req, res) => {
    // Health check
    res.status(200).send("ok");
  });

  app.post("/take_notes", async (req, res) => {
    const { paperUrl, name, pagesToDelete } = req.body;
    console.log(paperUrl, name, pagesToDelete);
    const notes = await takeNotes(paperUrl, name, pagesToDelete);
    console.log(notes);
    res.status(200).send(notes);
    return;
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

// Run the main
main();
