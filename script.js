fetch("https://tktk123456-openfrontio-51.deno.dev/")
  .then(res => res.json())
  .then((json) => alert(JSON.stringify(json)))
  .catch(alert);
