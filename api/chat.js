module.exports = async (req, res) => {
  // Hanya izinkan HTTP POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vercel otomatis mem-parse body JSON (tidak perlu JSON.parse manual)
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const apiKey = "bariska_Rgjwcw7Ly0uvWr4sWHLxIV3mS05ZHj2hxBo9W2Tj";

    const response = await fetch("https://api.bariska.cloud/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash",
        input: message
      })
    });

    const data = await response.json();

    // Fungsi pembersih respon AI agar tidak muncul JSON mentah / reasoning
    function extractReply(payload) {
      if (!payload) return "⚠️ Tidak ada respon dari AI.";
      if (typeof payload === 'string') return payload;

      if (payload.error) {
        return `⚠️ Error API: ${payload.error.message || JSON.stringify(payload.error)}`;
      }

      // 1. Ekstraksi format Responses API (data.output berupa array)
      const list = Array.isArray(payload.output)
        ? payload.output
        : (Array.isArray(payload) ? payload : null);

      if (list) {
        const messageItems = list.filter(item => item && (item.type === 'message' || item.role === 'assistant'));
        const targetItems = messageItems.length > 0 ? messageItems : list;

        let textBlocks = [];
        for (const item of targetItems) {
          // Lewati proses berpikir internal (reasoning)
          if (item.type === 'reasoning' && messageItems.length > 0) continue;

          if (typeof item === 'string') {
            textBlocks.push(item);
          } else if (Array.isArray(item.content)) {
            for (const block of item.content) {
              if (typeof block === 'string') {
                textBlocks.push(block);
              } else if (block && block.text) {
                if (block.type === 'reasoning_text' && messageItems.length > 0) continue;
                textBlocks.push(block.text);
              }
            }
          } else if (typeof item.content === 'string') {
            textBlocks.push(item.content);
          } else if (item.text) {
            textBlocks.push(item.text);
          }
        }

        if (textBlocks.length > 0) {
          return textBlocks.join('\n').trim();
        }
      }

      // 2. Format jika data.output berupa objek tunggal
      if (payload.output && typeof payload.output === 'object') {
        if (typeof payload.output.text === 'string') return payload.output.text;
        if (Array.isArray(payload.output.content)) {
          const texts = payload.output.content
            .map(c => (typeof c === 'string' ? c : (c && c.text ? c.text : '')))
            .filter(Boolean);
          if (texts.length > 0) return texts.join('\n').trim();
        }
      }

      // 3. Cadangan jika menggunakan format standar Chat Completions
      if (Array.isArray(payload.choices) && payload.choices[0]) {
        const choice = payload.choices[0];
        if (choice.message && choice.message.content) {
          return typeof choice.message.content === 'string'
            ? choice.message.content
            : JSON.stringify(choice.message.content);
        }
        if (choice.text) return choice.text;
      }

      if (typeof payload.output === 'string') return payload.output;
      if (typeof payload.response === 'string') return payload.response;

      return typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    }

    const reply = extractReply(data);

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};