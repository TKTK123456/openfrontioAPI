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
let outJSON = document.getElementById("json")
//(async () => outJSON.textContent = JSON.stringify(await fetchInfo("wPHaVYX4", "player"), undefined, 2))();
document.getElementById("")
