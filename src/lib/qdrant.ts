import { QdrantClient } from "@qdrant/js-client-rest";

export const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "pdf_embeddings"

export const qdrant = new QdrantClient({ url: QDRANT_URL });


