const express = require('express');
const cors = require('cors'); // 1. Tambahkan ini
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const app = express();


app.use(express.json());
app.use(cors()); // 2. Tambahkan ini di atas route apa pun
// Melayani file statis (HTML, JS, CSS) dari folder saat ini
app.use(express.static('.'));

// --- ENDPOINT API GEMINI ---
app.post('/api/get-ai-suggestion', async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "API Key belum di-set di environment variable!" });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Pastikan pakai 1.5-flash
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ suggestion: response.text() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server jalan di http://localhost:${port}`);
    console.log(`Klik 'Web Preview' di pojok kanan atas Cloud Shell!`);
});
module.exports = app;