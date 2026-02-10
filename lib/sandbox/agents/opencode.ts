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
  const fullCommand = `${opencodeCmdToUse} run --quiet${modelFlag}${sessionFlags} "${escapedPrompt}"`

  await logger.command('Executing OpenCode command')
  const executeResult = await runCommandInSandbox(sandbox, 'sh', ['-c', fullCommand])

  const stdout = executeResult.output || ''
  const stderr = executeResult.error || ''

  if (stdout && stdout.trim()) {
    await logger.info('OpenCode command completed with output')
  }
  if (stderr && stderr.trim()) {
    if (executeResult.success) {
      await logger.info(`OpenCode command produced output: ${stderr.trim().substring(0, 500)}`)
    } else {
      await logger.error(`OpenCode command returned errors: ${stderr.trim().substring(0, 1000)}`)
    }
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
  apiKeys?: Record<string, string>,
): Promise<AgentExecutionResult> {
  const authSetupCommands: string[] = []
  try {
    await logger.info('Starting OpenCode agent execution')

    // Helper to get API key from apiKeys or process.env
    const getApiKey = (key: string) => apiKeys?.[key] || process.env[key]

    // Check if we have required environment variables for OpenCode
    if (
      !getApiKey('OPENAI_API_KEY') &&
      !getApiKey('ANTHROPIC_API_KEY') &&
      !getApiKey('GOOGLE_API_KEY') &&
      !getApiKey('GEMINI_API_KEY') &&
      !getApiKey('GOOGLE_VERTEX_PROJECT') &&
      !getApiKey('VERTEXAI_PROJECT') &&
      !getApiKey('GROQ_API_KEY') &&
      !getApiKey('OPENROUTER_API_KEY') &&
      !getApiKey('VERCEL_API_KEY') &&
      !getApiKey('ZAI_API_KEY') &&
      !getApiKey('HF_TOKEN') &&
      !getApiKey('CEREBRAS_API_KEY') &&
      !getApiKey('MINIMAX_API_KEY') &&
      !getApiKey('AZURE_OPENAI_API_KEY') &&
      !getApiKey('OPENCODE_API_KEY') &&
      !getApiKey('COHERE_API_KEY') &&
      !getApiKey('DEEPSEEK_API_KEY') &&
      !getApiKey('MOONSHOT_API_KEY') &&
      !getApiKey('ZHIPU_API_KEY')
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
      model?: string
      mcp: Record<string, MCPConfig>
      providers: Record<string, ProviderConfig>
    } = {
      $schema: 'https://opencode.ai/config.json',
      mcp: {},
      providers: {},
    }

    // Set the default model at the root level if provided
    if (selectedModel) {
      // If the model already has a provider prefix, use it as is
      // Otherwise, assume it belongs to the selected provider
      if (selectedModel.includes('/')) {
        opencodeConfig.model = selectedModel
      } else if (selectedProvider) {
        opencodeConfig.model = `${selectedProvider}/${selectedModel}`
      }
    } else if (getApiKey('OPENCODE_API_KEY')) {
      // Fallback to a sensible OpenCode Zen default if no model selected
      opencodeConfig.model = 'opencode/gpt-5.2-codex'
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
    const openaiKey = getApiKey('OPENAI_API_KEY')
    if (openaiKey) {
      opencodeConfig.providers.openai = {
        apiKey: openaiKey,
        ...(getApiKey('OPENAI_BASE_URL') ? { baseUrl: getApiKey('OPENAI_BASE_URL') } : {}),
      }
      await logger.info('Configured OpenAI provider')
    }

    // Anthropic and Anthropic-Compatible
    const anthropicKey = getApiKey('ANTHROPIC_API_KEY')
    if (anthropicKey) {
      opencodeConfig.providers.anthropic = {
        apiKey: anthropicKey,
        ...(getApiKey('ANTHROPIC_BASE_URL') ? { baseUrl: getApiKey('ANTHROPIC_BASE_URL') } : {}),
      }
      await logger.info('Configured Anthropic provider')
    }

    // Google/Gemini
    const googleKey = getApiKey('GOOGLE_API_KEY') ?? getApiKey('GEMINI_API_KEY')
    if (googleKey) {
      opencodeConfig.providers.google = { apiKey: googleKey }
      await logger.info('Configured Google provider')
    }

    // Google Vertex (formerly Vertex AI)
    const vertexProject = getApiKey('GOOGLE_VERTEX_PROJECT') || getApiKey('VERTEXAI_PROJECT')
    if (vertexProject) {
      opencodeConfig.providers['google-vertex'] = { apiKey: vertexProject }
      await logger.info('Configured Google Vertex provider')
    }

    // Other providers
    if (getApiKey('GROQ_API_KEY')) {
      opencodeConfig.providers.groq = { apiKey: getApiKey('GROQ_API_KEY')! }
      await logger.info('Configured Groq provider')
    }
    if (getApiKey('OPENROUTER_API_KEY')) {
      opencodeConfig.providers.openrouter = { apiKey: getApiKey('OPENROUTER_API_KEY')! }
      await logger.info('Configured OpenRouter provider')
    }
    if (getApiKey('VERCEL_API_KEY')) {
      opencodeConfig.providers.vercel = { apiKey: getApiKey('VERCEL_API_KEY')! }
      await logger.info('Configured Vercel AI Gateway provider')
    }
    if (getApiKey('SYNTHETIC_API_KEY')) {
      opencodeConfig.providers.synthetic = { apiKey: getApiKey('SYNTHETIC_API_KEY')! }
      await logger.info('Configured Synthetic provider')
    }
    if (getApiKey('ZAI_API_KEY')) {
      opencodeConfig.providers.zai = { apiKey: getApiKey('ZAI_API_KEY')! }
      await logger.info('Configured Z.ai provider')
    }
    if (getApiKey('HF_TOKEN')) {
      opencodeConfig.providers.huggingface = { apiKey: getApiKey('HF_TOKEN')! }
      await logger.info('Configured Hugging Face provider')
    }
    if (getApiKey('CEREBRAS_API_KEY')) {
      opencodeConfig.providers.cerebras = { apiKey: getApiKey('CEREBRAS_API_KEY')! }
      await logger.info('Configured Cerebras provider')
    }
    if (getApiKey('AWS_ACCESS_KEY_ID')) {
      opencodeConfig.providers.bedrock = { apiKey: getApiKey('AWS_ACCESS_KEY_ID')! }
      await logger.info('Configured Amazon Bedrock provider')
    }
    if (getApiKey('AZURE_OPENAI_API_KEY')) {
      opencodeConfig.providers.azure = { apiKey: getApiKey('AZURE_OPENAI_API_KEY')! }
      await logger.info('Configured Azure OpenAI provider')
    }
    if (getApiKey('MINIMAX_API_KEY')) {
      opencodeConfig.providers.minimax = { apiKey: getApiKey('MINIMAX_API_KEY')! }
      await logger.info('Configured MiniMax provider')
    }

    const opencodeKey = getApiKey('OPENCODE_API_KEY')
    if (opencodeKey) {
      opencodeConfig.providers.opencode = { apiKey: opencodeKey }
      await logger.info('Configured OpenCode provider')
    }

    // Write the opencode.json file to the OpenCode config directory (not project directory)
    const opencodeConfigJson = JSON.stringify(opencodeConfig, null, 2)
    const createConfigCmd = `mkdir -p ~/.opencode ~/.config/opencode && 
cat > ~/.opencode/config.json << 'EOF'
${opencodeConfigJson}
EOF
cat > ~/.config/opencode/opencode.json << 'EOF'
${opencodeConfigJson}
EOF
chmod 600 ~/.opencode/config.json ~/.config/opencode/opencode.json`

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
        opencodeSessionId: extractedSessionId, // Include session ID for resumption
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
        opencodeSessionId: extractedSessionId, // Include session ID even on failure
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
