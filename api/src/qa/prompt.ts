import { ChatPromptTemplate } from "langchain/prompts";
import { BaseMessageChunk } from "langchain/schema";
import { ArxivPaperNote } from "notes/prompt.js";
import type { OpenAI as OpenAIClient } from "openai";

export const QA_TOOL_SCHEMA: OpenAIClient.ChatCompletionTool = {
  type: "function",
  function: {
    name: "questionAnswer",
    description:
      "The answer and followup questions for a given question on a paper",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description: "Response to question",
        },
        followupQuestions: {
          type: "array",
          items: {
            type: "string",
            description: "Followup questions to a given question on a paper",
          },
        },
      },
      required: ["answer", "followupQuestions"],
    },
  },
};

export const QA_OVER_PAPER_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "ai",
    `You are a tenured professor of computer science helping a student with their research.
    The student has a question regarding a paper they are reading.
    Here are their notes on the paper:
    {notes}
    
    And here are some relevant parts of the paper relating to their question
    {relevantDocuments}
    
    Answer the student's question in the context of the paper. You should also suggest followup questions.
    Take a deep breath, and think through your reply carefully, step by step.`,
  ],
  ["human", "Question: {question}"],
]);

export const answerOutputParser = (
  output: BaseMessageChunk
): Array<{ answer: string; followupQuestions: string[] }> => {
  console.log("llm output: ", output);
  const toolCalls = output.additional_kwargs.tool_calls;
  if (!toolCalls) {
    throw new Error("Missing 'tool_calls' in qa output");
  }

  const response = toolCalls
    .map((toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      return args;
    })
    .flat();
  return response;
};
