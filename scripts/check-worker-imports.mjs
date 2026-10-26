import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const root = resolve("dist/server");
function files(path) {
  return readdirSync(path, {withFileTypes:true}).flatMap(entry => {
    const full=join(path,entry.name);
    return entry.isDirectory()?files(full):/\.m?js$/.test(entry.name)?[full]:[];
  });
}
const missing=[];
for(const file of files(root)) {
  const code=readFileSync(file,"utf8");
  for(const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(["'])(\.[^"']+)\1/g)) {
    if(!existsSync(resolve(dirname(file),match[2]))) missing.push(`${file}: ${match[2]}`);
  }
}
if(missing.length) throw new Error(`Unpackaged Worker imports:\n${missing.join("\n")}`);
console.log("Worker relative imports resolve in the packaged build.");
