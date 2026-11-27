import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function createDb({ databaseUrl = process.env.DATABASE_URL || null, database = "server/data/veracard.sqlite" } = {}) {
  if (databaseUrl && /^postgres(ql)?:\/\//i.test(databaseUrl)) {
    return createPostgresDb(databaseUrl);
  }
  return createSqliteDb(database);
}

function createSqliteDb(database) {
  if (database !== ":memory:") mkdirSync(dirname(resolve(database)), { recursive: true });
  const raw = new DatabaseSync(database);
  raw.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,salt TEXT,password_hash TEXT,nonce TEXT,wallet TEXT,dynamic_subject TEXT);
  CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,email TEXT,kind TEXT,salt TEXT,password_hash TEXT,code_hash TEXT,expires INTEGER,sent INTEGER,attempts INTEGER DEFAULT 0,provider TEXT DEFAULT 'local');
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);`);

  if (!raw.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "dynamic_subject")) {
    raw.exec("ALTER TABLE users ADD COLUMN dynamic_subject TEXT");
  }
  if (!raw.prepare("PRAGMA table_info(challenges)").all().some((c) => c.name === "provider")) {
    raw.exec("ALTER TABLE challenges ADD COLUMN provider TEXT DEFAULT 'local'");
  }

  return {
    kind: "sqlite",
    raw,
    prepare: (...args) => raw.prepare(...args),
    ready: Promise.resolve(),
    async getUserByEmail(email) {
      return raw.prepare("SELECT * FROM users WHERE email=?").get(email) || null;
    },
    async getUserById(id) {
      return raw.prepare("SELECT * FROM users WHERE id=?").get(id) || null;
    },
    async insertUser({ id, email, salt, passwordHash, nonce }) {
      raw.prepare("INSERT INTO users(id,email,salt,password_hash,nonce) VALUES(?,?,?,?,?)").run(id, email, salt, passwordHash, nonce);
    },
    async updateUserPassword(email, salt, passwordHash) {
      raw.prepare("UPDATE users SET salt=?,password_hash=? WHERE email=?").run(salt, passwordHash, email);
    },
    async updateUserDynamicSubject(email, subject) {
      raw
        .prepare("UPDATE users SET dynamic_subject=? WHERE email=? AND (dynamic_subject IS NULL OR dynamic_subject=?)")
        .run(subject, email, subject);
    },
    async updateUserWallet(userId, walletJson, onlyIfNull = false) {
      if (onlyIfNull) {
        raw.prepare("UPDATE users SET wallet=? WHERE id=? AND wallet IS NULL").run(walletJson, userId);
      } else {
        raw.prepare("UPDATE users SET wallet=? WHERE id=?").run(walletJson, userId);
      }
    },
    async getLatestChallengeSent(email) {
      return raw.prepare("SELECT sent FROM challenges WHERE email=? ORDER BY sent DESC LIMIT 1").get(email) || null;
    },
    async replaceChallenge({ id, email, kind, salt, passwordHash, codeHash, expires, sent, provider }) {
      raw.prepare("DELETE FROM challenges WHERE email=?").run(email);
      raw
        .prepare(
          "INSERT INTO challenges(id,email,kind,salt,password_hash,code_hash,expires,sent,provider) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(id, email, kind, salt, passwordHash, codeHash, expires, sent, provider);
    },
    async getChallenge(id) {
      return raw.prepare("SELECT * FROM challenges WHERE id=?").get(id) || null;
    },
    async updateChallengeResend(id, codeHash, expires, sent) {
      raw
        .prepare("UPDATE challenges SET code_hash=?,expires=?,sent=?,attempts=0 WHERE id=?")
        .run(codeHash, expires, sent, id);
    },
    async incrementChallengeAttempts(id) {
      raw.prepare("UPDATE challenges SET attempts=attempts+1 WHERE id=?").run(id);
    },
    async deleteChallenge(id) {
      raw.prepare("DELETE FROM challenges WHERE id=?").run(id);
    },
    async insertSession(tokenHash, userId, expires) {
      raw.prepare("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)").run(tokenHash, userId, expires);
    },
    async getValidSession(tokenHash, now) {
      return raw.prepare("SELECT * FROM sessions WHERE token_hash=? AND expires>?").get(tokenHash, now) || null;
    },
    async deleteSession(tokenHash) {
      raw.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash);
    },
    async deleteSessionsByEmail(email) {
      raw.prepare("DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)").run(email);
    },
    async close() {
      raw.close();
    },
  };
}

function createPostgresDb(connectionString) {
  let poolPromise = null;
  let initPromise = null;

  const getPool = async () => {
    if (!poolPromise) {
      poolPromise = import("pg").then(({ default: pg }) => {
        const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
        return new pg.Pool({
          connectionString,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 5,
        });
      });
    }
    const pool = await poolPromise;
    if (!initPromise) {
      initPromise = pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          salt TEXT,
          password_hash TEXT,
          nonce TEXT,
          wallet TEXT,
          dynamic_subject TEXT
        );
        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          email TEXT,
          kind TEXT,
          salt TEXT,
          password_hash TEXT,
          code_hash TEXT,
          expires BIGINT,
          sent BIGINT,
          attempts INTEGER DEFAULT 0,
          provider TEXT DEFAULT 'local'
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT,
          expires BIGINT
        );
      `);
    }
    await initPromise;
    return pool;
  };

  const q = async (text, params = []) => {
    const pool = await getPool();
    return pool.query(text, params);
  };

  const toNumRow = (row) => {
    if (!row) return null;
    if (row.expires !== undefined) row.expires = Number(row.expires);
    if (row.sent !== undefined) row.sent = Number(row.sent);
    return row;
  };

  return {
    kind: "postgres",
    ready: getPool().then(() => {}),
    async getUserByEmail(email) {
      const { rows } = await q("SELECT * FROM users WHERE email=$1", [email]);
      return rows[0] || null;
    },
    async getUserById(id) {
      const { rows } = await q("SELECT * FROM users WHERE id=$1", [id]);
      return rows[0] || null;
    },
    async insertUser({ id, email, salt, passwordHash, nonce }) {
      await q("INSERT INTO users(id,email,salt,password_hash,nonce) VALUES($1,$2,$3,$4,$5)", [
        id,
        email,
        salt,
        passwordHash,
        nonce,
      ]);
    },
    async updateUserPassword(email, salt, passwordHash) {
      await q("UPDATE users SET salt=$1,password_hash=$2 WHERE email=$3", [salt, passwordHash, email]);
    },
    async updateUserDynamicSubject(email, subject) {
      await q(
        "UPDATE users SET dynamic_subject=$1 WHERE email=$2 AND (dynamic_subject IS NULL OR dynamic_subject=$3)",
        [subject, email, subject],
      );
    },
    async updateUserWallet(userId, walletJson, onlyIfNull = false) {
      if (onlyIfNull) {
        await q("UPDATE users SET wallet=$1 WHERE id=$2 AND wallet IS NULL", [walletJson, userId]);
      } else {
        await q("UPDATE users SET wallet=$1 WHERE id=$2", [walletJson, userId]);
      }
    },
    async getLatestChallengeSent(email) {
      const { rows } = await q("SELECT sent FROM challenges WHERE email=$1 ORDER BY sent DESC LIMIT 1", [email]);
      return toNumRow(rows[0] || null);
    },
    async replaceChallenge({ id, email, kind, salt, passwordHash, codeHash, expires, sent, provider }) {
      await q("DELETE FROM challenges WHERE email=$1", [email]);
      await q(
        "INSERT INTO challenges(id,email,kind,salt,password_hash,code_hash,expires,sent,provider) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [id, email, kind, salt, passwordHash, codeHash, expires, sent, provider],
      );
    },
    async getChallenge(id) {
      const { rows } = await q("SELECT * FROM challenges WHERE id=$1", [id]);
      return toNumRow(rows[0] || null);
    },
    async updateChallengeResend(id, codeHash, expires, sent) {
      await q("UPDATE challenges SET code_hash=$1,expires=$2,sent=$3,attempts=0 WHERE id=$4", [
        codeHash,
        expires,
        sent,
        id,
      ]);
    },
    async incrementChallengeAttempts(id) {
      await q("UPDATE challenges SET attempts=attempts+1 WHERE id=$1", [id]);
    },
    async deleteChallenge(id) {
      await q("DELETE FROM challenges WHERE id=$1", [id]);
    },
    async insertSession(tokenHash, userId, expires) {
      await q("INSERT INTO sessions(token_hash,user_id,expires) VALUES($1,$2,$3)", [tokenHash, userId, expires]);
    },
    async getValidSession(tokenHash, now) {
      const { rows } = await q("SELECT * FROM sessions WHERE token_hash=$1 AND expires>$2", [tokenHash, now]);
      return toNumRow(rows[0] || null);
    },
    async deleteSession(tokenHash) {
      await q("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
    },
    async deleteSessionsByEmail(email) {
      await q("DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=$1)", [email]);
    },
    async close() {
      if (poolPromise) {
        const pool = await poolPromise;
        await pool.end();
      }
    },
  };
}
