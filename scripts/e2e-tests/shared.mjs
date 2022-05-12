import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getAppDirectory(name) {
    return path.join(__dirname, "apps", name);
}

export function getAppName(target) {
    const sha = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
    const unique = crypto.randomBytes(2).toString("hex");
    return `test-${target}-${sha}-${unique}`;
}
