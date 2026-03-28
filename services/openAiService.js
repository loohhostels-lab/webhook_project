
export async function extractAreaWithAI(message) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a location extractor. User is looking for a hostel in India.
Extract the area/locality name from the message if present.
Reply ONLY in this JSON format:
{"area": "Boring Road"} if area found
{"area": null} if no area found

Rules:
- Only extract if it looks like a real place/area name
- Ignore random text like "aap option do", "batao", "kuch bhi"
- Do not make up areas`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.area || null;

  } catch (err) {
    console.log("OpenAI Error:", err.message);
    return null;
  }
}