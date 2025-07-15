async function fetchInfo(id, type = "player") {
  let getURL = `https://tktk123456-openfrontio-51.deno.dev/${type}?id=${id}`
  try {
    let res = await fetch(getURL)
    res = await res.json()
    return res
  } catch(e) {
    return `${e} ${id} ${type} ${getURL}`
  }
}
let outJSON = document.getElementById("json")
/*let stats = {
  game: {
    element: document.getElementById("stats.game"),
    totals: {
      gold: {
        element: document.getElementById("stats.game.totals.gold"),
        amount: 0
      }
    }
  }
}
*/
class statsHolder {
  constructor(name = "stats", {type = "holder", prefixText = null, startAmount = 0, context = this, createNewElement = false} = {}) {
    
  }
}
//(async () => outJSON.textContent = JSON.stringify(await fetchInfo("wPHaVYX4", "player"), undefined, 2))();
function getTotalGold(game) {
  let totalGold = 0
  game.players.forEach((player) => {
    player.stats.gold.forEach((amount) => {
      totalGold+=parseInt(amount)
    })
  })
  return totalGold
}
document.getElementById("runGet").addEventListener("click", async () => {
  let type = document.getElementById("getType").value
  let id = document.getElementById("getID").value
  outJSON.textContent = JSON.stringify(await fetchInfo(id, type), undefined, 2)
  if (type == "game") {
    
  }
})
