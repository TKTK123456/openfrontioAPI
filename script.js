fetch("https://corsproxy.io/?https://api.openfront.io/player/wPHaVYX4")
  .then(res => res.json())
  .then((json) => alert(JSON.stringify(json)))
  .catch(alert);
