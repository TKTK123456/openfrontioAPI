const kv = await Deno.openKv();
export async function addToKvSet(key, value) {
  let allVals = await kv.get(key)
  allVals = allVals.value
  if (!allVals) {
    allVals = new Set()
  }
  allVals.add(value)
  kv.set(key, allVals)
}
export const sets = {
  add: async function(key, value) {
    let allVals = await kv.get(key)
    allVals = allVals.value
    if (!allVals) {
      allVals = new Set()
    }
    allVals.add(value)
    kv.set(key, allVals)
  },
  get: async function(key, value) {
    
  }
}
async function updateGameInfo() {
  
}
