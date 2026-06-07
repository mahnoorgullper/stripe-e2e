/**
 * encrypt-secrets.js
 * Reads your .env file and encrypts it to secrets/secrets.enc using AES-256-GCM.
 * Run: npm run secrets:encrypt
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ENV_FILE = path.join(__dirname, "../.env");
const OUT_FILE = path.join(__dirname, "../secrets/secrets.enc");

const ALGORITHM = "aes-256-gcm";
const SALT_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;
const PBKDF2_ITERATIONS = 200_000;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: [salt(32)] [iv(16)] [tag(16)] [ciphertext]
  return Buffer.concat([salt, iv, tag, encrypted]);
}

async function getPassword(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(prompt);
  // Hide input on terminals that support it
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  return new Promise((resolve) => {
    let input = "";
    process.stdout.write("\x1b[?25l"); // hide cursor
    rl.on("line", (line) => {
      input = line;
      rl.close();
      resolve(input);
    });
  });
}

(async () => {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`❌ .env file not found at ${ENV_FILE}`);
    process.exit(1);
  }

  console.log("\n🔐 Stripe Secrets Encryptor");
  console.log("============================");

  const password = await getPassword("Enter master password: ");
  console.log();
  const confirm = await getPassword("Confirm master password: ");
  console.log();

  if (password !== confirm) {
    console.error("❌ Passwords do not match.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  const plaintext = fs.readFileSync(ENV_FILE, "utf8");
  const encrypted = encrypt(plaintext, password);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, encrypted);

  console.log(`✅ Secrets encrypted to: secrets/secrets.enc`);
  console.log(`   Keep your master password safe — it cannot be recovered.`);
  console.log(`   Run "npm run secrets:decrypt" to restore your .env file.\n`);
})();
