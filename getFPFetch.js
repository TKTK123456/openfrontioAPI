import fetchFPGameIds from './fetchFrontPlusDump.js'
import { remoteVars, remoteJsonStore } from './remoteVarStore.js'
export default async function getFPFetch() {
  console.log("Getting FrontPlus dump.")
  const gameIds = await fetchFPGameIds(1, {startTime:new Date(remoteVars.lastFPFetch-60000)})
  gameIds.forEach((id) => {
    remoteVars.active.ids.add(id)
    remoteVars.active.ws.set(id, "unknown")
  })
  remoteVars.lastFPFetch = Date.now()
  await remoteJsonStore.save()
}
if (process.argv[2]==="--manualFetch"||process.argv[2]==="-m") {
  getFPFetch()
}