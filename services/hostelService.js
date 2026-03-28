import { supabase } from "../config/supabase.js";

export async function fetchFilteredHostels(state) {
  let { data: owners } = await supabase
    .from("hostel_owners")
    .select("*")
    .eq("status", "verified");

  if (!owners) return [];

  if (state.city) {
    owners = owners.filter(o =>
      (o.city || "").toLowerCase().includes(state.city.toLowerCase())
    );
  }

  const ownerIds = owners.map(o => o.user_id);

  let { data: rooms } = await supabase
    .from("rooms_new")
    .select("*")
    .in("room_owner_id", ownerIds);

  if (!rooms) return [];

  if (state.budget) {
    rooms = rooms.filter(r => r.rent <= state.budget);
  }

  const result = [];

  owners.forEach(owner => {
    const ownerRooms = rooms.filter(r => r.room_owner_id === owner.user_id);
    if (ownerRooms.length > 0) {
      result.push({
        ...owner,
        min_rent: Math.min(...ownerRooms.map(r => r.rent))
      });
    }
  });

  return result;
}

export async function getAvailableCities() {
  const { data, error } = await supabase
    .from("hostel_owners")
    .select("city")
    .eq("status", "verified");

  if (error || !data) return [];

  // Unique cities, lowercase mein
  const cities = [...new Set(data.map(o => o.city?.toLowerCase().trim()).filter(Boolean))];
  return cities;
}


export async function getAreasForCity(city) {
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