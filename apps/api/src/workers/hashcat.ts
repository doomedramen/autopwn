import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/db'
import { jobs, jobResults, networks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

interface RunHashcatAttackOptions {
  jobId: string
  networkId: string
  dictionaryId: string
  handshakePath: string
  dictionaryPath: string
  attackMode: 'pmkid' | 'handshake'
  userId: string
}

export async function runHashcatAttack({
  jobId,
  networkId,
  dictionaryId,
  handshakePath,
  dictionaryPath,
  attackMode,
  userId
}: RunHashcatAttackOptions) {
  try {
    // Update job status to running
    await db.update(jobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))

    // Update network status
    await db.update(networks)
      .set({
        status: 'cracking',
        updatedAt: new Date()
      })
      .where(eq(networks.id, networkId))

    // Prepare hashcat command
    const hashcatCommand = buildHashcatCommand({
      attackMode,
      handshakePath,
      dictionaryPath,
      jobId
    })

    console.log(`Running hashcat command: ${hashcatCommand}`)

    // Execute hashcat
    const result = await executeHashcat(hashcatCommand, jobId)

    // Process results
    const crackedPasswords = await parseHashcatOutput(result, jobId)

    // Save results to database
    if (crackedPasswords.length > 0) {
      for (const password of crackedPasswords) {
        await db.insert(jobResults).values({
          jobId,
          networkId,
          dictionaryId,
          password: password.password,
          plaintext: password.plaintext,
          attackMode,
          hashType: getHashType(attackMode),
          processingTime: password.processingTime,
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }

      // Update network status with cracked password
      const mainPassword = crackedPasswords[0]
      await db.update(networks)
        .set({
          status: 'cracked',
          crackedPassword: mainPassword.plaintext,
          crackedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(networks.id, networkId))

      // Update job status to completed
      await db.update(jobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          success: true,
          passwordFound: true,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId))

      return {
        success: true,
        passwordsFound: crackedPasswords.length,
        passwords: crackedPasswords.map(p => ({
          password: p.password,
          plaintext: p.plaintext
        }))
      }
    } else {
      // No passwords found
      await db.update(jobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          success: true,
          passwordFound: false,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId))

      await db.update(networks)
        .set({
          status: 'ready',
          updatedAt: new Date()
        })
        .where(eq(networks.id, networkId))

      return {
        success: true,
        passwordsFound: 0,
        message: 'No passwords found with the provided dictionary'
      }
    }

  } catch (error) {
    // Update job status to failed
    await db.update(jobs)
      .set({
        status: 'failed',
        failedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))

    // Reset network status
    await db.update(networks)
      .set({
        status: 'ready',
        updatedAt: new Date()
      })
      .where(eq(networks.id, networkId))

    throw error
  }
}

function buildHashcatCommand({
  attackMode,
  handshakePath,
  dictionaryPath,
  jobId
}: {
  attackMode: 'pmkid' | 'handshake'
  handshakePath: string
  dictionaryPath: string
  jobId: string
}) {
  const workDir = path.join(process.cwd(), 'temp', 'hashcat', jobId)

  // Hashcat attack modes:
  // -m 16800: WPA-PMKID-PBKDF2 (PMKID attack)
  // -m 22000: WPA-PBKDF2-PMKID+EAPOL (handshake attack)
  const hashMode = attackMode === 'pmkid' ? 16800 : 22000

  // Output files
  const outputFile = path.join(workDir, 'hashcat_output.txt')
  const potfile = path.join(workDir, 'hashcat.pot')

  const command = [
    'hashcat',
    `-m ${hashMode}`,
    `-a 0`, // Dictionary attack
    handshakePath,
    dictionaryPath,
    `-o ${outputFile}`,
    `--potfile-path=${potfile}`,
    '--quiet',
    '--force',
    '-O', // Optimized kernel
    '-w 4', // Workload profile (high)
    `--session=${jobId}`,
    '--runtime=3600' // 1 hour max runtime
  ].join(' ')

  return command
}

async function executeHashcat(command: string, jobId: string) {
  const workDir = path.join(process.cwd(), 'temp', 'hashcat', jobId)

  // Ensure working directory exists
  await fs.mkdir(workDir, { recursive: true })

  const startTime = Date.now()

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workDir,
      timeout: 3600000, // 1 hour timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    })

    const processingTime = Date.now() - startTime

    return {
      stdout,
      stderr,
      processingTime,
      exitCode: 0
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime

    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      processingTime,
      exitCode: error.code || 1
    }
  }
}

async function parseHashcatOutput(result: any, jobId: string) {
  const workDir = path.join(process.cwd(), 'temp', 'hashcat', jobId)
  const outputFile = path.join(workDir, 'hashcat_output.txt')

  try {
    // Check if output file exists and has content
    const outputExists = await fs.access(outputFile).then(() => true).catch(() => false)

    if (!outputExists) {
      return []
    }

    const outputContent = await fs.readFile(outputFile, 'utf-8')
    const lines = outputContent.trim().split('\n').filter(line => line.trim())

    const crackedPasswords = []

    for (const line of lines) {
      // Parse hashcat output format
      // Format: hash:plaintext
      const parts = line.split(':')
      if (parts.length >= 2) {
        crackedPasswords.push({
          password: parts[0],
          plaintext: parts.slice(1).join(':'),
          processingTime: result.processingTime
        })
      }
    }

    return crackedPasswords
  } catch (error) {
    console.error('Error parsing hashcat output:', error)
    return []
  }
}

function getHashType(attackMode: 'pmkid' | 'handshake'): string {
  return attackMode === 'pmkid' ? 'WPA-PMKID-PBKDF2' : 'WPA-PBKDF2-PMKID+EAPOL'
}

// Cleanup temporary files
export async function cleanupHashcatTemp(jobId: string) {
  const workDir = path.join(process.cwd(), 'temp', 'hashcat', jobId)

  try {
    await fs.rm(workDir, { recursive: true, force: true })
  } catch (error) {
    console.error('Error cleaning up hashcat temp files:', error)
  }
}

// Check hashcat availability
export async function checkHashcatAvailability() {
  try {
    const { stdout } = await execAsync('hashcat --version')
    return {
      available: true,
      version: stdout.trim()
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Hashcat not found'
    }
  }
}