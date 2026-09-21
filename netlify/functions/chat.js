exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message } = JSON.parse(event.body);
    
    // Menggunakan API Key Atria milikmu secara aman di server
    const apiKey = "atr_LXJz-RWyY0L_Dmczub0PixlqZ0AIZNZT";
    
    const response = await fetch("https://api.atria-asi.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "Atria Dawn-Preview",
        input: message
      })
    });

    const data = await response.json();

    let reply = "";
    if (data.output) {
      reply = typeof data.output === 'string' ? data.output : (data.output.text || JSON.stringify(data.output));
    } else if (data.response) {
      reply = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
    } else {
      reply = data.error ? (data.error.message || JSON.stringify(data.error)) : JSON.stringify(data);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};