import fastifyLine from './plugin.js'

// re-export from @line/bot-sdk
export * from '@line/bot-sdk'

export { SignatureValidationError } from './error.js'
export * from './types.js'

export { fastifyLine }
export default fastifyLine
