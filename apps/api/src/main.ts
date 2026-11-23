import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/database.js';

const config = loadConfig();
const database = await createDatabase(config.database);
if (config.migrateOnStart) await database.migrate();

const app = await createApp({ config, database });
app.enableShutdownHooks();
await app.listen(config.port);

const logger = new Logger('Bootstrap');
logger.log(`API listening on http://localhost:${config.port}/api/v1 (db: ${database.driver})`);
logger.log(`OpenAPI docs: http://localhost:${config.port}/api/docs`);

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
