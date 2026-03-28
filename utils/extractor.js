
export function extractDetails(message, state) {
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


// ---------------- JUNK CHECK ----------------

const JUNK_EXACT = new Set([
  "no","na","nahi","nahin","nai","nope","nothing","null","none",
  "nhi","mat","ha","haan","hmm","hm"
]);

const JUNK_STARTS = [
  "nahi ","nahin ","no ","nope","idk","pata nahi",
  "kuch nahi","dont know","nhi ","nai ","nah ",
  "aapse","keo ","kyun ","kyu "
];

const REFUSAL_PATTERNS = [
  "nahi batay","nahi karega","nahi denge","nahi dange",
  "nahi bataunga","nahi batayenge","nahi chaiye",
  "nahi chahiye","mat pucho","nahi bolunga"
];

export function isJunk(message) {
  const t = message.toLowerCase().trim();
  if (t.length < 2) return true;
  if (JUNK_EXACT.has(t)) return true;
  if (JUNK_STARTS.some(p => t.startsWith(p))) return true;
  if (REFUSAL_PATTERNS.some(p => t.includes(p))) return true;
  return false;
}


// ---------------- PLACE CHECK ----------------

export function looksLikePlace(message) {
  const t = message.toLowerCase().trim();

  const badWords = [
    "keo","kyun","kyu","batao","bato","aapse",
    "tumse","mujhe","hamko","please","yaar","bhai","bhaiya"
  ];

  if (badWords.some(w => t.includes(w))) return false;
  if (t.split(" ").length > 4) return false;

  return true;
}


// ---------------- MAP USER REPLY ----------------

export function mapReplyToState(message, state) {
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

console.log("EXPORTS CHECK:", {
  extractDetails,
  mapReplyToState
});