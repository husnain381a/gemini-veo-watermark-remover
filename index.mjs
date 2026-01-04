import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// ==========================================
// CONFIGURATION
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

app.use(cors());
app.use(express.json());


const UPLOAD_DIR = process.env.RAILWAY_ENVIRONMENT ? "/tmp/uploads" : "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ==========================================
// MULTER (FILE UPLOAD)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    cb(null, safeName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 90 * 1024 * 1024 }, // 90MB Limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are allowed!"), false);
  }
});

// ==========================================
// PROCESS ROUTE
// ==========================================
app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video uploaded" });

  const inputPath = req.file.path;
  console.log(`Uploading to Cloudinary: ${req.file.originalname}`);

  try {
    const result = await cloudinary.uploader.upload(inputPath, {
      resource_type: "video",
      transformation: [
        { width: 1280, crop: "scale" }, 
        
        { 
          width: "w_sub_200", 
          height: "h_sub_100", 
          gravity: "north_west",
          crop: "crop" 
        }
      ]
    });

    console.log("Processing Complete:", result.secure_url);

    cleanupFile(inputPath);

    res.json({ success: true, url: result.secure_url });

  } catch (error) {
    console.error("Cloudinary Error:", error);
    cleanupFile(inputPath);
    res.status(500).json({ error: "Processing Failed", details: error.message });
  }
});

function cleanupFile(path) {
  try { if (fs.existsSync(path)) fs.unlinkSync(path); } catch (e) {}
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});