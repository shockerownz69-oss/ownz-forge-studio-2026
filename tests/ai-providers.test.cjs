"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config({quiet:true});
const {selectProvider} = require("../ai-router");

test("Groq is the default AI provider", () => {
  const provider = selectProvider();
  assert.equal(provider.id, "groq");
  assert.equal(provider.model, "openai/gpt-oss-120b");
});

test("Local FatalAcidBurn remains selectable", () => {
  const provider = selectProvider("local");
  assert.equal(provider.id, "local");
});

test("Unknown providers are rejected", () => {
  assert.throws(() => selectProvider("unknown"), /Unknown AI provider/);
});

test("Invalid provider selections are rejected", () => {
  assert.throws(() => selectProvider(null), /Invalid provider selection/);
});
