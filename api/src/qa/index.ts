import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { formatDocumentsAsString } from "langchain/util/document";
import { ArxivPaperNote } from "notes/prompt.js";
import {
  QA_OVER_PAPER_PROMPT,
  QA_TOOL_SCHEMA,
  answerOutputParser,
} from "./prompt.js";
import { ARXIV_QA_TABLE, SupabaseDatabase } from "database.js";

export async function qAModel(
  question: string,
  docs: Array<Document>,
  notes: Array<ArxivPaperNote>
) {
  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  }).bind({
    tools: [QA_TOOL_SCHEMA],
    tool_choice: "auto",
  });

  const chain = QA_OVER_PAPER_PROMPT.pipe(model).pipe(answerOutputParser);
  if (!docs) {
    throw new Error("No documents found");
  }
  if (!notes) {
    throw new Error("No notes found");
  }
  const notesAsString = notes.map((note) => note.note).join("\n");
  const response = await chain.invoke({
    question,
    notes: notesAsString,
    relevantDocuments: formatDocumentsAsString(docs),
  });

  return response;
}

export async function qAPaper(question: string, paperUrl: string) {
  // Get relevant documents,
  console.log("Starting qaPaper method...")
  const database = await SupabaseDatabase.fromExistingIndex();
  const relevantDocuments = await database.vectorStore.similaritySearch(
    question,
    7,
    {
      url: paperUrl,
    }
  );
  console.log("Relevant docs: ", relevantDocuments);
  // Get notes
  const paper = await database.getPaper(paperUrl);
  if (!paper?.notes) {
    throw new Error("No notes found");
  }

  const { notes } = paper;
  console.log("Notes from paper: ", notes);
  const answerAndFollowupQuestions = await qAModel(
    question,
    relevantDocuments as Array<Document>,
    notes as unknown as Array<ArxivPaperNote>
  );

  await Promise.all([
    answerAndFollowupQuestions.map((qa) => {
      database.saveQa(
        question,
        qa.answer,
        formatDocumentsAsString(relevantDocuments),
        qa.followupQuestions
      );
    }),
  ]);

  return answerAndFollowupQuestions;
}
