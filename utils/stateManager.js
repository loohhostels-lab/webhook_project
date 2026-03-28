const userStates = {};

export function getState(userId) {
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

export function resetState(userId) {
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