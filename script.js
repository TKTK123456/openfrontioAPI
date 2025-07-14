fetch('https://jsonplaceholder.typicode.com/posts/1')
  .then((response) => response.json())
  .then((json) => alert(json));
async function getPlayerData(id) {
    const response = await fetch(`https://api.openfront.io/player/${id}`);
    let output = await response.json()
    return output
}
(async () => {
    alert(JSON.stringify(await getPlayerData("wPHaVYX4")))
})();
