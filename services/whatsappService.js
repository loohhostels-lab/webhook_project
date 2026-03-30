  import axios from "axios";
  import dotenv from "dotenv";
  dotenv.config();




                                      

  export async function sendWhatsAppMessage(to, text) {
    try {

        const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
        const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
      
      const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

      console.log("📤 Sending to URL:", url);
      console.log("📱 To:", to);
      console.log("🔑 Token first 20 chars:", WHATSAPP_TOKEN?.slice(0, 20));
      console.log("🆔 Phone Number ID:", PHONE_NUMBER_ID);

      const response = await axios.post(
        url,
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

      console.log("✅ WhatsApp Response:", response.data);

    } catch (err) {
      console.log("❌ WhatsApp Error Status:", err.response?.status);
      console.log("❌ WhatsApp Error Data:", err.response?.data);
      console.log("❌ WhatsApp Error Headers:", err.response?.headers);
      console.log("❌ Full Error Message:", err.message);
    }
  }
