module.exports = async (req, res) => {
  // Hanya izinkan HTTP POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    // Ambil API Key dari Environment Variable Vercel
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Variabel AI_API_KEY belum dikonfigurasi di dashboard Vercel.' 
      });
    }

    // Gunakan timeout abort agar aman dari batas execution limit Vercel
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 9000);

    let response;
    try {
      response = await fetch("https://api.bariska.cloud/v1", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: JSON.stringify({
          model: "glm-5.3-flash",
          messages: [
            {
              role: "system",
              content: "Kamu adalah asisten matematika dan koding pada kalkulator cerdas. Berikan jawaban yang tepat, ringkas, dan jelas dalam bahasa Indonesia."
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 800,
          temperature: 0.5
        })
      });
    } catch (err) {
      clearTimeout(timeoutTimer);
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Waktu tunggu habis (>9 detik).' });
      }
      throw err;
    }
    clearTimeout(timeoutTimer);

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return res.status(502).json({
        error: `Server AI mengembalikan HTML (kemungkinan diblokir Cloudflare): ${rawText.slice(0, 100)}`
      });
    }

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.message || rawText;
      return res.status(response.status).json({ error: `Error API (\({response.status}):\){errMsg}` });
    }

    let reply = data?.choices?.[0]?.message?.content || data?.output || "⚠️ Tidak ada teks balasan.";
    return res.status(200).json({ reply: reply.trim() });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};