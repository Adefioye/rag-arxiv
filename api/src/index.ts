import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { Document } from "langchain/document";
import { writeFile, unlink } from "fs/promises";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { formatDocumentsAsString } from "langchain/util/document";
import {
  ArxivPaperNote,
  NOTES_TOOL_SCHEMA,
  NOTE_PROMPT,
  outputParser,
} from "prompt.js";

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

  console.log("Notes: ", res);
  return res;
}

async function main({
  paperUrl,
  name,
  pagesToDelete,
}: {
  paperUrl: string;
  name: string;
  pagesToDelete?: number[];
}) {
  if (!paperUrl.endsWith("pdf")) {
    throw new Error("Not a PDF");
  }

  let pdfAsBuffer = await loadPdfFromUrl(paperUrl);

  if (pagesToDelete && pagesToDelete.length > 0) {
    // Delete pages
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }

  const documents = await convertPdfToDocument(pdfAsBuffer);

  console.log(documents);
  const notes = await generateNotes(documents);
}

console.log("Running main....");
main({ paperUrl: "https://arxiv.org/pdf/2403.11905.pdf", name: "test" });
