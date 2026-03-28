export function formatHostelResults(hostels) {
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

 
