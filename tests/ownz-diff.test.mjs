import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(
  "editor/src/ownz-diff.js", "utf8"
);

const { ownzBuildDiff } = await import(
  "data:text/javascript," + encodeURIComponent(source)
);

const tests = [
  ["Identical files", "a\nb", "a\nb", 0, 0],
  ["Line addition", "a", "a\nb", 1, 0],
  ["Line removal", "a\nb", "a", 0, 1],
  ["Code replacement", "Node", "extends Node", 1, 1],
  ["Empty files", "", "", 0, 0],
  ["Trailing newline", "a\n", "a", 0, 0]
];

let passed = 0;

for (const [name, before, after, added, removed] of tests) {
  const result = ownzBuildDiff(before, after);

  assert.equal(result.added, added, name + " additions");
  assert.equal(result.removed, removed, name + " removals");

  console.log("PASS " + name);
  passed++;
}

const large = ownzBuildDiff(
  "x\n".repeat(600),
  "y\n".repeat(600)
);

assert.equal(large.tooLarge, true);
console.log("PASS Large-file protection");
passed++;

console.log("\nOWNZ DIFF TESTS: " + passed + "/7 PASSED");

// PHASE 13 — ADVANCED DIFF TESTS
const advancedTests = [
  {
    name: "Multiple independent edits",
    before: "one\nold\nthree\nfour\nold2",
    after: "one\nnew\nthree\nfour\nnew2",
    added: 2,
    removed: 2
  },
  {
    name: "Whitespace-sensitive changes",
    before: "    print('ready')",
    after: "  print('ready')",
    added: 1,
    removed: 1
  },
  {
    name: "Completely different files",
    before: "alpha\nbeta",
    after: "gamma\ndelta",
    added: 2,
    removed: 2
  }
];

for (const test of advancedTests) {
  const result = ownzBuildDiff(test.before, test.after);

  assert.equal(result.added, test.added, test.name);
  assert.equal(result.removed, test.removed, test.name);

  const reconstructedOld = result.lines
    .filter(line => line.type !== "add")
    .map(line => line.text).join("\n");

  const reconstructedNew = result.lines
    .filter(line => line.type !== "remove")
    .map(line => line.text).join("\n");

  assert.equal(reconstructedOld, test.before);
  assert.equal(reconstructedNew, test.after);

  console.log("PASS " + test.name);
}

console.log("\nOWNZ ADVANCED DIFF TESTS: 3/3 PASSED");
