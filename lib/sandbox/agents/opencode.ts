import { Sandbox } from '@vercel/sandbox'
import { runCommandInSandbox, runInProject, PROJECT_DIR } from '../commands'
import { AgentExecutionResult } from '../types'
import { TaskLogger } from '@/lib/utils/task-logger'
import { connectors } from '@/lib/db/schema'

type Connector = typeof connectors.$inferSelect

// Helper function to run command and log it in project directory
async function runAndLogCommand(sandbox: Sandbox, command: string, args: string[], logger: TaskLogger) {
  await logger.command('Running command')

  const result = await runInProject(sandbox, command, args)

  // Only try to access properties if result is valid
  if (result && result.output && result.output.trim()) {
    await logger.info('Command completed with output')
  }

  if (result && !result.success && result.error) {
    await logger.error('Command failed')
  }

  // If result is null/undefined, create a fallback result
  if (!result) {
    const errorResult = {
      success: false,
      error: 'Command execution failed - no result returned',
      exitCode: -1,
      output: '',
      command: 'command',
    }
    await logger.error('Command execution failed')
    return errorResult
  }

  return result
}

async function runOpenCodeRun(
  sandbox: Sandbox,
  opencodeCmdToUse: string,
  prompt: string,
  logger: TaskLogger,
  modelFlag = '',
  sessionFlags = '',
) {
  await logger.info('Starting OpenCode run')

  const escapedPrompt = prompt.replace(/"/g, '\\"')
  const fullCommand = `${opencodeCmdToUse} run${modelFlag}${sessionFlags} "${escapedPrompt}"`

  await logger.command('Executing OpenCode command')
  const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

  const stdout = executeResult.output || ''
  const stderr = executeResult.error || ''

  if (stdout && stdout.trim()) {
    await logger.info('OpenCode command completed with output')
  }
  if (stderr && stderr.trim()) {
    await logger.error('OpenCode command returned errors')
  }

  await logger.info('OpenCode run completed')

  return executeResult
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
    await logger.info('Starting OpenCode agent execution')

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
      await logger.error('A provider API key is required for OpenCode agent')
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
        await logger.info('OpenCode CLI already installed')
      }
    } else {
      // Install OpenCode using the official npm package
      // Installing OpenCode CLI
      if (logger) {
        await logger.info('Installing OpenCode CLI')
      }

      installResult = await runAndLogCommand(sandbox, 'npm', ['install', '-g', 'opencode-ai'], logger)

      if (!installResult.success) {
        console.error('OpenCode CLI installation failed')
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
            error: 'OpenCode CLI not found after installation. Installation may have failed.',
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
    await logger.info('Configuring OpenCode settings')

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
              await logger.info('Failed to parse MCP server environment')
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
      await logger.info('Configured OpenAI provider')
    }

    // Anthropic and Anthropic-Compatible
    if (process.env.ANTHROPIC_API_KEY) {
      opencodeConfig.providers.anthropic = {
        apiKey: process.env.ANTHROPIC_API_KEY,
        ...(process.env.ANTHROPIC_BASE_URL ? { baseUrl: process.env.ANTHROPIC_BASE_URL } : {}),
      }
      await logger.info('Configured Anthropic provider')
    }

    // Other providers
    if (process.env.GEMINI_API_KEY) {
      opencodeConfig.providers.gemini = { apiKey: process.env.GEMINI_API_KEY }
      await logger.info('Configured Gemini provider')
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
      await logger.info('Configured Groq provider')
    }
    if (process.env.OPENROUTER_API_KEY) {
      opencodeConfig.providers.openrouter = { apiKey: process.env.OPENROUTER_API_KEY }
      await logger.info('Configured OpenRouter provider')
    }
    if (process.env.VERCEL_API_KEY) {
      opencodeConfig.providers.vercel = { apiKey: process.env.VERCEL_API_KEY }
      await logger.info('Configured Vercel AI Gateway provider')
    }
    if (process.env.SYNTHETIC_API_KEY) {
      opencodeConfig.providers.synthetic = { apiKey: process.env.SYNTHETIC_API_KEY }
      await logger.info('Configured Synthetic provider')
    }
    if (process.env.ZAI_API_KEY) {
      opencodeConfig.providers.zai = { apiKey: process.env.ZAI_API_KEY }
      await logger.info('Configured Z.ai provider')
    }
    if (process.env.HF_TOKEN) {
      opencodeConfig.providers.huggingface = { apiKey: process.env.HF_TOKEN }
      await logger.info('Configured Hugging Face provider')
    }
    if (process.env.CEREBRAS_API_KEY) {
      opencodeConfig.providers.cerebras = { apiKey: process.env.CEREBRAS_API_KEY }
      await logger.info('Configured Cerebras provider')
    }
    if (process.env.VERTEXAI_PROJECT) {
      opencodeConfig.providers.vertexai = { apiKey: process.env.VERTEXAI_PROJECT }
      await logger.info('Configured Vertex AI provider')
    }
    if (process.env.AWS_ACCESS_KEY_ID) {
      opencodeConfig.providers.bedrock = { apiKey: process.env.AWS_ACCESS_KEY_ID }
      await logger.info('Configured Amazon Bedrock provider')
    }
    if (process.env.AZURE_OPENAI_API_KEY) {
      opencodeConfig.providers.azure = { apiKey: process.env.AZURE_OPENAI_API_KEY }
      await logger.info('Configured Azure OpenAI provider')
    }
    if (process.env.ZEN_API_KEY) {
      opencodeConfig.providers.zen = { apiKey: process.env.ZEN_API_KEY }
      await logger.info('Configured Zen provider')
    }

    // Write the opencode.json file to the OpenCode config directory (not project directory)
    const opencodeConfigJson = JSON.stringify(opencodeConfig, null, 2)
    const createConfigCmd = `mkdir -p ~/.opencode && cat > ~/.opencode/config.json << 'EOF'
${opencodeConfigJson}
EOF
chmod 600 ~/.opencode/config.json`

    await logger.info('Creating OpenCode configuration file')
    const configResult = await runCommandInSandbox(sandbox, 'sh', ['-c', createConfigCmd])

    if (configResult.success) {
      await logger.info('OpenCode configuration file created successfully')

      // Verify the file was created (without logging sensitive contents)
      const verifyConfig = await runCommandInSandbox(sandbox, 'test', ['-f', '~/.opencode/config.json'])
      if (verifyConfig.success) {
        await logger.info('OpenCode configuration verified')
      }
    } else {
      await logger.info('Failed to create OpenCode configuration file')
    }

    if (process.env.GEMINI_API_KEY) {
      console.log('Configuring Gemini provider')
      if (logger) {
        await logger.info('Configuring Gemini provider')
      }

      const geminiAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${googleKey}" | opencode auth add google`,
      ])
      if (googleAuthResult.success) {
        authSetupCommands.push('Google provider configured')
      }
    }

<<<<<<< HEAD
    if (vertexProject) {
      console.log('Configuring Google Vertex provider...')
      const vertexAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${vertexProject}" | opencode auth add google-vertex`,
        authSetupCommands.push('Gemini provider configured')
>>>>>>> 64decfa8fa4e9e20dcd9b6400c77af92cabe260
      }
    }

    if (process.env.GROQ_API_KEY) {
<<<<<<< HEAD
      console.log('Configuring Groq provider')
      if (logger) {
        await logger.info('Configuring Groq provider')
      }

>>>>>>> 64decfa8fa4e9e20dcd9b6400c77af92cabe2602
      const groqAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.GROQ_API_KEY}" | opencode auth add groq`,
      ])

      if (!groqAuthResult.success) {
        console.warn('Failed to configure Groq provider')
        if (logger) {
          await logger.info('Failed to configure Groq provider')
        }
      } else {
        authSetupCommands.push('Groq provider configured')
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      console.log('Configuring OpenRouter provider')
      if (logger) {
        await logger.info('Configuring OpenRouter provider')
      }

      const openRouterAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.OPENROUTER_API_KEY}" | opencode auth add openrouter`,
      ])

      if (!openRouterAuthResult.success) {
        console.warn('Failed to configure OpenRouter provider')
        if (logger) {
          await logger.info('Failed to configure OpenRouter provider')
        }
      } else {
        authSetupCommands.push('OpenRouter provider configured')
      }
    }

    if (process.env.VERCEL_API_KEY) {
      console.log('Configuring Vercel AI Gateway provider')
      if (logger) {
        await logger.info('Configuring Vercel AI Gateway provider')
      }

      const vercelAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.VERCEL_API_KEY}" | opencode auth add vercel`,
      ])

      if (!vercelAuthResult.success) {
        console.warn('Failed to configure Vercel AI Gateway provider')
        if (logger) {
          await logger.info('Failed to configure Vercel AI Gateway provider')
        }
      } else {
        authSetupCommands.push('Vercel AI Gateway provider configured')
      }
    }

    if (process.env.SYNTHETIC_API_KEY) {
      console.log('Configuring Synthetic provider')
      if (logger) {
        await logger.info('Configuring Synthetic provider')
      }

      const syntheticAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.SYNTHETIC_API_KEY}" | opencode auth add synthetic`,
      ])

      if (!syntheticAuthResult.success) {
        console.warn('Failed to configure Synthetic provider')
        if (logger) {
          await logger.info('Failed to configure Synthetic provider')
        }
      } else {
        authSetupCommands.push('Synthetic provider configured')
      }
    }

    if (process.env.ZAI_API_KEY) {
      console.log('Configuring Z.ai provider')
      if (logger) {
        await logger.info('Configuring Z.ai provider')
      }

      const zaiAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.ZAI_API_KEY}" | opencode auth add zai`,
      ])

      if (!zaiAuthResult.success) {
        console.warn('Failed to configure Z.ai provider')
        if (logger) {
          await logger.info('Failed to configure Z.ai provider')
        }
      } else {
        authSetupCommands.push('Z.ai provider configured')
      }
    }

    if (process.env.HF_TOKEN) {
      console.log('Configuring Hugging Face provider')
      if (logger) {
        await logger.info('Configuring Hugging Face provider')
      }

      const hfAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.HF_TOKEN}" | opencode auth add huggingface`,
      ])

      if (!hfAuthResult.success) {
        console.warn('Failed to configure Hugging Face provider')
        if (logger) {
          await logger.info('Failed to configure Hugging Face provider')
        }
      } else {
        authSetupCommands.push('Hugging Face provider configured')
      }
    }

    if (process.env.CEREBRAS_API_KEY) {
      console.log('Configuring Cerebras provider')
      if (logger) {
        await logger.info('Configuring Cerebras provider')
      }

      const cerebrasAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.CEREBRAS_API_KEY}" | opencode auth add cerebras`,
      ])

      if (!cerebrasAuthResult.success) {
        console.warn('Failed to configure Cerebras provider')
        if (logger) {
          await logger.info('Failed to configure Cerebras provider')
        }
      } else {
        authSetupCommands.push('Cerebras provider configured')
      }
    }

    if (process.env.VERTEXAI_PROJECT) {
      console.log('Configuring Vertex AI provider')
      if (logger) {
        await logger.info('Configuring Vertex AI provider')
      }

      const vertexAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.VERTEXAI_PROJECT}" | opencode auth add vertexai`,
      ])

      if (!vertexAuthResult.success) {
        console.warn('Failed to configure Vertex AI provider')
        if (logger) {
          await logger.info('Failed to configure Vertex AI provider')
        }
      } else {
        authSetupCommands.push('Vertex AI provider configured')
      }
    }

    if (process.env.AWS_ACCESS_KEY_ID) {
      console.log('Configuring Amazon Bedrock provider')
      if (logger) {
        await logger.info('Configuring Amazon Bedrock provider')
      }

      const bedrockAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.AWS_ACCESS_KEY_ID}" | opencode auth add bedrock`,
      ])

      if (!bedrockAuthResult.success) {
        console.warn('Failed to configure Amazon Bedrock provider')
        if (logger) {
          await logger.info('Failed to configure Amazon Bedrock provider')
        }
      } else {
        authSetupCommands.push('Amazon Bedrock provider configured')
      }
    }

    if (process.env.AZURE_OPENAI_API_KEY) {
      console.log('Configuring Azure OpenAI provider')
      if (logger) {
        await logger.info('Configuring Azure OpenAI provider')
      }

      const azureAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.AZURE_OPENAI_API_KEY}" | opencode auth add azure`,
      ])

      if (!azureAuthResult.success) {
        console.warn('Failed to configure Azure OpenAI provider')
        if (logger) {
          await logger.info('Failed to configure Azure OpenAI provider')
        }
      } else {
        authSetupCommands.push('Azure OpenAI provider configured')
      }
    }

    if (process.env.OPENAI_API_KEY) {
      console.log('Configuring OpenAI Compatible provider')
      if (logger) {
        await logger.info('Configuring OpenAI Compatible provider')
      }

      const openaiCompatAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${process.env.MINIMAX_API_KEY}" | opencode auth add minimax`,
      ])

      if (!openaiCompatAuthResult.success) {
        console.warn('Failed to configure OpenAI Compatible provider')
        if (logger) {
          await logger.info('Failed to configure OpenAI Compatible provider')
        }
      } else {
        authSetupCommands.push('OpenAI Compatible provider configured')
      }
    }

    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Configuring Anthropic Compatible provider')
      if (logger) {
        await logger.info('Configuring Anthropic Compatible provider')
      }

      const anthropicCompatAuthResult = await runCommandInSandbox(sandbox, 'sh', [
        '-c',
        `echo "${opencodeKey}" | opencode auth add opencode`,
      ])
      if (authResult.success) {
        authSetupCommands.push('OpenCode Zen provider configured')
      }
    }

      if (!anthropicCompatAuthResult.success) {
        console.warn('Failed to configure Anthropic Compatible provider')
        if (logger) {
          await logger.info('Failed to configure Anthropic Compatible provider')
        }
      } else {
        authSetupCommands.push('Anthropic Compatible provider configured')
      }
    }

    // Initialize OpenCode for the project
    console.log('Initializing OpenCode for the project')
    if (logger) {
      await logger.info('Initializing OpenCode for the project')
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

    console.log('Executing OpenCode using the run command for non-interactive mode')
    if (logger) {
      await logger.info('Executing OpenCode run command in non-interactive mode')
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
          await logger.info('Resuming OpenCode session')
        }
      } else {
        sessionFlags = ' --continue'
        if (logger) {
          await logger.info('Continuing OpenCode session')
        }
      }
    }

    const planPrompt = [
      'You are OpenCode running in a sandbox.',
      'First, analyze the repository and the user request below.',
      'Create a plan.md file at the project root with a detailed, structured plan.',
      'Do not change any other files and do not write any code.',
      'User request:',
      instruction,
    ].join('\n')

    const planResult = await runOpenCodeRun(sandbox, opencodeCmdToUse, planPrompt, logger, modelFlag)

    if (!planResult.success) {
      return {
        success: false,
        error: 'OpenCode planning step failed',
        agentResponse: planResult.output,
        cliName: 'opencode',
        changesDetected: false,
      }
    }

    const executionPrompt = [
      'You are OpenCode running in a sandbox.',
      'Follow plan.md exactly to implement the requested changes.',
      'Make only the changes required by the plan and user request.',
      'User request:',
      instruction,
    ].join('\n')

    const executeResult = await runOpenCodeRun(
      sandbox,
      opencodeCmdToUse,
      executionPrompt,
      logger,
      modelFlag,
      sessionFlags,
    )

    const stdout = executeResult.output || ''
    const stderr = executeResult.error || ''

    if (!executeResult.success) {
      return {
        success: false,
        error: 'OpenCode execution step failed',
        agentResponse: stdout || stderr,
        cliName: 'opencode',
        changesDetected: false,
      }
    }

    const reviewPrompt = [
      'You are OpenCode running in a sandbox.',
      'Review the changes line by line using subagents.',
      'Fix any issues you find and ensure the code follows project standards.',
      'User request:',
      instruction,
    ].join('\n')

    const reviewResult = await runOpenCodeRun(sandbox, opencodeCmdToUse, reviewPrompt, logger, modelFlag)

    if (!reviewResult.success) {
      return {
        success: false,
        error: 'OpenCode review step failed',
        agentResponse: reviewResult.output,
        cliName: 'opencode',
        changesDetected: false,
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
      const successMsg = 'OpenCode executed successfully'
      if (logger) {
        await logger.success('OpenCode executed successfully')
      }

      // If there are changes, log what was changed
      if (hasChanges) {
        console.log('OpenCode made changes to files')
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
      const errorMsg = 'OpenCode failed during execution'
      if (logger) {
        await logger.error('OpenCode failed during execution')
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
    console.error('OpenCode execution error')

    if (logger) {
      await logger.error('OpenCode execution error')
    }

    return {
      success: false,
      error: errorMessage,
      cliName: 'opencode',
      changesDetected: false,
    }
  }
}
