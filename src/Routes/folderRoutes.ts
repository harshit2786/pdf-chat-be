import { Request, Response, Router } from "express";
import { prismaClient } from "../lib/db";
import { z } from "zod";
import { qdrant, QDRANT_COLLECTION } from "../lib/qdrant";
import { bucket } from "../lib/storage";

const folderCreateSchema = z.object({
  name: z.string(),
  description: z.string(),
  color: z.string(),
});

const router = Router();

const PAGE_SIZE = 6;

router.get("/", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);
  let { page, query } = req.query;

  const currentPage = Math.max(Number(page) || 1, 1);
  const search = (query as string) || "";

  try {
    // Count total matching folders
    const totalFolders = await prismaClient.folder.count({
      where: {
        userId,
        name: {
          contains: search,
          mode: "insensitive", // Case-insensitive match
        },
      },
    });

    const totalPages = Math.max(Math.ceil(totalFolders / PAGE_SIZE), 1);
    const validPage = currentPage > totalPages ? 1 : currentPage;

    // Fetch folders with pagination, sorting by createdAt DESC
    const folders = await prismaClient.folder.findMany({
      where: {
        userId,
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (validPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: {
          select: {
            pdfs: true,
          },
        },
      },
    });

    const response = {
      currentPage: validPage,
      totalPages,
      folders: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        createdAt: folder.createdAt,
        color: folder.color,
        pdfNum: folder._count.pdfs,
      })),
    };

    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST - Create folder
router.post("/", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);

  const parseResult = folderCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { name, description, color } = parseResult.data;

  try {
    const folder = await prismaClient.folder.create({
      data: {
        name,
        description,
        color,
        createdAt: Math.floor(Date.now() / 1000),
        userId,
      },
    });

    res.status(200).json(folder);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

// PUT - Update folder
router.put("/:id", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);
  const id = Number(req.params.id);

  const parseResult = folderCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    // Check if the folder belongs to the user
    const folder = await prismaClient.folder.findUnique({
      where: { id },
    });

    if (!folder || folder.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updated = await prismaClient.folder.update({
      where: { id },
      data: parseResult.data,
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update folder" });
  }
});

// DELETE - Delete folder (PDFs will be handled later)
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = Number((req as any).user.userId);
  const folderId = Number(req.params.id);

  try {
    const folder = await prismaClient.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Get all PDFs in the folder
    const pdfs = await prismaClient.pdfs.findMany({
      where: {
        folderId,
        userId,
      },
    });

    const pdfIds = pdfs.map((pdf) => pdf.id);

    // Delete embeddings from Qdrant
    if (pdfIds.length > 0) {
      await qdrant.delete(QDRANT_COLLECTION, {
        filter: {
          must: [
            {
              key: "metadata.pdfId",
              match: { any: pdfIds.map(String) },
            },
          ],
        },
      });
    }

    // Optional: Delete PDFs from GCS
    for (const pdf of pdfs) {
      try {
        const blobName = decodeURIComponent(
          new URL(pdf.url).pathname.split("/").pop() || ""
        );
        const file = bucket.file(blobName);
        await file.delete();
      } catch (err) {
        console.warn(`⚠️ Failed to delete PDF from bucket: ${pdf.url}`);
      }
    }

    // Delete PDFs from database
    await prismaClient.pdfs.deleteMany({
      where: {
        folderId,
        userId,
      },
    });

    // Finally delete the folder
    await prismaClient.folder.delete({
      where: { id: folderId },
    });

    res.status(200).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete folder and PDFs" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  console.log("Reached");
  const userId = Number((req as any).user.userId);
  const folderId = Number(req.params.id);

  try {
    // Find the folder that belongs to the user
    const folder = await prismaClient.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      include: {
        pdfs: {
          select: {
            id: true,
            fileName: true,
            url: true,
            status: true,
            uploadedAt: true,
            totalPages: true,
            // Assume totalPages is to be extracted from the PDF metadata later
            // For now we return 0 as placeholder
          },
        },
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const response = {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      pdfs: folder.pdfs.map((pdf) => ({
        id: pdf.id,
        fileName: pdf.fileName,
        url: pdf.url,
        status: pdf.status,
        uploadedAt: pdf.uploadedAt,
        totalPages: pdf.totalPages, // You can replace this if actual totalPages are stored somewhere
      })),
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
