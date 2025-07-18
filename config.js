import fs from 'node:fs'
const config = JSON.parse(fs.readFileSync("config.json"))
export default config
console.log(config)
