async function fetchInfo(id, from = "player") {
  try {
    if (from==="player") {
      let res = await fetch(`https://tktk123456-openfrontio-51.deno.dev/player?id=${id}`)
      res = await res.json()
      return res
    }
  } catch(e) {
    return e
  }
}
document.getElementById("outputJson").textContent = await fetchInfo("wPHaVYX4", "player")
