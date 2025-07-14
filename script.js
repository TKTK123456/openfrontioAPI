function fetchPlayerInfo(id) {
  fetch(`https://tktk123456-openfrontio-51.deno.dev/player?id=${id}`)
    .then(res => res.json())
    .then((json) => alert(JSON.stringify(json)))
    .catch(alert);
}
