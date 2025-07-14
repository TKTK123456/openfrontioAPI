async function getPlayerData(id) {
    const response = await fetch(`https://api.openfront.io/player/${id}`);
    let output = await response.json()
    return output
}
(async () => {
    alert(JSON.stringify(await getPlayerData("wPHaVYX4")))
})();
