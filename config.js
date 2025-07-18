import fs from 'node:fs'
export default const config = JSON.parse(fs.readFileSync("config.json"))
console.log(config)
