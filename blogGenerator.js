import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { InferenceClient } from "@huggingface/inference";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------
// 🔗 MongoDB Connection
// -------------------------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------------
// 🧾 Blog Schema
// -------------------------
const blogSchema = new mongoose.Schema({
  title: String,
  details: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
});
const Blog = mongoose.model("Blog", blogSchema);

// -------------------------
// 🤖 Hugging Face AI Setup
// -------------------------
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY;
if (!HF_TOKEN) console.error("⚠️ Missing HF_TOKEN in .env");

const client = new InferenceClient(HF_TOKEN);
const MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct"; // You can try mistralai/Mixtral-8x7B-Instruct too

// -------------------------
// 🧠 Blog Generator Function
// -------------------------
async function generateBlog(title, details) {
  const prompt = `
  Write a beginner-friendly programming blog on the topic: "${title}".
  Include:
  - Simple introduction
  - Key concepts explained clearly
  - Example code snippets (if relevant)
  - Real-world applications
  - A small conclusion

  Details: ${details}
  `;

  try {
    // Using standard (non-stream) chatCompletion
    const response = await client.chatCompletion({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content:
            "You are a beginner-friendly technical writer. Keep explanations simple, clear, and engaging for new developers.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.6,
    });

    const content =
      response?.choices?.[0]?.message?.content?.trim() ||
      "No content generated.";

    // Save blog in MongoDB
    const blog = new Blog({ title, details, content });
    await blog.save();

    console.log(`📝 Blog generated successfully: ${title}`);
    return blog;
  } catch (err) {
    console.error("❌ Error generating blog:", err);
    return { title, details, content: "Failed to generate blog." };
  }
}

// -------------------------
// 🌐 API Routes
// -------------------------
app.post("/generate", async (req, res) => {
  try {
    const { blogs } = req.body; // [{ title, details }]
    if (!blogs || !Array.isArray(blogs))
      return res
        .status(400)
        .json({ error: "Please provide blogs as an array of { title, details }" });

    const results = [];
    for (const b of blogs) {
      const generated = await generateBlog(b.title, b.details);
      results.push(generated);
    }

    res.json(results);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Failed to generate blogs" });
  }
});

app.get("/blog", async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json(blogs);
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Blog Generator running at http://localhost:${PORT}`)
);
