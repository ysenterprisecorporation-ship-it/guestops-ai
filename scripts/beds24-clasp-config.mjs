import { writeFile } from "node:fs/promises";
const scriptId=process.env.BEDS24_GAS_SCRIPT_ID?.trim();
if(!scriptId || !/^[A-Za-z0-9_-]{30,}$/.test(scriptId)) throw new Error("BEDS24_GAS_SCRIPT_ID_REQUIRED");
await writeFile("dist-gtos/.clasp.json",JSON.stringify({scriptId,rootDir:"."},null,2)+"\n",{mode:0o600});
console.log("Dedicated read-only Beds24 GAS target configured. No credentials printed.");
