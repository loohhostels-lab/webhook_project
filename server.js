const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();


const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

app.post("/webhook", async (req, res) => {
  const body = req.body;

  try {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const userNumber = message.from;
    const text = message.text?.body || "";
    const type = message.type;

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          user_number: userNumber,
          message: text,
          type: type
        }
      ]);

    if (error) {
      console.log("Supabase Error:", error.message);
    } else {
      console.log("Message saved ✅");
    }

  } catch (err) {
    console.log("Error:", err.message);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});