async function fetchInfo(id, type = "player") {
  let getURL = `https://tktk123456-openfrontio-51.deno.dev/${type}?id=${id}`
  try {
    let res = await fetch(getURL)
    res = await res.json()
    return res
  } catch(e) {
    alert(`${e} ${id} ${type} ${getURL}`)
    return `${e} ${id} ${type} ${getURL}`
  }
}
let outJSON = document.getElementById("json")
let stats = {
  elm: document.getElementById("stats"),
  game: {
    elm: document.getElementById("stats.game"),
    totals: {
      gold: {
        elm: document.getElementById("stats.game.totals.gold"),
        amount: 0
      }
    }
  }
}

function getTotalGold(game) {
  try {
  alert("hi")
  stats.game.totals.gold.amount = 0
    alert("ho")
  game.info.players.forEach((player) => {
    try {
      player.stats.gold.forEach((amount) => {
        stats.game.totals.gold.amount+=parseInt(amount)
      })
    } catch (e) {}
  })
  //alert(stats.game.totals.gold.amount)
  stats.game.totals.gold.elm.textContent = stats.game.totals.gold.amount
  return stats.game.totals.gold.amount
  } catch (e) {
    alert(e)
  }
}
document.getElementById("runGet").addEventListener("click", async () => {
  let type = document.getElementById("getType").value
  let id = document.getElementById("getID").value
  let data = await fetchInfo(id, type)
  outJSON.textContent = JSON.stringify(data, undefined, 2)
  stats.game.elm.hidden = true;
  if (type == "game") {
    stats.game.elm.hidden = false;
    getTotalGold(data)
  }
})
document.addEventListener("keydown", (e) => {
  if (e.key === "j") {
    outJSON.hidden = !outJSON.hidden
  }
})
