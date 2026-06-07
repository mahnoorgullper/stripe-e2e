/**
 * decrypt-secrets.js
 * Decrypts secrets/secrets.enc and writes it back to .env.
 * Run: npm run secrets:decrypt
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ENC_FILE = path.join(__dirname, "../secrets/secrets.enc");
const OUT_FILE = path.join(__dirname, "../.env");

const ALGORITHM = "aes-256-gcm";
const SALT_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;
const PBKDF2_ITERATIONS = 200_000;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

function decrypt(data, password) {
  const salt = data.subarray(0, SALT_LEN);
  const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = data.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

async function getPassword(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let input = "";
    rl.on("line", (line) => {
      input = line;
      rl.close();
      resolve(input);
    });
  });
}

(async () => {
  if (!fs.existsSync(ENC_FILE)) {
    console.error(`❌ Encrypted file not found at ${ENC_FILE}`);
    console.error(`   Run "npm run secrets:encrypt" first.`);
    process.exit(1);
  }

  console.log("\n🔓 Stripe Secrets Decryptor");
  console.log("============================");

  const password = await getPassword("Enter master password: ");
  console.log();

  try {
    const data = fs.readFileSync(ENC_FILE);
    const plaintext = decrypt(data, password);
    fs.writeFileSync(OUT_FILE, plaintext, { mode: 0o600 }); // owner-read-write only
    console.log(`✅ Secrets decrypted to: .env`);
    console.log(`   File permissions set to owner-only (600).\n`);
  } catch {
    console.error("❌ Decryption failed — wrong password or corrupted file.");
    process.exit(1);
  }
})();
