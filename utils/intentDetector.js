
export function detectIntent(message, state) {
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