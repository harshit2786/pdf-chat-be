import { Request, Response, Router } from "express";
import { z } from "zod";
import { prismaClient } from "../lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware";

const router = Router();

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const avatarSchema = z.object({
  avatar: z.string(),
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "mysecret";

router.post("/signin", async (req: Request, res: Response) => {
  console.log("reached");
  try {
    const result = signInSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: result.error.flatten() });
      return;
    }

    const { email, password } = result.data;

    const user = await prismaClient.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      jwt: token,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/signup", async (req: Request, res: Response) => {
  try {
    console.log("reached");
    const result = signUpSchema.safeParse(req.body);
    console.log("success", result.success);
    if (!result.success) {
      res.status(400).json({ error: result.error.flatten() });
      return;
    }

    const { email, password, name } = result.data;

    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    const user = await prismaClient.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      jwt: token,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get(
  "/currentuser",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ user });
    } catch (err) {
      console.error("Error in /currentuser:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.put("/avatar", authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = avatarSchema.safeParse(req.body);
    const userId = (req as any).user.userId;
    if (!result.success) {
      res.status(400).json({ error: result.error.flatten() });
      return;
    }
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await prismaClient.user.update({
      where: { id: userId },
      data: {
        avatar: result.data.avatar,
      },
    });
    res.json({ message: "Avatar updated successfully" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
