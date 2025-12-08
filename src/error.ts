import { createError } from '@fastify/error'

export class MissingSignatureError extends createError(
  'FST_ERR_LINE_SIGNATURE_MISSING',
  'Line signature is missing',
  401,
) {}

export class InvalidSignatureError extends createError(
  'FST_ERR_LINE_SIGNATURE_INVALID',
  'Line signature validation failed',
  401,
) {
  constructor(public signature: string) {
    super()
  }
}
