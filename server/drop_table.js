import { run, dbReady, closeDatabase } from './db.js';

async function drop() {
  await dbReady;
  await run('DROP TABLE IF EXISTS yeu_cau_o_ghep');
  console.log('Dropped yeu_cau_o_ghep');
  await closeDatabase();
}

drop().catch(console.error);
