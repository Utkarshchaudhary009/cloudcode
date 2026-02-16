import type { ErrorType, AnalysisResult } from '../../types'

const ERROR_PATTERNS: Record<ErrorType, RegExp[]> = {
  typescript: [
    /error TS\d+:/,
    /TypeError:/,
    /Cannot find (?:name|module) '/,
    /Property '.*' does not exist/,
    /Type '.*' is not assignable/,
  ],
  dependency: [
    /npm ERR! /,
    /ERESOLVE/,
    /peer dep/,
    /Cannot find module '.*'/,
    /Module not found:/,
    /Package '.*' not found/,
  ],
  config: [/next\.config\.js/, /Invalid configuration/, /Config error/, /Environment variable/],
  runtime: [/ReferenceError:/, /TypeError: Cannot read/, /Uncaught Error:/, /ENOENT:/],
  build: [/Build error/, /Failed to compile/, /Webpack error/, /Transform failed/],
  other: [],
}

export function analyzeBuildLogs(logs: string): AnalysisResult {
  const lines = logs.split('\n')

  const errorLines = lines.filter(
    (line) => line.toLowerCase().includes('error') || line.includes('failed') || line.includes('fatal'),
  )

  let errorType: ErrorType = 'other'
  let maxMatches = 0

  for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (type === 'other') continue
    let matches = 0
    for (const pattern of patterns) {
      if (pattern.test(logs)) {
        matches++
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches
      errorType = type as ErrorType
    }
  }

  const errorContext = extractErrorContext(lines, errorLines)
  const affectedFiles = extractAffectedFiles(logs)
  const errorMessage = errorLines[0] || 'Unknown build error'

  return {
    errorType,
    errorMessage,
    errorContext,
    affectedFiles,
    confidence: maxMatches > 0 ? Math.min(maxMatches / 2, 1) : 0.3,
  }
}

function extractErrorContext(lines: string[], errorLines: string[]): string {
  const errorIndex = lines.findIndex((line) => errorLines.includes(line))
  if (errorIndex === -1) return lines.slice(-50).join('\n')

  const start = Math.max(0, errorIndex - 10)
  const end = Math.min(lines.length, errorIndex + 20)
  return lines.slice(start, end).join('\n')
}

function extractAffectedFiles(logs: string): string[] {
  const filePattern = /(?:at\s+)?(?:['"])?([\/\w.-]+\.(?:ts|tsx|js|jsx|json))['"]?/g
  const files = new Set<string>()
  let match
  while ((match = filePattern.exec(logs)) !== null) {
    files.add(match[1])
  }
  return Array.from(files).slice(0, 10)
}
