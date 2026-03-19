export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  environment: string
  hostname?: string
  requestId?: string
  [key: string]: unknown
}

class Logger {
  private isDevelopment: boolean
  private currentRequestId?: string

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  setRequestId(requestId: string) {
    this.currentRequestId = requestId
  }

  clearRequestId() {
    this.currentRequestId = undefined
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: process.env.NODE_ENV || 'development',
      ...context,
    }

    if (this.currentRequestId) {
      entry.requestId = this.currentRequestId
    }

    return this.sanitize(entry)
  }

  private sanitize(entry: LogEntry): LogEntry {
    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'apikey']
    const sanitized = { ...entry }

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  private output(entry: LogEntry) {
    if (this.isDevelopment) {
      this.prettyPrint(entry)
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  private prettyPrint(entry: LogEntry) {
    const colors = {
      debug: '\x1b[36m',   // Cyan
      info: '\x1b[32m',    // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m',
    }

    const time = new Date(entry.timestamp).toLocaleTimeString()
    const level = entry.level.toUpperCase()
    const color = colors[entry.level]

    console.log(`${color}[${time}] ${level}${colors.reset} ${entry.message}`)

    // Extract context without core fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timestamp, level: _, message, environment, ...context } = entry

    if (Object.keys(context).length > 0) {
      console.log('  Context:', context)
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const entry = this.formatEntry('debug', message, context)
      this.output(entry)
    }
  }

  info(message: string, context?: LogContext) {
    const entry = this.formatEntry('info', message, context)
    this.output(entry)
  }

  warn(message: string, context?: LogContext) {
    const entry = this.formatEntry('warn', message, context)
    this.output(entry)
  }

  error(message: string, context?: LogContext) {
    const entry = this.formatEntry('error', message, context)
    this.output(entry)
  }
}

export const logger = new Logger()
