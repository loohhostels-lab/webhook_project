import { getState, resetState } from "../utils/stateManager.js";
import { detectIntent } from "../utils/intentDetector.js";
import { extractDetails, mapReplyToState, isJunk } from "../utils/extractor.js";
import { formatHostelResults } from "../utils/formatter.js";
import { fetchFilteredHostels, getAvailableCities, getAreasForCity} from "../services/hostelService.js";
import { sendWhatsAppMessage } from "../services/whatsappService.js";
import { extractAreaWithAI } from "../services/openAiService.js";
import { supabase } from "../config/supabase.js";


const VERIFY_TOKEN = process.env.VERIFY_TOKEN;


export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};




// ✅ MAIN HANDLER
export const handleWebhook = async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const messageId = message.id;
    const userNumber = "+" + message.from;
    const text = (message.text?.body || "").trim();
    if (!text) return res.sendStatus(200);

    console.log("📩 Incoming:", text);

    // Duplicate check
    const { data: exists } = await supabase.from("messages").select("id").eq("message_id", messageId).maybeSingle();
    if (exists) return res.sendStatus(200);

    const { data: user } = await supabase.from("hostel_user").select("user_name").eq("user_number", userNumber).maybeSingle();
    const userName = user?.user_name || "User";

    await supabase.from("messages").insert([{ user_number: userNumber, message: text, name: userName}]);

    const state = getState(userNumber);
    const intent = detectIntent(text, state);
    console.log("🧠 Detected Intent:", intent);

    let reply = "";

    if (intent === "clarify") {
      if (state.lastQuestion === "sharing") {
        reply = "Matlab — akele rehna chahte ho (single room) ya kisi ke saath share karna hai (sharing room)? 🏠";
      } else if (state.lastQuestion === "budget") {
        reply = "Mahine ka kitna rent doge? Jaise 5000, 7000, 10000 💰";
      } else if (state.lastQuestion === "area") {
        reply = "Patna mein kaunse area ke paas chahiye? Jaise Gandhi Maidan, Boring Road, Gola Road 📍";
      } else {
        reply = "Thoda aur batao, main samjha nahi 😊";
      }
    }

    else if (intent === "about") {
      reply = "Main LOOH app ka hostel assistant hoon 🤖 Aapko Patna mein accha hostel dhundne mein madad karta hoon!";
    }

    else if (intent === "pause") {
      reply = "Thik hai 👍 Jab chahiye ho batana, main yahan hoon 🙂";
    }

    else if (intent === "stop") {
      resetState(userNumber);
      reply = "Koi baat nahi 😊 Jab chahiye tab batana!";
    }

    else if (intent === "reset") {
      resetState(userNumber);
      reply = "Naya search shuru karte hain! Kis city me hostel chahiye?";
      getState(userNumber).lastQuestion = "city";
    }

    else if (intent === "greeting") {

      debug("Flow", "Greeting Intent Triggered");
      resetState(userNumber);
      const newState = getState(userNumber);
      newState.lastQuestion = "city";
      console.log(`City ${text}`);
      reply = "Hi 👋 Apni preferred city batayein, jahan aapko hostel chahiye";

    }

    else if (intent === "more") {

      if (state.allHostels && state.allHostels.length > 0) {
        reply = formatHostelResults(state.allHostels);
      } else {
        reply = "Koi baat nahi 😊 Jab chahiye batana, main hoon yahan!";
      }
    }

    else {

      mapReplyToState(text, state);
      extractDetails(text, state);

    if (!state.city) {
    // Pehle check karo: user ne city boli ya nahi
    const availableCities = await getAvailableCities();
    // availableCities = ["patna", "delhi", ...] jo bhi DB mein hai

    // User ka text match karo available cities se
    const userText = text.toLowerCase().trim();
    const matchedCity = availableCities.find(c => userText.includes(c));

    if (matchedCity) {
        // ✅ City DB mein hai — store karo aur area pucho
        state.city = matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1); // "patna" → "Patna"
        state.lastQuestion = "area";
        reply = `${state.city} — accha! Kis area mein chahiye? 📍`;

    } else if (isJunk(text)) {
        // User ne kuch random/junk bheja
        state.lastQuestion = "city";
        const cityList = availableCities.map(c => 
        c.charAt(0).toUpperCase() + c.slice(1)  // "patna" → "Patna"
        ).join(", ");
        reply = `City ka naam batao 🏙️\nHum in cities mein available hain: *${cityList}*`;

    } else {
        // User ne koi city boli jo DB mein nahi hai
        state.lastQuestion = "city";
        const cityList = availableCities.map(c => 
        c.charAt(0).toUpperCase() + c.slice(1)
        ).join(", ");
        reply = `😔 "${text}" mein abhi hum available nahi hain.\n\nHum sirf in cities mein hain:\n*${cityList}*\n\nInmein se koi choose karo 😊`;
    }

}else if (!state.area) {
        const aiArea = await extractAreaWithAI(text);

        if (aiArea) {
            // ✅ User ne area bataya — store karo
            state.area = aiArea;
            state.lastQuestion = "budget";
            reply = "Budget kitna hai? (monthly, jaise 7000) 💰";
        } else {
            // ❌ User ne area nahi bataya — DB se us city ke areas dikhao
            state.lastQuestion = "area";

            const cityAreas = await getAreasForCity(state.city);

            if (cityAreas.length > 0) {
            const areaList = cityAreas.map(a => `• ${a}`).join("\n");
            reply = `${state.city} mein ye areas available hain:\n\n${areaList}\n\nKaunsa area chahiye? 📍`;

            } else {
            // DB mein areas nahi hain — seedha area poochho
            console.log('Aera not comming');
            reply = `${state.city} mein kaunse area mein chahiye? 📍`;
            }
        }

      }  else if (!state.budget) {
        state.lastQuestion = "budget";
        reply = isJunk(text)
          ? "Ek number batao — mahine ka kitna rent afford kar sakte ho? Jaise 5000, 7000, 10000 💰"
          : "Budget kitna hai? (monthly, jaise 7000)";

      } else if (state.budget < 2000) {
        state.lastQuestion = "budget";
        reply = "Minimum budget ₹2000 hona chahiye. Thoda zyada budget batao? 💰";

      } else if (!state.sharing) {
        state.lastQuestion = "sharing";
        reply = isJunk(text)
          ? "Bas itna batao — akele rehna hai (single) ya kisi ke saath room share karna hai (sharing)? 🏠"
          : "Single ya sharing room chahiye?";

      } else {

        state.lastQuestion = null;
        state.flowComplete = true;

        const hostels = await fetchFilteredHostels(state);
        state.allHostels = hostels;
        reply = formatHostelResults(hostels);
      }
    }

    await sendWhatsAppMessage(userNumber, reply);

  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }

  res.sendStatus(200);
};



// Simple debug helper
function debug(step, data = "") {
  console.log(`🔍 [${step}]`, data);
}