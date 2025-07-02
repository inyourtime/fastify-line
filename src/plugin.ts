import { LINE_SIGNATURE_HTTP_HEADER_NAME, messagingApi, validateSignature } from '@line/bot-sdk'
import type { FastifyPluginCallback, preHandlerHookHandler, preParsingHookHandler } from 'fastify'
import fp from 'fastify-plugin'
import getRawBody from 'raw-body'
import { SignatureValidationError } from './error.js'
// import { FST_LINE_INVALID_SIGNATURE, FST_LINE_NO_SIGNATURE } from './error.js'
import { kRawBody } from './symbols.js'
import type { FastifyLineOptions } from './types.js'

const plugin: FastifyPluginCallback<FastifyLineOptions> = (fastify, opts, done) => {
  const { channelSecret, channelAccessToken } = opts

  if (!channelSecret) {
    done(new Error('"channelSecret" option is required'))
    return
  }
  if (!channelAccessToken) {
    done(new Error('"channelAccessToken" option is required'))
    return
  }

  const { MessagingApiClient } = messagingApi
  const client = new MessagingApiClient({ channelAccessToken })

  if (!fastify.line) {
    fastify.decorate('line', client)
  }

  fastify.addHook('onRoute', (routeOptions) => {
    const skip = routeOptions.method !== 'POST' || !routeOptions.config?.lineWebhook
    if (skip) return

    const existingPreParsing = routeOptions.preParsing || []
    routeOptions.preParsing = [
      parseRawBody,
      ...(Array.isArray(existingPreParsing) ? existingPreParsing : [existingPreParsing]),
    ]

    const existingPreHandler = routeOptions.preHandler || []
    routeOptions.preHandler = [
      verifySignature,
      ...(Array.isArray(existingPreHandler) ? existingPreHandler : [existingPreHandler]),
    ]
  })

  const parseRawBody: preParsingHookHandler = (request, _reply, payload, done) => {
    getRawBody(
      payload,
      { length: null, limit: request.routeOptions.bodyLimit, encoding: 'utf8' },
      (err, buf) => {
        if (err) return

        request[kRawBody] = buf
      },
    )

    done(null, payload)
  }

  const verifySignature: preHandlerHookHandler = (request, _reply, done) => {
    const signature = request.headers[LINE_SIGNATURE_HTTP_HEADER_NAME] as string

    if (!signature) {
      done(new SignatureValidationError('Missing signature'))
      return
    }

    if (!validateSignature(request[kRawBody], channelSecret, signature)) {
      done(new SignatureValidationError('Invalid signature', signature))
      return
    }

    done()
  }

  done()
}

const fastifyLine = fp(plugin, {
  name: 'fastify-line',
  fastify: '5.x',
})

export default fastifyLine
