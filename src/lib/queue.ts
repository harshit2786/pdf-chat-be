import { Queue } from "bullmq";

const REDIS_HOST=process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT= Number(process.env.REDIS_PORT) ?? 6379;

export const connection = {
  host: REDIS_HOST, 
  port: REDIS_PORT,
};

export const embeddingQueue = new Queue("embeddingQueue", {
  connection,
});
