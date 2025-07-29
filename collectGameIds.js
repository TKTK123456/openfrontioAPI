import path from "node:path";
const __dirname = path.resolve()
async function readFile(filename) {
  try {
    const fullPath = path.join(__dirname, filename);
    const text = await Deno.readTextFile(fullPath);
    return text;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return null;
    }
    throw err;
  }
}
(async () => {
  let arr = await readFile("data-1753801035109.csv")
  arr = arr.split("\n").slice(1).map(i => [i.split(",")[5].slice(0, 10), [i.split(",").slice(0, 2)]]).map(i => ([i[0], {gameId: i[1][0], mapType: i[1][1]}]))
  /*let dateMap = new Map()
  arr.forEach((i) => {
    if (!dateMap.has(i[0])) {
      dateMap.set(i[0])
    }
  })*/
  console.log(arr)
})()
