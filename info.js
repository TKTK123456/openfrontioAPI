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
async function updateGameInfo() {
  
}
