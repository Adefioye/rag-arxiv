import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { Document } from "langchain/document";
import { writeFile, unlink, readFile } from "fs/promises";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { formatDocumentsAsString } from "langchain/util/document";
import {
  ArxivPaperNote,
  NOTES_TOOL_SCHEMA,
  NOTE_PROMPT,
  outputParser,
} from "prompt.js";
import { SupabaseDatabase } from "database.js";

async function deletePages(
  pdf: Buffer,
  pagesToDelete: number[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdf);
  let numToOffsetBy = 1;
  for (const pageNum of pagesToDelete) {
    pdfDoc.removePage(pageNum - numToOffsetBy);
    numToOffsetBy++;
  }

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);
}

async function loadPdfFromUrl(paperUrl: string): Promise<Buffer> {
  const response = await axios.get(paperUrl, { responseType: "arraybuffer" });
  return response.data;
}

async function convertPdfToDocument(pdf: Buffer): Promise<Array<Document>> {
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error("Missing UNSTRUCTURED_API_KEY");
  }

  const randomName = Math.random().toString(36).substring(7);
  const pdfPath = `pdfs/${randomName}.pdf`;
  await writeFile(pdfPath, pdf, "binary");
  const loader = new UnstructuredLoader(pdfPath, {
    apiKey: process.env.UNSTRUCTURED_API_KEY,
  });
  const docs = await loader.load();
  // Delete temporary file
  await unlink(pdfPath);
  return docs;
}

async function generateNotes(
  documents: Array<Document>
): Promise<Array<ArxivPaperNote>> {
  const documentsAsString = formatDocumentsAsString(documents);
  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bind({
    tools: [NOTES_TOOL_SCHEMA],
    tool_choice: "auto",
  });

  const chain = NOTE_PROMPT.pipe(model).pipe(outputParser);
  const res = await chain.invoke({
    paper: documentsAsString,
  });
  return res;
}

export async function takeNotes(
  paperUrl: string,
  name: string,
  pagesToDelete: number[]
): Promise<ArxivPaperNote[]> {
  if (!paperUrl.endsWith("pdf")) {
    throw new Error("Not a PDF");
  }

  let pdfAsBuffer = await loadPdfFromUrl(paperUrl);

  if (pagesToDelete && pagesToDelete.length > 0) {
    // Delete pages
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }
  const documents = await convertPdfToDocument(pdfAsBuffer);
  // const documentsAsString = await readFile(`pdfs/document.json`, "utf-8");
  // const documents = JSON.parse(documentsAsString);
  console.log("Documents: ", documents);
  const notes = await generateNotes(documents);
  const database = await SupabaseDatabase.fromDocuments(documents);
  console.log("Notes: ", notes);
  console.log("Add paper to table...");
  await Promise.all([
    database.addPaper({
      paper: formatDocumentsAsString(documents),
      url: paperUrl,
      notes,
      name,
    }), // NO need to do vectorStore.addDocuments since it has been done by SupabaseVectorStore.fromDocuments
  ]);

  return notes;
}

console.log("Running main....");
// takeNotes("https://arxiv.org/pdf/2305.15334.pdf", "test", [10, 11, 12]);
