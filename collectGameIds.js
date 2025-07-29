import path from "node:path";

const __dirname = path.resolve();

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
  let arr = await readFile("data-1753801035109.csv");
  if (!arr) {
    console.error("File not found or unreadable");
    return;
  }

  arr = arr
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(line => {
      const parts = line.split(",");
      if (parts.length < 6) return null;
      const date = parts[5]?.slice(0, 10);
      const gameId = parts[0];
      const mapType = parts[1];
      return [date, { gameId, mapType }];
    })
    .filter(Boolean);

  console.log(arr);
})();
