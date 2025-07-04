import { createError } from '@fastify/error'

export class MissingSignatureError extends createError(
  'FST_ERR_LINE_SIGNATURE_MISSING',
  'Line signature is missing',
) {}

export class InvalidSignatureError extends createError(
  'FST_ERR_LINE_SIGNATURE_INVALID',
  'Line signature validation failed',
) {
  constructor(public signature: string) {
    super()
  }
}
