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
  stats.game.totals.gold.amount = 0
  game.info.players.forEach((player) => {
    try {
      player.stats.gold.forEach((amount) => {
        stats.game.totals.gold.amount+=parseInt(amount)
      })
    } catch (e) {}
  })
  stats.game.totals.gold.elm.textContent = stats.game.totals.gold.amount
  return stats.game.totals.gold.amount
  } catch (e) {
    alert(e)
  }
}
let toggleFormat = 0
let jsonData;
function updateJSON(data = jsonData) {
  if (toggleFormat) {
    outJSON.textContent = JSON.stringify(data, undefined, 0)
  } else {
    outJSON.textContent = JSON.stringify(data, undefined, 2)
  }
}
document.getElementById("runGet").addEventListener("click", async () => {
  let type = document.getElementById("getType").value
  let id = document.getElementById("getID").value
  let data = await fetchInfo(id, type)
  jsonData = data
  updateJSON(data)
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
  if (e.key === "f") {
    if (toggleFormat) {
      toggleFormat = 0
    } else {
      toggleFormat = 1
    }
    updateJSON()
  }
})
