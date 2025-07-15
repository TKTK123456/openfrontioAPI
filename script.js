function fetchInfo(id, from = "player") {
  if (from==="player") return fetch(`https://tktk123456-openfrontio-51.deno.dev/player?id=${id}`).then(res => res.json()).then((json) => return json).catch((e) => return e);
}
