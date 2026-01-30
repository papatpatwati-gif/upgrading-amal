import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from 'cors';

// Inisialisasi Middleware CORS
const corsMiddleware = cors({
  methods: ['POST', 'GET', 'OPTIONS'],
});

// Helper untuk menjalankan middleware di Vercel Functions
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // 1. Jalankan CORS
  await runMiddleware(req, res, corsMiddleware);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key tidak ditemukan di environment Vercel." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Gunakan model yang sudah stabil: gemini-1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return res.status(200).json({ suggestion: response.text() });
  } catch (error) {
    console.error("Server-side AI Error:", error);
    return res.status(500).json({ error: "Gagal memproses AI: " + error.message });
  }
}