import { Request, Response, Router } from "express";
import { bucket, multerUpload } from "../lib/storage";
import { prismaClient } from "../lib/db";
import { Status } from "@prisma/client";
import { embeddingQueue } from "../lib/queue";
import { qdrant, QDRANT_COLLECTION } from "../lib/qdrant";

const router = Router();

router.post(
  "/upload/:folderid",
  multerUpload.single("file"),
  async (req: Request, res: Response) => {
    const userId = Number((req as any).user.userId);
    const folderId = Number(req.params.folderid);
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    if (file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Only PDF files are allowed" });
      return;
    }

    try {
      const folder = await prismaClient.folder.findFirst({
        where: {
          id: folderId,
          userId: userId,
        },
      });

      if (!folder) {
        res.status(403).json({ error: "Unauthorized or folder not found" });
        return;
      }

      const blobName = `${Date.now()}_${file.originalname}`;
      const blob = bucket.file(blobName);
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
      });

      blobStream.on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "Upload error" });
        return;
      });

      blobStream.on("finish", async () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

        const newPdf = await prismaClient.pdfs.create({
          data: {
            fileName: file.originalname,
            url: publicUrl,
            status: Status.INQUEUE,
            totalPages: 0, // Default, can be updated later when processed
            uploadedAt: Math.floor(Date.now() / 1000),
            userId: userId,
            folderId: folderId,
          },
        });

        await embeddingQueue.add("process-pdf", {
          pdfId: newPdf.id,
          userId: userId,
          url: publicUrl,
          blobName,
        });
        return res.status(201).json({
          message: "PDF uploaded successfully",
          pdf: newPdf,
        });
      });

      blobStream.end(file.buffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);
  const pdfId = Number(req.params.id);

  try {
    const pdf = await prismaClient.pdfs.findUnique({
      where: { id: pdfId },
    });

    if (!pdf || pdf.userId !== userId) {
      res.status(403).json({ error: "Forbidden or PDF not found" });
      return;
    }

    // Delete from Google Cloud Storage
    const blobName = decodeURIComponent(
      new URL(pdf.url).pathname.split("/").pop() || ""
    );
    await bucket
      .file(blobName)
      .delete()
      .catch((e) => {
        console.warn(`Failed to delete from GCS: ${e.message}`);
      });

    // Delete from Qdrant collection
    await qdrant.delete(QDRANT_COLLECTION, {
      filter: {
        must: [
          {
            key: "metadata.pdfId",
            match: {
              value: String(pdfId),
            },
          },
        ],
      },
    });

    // Delete from database
    await prismaClient.pdfs.delete({
      where: { id: pdfId },
    });

    res.status(200).json({ message: "PDF deleted successfully" });
  } catch (error) {
    console.error("Failed to delete PDF:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);
  const pdfId = Number(req.params.id);

  try {
    const pdf = await prismaClient.pdfs.findUnique({
      where: { id: pdfId },
    });

    if (!pdf || pdf.userId !== userId) {
      res.status(403).json({ error: "Forbidden or PDF not found" });
      return;
    }

    const blobName = decodeURIComponent(
      new URL(pdf.url).pathname.split("/").pop() || ""
    );
    const file = bucket.file(blobName);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "File not found in storage" });
      return;
    }

    // Set appropriate headers
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.fileName}"`
    );
    res.setHeader("Content-Type", "application/pdf");

    // Pipe the file directly to the response
    file.createReadStream().pipe(res);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

export default router;
