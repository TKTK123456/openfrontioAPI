import path from "node:path";

const __dirname = path.resolve();
async function saveFile(dateStr, entries) {
    const filename = `${dateStr}.ndjson`;
    // Save JSON lines (ndjson) format, each entry stringified on separate line
    const content = JSON.stringify(entries.flat(Infinity))
    const { error } = await supabase.storage.from("logs").upload(filename, new Blob([content]), {
      upsert: true,
      contentType: "application/x-ndjson",
    });
    if (error) {
      console.error(`Error uploading log file ${filename}:`, error);
    }
}
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
    const date = parts[5].slice(0, 10).replace(/^"|"$/g, "");
    const gameId = parts[0].replace(/^"|"$/g, "");
    const mapType = parts[1].replace(/^"|"$/g, "");
    return [date, { gameId, mapType }];
  })
  .filter(Boolean);

  const grouped = {};
arr.forEach(([date, entry]) => {
  if (!grouped[date]) grouped[date] = [];
  grouped[date].push(entry);
});
})();
