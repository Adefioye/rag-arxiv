import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { Database } from "generated/db.js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "notes/prompt.js";

export const ARXIV_PAPERS_TABLE = "arxiv_papers";
export const ARXIV_EMBEDDINGS_TABLE = "arxiv_embeddings";
export const ARXIV_QA_TABLE = "arxiv_question_answering";

export class SupabaseDatabase {
  vectorStore: SupabaseVectorStore;

  supabaseClient: SupabaseClient<Database, "public", any>;

  constructor(
    vectorStore: SupabaseVectorStore,
    supabaseClient: SupabaseClient<Database, "public", any>
  ) {
    this.vectorStore = vectorStore;
    this.supabaseClient = supabaseClient;
  }

  static async fromDocuments(docs: Array<Document>): Promise<SupabaseDatabase> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing env vars SUPABASE_URL or SUPABASE_PRIVATE_KEY");
    }

    const client = createClient<Database, "public", any>(
      supabaseUrl,
      supabaseKey
    );
    const vectorStore = await SupabaseVectorStore.fromDocuments(
      docs,
      new OpenAIEmbeddings(),
      {
        client,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(vectorStore, client);
  }

  static async fromExistingIndex(): Promise<SupabaseDatabase> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing env vars SUPABASE_URL or SUPABASE_PRIVATE_KEY");
    }

    const client = createClient<Database, "public", any>(
      supabaseUrl,
      supabaseKey
    );
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        client,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(vectorStore, client);
  }

  async addPaper({
    paper,
    url,
    notes,
    name,
  }: {
    paper: string;
    url: string;
    notes: Array<ArxivPaperNote>;
    name: string;
  }) {
    const { error } = await this.supabaseClient
      .from(ARXIV_PAPERS_TABLE)
      .insert({
        paper,
        arxiv_url: url,
        notes,
        name,
      });

    if (error) {
      throw new Error(
        "Unable to insert paper into database" + JSON.stringify(error, null, 2)
      );
    }
  }

  async getPaper(
    paperUrl: string
  ): Promise<Database["public"]["Tables"]["arxiv_papers"]["Row"] | null> {
    const { data, error } = await this.supabaseClient
      .from(ARXIV_PAPERS_TABLE)
      .select()
      .eq("arxiv_url", paperUrl);

    if (error || !data) {
      throw new Error(`Unable to get paper with ${paperUrl} from database`);
    }

    return data[0];
  }

  async saveQa(
    question: string,
    answer: string,
    context: string,
    followupQuestions: string[]
  ) {
    console.log("Saving QA to database...");
    const { error } = await this.supabaseClient.from(ARXIV_QA_TABLE).insert({
      question,
      answer,
      context,
      followup_questions: followupQuestions,
    });
    if (error) {
      console.error("Error saving QA to database");
      throw error;
    }
  }
}
