import { LINE_SIGNATURE_HTTP_HEADER_NAME, messagingApi, validateSignature } from '@line/bot-sdk'
import type { FastifyPluginCallback, preHandlerHookHandler, preParsingHookHandler } from 'fastify'
import fp from 'fastify-plugin'
import getRawBody from 'raw-body'
import { InvalidSignatureError, MissingSignatureError } from './error.js'
import { kRawBody } from './symbols.js'
import type { FastifyLineOptions } from './types.js'

const plugin: FastifyPluginCallback<FastifyLineOptions> = (fastify, opts, done) => {
  const { channelSecret, channelAccessToken, skipVerify = false } = opts

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

    if (!skipVerify) {
      const existingPreHandler = routeOptions.preHandler || []
      routeOptions.preHandler = [
        verifySignature,
        ...(Array.isArray(existingPreHandler) ? existingPreHandler : [existingPreHandler]),
      ]
    }
  })

  const parseRawBody: preParsingHookHandler = (request, _reply, payload, done) => {
    const { bodyLimit } = request.routeOptions

    getRawBody(
      payload,
      {
        length: null,
        limit: bodyLimit, // avoid memory leak
        encoding: 'utf8', // ensure the body is a string
      },
      (err, buf) => {
        if (err) {
          /**
           * the error is managed by fastify server
           */
          return
        }

        request[kRawBody] = buf
      },
    )

    done(null, payload)
  }

  const verifySignature: preHandlerHookHandler = (request, _reply, done) => {
    const signature = request.headers[LINE_SIGNATURE_HTTP_HEADER_NAME] as string

    if (!signature) {
      done(new MissingSignatureError())
      return
    }

    if (!validateSignature(request[kRawBody], channelSecret, signature)) {
      done(new InvalidSignatureError(signature))
      return
    }

    done()
  }

  done()
}

export const fastifyLine = fp(plugin, {
  name: 'fastify-line',
  fastify: '5.x',
})
