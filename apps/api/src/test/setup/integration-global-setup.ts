import { BeforeAll, AfterAll } from 'vitest'
import { PostgreSQLContainer, StartedPostgreSQLContainer } from '@testcontainers/postgresql'
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let postgresContainer: StartedPostgreSQLContainer | null = null
let redisContainer: StartedRedisContainer | null = null

export const setup = async () => {
  console.log('🚀 Starting integration test containers...')

  try {
    // Start PostgreSQL container
    postgresContainer = await new PostgreSQLContainer('postgres:15-alpine')
      .withName('autopwn-test-postgres')
      .withEnvironment({
        POSTGRES_USER: 'testuser',
        POSTGRES_PASSWORD: 'testpass',
        POSTGRES_DB: 'autopwn_test'
      })
      .withExposedPorts(5432)
      .withStartupTimeout(120000)
      .withWaitStrategy({
        strategy: 'log',
        message: /database system is ready to accept connections/
      })
      .withReuse() // Enable container reuse for faster subsequent runs
      .start()

    // Start Redis container
    redisContainer = await new RedisContainer('redis:7-alpine')
      .withName('autopwn-test-redis')
      .withExposedPorts(6379)
      .withStartupTimeout(60000)
      .withReuse() // Enable container reuse for faster subsequent runs
      .start()

    // Set environment variables for tests
    process.env.DATABASE_URL = postgresContainer.getConnectionUri()
    process.env.REDIS_URL = redisContainer.getConnectionUri()
    process.env.DATABASE_HOST = postgresContainer.getHost()
    process.env.DATABASE_PORT = postgresContainer.getMappedPort(5432).toString()
    process.env.REDIS_HOST = redisContainer.getHost()
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString()

    console.log('✅ Integration containers started successfully')
    console.log(`📊 PostgreSQL: ${postgresContainer.getConnectionUri()}`)
    console.log(`🔴 Redis: ${redisContainer.getConnectionUri()}`)

    // Run database migrations
    console.log('🔄 Running database migrations...')
    await execAsync('pnpm db:migrate', {
      env: { ...process.env, NODE_ENV: 'test' }
    })
    console.log('✅ Database migrations completed')

    return {
      postgres: postgresContainer,
      redis: redisContainer
    }
  } catch (error) {
    console.error('❌ Failed to start integration containers:', error)
    throw error
  }
}

export const teardown = async () => {
  console.log('🛑 Stopping integration test containers...')

  try {
    if (postgresContainer) {
      await postgresContainer.stop()
      postgresContainer = null
    }

    if (redisContainer) {
      await redisContainer.stop()
      redisContainer = null
    }

    console.log('✅ Integration containers stopped')
  } catch (error) {
    console.error('❌ Error stopping containers:', error)
  }
}

export default { setup, teardown }