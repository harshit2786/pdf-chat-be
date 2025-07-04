import { Storage } from "@google-cloud/storage";
import multer from "multer";
import path from "path"

export const multerUpload = multer({ storage: multer.memoryStorage() });
const storage = new Storage({
  keyFilename: path.join(__dirname, "../../cloud-key.json"),
});
export const bucket = storage.bucket(process.env.BUCKET_NAME ?? "");
