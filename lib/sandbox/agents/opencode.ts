import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject, PROJECT_DIR } from '../commands'
import { AgentExecutionResult } from '../types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'
import { connectors } from '@/lib/db/schema'

type Connector = typeof connectors.$inferSelect

// Helper function to run command and log it in project directory
async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
  const redactedCommand = redactSensitiveInfo(fullCommand)

  await logger.command(redactedCommand)

  const result = await runInProject(sandbox, command, args)

  // Only try to access properties if result is valid
  if (result && result.output && result.output.trim()) {
    const redactedOutput = redactSensitiveInfo(result.output.trim())
    await logger.info(redactedOutput)
  }

  if (result && !result.success && result.error) {
    const redactedError = redactSensitiveInfo(result.error)
    await logger.error(redactedError)
  }

  // If result is null/undefined, create a fallback result
  if (!result) {
    const errorResult = {
      success: false,
      error: 'Command execution failed - no result returned',
      exitCode: -1,
      output: '',
      command: redactedCommand,
    }
    await logger.error('Command execution failed - no result returned')
    return errorResult
  }

  return result
}

export async function executeOpenCodeInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
  mcpServers?: Connector[],
  isResumed?: boolean,
  sessionId?: string,
): Promise<AgentExecutionResult> {
  const authSetupCommands: string[] = []
  try {
    // Executing OpenCode with instruction
    await logger.info('Starting OpenCode agent execution...')

    // Check if we have required environment variables for OpenCode
    if (
      !process.env.OPENAI_API_KEY &&
      !process.env.ANTHROPIC_API_KEY &&
      !process.env.GOOGLE_API_KEY &&
      !process.env.GEMINI_API_KEY &&
      !process.env.GOOGLE_VERTEX_PROJECT &&
      !process.env.VERTEXAI_PROJECT &&
      !process.env.GROQ_API_KEY &&
      !process.env.OPENROUTER_API_KEY &&
      !process.env.VERCEL_API_KEY &&
      !process.env.ZAI_API_KEY &&
      !process.env.HF_TOKEN &&
      !process.env.CEREBRAS_API_KEY &&
      !process.env.MINIMAX_API_KEY &&
      !process.env.AZURE_OPENAI_API_KEY &&
      !process.env.OPENCODE_API_KEY &&
      !process.env.ZEN_API_KEY &&
      !process.env.COHERE_API_KEY &&
      !process.env.DEEPSEEK_API_KEY &&
      !process.env.MOONSHOT_API_KEY &&
      !process.env.ZHIPU_API_KEY
    ) {
      const errorMsg = 'A provider API key is required for OpenCode agent'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'opencode',
        changesDetected: false,
      }
    }

    // Check if OpenCode CLI is already installed (for resumed sandboxes)
    const existingCLICheck = await runCommandInSandbox(sandbox, 'which', ['opencode'])

    let installResult: { success: boolean; output?: string; error?: string } = { success: true }

    if (existingCLICheck.success && existingCLICheck.output?.includes('opencode')) {
      // CLI already installed, skip installation
      if (logger) {
        await logger.info('OpenCode CLI already installed, skipping installation')
      }
    } else {
      // Install OpenCode using the official npm package
      // Installing OpenCode CLI
      if (logger) {
        await logger.info('Installing OpenCode CLI...')
      }

      installResult = await runAndLogCommand(sandbox, 'npm', ['install', '-g', 'opencode-ai'], logger)

      if (!installResult.success) {
        console.error('OpenCode CLI installation failed:', { error: installResult.error })
        return {
          success: false,
          error: `Failed to install OpenCode CLI: ${installResult.error || 'Unknown error'}`,
          cliName: 'opencode',
          changesDetected: false,
        }
      }

      console.log('OpenCode CLI installed successfully')
      if (logger) {
        await logger.success('OpenCode CLI installed successfully')
      }
    }

    // Verify OpenCode CLI is available
    const cliCheck = await runAndLogCommand(sandbox, 'opencode', ['--version'], logger)

    if (!cliCheck.success) {
      // Try to find the exact path where npm installed it
      const npmBinCheck = await runAndLogCommand(sandbox, 'npm', ['bin', '-g'], logger)

      if (npmBinCheck.success && npmBinCheck.output) {
        const globalBinPath = npmBinCheck.output.trim()
        console.log('Global npm bin path retrieved')

        // Try running opencode from the global bin path
        const directPathCheck = await runAndLogCommand(
          sandbox,
          `${globalBinPath}/opencode`,
          ['--version'],

          logger,
        )

        if (!directPathCheck.success) {
          return {
            success: false,
            error: `OpenCode CLI not found after installation. Tried both 'opencode' and '${globalBinPath}/opencode'. Installation may have failed.`,
            cliName: 'opencode',
            changesDetected: false,
          }
        }
      } else {
        return {
          success: false,
          error: 'OpenCode CLI not found after installation and could not determine npm global bin path.',
          cliName: 'opencode',
          changesDetected: false,
        }
      }
    }

    console.log('OpenCode CLI verified successfully')
    if (logger) {
      await logger.success('OpenCode CLI verified successfully')
    }

    // Configure OpenCode settings (MCP servers and providers)
    await logger.info('Configuring OpenCode settings...')

    // Create OpenCode opencode.json configuration file
    // Define types for configuration
    type MCPConfig =
      | { type: 'local'; command: string[]; enabled: boolean; environment?: Record<string, string> }
      | { type: 'remote'; url: string; enabled: boolean; headers?: Record<string, string> }

    type ProviderConfig = { apiKey?: string; baseUrl?: string }

    const opencodeConfig: {
      $schema: string
      mcp: Record<string, MCPConfig>
      providers: Record<string, ProviderConfig>
    } = {
      $schema: 'https://opencode.ai/config.json',
      mcp: {},
      providers: {},
    }

    // Configure MCP servers if provided
    if (mcpServers && mcpServers.length > 0) {
      await logger.info('Configuring MCP servers')

      for (const server of mcpServers) {
        const serverName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

        if (server.type === 'local') {
          // Local MCP server - parse command string into executable and args
          const commandParts = server.command!.trim().split(/\s+/)

          // Parse env from JSON string if present
          let envObject: Record<string, string> | undefined
          if (server.env) {
            try {
              envObject = JSON.parse(server.env)
            } catch (e) {
              await logger.info('Warning: Failed to parse env for MCP server')
            }
          }

          opencodeConfig.mcp[serverName] = {
            type: 'local',
            command: commandParts,
            enabled: true,
            ...(envObject ? { environment: envObject } : {}),
          }

          await logger.info('Added local MCP server')
        } else {
          // Remote MCP server
          opencodeConfig.mcp[serverName] = {
            type: 'remote',
            url: server.baseUrl!,
            enabled: true,
          }

          // Build headers object
          const headers: Record<string, string> = {}
          if (server.oauthClientSecret) {
            headers.Authorization = `Bearer ${server.oauthClientSecret}`
          }
          if (server.oauthClientId) {
            headers['X-Client-ID'] = server.oauthClientId
          }
          if (Object.keys(headers).length > 0) {
            opencodeConfig.mcp[serverName].headers = headers
          }

          await logger.info('Added remote MCP server')
        }
      }
    }

    // Configure Providers (Authentication) via config file
    // This avoids passing secrets via command arguments

    // OpenAI and OpenAI-Compatible
    if (process.env.OPENAI_API_KEY) {
      opencodeConfig.providers.openai = {
        apiKey: process.env.OPENAI_API_KEY,
        ...(process.env.OPENAI_BASE_URL ? { baseUrl: process.env.OPENAI_BASE_URL } : {}),
      }
      await logger.info('Configured OpenAI provider (via config)')
    }

    // Anthropic and Anthropic-Compatible
    if (process.env.ANTHROPIC_API_KEY) {
      opencodeConfig.providers.anthropic = {
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...(process.env.ANTHROPIC_BASE_URL ? { baseUrl: process.env.ANTHROPIC_BASE_URL } : {}),
      }
      await logger.info('Configured Anthropic provider (via config)')
    }

    // Google (formerly Gemini)
    const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (googleKey) {
      opencodeConfig.providers.google = { apiKey: googleKey }
      await logger.info('Configured Google provider (via config)')
    }

    // Google Vertex (formerly Vertex AI)
    const vertexProject = process.env.GOOGLE_VERTEX_PROJECT || process.env.VERTEXAI_PROJECT
    if (vertexProject) {
      opencodeConfig.providers['google-vertex'] = { apiKey: vertexProject }
      await logger.info('Configured Google Vertex provider (via config)')
    }

    // Other providers
    if (process.env.GROQ_API_KEY) {
      opencodeConfig.providers.groq = { apiKey: process.env.GROQ_API_KEY }
      await logger.info('Configured Groq provider (via config)')
    }
    if (process.env.OPENROUTER_API_KEY) {
      opencodeConfig.providers.openrouter = { apiKey: process.env.OPENROUTER_API_KEY }
      await logger.info('Configured OpenRouter provider (via config)')
    }
    if (process.env.VERCEL_API_KEY) {
      opencodeConfig.providers.vercel = { apiKey: process.env.VERCEL_API_KEY }
      await logger.info('Configured Vercel AI Gateway provider (via config)')
    }
    if (process.env.ZAI_API_KEY) {
      opencodeConfig.providers.zai = { apiKey: process.env.ZAI_API_KEY }
      await logger.info('Configured Z.ai provider (via config)')
    }
    if (process.env.HF_TOKEN) {
      opencodeConfig.providers.huggingface = { apiKey: process.env.HF_TOKEN }
      await logger.info('Configured Hugging Face provider (via config)')
    }
    if (process.env.CEREBRAS_API_KEY) {
      opencodeConfig.providers.cerebras = { apiKey: process.env.CEREBRAS_API_KEY }
      await logger.info('Configured Cerebras provider (via config)')
    }
    if (process.env.AZURE_OPENAI_API_KEY) {
      opencodeConfig.providers.azure = { apiKey: process.env.AZURE_OPENAI_API_KEY }
      await logger.info('Configured Azure OpenAI provider (via config)')
    }

    // New Providers
    if (process.env.MINIMAX_API_KEY) {
      opencodeConfig.providers.minimax = { apiKey: process.env.MINIMAX_API_KEY }
      await logger.info('Configured MiniMax provider (via config)')
    }
    const opencodeKey = process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY
    if (opencodeKey) {
      opencodeConfig.providers.opencode = { apiKey: opencodeKey }
      await logger.info('Configured OpenCode Zen provider (via config)')
    }
    if (process.env.COHERE_API_KEY) {
      opencodeConfig.providers.cohere = { apiKey: process.env.COHERE_API_KEY }
      await logger.info('Configured Cohere provider (via config)')
    }
    if (process.env.DEEPSEEK_API_KEY) {
      opencodeConfig.providers.deepseek = { apiKey: process.env.DEEPSEEK_API_KEY }
      await logger.info('Configured DeepSeek provider (via config)')
    }
    if (process.env.MOONSHOT_API_KEY) {
      opencodeConfig.providers.moonshotai = { apiKey: process.env.MOONSHOT_API_KEY }
      await logger.info('Configured Moonshot AI provider (via config)')
    }
    if (process.env.ZHIPU_API_KEY) {
      opencodeConfig.providers.zhipuai = { apiKey: process.env.ZHIPU_API_KEY }
      await logger.info('Configured Zhipu AI provider (via config)')
    }

    // Write the opencode.json file to the OpenCode config directory (not project directory)
    const opencodeConfigJson = JSON.stringify(opencodeConfig, null, 2)
    const createConfigCmd = `mkdir -p ~/.opencode && cat > ~/.opencode/config.json << 'EOF'
${opencodeConfigJson}
EOF
chmod 600 ~/.opencode/config.json`

    await logger.info('Creating OpenCode configuration file...')
    const configResult = await runCommandInSandbox(sandbox, 'sh', ['-c', createConfigCmd])

    if (configResult.success) {
      await logger.info('OpenCode configuration file (~/.opencode/config.json) created successfully')

      // Verify the file was created (without logging sensitive contents)
      const verifyConfig = await runCommandInSandbox(sandbox, 'test', ['-f', '~/.opencode/config.json'])
      if (verifyConfig.success) {
        await logger.info('OpenCode configuration verified')
      }
    } else {
      await logger.info('Warning: Failed to create OpenCode configuration file')
    }

    if (googleKey) {
      console.log('Configuring Google provider...')
      const googleAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${googleKey}" | opencode auth add google`,
      ])
      if (googleAuthResult.success) {
        authSetupCommands.push('Google provider configured')
      }
    }

    if (vertexProject) {
      console.log('Configuring Google Vertex provider...')
      const vertexAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${vertexProject}" | opencode auth add google-vertex`,
      ])
      if (vertexAuthResult.success) {
        authSetupCommands.push('Google Vertex provider configured')
      }
    }

    if (process.env.GROQ_API_KEY) {
      const groqAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.GROQ_API_KEY}" | opencode auth add groq`,
      ])
      if (groqAuthResult.success) {
        authSetupCommands.push('Groq provider configured')
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      const openRouterAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.OPENROUTER_API_KEY}" | opencode auth add openrouter`,
      ])
      if (openRouterAuthResult.success) {
        authSetupCommands.push('OpenRouter provider configured')
      }
    }

    if (process.env.VERCEL_API_KEY) {
      const vercelAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.VERCEL_API_KEY}" | opencode auth add vercel`,
      ])
      if (vercelAuthResult.success) {
        authSetupCommands.push('Vercel API Gateway provider configured')
      }
    }

    if (process.env.ZAI_API_KEY) {
      const zaiAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.ZAI_API_KEY}" | opencode auth add zai`,
      ])
      if (zaiAuthResult.success) {
        authSetupCommands.push('Z.ai provider configured')
      }
    }

    if (process.env.HF_TOKEN) {
      const hfAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.HF_TOKEN}" | opencode auth add huggingface`,
      ])
      if (hfAuthResult.success) {
        authSetupCommands.push('Hugging Face provider configured')
      }
    }

    if (process.env.CEREBRAS_API_KEY) {
      const cerebrasAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.CEREBRAS_API_KEY}" | opencode auth add cerebras`,
      ])
      if (cerebrasAuthResult.success) {
        authSetupCommands.push('Cerebras provider configured')
      }
    }

    if (process.env.AZURE_OPENAI_API_KEY) {
      const azureAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.AZURE_OPENAI_API_KEY}" | opencode auth add azure`,
      ])
      if (azureAuthResult.success) {
        authSetupCommands.push('Azure OpenAI provider configured')
      }
    }

    if (process.env.MINIMAX_API_KEY) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.MINIMAX_API_KEY}" | opencode auth add minimax`,
      ])
      if (authResult.success) {
        authSetupCommands.push('MiniMax provider configured')
      }
    }

    if (opencodeKey) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${opencodeKey}" | opencode auth add opencode`,
      ])
      if (authResult.success) {
        authSetupCommands.push('OpenCode Zen provider configured')
      }
    }

    if (process.env.COHERE_API_KEY) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.COHERE_API_KEY}" | opencode auth add cohere`,
      ])
      if (authResult.success) {
        authSetupCommands.push('Cohere provider configured')
      }
    }

    if (process.env.DEEPSEEK_API_KEY) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.DEEPSEEK_API_KEY}" | opencode auth add deepseek`,
      ])
      if (authResult.success) {
        authSetupCommands.push('DeepSeek provider configured')
      }
    }

    if (process.env.MOONSHOT_API_KEY) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.MOONSHOT_API_KEY}" | opencode auth add moonshotai`,
      ])
      if (authResult.success) {
        authSetupCommands.push('Moonshot AI provider configured')
      }
    }

    if (process.env.ZHIPU_API_KEY) {
      const authResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.ZHIPU_API_KEY}" | opencode auth add zhipuai`,
      ])
      if (authResult.success) {
        authSetupCommands.push('Zhipu AI provider configured')
      }
    }

    // Initialize OpenCode for the project
    console.log('Initializing OpenCode for the project...')
    if (logger) {
      await logger.info('Initializing OpenCode for the project...')
    }

    // Determine the correct command to use (handle cases where npm global bin path is needed)
    let opencodeCmdToUse = 'opencode'

    if (!cliCheck.success) {
      const npmBinResult = await runAndLogCommand(sandbox, 'npm', ['bin', '-g'], logger)
      if (npmBinResult.success && npmBinResult.output) {
        const globalBinPath = npmBinResult.output.trim()
        opencodeCmdToUse = `${globalBinPath}/opencode`
      }
    }

    console.log('Executing OpenCode using the run command for non-interactive mode...')
    if (logger) {
      await logger.info('Executing OpenCode run command in non-interactive mode...')
      if (selectedModel) {
        await logger.info('Using selected model')
      }
    }

    // Use the 'opencode run' command for non-interactive execution as documented at https://opencode.ai/docs/cli/
    // This command allows us to pass a prompt directly and get results without the TUI
    // Add model parameter if provided
    const modelFlag = selectedModel ? ` --model "${selectedModel}"` : ''

    // Add session resumption flags if resuming
    let sessionFlags = ''
    if (isResumed) {
      if (sessionId) {
        sessionFlags = ` --session "${sessionId}"`
        if (logger) {
          await logger.info('Resuming specific OpenCode session')
        }
      } else {
        sessionFlags = ' --continue'
        if (logger) {
          await logger.info('Continuing last OpenCode session')
        }
      }
    }

    const fullCommand = `${opencodeCmdToUse} run${modelFlag}${sessionFlags} "${instruction}"`

    // Log the command we're about to execute (with redacted API keys)
    const redactedCommand = fullCommand.replace(/API_KEY="[^"]*"/g, 'API_KEY="[REDACTED]"')
    await logger.command(redactedCommand)
    if (logger) {
      await logger.command(redactedCommand)
    }

    // Execute OpenCode run command
    const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

    const stdout = executeResult.output || ''
    const stderr = executeResult.error || ''

    // Log the output
    if (stdout && stdout.trim()) {
      await logger.info(redactSensitiveInfo(stdout.trim()))
      if (logger) {
        await logger.info(redactSensitiveInfo(stdout.trim()))
      }
    }
    if (stderr && stderr.trim()) {
      await logger.error(redactSensitiveInfo(stderr.trim()))
      if (logger) {
        await logger.error(redactSensitiveInfo(stderr.trim()))
      }
    }

    // OpenCode execution completed

    // Extract session ID from output if present (for resumption)
    let extractedSessionId: string | undefined
    try {
      // Look for session ID in output (format may vary)
      const sessionMatch = stdout?.match(/(?:session[_\s-]?id|Session)[:\s]+([a-f0-9-]+)/i)
      if (sessionMatch) {
        extractedSessionId = sessionMatch[1]
      }
    } catch {
      // Ignore parsing errors
    }

    // Check if any files were modified by OpenCode
    const gitStatusCheck = await runAndLogCommand(sandbox, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (executeResult.success || executeResult.exitCode === 0) {
      const successMsg = `OpenCode executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`
      if (logger) {
        await logger.success(successMsg)
      }

      // If there are changes, log what was changed
      if (hasChanges) {
        console.log('OpenCode made changes to files:', hasChanges)
        if (logger) {
          await logger.info('Files checked for changes')
        }
      }

      return {
        success: true,
        output: successMsg,
        agentResponse: stdout || 'OpenCode completed the task',
        cliName: 'opencode',
        changesDetected: !!hasChanges,
        error: undefined,
        sessionId: extractedSessionId, // Include session ID for resumption
      }
    } else {
      const errorMsg = `OpenCode failed (exit code ${executeResult.exitCode}): ${stderr || stdout || 'No error message'}`
      if (logger) {
        await logger.error(errorMsg)
      }

      return {
        success: false,
        error: errorMsg,
        agentResponse: stdout,
        cliName: 'opencode',
        changesDetected: !!hasChanges,
        sessionId: extractedSessionId, // Include session ID even on failure
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute OpenCode in sandbox'
    console.error('OpenCode execution error:', error)

    if (logger) {
      await logger.error(errorMessage)
    }

    return {
      success: false,
      error: errorMessage,
      cliName: 'opencode',
      changesDetected: false,
    }
  }
}
