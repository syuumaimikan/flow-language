import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/nodeDefinitions.ts");
const outputPath = path.resolve("NODE-REFERENCE.generated.md");
const source = await fs.readFile(sourcePath, "utf8");

const pattern =
  /"([^"]+)":\s*\{\s*languageType:\s*"([^"]+)",\s*title:\s*"([^"]+)",[\s\S]*?category:\s*"([^"]+)",\s*description:\s*(?:"([^"]*)"|`([^`]*)`)/g;

const items = [];
let match;

while ((match = pattern.exec(source)) !== null) {
  items.push({
    key: match[1],
    languageType: match[2],
    title: match[3],
    category: match[4],
    description: (match[5] ?? match[6] ?? "").replace(/\s+/g, " ").trim(),
  });
}

items.sort((a, b) =>
  a.category.localeCompare(b.category) ||
  a.title.localeCompare(b.title)
);

const grouped = new Map();

for (const item of items) {
  grouped.set(item.category, [
    ...(grouped.get(item.category) ?? []),
    item,
  ]);
}

const lines = [
  "# Flow Language Node Reference",
  "",
  `Generated from \`src/nodeDefinitions.ts\`. Nodes: ${items.length}`,
  "",
];

for (const [category, nodes] of grouped) {
  lines.push(`## ${category}`, "");

  for (const node of nodes) {
    lines.push(
      `### ${node.title}`,
      "",
      `- Type: \`${node.languageType}\``,
      `- ${node.description || "No description"}`,
      "",
    );
  }
}

await fs.writeFile(outputPath, lines.join("\n"), "utf8");
console.log(`Generated ${outputPath}`);
