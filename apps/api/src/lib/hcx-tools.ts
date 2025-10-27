import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface ConversionResult {
  success: boolean
  outputFile?: string
  networksFound?: number
  pmkidsFound?: number
  hashesConverted?: number
  processingTime?: number
  error?: string
  metrics?: {
    packetsAnalyzed?: number
    beaconFramesFound?: number
    dataRate?: number
  }
}

export interface PMKIDResult {
  success: boolean
  outputFile?: string
  pmkidsFound?: number
  processingTime?: number
  error?: string
}

export interface HashcatConversionResult {
  success: boolean
  outputFile?: string
  hashesConverted?: number
  processingTime?: number
  error?: string
}

export interface Validation {
  isValid: boolean
  format?: string
  networks?: number
  errors: string[]
}

/**
 * Convert PCAP file to HC22000 format using hcxpcapngtool
 */
export async function convertToHC22000(
  inputPcap: string,
  outputHc22000: string
): Promise<ConversionResult> {
  const startTime = Date.now()

  try {
    // Check if hcxpcapngtool is available
    const versionCheck = await execAsync('hcxpcapngtool --version')
    if (versionCheck.stderr) {
      throw new Error('HCX PCAPNGTOOL not found')
    }

    // Run hcxpcapngtool conversion
    const command = `hcxpcapngtool -i "${inputPcap}" -o "${outputHc22000}" -O hc22000`
    const result = await execAsync(command)

    if (result.stderr) {
      throw new Error(`HCX conversion failed: ${result.stderr}`)
    }

    const processingTime = Date.now() - startTime
    const networksFound = extractNetworkCountFromOutput(result.stdout)

    return {
      success: true,
      outputFile: outputHc22000,
      networksFound,
      processingTime
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Extract PMKID from PCAP using hcxpcapngtool
 */
export async function extractPMKID(
  inputPcap: string,
  outputPmkid: string
): Promise<PMKIDResult> {
  const startTime = Date.now()

  try {
    // Run hcxpcapngtool PMKID extraction
    const command = `hcxpcapngtool -i "${inputPcap}" -o "${outputPmkid}" -O pmkid`
    const result = await execAsync(command)

    if (result.stderr) {
      throw new Error(`PMKID extraction failed: ${result.stderr}`)
    }

    const processingTime = Date.now() - startTime
    const pmkidsFound = extractPMKIDCountFromOutput(result.stdout)

    return {
      success: true,
      outputFile: outputPmkid,
      pmkidsFound,
      processingTime
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Convert HC22000 to hashcat-compatible format
 */
export async function convertToHashcat(
  inputHc22000: string,
  outputHashcat: string
): Promise<HashcatConversionResult> {
  const startTime = Date.now()

  try {
    // Read HC22000 file and format for hashcat
    const hc22000Content = await fs.readFile(inputHc22000, 'utf-8')
    const hashcatFormat = hc22000Content
      .split('\n')
      .map(line => line.replace(/^WPA\*01\*/, '$')) // Remove WPA*01 prefix, keep hash
      .filter(line => line.includes(':')) // Keep lines with passwords
      .join('\n')

    await fs.writeFile(outputHashcat, hashcatFormat)

    const processingTime = Date.now() - startTime
    const hashesConverted = hashcatFormat.split('\n').length

    return {
      success: true,
      outputFile: outputHashcat,
      hashesConverted,
      processingTime
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }
  }
}

/**
 * Validate converted file format
 */
export async function validateConversion(
  convertedFile: string
): Promise<Validation> {
  try {
    const content = await fs.readFile(convertedFile, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())

    let isValid = true
    const errors: string[] = []
    let networks = 0

    // Check each line
    for (const line of lines) {
      if (!line.includes(':')) {
        continue // Skip empty lines or comments
      }

      if (!line.includes('$')) {
        errors.push('Invalid format: missing hash delimiter')
        isValid = false
        continue
      }

      // Extract hash and validate format
      const [hash, ...rest] = line.split(':')
      if (!rest[0]) {
        errors.push('Invalid format: empty hash')
        isValid = false
        continue
      }

      // Validate hash format (40 hex characters)
      if (!/^[a-fA-F0-9]{40}$/.test(hash)) {
        errors.push('Invalid format: invalid hash characters')
        isValid = false
      }

      networks++
    }

    return {
      isValid,
      format: 'HC22000',
      networks,
      errors
    }
  } catch (error) {
    return {
      isValid: false,
      format: 'unknown',
      networks: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Extract network count from hcxpcapngtool output
 */
function extractNetworkCountFromOutput(output: string): number {
  const match = output.match(/(\d+)\s+networks?\s+found/i)
  return match ? parseInt(match[1]) : 0
}

/**
 * Extract PMKID count from hcxpcapngtool output
 */
function extractPMKIDCountFromOutput(output: string): number {
  const match = output.match(/(\d+)\s+PMKIDs?\s+found/i)
  return match ? parseInt(match[1]) : 0
}

/**
 * Check if hcxpcapngtool is available
 */
export async function checkHCXToolsAvailability(): Promise<{
  available: boolean
  version?: string
  error?: string
}> {
  try {
    const result = await execAsync('hcxpcapngtool --version')

    if (result.stderr) {
      return {
        available: false,
        error: result.stderr.trim()
      }
    }

    return {
      available: true,
      version: result.stdout.trim()
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Analyze PCAP file metadata
 */
export async function analyzePCAPOptions(inputPcap: string): Promise<{
  fileSize: number
  packetCount?: number
  duration?: number
  hasBeaconFrames?: boolean
  hasDataFrames?: boolean
  encryptionTypes?: string[]
}> {
  try {
    // Use hcxpcapngtool for analysis
    const command = `hcxpcapngtool -i "${inputPcap}" -E`
    const result = await execAsync(command)

    if (result.stderr) {
      throw new Error(`PCAP analysis failed: ${result.stderr}`)
    }

    // Parse output for metadata
    const output = result.stdout
    const encryptionTypes = new Set<string>()

    // Look for encryption type indicators
    if (output.includes('WPA2')) encryptionTypes.add('WPA2')
    if (output.includes('WPA3')) encryptionTypes.add('WPA3')
    if (output.includes('WEP')) encryptionTypes.add('WEP')

    return {
      fileSize: (await fs.stat(inputPcap)).size,
      packetCount: extractPacketCount(output),
      duration: extractDuration(output),
      hasBeaconFrames: output.includes('Beacon frames'),
      hasDataFrames: output.includes('Data frames'),
      encryptionTypes: Array.from(encryptionTypes)
    }
  } catch (error) {
    throw new Error(`PCAP analysis error: ${error.message}`)
  }
}

function extractPacketCount(output: string): number {
  const match = output.match(/(\d+)\s+packets?\s+captured/i)
  return match ? parseInt(match[1]) : 0
}

function extractDuration(output: string): number {
  const match = output.match(/Duration:\s+(\d+)\s+seconds/)
  return match ? parseInt(match[1]) : 0
}