import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

const userStates = {};

function getState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      city: null,
      area: null,
      budget: null,
      sharing: null,
      lastQuestion: null,
      flowComplete: false,
      allHostels: [], 
      offset: 0,       
    };
  }
  return userStates[userId];
}

function resetState(userId) {
  userStates[userId] = {
    city: null,
    area: null,
    budget: null,
    sharing: null,
    lastQuestion: null,
    flowComplete: false,
    allHostels: [],
    offset: 0,
  };
  return userStates[userId];
}

// 🔍 EXTRACT
function extractDetails(message, state) {
  const text = message.toLowerCase();

//   if (text.includes("patna")) state.city = "Patna";
//   if (text.includes("gola")) state.area = "Gola Road";
//   if (text.includes("junction")) state.area = "Junction";
//   if (text.includes("gandhi maidan")) state.area = "Gandhi Maidan";
//   if (text.includes("boring road")) state.area = "Boring Road";
//   if (text.includes("kankarbagh")) state.area = "Kankarbagh";

  const budgetMatch = message.match(/(\d[\d,]*)\s*k?/i);
  if (budgetMatch) {
    let amount = parseInt(budgetMatch[1].replace(",", ""));
    if (message.toLowerCase().includes("k")) amount *= 1000;
    state.budget = amount;
  }

  if (text.includes("single")) state.sharing = "single";
  if (text.includes("sharing") || text.includes("double")) state.sharing = "sharing";

  return state;
}

// 🚫 JUNK / REFUSAL DETECTION
const JUNK_EXACT = new Set(["no","na","nahi","nahin","nai","nope","nothing","null","none","nhi","mat","ha","haan","hmm","hm"]);
const JUNK_STARTS = ["nahi ","nahin ","nahi","no ","nope","idk","pata nahi","kuch nahi","dont know","nhi ","nai ","nah ","aapse","keo ","kyun ","kyu "];
const REFUSAL_PATTERNS = ["nahi batay","nahi karega","nahi denge","nahi dange","nahi bataunga","nahi batayenge","nahi chaiye","nahi chahiye","mat pucho","nahi bolunga"];

function isJunk(message) {
  const t = message.toLowerCase().trim();
  if (t.length < 2) return true;
  if (JUNK_EXACT.has(t)) return true;
  if (JUNK_STARTS.some(p => t.startsWith(p))) return true;
  if (REFUSAL_PATTERNS.some(p => t.includes(p))) return true;
  return false;
}

function looksLikePlace(message) {
  const t = message.toLowerCase().trim();
  const badWords = ["keo","kyun","kyu","batao","bato","aapse","tumse","mujhe","hamko","please","yaar","bhai","bhaiya"];
  if (badWords.some(w => t.includes(w))) return false;
  if (t.split(" ").length > 4) return false;
  return true;
}

function mapReplyToState(message, state) {
  if (isJunk(message)) return;

  const text = message.toLowerCase().trim();
//   if (state.lastQuestion === "city") {

//     if (looksLikePlace(message)) state.city = message;
    
//   } 

//    if (state.lastQuestion === "area") {
//     if (looksLikePlace(message)) state.area = message;
//   } 


   if (state.lastQuestion === "budget") {
    const match = message.match(/\d[\d,]*/);
    if (match) state.budget = parseInt(match[0].replace(",", ""));

  } else if (state.lastQuestion === "sharing") {
    
    if (text.includes("single")) state.sharing = "single";
    else if (text.includes("sharing") || text.includes("double") || text.includes("share")) state.sharing = "sharing";
  }
}

function detectIntent(message, state) {
  const text = message.toLowerCase().trim();

  if (["hi", "hello", "hey", "hai", "hii", "helo"].includes(text)) return "greeting";

  if (
    text.includes("kaun ho") || text.includes("kaun hain") ||
    text.includes("tumhara naam") || text.includes("tera naam") ||
    text.includes("aap kaun") || text.includes("naam kya") ||
    text.includes("naam bata") || text.includes("naam hai")
  ) return "about";

  if (text.includes("reset") || text.includes("fir se") || text.includes("new search") || text.includes("dobara")) return "reset";

  // ✅ "more" — expanded with dusra, next, aur, etc.
  if (state.flowComplete && (
    text === "more" ||
    text === "next" ||
    text.includes("dusra") ||
    text.includes("doosra") ||
    text.includes("aur dikhao") ||
    text.includes("aur batao") ||
    text.includes("aur show") ||
    text.includes("kuch aur") ||
    text.includes("next dikhao") ||
    text.includes("accha nahi") ||
    text.includes("pasand nahi") ||
    text.includes("sahi nahi") ||
    text.includes("nahi chahiye") ||
    text.includes("nahi chaiye")
  )) return "more";

  if (
    text.includes("nahi lena") || text.includes("band karo") ||
    text.includes("mat dikhao") || text.includes("rehne do")
  ) return "stop";

  if (
    text.includes("ruko") || text.includes("ab rahne do") ||
    text.includes("rahne do") || text.includes("wait") ||
    text.includes("ek minute") || text.includes("pasand aaya") ||
    text.includes("pasand aayi") || text.includes("book karna") ||
    text.includes("theek hai") || text.includes("thik hai") ||
    text === "ok"
  ) return "pause";

  if ((text === "kya" || text === "?" || text === "matlab") && state.lastQuestion) return "clarify";

  return "normal";
}

// 🔑 ENV
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ VERIFY
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
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
      resetState(userNumber);
      const newState = getState(userNumber);
      newState.lastQuestion = "city";
      reply = "Hi 👋 Apni preferred city batayein, jahan aapko hostel chahiye";
    }

    else if (intent === "more") {
      // ✅ Show all cached results again
      if (state.allHostels && state.allHostels.length > 0) {
        reply = formatHostelResults(state.allHostels);
      } else {
        reply = "Koi baat nahi 😊 Jab chahiye batana, main hoon yahan!";
      }
    }

    else {
      mapReplyToState(text, state);
      extractDetails(text, state);

      console.log("STATE after extract:", JSON.stringify(state));


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

}

            else if (!state.area) {
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
        }

else if (!state.budget) {
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
        // ✅ ALL INFO COLLECTED — fetch all, show all at once
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
});


// ✅ FORMAT — shows all hostels at once
function formatHostelResults(hostels) {
  if (!hostels || hostels.length === 0) {
    return "😔 Sorry, aapke filter ke hisaab se koi hostel nahi mila.\n\nKooshish karo:\n• Budget thoda badhao\n• Alag area try karo\n• 'reset' likh ke naya search karo";
  }

  let reply = `🏠 *${hostels.length} hostel${hostels.length > 1 ? "s" : ""} mile aapke liye:*\n\n`;

  hostels.forEach((h, i) => {
    reply += `*${i + 1}. ${h.hostel_name}*\n`;

    // ✅ Full address — all DB fields combined
    const addressParts = [];
    if (h.address)       addressParts.push(h.address);
    if (h.small_address && h.small_address !== h.address) addressParts.push(h.small_address);
    if (h.area)          addressParts.push(h.area);
    if (h.city)          addressParts.push(h.city);
    if (h.state)         addressParts.push(h.state);
    if (h.pincode)       addressParts.push(h.pincode);

    const fullAddress = addressParts.join(", ");
    if (fullAddress) reply += `📍 ${fullAddress}\n`;

    reply += `💰 ₹${h.min_rent}/month se shuru\n`;

    if (h.amenities) {
      const amenitiesList = Array.isArray(h.amenities)
        ? h.amenities.slice(0, 3).join(", ")
        : String(h.amenities).split(",").slice(0, 3).join(", ");
      if (amenitiesList) reply += `✅ ${amenitiesList}\n`;
    }

    if (h.contact_number || h.phone) {
      reply += `📞 ${h.contact_number || h.phone}\n`;
    }

    reply += "\n";
  });

  reply += `Koi pasand aaya? Ya 'reset' likh ke naya search karo 😊`;
  return reply;
}


async function fetchFilteredHostels(state) {
  // STEP 1: Owners fetch
  let ownersQuery = supabase
    .from("hostel_owners")
    .select("*")
    .eq("status", "verified");

  if (state.gender) {
    ownersQuery = ownersQuery.eq("hostel_category", state.gender);
  }

  let { data: owners } = await ownersQuery;
  if (!owners || owners.length === 0) return [];

  // STEP 2: City + area filter with nearby area matching
  if (state.city || state.area) {
    const citySearch = (state.city || "").toLowerCase();
    const areaSearch = (state.area || "").toLowerCase();

    // ✅ Nearby areas map — if user says X, also match these related areas
    const NEARBY_AREAS = {
      "boring road": ["boring road", "boring canal road", "nageshwar colony", "kidwaipuri", "rajendra nagar", "patliputra", "boring road chauraha", "chauraha"],
      "gandhi maidan": ["gandhi maidan", "fraser road", "exhibition road", "ashok rajpath", "dak bungalow", "biscomaun chowk"],
      "gola road": ["gola road", "gola", "danapur", "khagaul", "saguna more", "saguna"],
      "kankarbagh": ["kankarbagh", "kankar bagh", "rajendra nagar", "anisabad", "bypass road"],
      "junction": ["patna junction", "station road", "mithapur", "nala road", "hardinge road", "ramna road"],
    };

    const areaKeywords = areaSearch
      ? (NEARBY_AREAS[areaSearch] || [areaSearch])
      : [];

    owners = owners.filter(o => {
      const city = (o.city || "").toLowerCase();
      const address = (o.address || "").toLowerCase();
      const small = (o.small_address || "").toLowerCase();
      const combined = city + " " + address + " " + small;

      const cityMatch = !citySearch || combined.includes(citySearch);

      // ✅ Match any of the nearby area keywords
      const areaMatch = areaKeywords.length === 0 ||
        areaKeywords.some(kw => combined.includes(kw));

      return cityMatch && areaMatch;
    });
  }

  if (owners.length === 0) return [];

  // STEP 3: Rooms fetch
  const ownerIds = owners.map(o => o.user_id);

  let roomsQuery = supabase
    .from("rooms_new")
    .select("*")
    .in("room_owner_id", ownerIds);

  if (state.budget) {
    roomsQuery = roomsQuery.lte("rent", state.budget);
  }

  if (state.sharing) {
    const capacity = state.sharing === "single" ? 1 : 2;
    roomsQuery = roomsQuery.eq("capacity", capacity);
  }

  const { data: rooms } = await roomsQuery;
  if (!rooms || rooms.length === 0) return [];

  // STEP 4: Map rooms → owners
  const roomsByOwner = {};
  rooms.forEach(r => {
    if (!roomsByOwner[r.room_owner_id]) roomsByOwner[r.room_owner_id] = [];
    roomsByOwner[r.room_owner_id].push(r);
  });

  // STEP 5: Final result
  const result = [];
  for (const owner of owners) {
    const matchedRooms = roomsByOwner[owner.user_id] || [];
    if (matchedRooms.length === 0) continue;

    result.push({
      ...owner,
      rooms: matchedRooms,
      min_rent: Math.min(...matchedRooms.map(r => r.rent || 0))
    });
  }

  return result;
}


// 📤 SEND
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

  } catch (err) {
    console.log("WhatsApp Error:", err.message);
  }
}

// 🏙️ DB se saari available cities fetch karo
async function getAvailableCities() {
  const { data, error } = await supabase
    .from("hostel_owners")
    .select("city")
    .eq("status", "verified");

  if (error || !data) return [];

  // Unique cities, lowercase mein
  const cities = [...new Set(data.map(o => o.city?.toLowerCase().trim()).filter(Boolean))];
  return cities;
}

async function extractAreaWithAI(message) {
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

async function getAreasForCity(city) {
  const { data, error } = await supabase
    .from("hostel_owners")
    .select("address")
    .eq("status", "verified")
    .ilike("city", `%${city}%`);

  if (error || !data || data.length === 0) return [];

  const areas = new Set();
  
  data.forEach(o => {
    if (o.address && o.address.trim()) {
      areas.add(o.address.trim());
    }
  });

  return [...areas].slice(0, 8);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));