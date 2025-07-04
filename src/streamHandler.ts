import { QdrantVectorStore } from "@langchain/qdrant";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { QDRANT_COLLECTION, QDRANT_URL } from "./lib/qdrant";
import { WebSocket } from "ws";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

export const handleWebsocket = async (
  ws: WebSocket,
  folderId: string,
  query: string,
  message_id: string
) => {
  try {
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        collectionName: QDRANT_COLLECTION,
      }
    );
    const retriever = vectorStore.asRetriever({
      filter: {
        must: [
          {
            key: "metadata.folderId",
            match: { value: folderId },
          },
        ],
      },
    });
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo", // or gpt-3.5-turbo
      temperature: 0,
      streaming: true,
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMNewToken(token: string) {
          ws.send(JSON.stringify({ type: "token", data: token, message_id : String(Number(message_id) + 1) }));
        },
        async handleLLMEnd() {
          ws.send(JSON.stringify({ type: "end", data: "", message_id : String(Number(message_id) + 1) }));
          ws.close();
        },
        async handleLLMError(error: Error) {
          ws.send(
            JSON.stringify({ type: "error", data: error.message, message_id : String(Number(message_id) + 1) })
          );
          ws.close();
        },
      }),
    });
    const chain = RunnableSequence.from([
      {
        context: retriever.pipe(formatDocumentsAsString),
        question: new RunnablePassthrough(),
      },
      {
        question: (input) => input.question,
        context: (input) => input.context,
      },
      (input) => `
        Answer the question based only on the following context:
        ${input.context}
        
        Question: ${input.question}
      `,
      llm,
      new StringOutputParser(),
    ]);

    await chain.invoke(query);
  } catch (e) {
    console.error("WebSocket handler error:", e);
    ws.send(
      JSON.stringify({
        type: "error",
        data: "An error occurred while processing your request",
      })
    );
    ws.close();
  }
};
