const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const axios = require("axios");


const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const OPENAI_KEY = process.env.OPENAI_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/* ---------------- WEBHOOK VERIFY ---------------- */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook Verified ✅");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

/* ---------------- MAIN WEBHOOK ---------------- */
app.post("/webhook", async (req, res) => {
  const body = req.body;

  try {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const rawNumber = message.from;
    const userNumber = "+" + rawNumber;
    const text = message.text?.body || "";
    const type = message.type;

    /* ---------------- GET USER ---------------- */
    const { data: user } = await supabase
      .from("hostel_user")
      .select("user_name")
      .eq("user_number", userNumber)
      .maybeSingle();

    const userName = user['user_name'] || "Unknown";

    /* ---------------- SAVE MESSAGE ---------------- */
    await supabase.from("messages").insert([
      {
        user_number: userNumber,
        message: text,
        type: type,
        name: userName
      }
    ]);

    console.log("Message saved ✅");

    /* ---------------- AI RESPONSE ---------------- */
    const aiReply = await getAIResponse(text, userName);

    /* ---------------- SEND WHATSAPP REPLY ---------------- */
    await sendWhatsAppMessage(userNumber, aiReply);

  } catch (err) {
    console.log("Server Error:", err.message);
  }

  res.sendStatus(200);
});

/* ---------------- AI FUNCTION ---------------- */
async function getAIResponse(userMessage, userName) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a WhatsApp hostel assistant bot.
User name is ${userName}.

Rules:
- Reply short and friendly (Hinglish mix)
- If user asks about hostel, ask city, budget, sharing type
- Be helpful and conversational
          `
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;
}

/* ---------------- SEND MESSAGE FUNCTION ---------------- */
async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("AI Reply sent ✅");
  } catch (err) {
    console.log("WhatsApp Send Error:", err.message);
  }
}

/* ---------------- SERVER ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});