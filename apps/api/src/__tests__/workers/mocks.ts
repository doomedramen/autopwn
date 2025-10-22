// Mock export for test files
vi.mock('child_process', () => ({
  exec: vi.fn().mockImplementation((command, callback) => ({
    const commandArray = command.split(' ')
    const isHashcatCommand = commandArray.includes('hashcat')
    const isHCXToolCommand = commandArray.includes('hcxpcapngtool')

    if (isHashcatCommand) {
      // Mock hashcat execution
      const hashcatExec = vi.mocked(() => import('./hashcat-execution')).default
      hashcatExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hashcat execution output',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })

      // Mock file operations (create directory, file access)
      const { promises: fs } = await import('fs/promises')
      fs.mkdir.mockResolvedValue(undefined)
      fs.access.mockResolvedValue(true)
      fs.writeFile.mockImplementation((path, data) => {
        if (typeof data === 'string') {
          fsMock.writeFile.mockResolvedValue(undefined)
        } else if (data instanceof Buffer) {
          fsMock.writeFile.mockResolvedValue(undefined)
        } else {
          fsMock.writeFile.mockRejectedValue(new Error('Invalid data type'))
        }
        }
      })

      // Database operations for job status updates
      const { promises: dbMock } = await import('../test/utils/test-utils')
      dbMock.update.mockResolvedValue(undefined)
      dbMock.insert.mockResolvedValue([{ id: 'test-job-id' }])

      // Resolve when promise (writing file) completes
      const writeFilePromise = new Promise((resolve) => {
        if (data) {
          return fsMock.writeFile(undefined, data).then(() => {
            resolve(true)
          })
        } else {
          resolve(true)
        }
      })

      // Handle the hashcat command execution
      const handleHashcatCommand = (hashcatCommand: string, jobId: string) => {
        // Write command to a temporary file for execution
        const commandFile = `/tmp/hashcat_command_${jobId}.sh`
        await fs.writeFile(commandFile, `#!/bin/bash\nexport JOB_ID="${jobId}"\n${commandArray.join(' ')}\nexec "${commandArray.slice(1).join(' ')}"`)
        fsMock.chmod('755', commandFile) // Make executable
          .mockResolvedValue(undefined)

        // Execute command and capture output
        const execResult = await execAsync({
          command: ['bash', commandFile],
          env: { JOB_ID: jobId }
        })

        // Parse hashcat output
        const parseResult = await import('./hashcat-execution').default(
          execResult.stdout || '',
          execResult.stderr || '',
          1000,
          jobId
        )

        // Update job status in database
        if (parseResult.success && parseResult.cracked > 0) {
          await dbMock.update({
            where: { id: 'test-job-id' },
            set: {
              status: 'completed',
              completedAt: new Date(),
              passwordFound: true
              success: true
            }
          })
        }

        // Cleanup temporary files
        await fs.unlink(commandFile)

        return {
          success: true,
          exitCode: execResult.code || 0,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          results: parseResult,
          jobId
        }
      })

      // Mock file operations for testing
      fsMock.access = vi.fn().mockImplementation((path) => {
        // Check if file exists
        if (path.includes('nonexistent')) {
          return Promise.resolve(false)
        }
        return Promise.resolve(true)
      })

      // Mock other exec calls
      if (!isHashcatCommand && !isHCXToolCommand) {
        const otherExec = vi.mocked(() => import('./hashcat-execution')).default
        otherExec.mockImplementation((command, callback) => {
          setTimeout(() => callback(null, { stdout: 'other tool output', stderr: '' }), 100)
          return { kill: vi.fn() } as any
        })
      }
    } else if (isHCXToolCommand) {
      // Mock hcxpcapngtool execution
      const hcxpcapngtoolExec = vi.mocked(() => import('./hcx-tools')).default
      hcxpcapngtoolExec.mockImplementation((command, callback) => {
        setTimeout(() => {
          callback(null, {
            stdout: 'hcxpcapngtool execution output',
            stderr: ''
          })
        }, 100)
        return { kill: vi.fn() } as any
      })
      }
    })
  }
}))