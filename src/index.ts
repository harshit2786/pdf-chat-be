import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./Routes/authRouter";
import folderRoutes from "./Routes/folderRoutes";
import { authMiddleware } from "./middleware";
import pdfRouter from "./Routes/pdfRouter";
import expressWs from "express-ws";
import { WebSocket } from "ws";
import { handleWebsocket } from "./streamHandler";

const PORT = process.env.PORT;

const app = express();
const wsSer = expressWs(app);
const server = wsSer.app;

server.use(express.json());
server.use(cors());

server.use("/api/v1/auth", authRouter);
server.use("/api/v1/folder", authMiddleware, folderRoutes);
server.use("/api/v1/pdf", authMiddleware, pdfRouter);

server.get("/", (req: Request, res: Response) => {
  res.send("Hi there");
});

server.ws("/", (ws: WebSocket, req: Request) => {
  ws.on("message", async (msg: string) => {
    try {
      const { query, folderId, message_id } = JSON.parse(msg);
      await handleWebsocket(ws, folderId, query, message_id);
    } catch (e) {
      console.log("Error");
      ws.send(JSON.stringify({ type: "error", data: "Not a valid query" }));
      ws.close();
    }
  });
  console.log("WebSocket connection established");
});

server.listen(PORT || 8000, () =>
  console.log(`Server is running on port ${PORT || 8000}`)
);
