import createError from '@fastify/error'

export class SignatureValidationError extends createError(
  'LINE_SIGNATURE_VALIDATION_FAILED',
  'Signature validation failed',
) {
  constructor(
    public message: string,
    public signature?: string,
  ) {
    super()
  }
}
