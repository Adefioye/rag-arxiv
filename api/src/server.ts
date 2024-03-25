import express from "express";
import { takeNotes } from "notes/index.js";
import { qAPaper } from "qa/index.js";

function processPagesToDelete(pagesToDelete: string): Array<number> {
  const numArr = pagesToDelete.split(",").map((num) => parseInt(num.trim()));
  return numArr;
}

function main() {
  const app = express();
  const port = process.env.PORT || 8080;

  // To get access to properties on request body
  app.use(express.json());

  app.get("/", (_req, res) => {
    // Health check
    res.status(200).send("ok");
  });

  app.post("/take_notes", async (req, res) => {
    const { paperUrl, name, pagesToDelete } = req.body;
    console.log(paperUrl, name, pagesToDelete);
    // convert pagesToDelete back to array numbers
    const pagesToDeleteArray = pagesToDelete
      ? processPagesToDelete(pagesToDelete)
      : undefined;
    const notes = await takeNotes(paperUrl, name, pagesToDeleteArray);
    console.log(notes);
    res.status(200).send(notes);
    return;
  });

  app.post("/qa", async (req, res) => {
    const { paperUrl, question } = req.body;
    console.log(paperUrl, question);
    const answerAndFollowupQuestions = await qAPaper(question, paperUrl);
    res.status(200).send(answerAndFollowupQuestions);
    return;
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

// Run the main
main();
