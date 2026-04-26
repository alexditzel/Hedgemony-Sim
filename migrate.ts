import fs from "fs";
import path from "path";

const filePath = path.resolve("./src/engine/types.ts");
let content = fs.readFileSync(filePath, "utf-8");

// replace z.optional with z.nullable
content = content.replace(/z\.optional\(/g, "z.nullable(");

// replace optional fields in interfaces/types
content = content.replace(/([a-zA-Z0-9_]+)\s*\?:\s*([^;,\n}]+)([;,\n}])/g, (match, p1, p2, p3) => {
    return `${p1}: ${p2} | null${p3}`;
});

fs.writeFileSync(filePath, content, "utf-8");
console.log("Migration complete.");
