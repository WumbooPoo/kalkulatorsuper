if (!message) {
  return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
}

const apiKey = "bariska_Rgjwcw7Ly0uvWr4sWHLxIV3mS05ZHj2hxBo9W2Tj";

// 1. Endpoint lengkap wajib mengarah ke /v1/chat/completions
const response = await fetch("https://api.bariska.cloud/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  // 2. Format standar OpenAI Chat Completions (menggunakan array messages)
  body: JSON.stringify({
    model: "deepseek-v4.1-flash",
    messages: [
      {
        role: "system",
        content: "Kamu adalah asisten pintar Super Calculator Workstation. Bantu jawab pertanyaan matematika, perhitungan rumus, logika sains, dan solusi pemrograman secara ringkas, jelas, dan akurat."
      },
      {
        role: "user",
        content: message
      }
    ],
    temperature: 0.7
  })
});

// 3. Baca respon sebagai teks terlebih dahulu untuk mencegah crash "Unexpected token <"
const rawText = await response.text();
let data;
try {
  data = JSON.parse(rawText);
} catch (e) {
  return res.status(502).json({ 
    error: `Server Bariska mengembalikan respon HTML (kemungkinan server sedang sibuk/down): ${rawText.slice(0, 100)}` 
  });
}

if (!response.ok) {
  const errMsg = data?.error?.message || data?.message || rawText;
  return res.status(response.status).json({ error: `Error API Bariska (\({response.status}):\){errMsg}` });
}

// 4. Ekstraksi teks balasan dari format OpenAI / DeepSeek
let reply = "";
if (data?.choices?.[0]?.message) {
  const msg = data.choices[0].message;
  reply = msg.content || msg.reasoning_content || "";
} else if (typeof data?.output === 'string') {
  reply = data.output;
}

if (!reply) {
  reply = "⚠️ Tidak ada balasan teks yang diterima dari model AI.";
}

return res.status(200).json({ reply: reply.trim() });