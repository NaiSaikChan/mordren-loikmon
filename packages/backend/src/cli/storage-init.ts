import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { createLogger } from '../lib/logger.js'
import { MinioStorageService } from '../storage/storage.js'

/** `npm run storage:init` — create the MinIO buckets and the public-read policy. */
const config = loadConfig()
const logger = createLogger(config)
try {
  await new MinioStorageService(config.storage, logger).ensureBuckets()
  logger.info({ public: config.storage.publicBucket, private: config.storage.privateBucket }, 'storage buckets ready')
} catch (err) {
  logger.error({ err }, 'storage initialisation failed')
  process.exitCode = 1
}
