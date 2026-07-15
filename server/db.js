import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join, resolve } from 'path';
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const isTest = process.env.NODE_ENV === 'test';
// Integrated Database Path pointing to HostelMate Landlord Project
const landlordDbPath =
  'D:/owner/Quan Li Phong Tro/HostelMate/server/csdl_hostelmate.sqlite';
const testDbPath = join(__dirname, '.test-hostelmate.sqlite');
const configuredDbPath = process.env.DATABASE_PATH?.trim();
const dbPath = isTest
  ? testDbPath
  : (configuredDbPath
    ? (isAbsolute(configuredDbPath) ? configuredDbPath : resolve(__dirname, '..', configuredDbPath))
    : landlordDbPath);

if (isTest) {
  if (existsSync(testDbPath)) unlinkSync(testDbPath);
  copyFileSync(join(__dirname, 'csdl_hostelmate.sqlite'), testDbPath);
}

export let dbReady;
let resolveDbReady, rejectDbReady;
dbReady = new Promise((resolve, reject) => {
  resolveDbReady = resolve;
  rejectDbReady = reject;
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    rejectDbReady(err);
  } else {
    if (!isTest) {
      console.log('Connected to SQLite database at:', dbPath);
    }
    initDatabase().then(resolveDbReady).catch(rejectDbReady);
  }
});

export const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else {
        if (isTest && existsSync(testDbPath)) unlinkSync(testDbPath);
        resolve();
      }
    });
  });
};

// Helper wrapper functions for async/await
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const queryOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const serialize = (fn) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      fn()
        .then(resolve)
        .catch(reject);
    });
  });
};

import { exec } from 'child_process';

function initDatabase() {
  return new Promise((resolve, reject) => {
    // Run migrations before resolving
    exec('node run-migrations.js', {
      cwd: __dirname,
      env: { ...process.env, DATABASE_PATH: dbPath },
    }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) {
        console.error('Migration failed:', error);
        return reject(error);
      }
      resolve();
    });
  });
}

export default db;
