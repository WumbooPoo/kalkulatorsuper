exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message } = JSON.parse(event.body);
    
    // API Key Atria
    const apiKey = "atr_r5GSG8S179UUgsOEXleIBLQVd_pcIpzB";
    
    const response = await fetch("https://api.atria-asi.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "Atria-Dawn-Preview",
        input: message
      })
    });

    const data = await response.json();

    // Fungsi parser untuk menyaring teks jawaban bersih dari Atria API
    function extractReply(payload) {
      if (!payload) return "⚠️ Tidak ada respon dari AI.";
      if (typeof payload === 'string') return payload;

      if (payload.error) {
        return `⚠️ Error API: ${payload.error.message || JSON.stringify(payload.error)}`;
      }

      // 1. Ekstraksi format Responses API (data.output berupa array of message/reasoning)
      const list = Array.isArray(payload.output) 
        ? payload.output 
        : (Array.isArray(payload) ? payload : null);

      if (list) {
        // Prioritaskan item yang bertipe "message" atau role "assistant"
        const messageItems = list.filter(item => item && (item.type === 'message' || item.role === 'assistant'));
        const targetItems = messageItems.length > 0 ? messageItems : list;

        let textBlocks = [];
        for (const item of targetItems) {
          // Lewati blok penalaran (reasoning) jika pesan jawaban utama sudah ditemukan
          if (item.type === 'reasoning' && messageItems.length > 0) continue;

          if (typeof item === 'string') {
            textBlocks.push(item);
          } else if (Array.isArray(item.content)) {
            for (const block of item.content) {
              if (typeof block === 'string') {
                textBlocks.push(block);
              } else if (block && block.text) {
                // Abaikan teks draft reasoning internal
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

      // 3. Cadangan format standar completions (choices[0].message.content)
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};