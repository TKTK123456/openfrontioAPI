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
  arr = arr.split("\n").slice(1).map(i => i.split(",").slice(0, 2)).map(i => ({gameId: i[0], mapType: i[1]}))
  console.log(arr)
})()
