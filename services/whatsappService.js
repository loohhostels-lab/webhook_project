import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const  PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID
const  WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN

export async function sendWhatsAppMessage(to, text) {
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

  } catch (err) {
    console.log("WhatsApp Error:", err.message);
  }
}