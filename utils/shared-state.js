/**
 * shared-state.js
 * Persists payment data across test files using a JSON file.
 * API tests write here; GUI tests read from here.
 */

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "../.test-state.json");

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {
    // Ignore read errors
  }
  return {};
}

function writeState(data) {
  const current = readState();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...current, ...data }, null, 2));
}

function clearState() {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

module.exports = { readState, writeState, clearState };
