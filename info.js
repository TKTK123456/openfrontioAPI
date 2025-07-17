const kv = await Deno.openKv();
export const sets = {
  add: async function(key, value) {
    let allVals = await kv.get(key);
    allVals = allVals.value;
    if (!allVals) {
      allVals = new Set();
    }
    allVals.add(value);
    kv.set(key, allVals);
  },
  get: async function(key) {
    let output = await kv.get(key);
    return output.value;
  }
}
async function updateGameInfo() {
  
}
