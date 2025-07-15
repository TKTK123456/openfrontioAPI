async function fetchInfo(id, type = "player") {
  try {
    let getURL = `https://tktk123456-openfrontio-51.deno.dev/${type}?id=${id}`
    let res = await fetch(getURL)
    res = await res.json()
    return res
  } catch(e) {
    alert(e)
    return e
  }
}
let outJSON = document.getElementById("json")
//(async () => outJSON.textContent = JSON.stringify(await fetchInfo("wPHaVYX4", "player"), undefined, 2))();
document.getElementById("runGet").addEventListener("click", async () => {
  let type = document.getElementById("getType").value
  let id = document.getElementById("getID").value
  outJSON.textContent = JSON.stringify(await fetchInfo(id, type), undefined, 2)
})
