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

    const apiKey = "bariska_Rgjwcw7Ly0uvWr4sWHLxIV3mS05ZHj2hxBo9W2Tj";

    // Gunakan timeout abort 9 detik agar fungsi tidak dibunuh paksa oleh Vercel (limit 10s)
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 9000);

    let response;
    try {
      // Gunakan model glm-5.3-flash yang cepat dan tidak ada jeda 'reasoning' panjang
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
              content: "Kamu adalah asisten kalkulator super cerdas. Jawab soal matematika, rumus, atau kodingan secara singkat, jelas, dan akurat."
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
        return res.status(504).json({
          error: "⚠️ Waktu tunggu habis (>9 detik). Server AI merespons terlalu lama untuk limit hosting gratis."
        });
      }
      throw err;
    }
    clearTimeout(timeoutTimer);

    // Baca respon sebagai teks mentah terlebih dahulu untuk mencegah crash JSON parse
    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return res.status(502).json({
        error: `Server AI mengembalikan HTML (kemungkinan server sedang sibuk/down): ${rawText.slice(0, 120)}`
      });
    }

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.message || rawText;
      return res.status(response.status).json({ error: `⚠️ Error API (\({response.status}):\){errMsg}` });
    }

    // Ambil teks balasan
    let reply = "";
    if (data?.choices?.[0]?.message?.content) {
      reply = data.choices[0].message.content;
    } else if (typeof data?.output === 'string') {
      reply = data.output;
    }

    if (!reply) {
      reply = "⚠️ Tidak ada teks balasan yang diterima dari model AI.";
    }

    return res.status(200).json({ reply: reply.trim() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};