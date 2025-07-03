import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InvalidSignatureError, MissingSignatureError } from '../src/error.js'
import fastifyLine, { type MessageEvent } from '../src/index.js' // Adjust path as needed
import { kRawBody } from '../src/symbols'
import { kRoutes, printRoutes } from './helpers/print-routes.js'

const DESTINATION = 'Uaaaabbbbccccddddeeeeffff'
const mockChannelSecret = 'test_channel_secret'
const mockChannelAccessToken = 'test_channel_secret'

describe('fastifyLine plugin', () => {
  let fastify: FastifyInstance

  const webhook: MessageEvent = {
    message: {
      id: 'test_event_message_id',
      text: 'this is test message.😄😅😢😞😄😅😢😞',
      quoteToken: 'test_quote_token',
      type: 'text',
    },
    replyToken: 'test_reply_token',
    source: {
      groupId: 'test_group_id',
      type: 'group',
    },
    webhookEventId: 'test_webhook_event_id',
    deliveryContext: {
      isRedelivery: false,
    },
    timestamp: 0,
    mode: 'active',
    type: 'message',
  }

  const webhookSignature = {
    'X-Line-Signature': 'eRdWYcVCzZV3MVZ3M9/rHJCl/a3oSbsRb04cLovpVwM=',
  }

  beforeEach(() => {
    fastify = Fastify()
  })

  afterEach(async () => {
    await fastify.close()
  })

  describe('Plugin Registration', () => {
    it('should register successfully with valid options', async () => {
      await expect(
        fastify.register(fastifyLine, {
          channelSecret: mockChannelSecret,
          channelAccessToken: mockChannelAccessToken,
        }),
      ).resolves.not.toThrow()
    })

    it('should throw error when channelSecret is missing', async () => {
      await expect(
        // @ts-expect-error
        fastify.register(fastifyLine, {
          channelAccessToken: mockChannelAccessToken,
        }),
      ).rejects.toThrow('"channelSecret" option is required')
    })

    it('should throw error when channelAccessToken is missing', async () => {
      await expect(
        // @ts-expect-error
        fastify.register(fastifyLine, {
          channelSecret: mockChannelSecret,
        }),
      ).rejects.toThrow('"channelAccessToken" option is required')
    })

    it('should decorate fastify instance with line client', async () => {
      await fastify.register(fastifyLine, {
        channelSecret: mockChannelSecret,
        channelAccessToken: mockChannelAccessToken,
      })

      expect(fastify.line).toBeDefined()
      expect(fastify.line).toHaveProperty('pushMessage')
      expect(fastify.line).toHaveProperty('replyMessage')
    })
  })

  describe('Hook Registration', () => {
    beforeEach(async () => {
      fastify.register(printRoutes)

      await fastify.register(fastifyLine, {
        channelSecret: mockChannelSecret,
        channelAccessToken: mockChannelAccessToken,
      })
    })

    it('should add hooks to POST routes with lineWebhook config', async () => {
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        () => {},
      )

      const route = fastify[kRoutes]()[0]

      expect(route).toBeDefined()
      expect(route.method).toBe('POST')
      expect(route.url).toBe('/webhook')
      expect(route.preParsing![0]).toBeInstanceOf(Function)
      expect(route.preParsing![0].name).toBe('parseRawBody')
      expect(route.preHandler![0]).toBeInstanceOf(Function)
      expect(route.preHandler![0].name).toBe('verifySignature')
    })

    it('should not add hooks to non-POST routes', async () => {
      fastify.get(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        () => ({ success: true }),
      )

      // The hooks should not be added to GET routes
      // This is tested by ensuring the route works without signature verification
      await fastify.ready()
      const response = await fastify.inject({
        method: 'GET',
        url: '/webhook',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toStrictEqual({ success: true })
    })

    it('should not add hooks to routes without lineWebhook config', async () => {
      fastify.post('/webhook', () => ({ success: true }))

      await fastify.ready()
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: { test: 'data' },
      })

      // Should not fail due to missing signature since hooks weren't added
      expect(response.statusCode).toBe(200)
      expect(response.json()).toStrictEqual({ success: true })
    })
  })

  describe('Raw Body Parsing', () => {
    beforeEach(async () => {
      await fastify.register(fastifyLine, {
        channelSecret: mockChannelSecret,
        channelAccessToken: mockChannelAccessToken,
      })
    })

    it('should parse raw body in preParsing hook', async () => {
      let rawBody: string | undefined
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        (request) => {
          rawBody = request[kRawBody]
          return request[kRawBody]
        },
      )

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
        headers: { ...webhookSignature },
      })

      expect(response.statusCode).toBe(200)
      expect(rawBody).toEqual(
        JSON.stringify({
          events: [webhook],
          destination: DESTINATION,
        }),
      )
      expect(response.json()).toStrictEqual({
        events: [webhook],
        destination: DESTINATION,
      })
    })

    it('should handle getRawBody errors gracefully', async () => {
      let rawBody: string | undefined
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        (request) => {
          rawBody = request[kRawBody]
          return {}
        },
      )

      await fastify.ready()

      const hugePayload = 'x'.repeat(1024 * 1024 + 1)

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: hugePayload,
        headers: { ...webhookSignature, 'content-type': 'text/plain; charset=utf-8' },
      })

      // Fastify should return 413 Payload Too Large
      expect(response.statusCode).toBe(413)
      expect(rawBody).toBeUndefined()
    })
  })

  describe('Signature Verification', () => {
    beforeEach(async () => {
      await fastify.register(fastifyLine, {
        channelSecret: mockChannelSecret,
        channelAccessToken: mockChannelAccessToken,
      })
    })

    it('should pass with valid signature', async () => {
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        (request) => {
          return request[kRawBody]
        },
      )

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
        headers: { ...webhookSignature },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toStrictEqual({
        events: [webhook],
        destination: DESTINATION,
      })
    })

    it('should fail with invalid signature', async () => {
      let setErrorHandlerCalled = false
      let signature: string | undefined
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        () => {
          return {}
        },
      )

      fastify.setErrorHandler((error, _request, reply) => {
        if (error instanceof InvalidSignatureError) {
          setErrorHandlerCalled = true
          signature = error.signature
        }
        reply.send(error)
      })

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
        headers: { 'X-Line-Signature': 'WqJD7WAIZhWcXThMCf8jZnwG3Hmn7EF36plkQGkj48w=' },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toStrictEqual({
        statusCode: 500,
        code: 'FST_ERR_LINE_SIGNATURE_INVALID',
        error: 'Internal Server Error',
        message: 'Line signature validation failed',
      })
      expect(setErrorHandlerCalled).toBe(true)
      expect(signature).toBe('WqJD7WAIZhWcXThMCf8jZnwG3Hmn7EF36plkQGkj48w=')
    })

    it('should fail when signature header is missing', async () => {
      let setErrorHandlerCalled = false
      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
        },
        () => {
          return {}
        },
      )

      fastify.setErrorHandler((error, _request, reply) => {
        if (error instanceof MissingSignatureError) {
          setErrorHandlerCalled = true
        }
        reply.send(error)
      })

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toStrictEqual({
        statusCode: 500,
        code: 'FST_ERR_LINE_SIGNATURE_MISSING',
        error: 'Internal Server Error',
        message: 'Line signature is missing',
      })
      expect(setErrorHandlerCalled).toBe(true)
    })
  })

  describe('Hook Order and Existing Hooks', () => {
    beforeEach(async () => {
      await fastify.register(fastifyLine, {
        channelSecret: mockChannelSecret,
        channelAccessToken: mockChannelAccessToken,
      })
    })

    it('should preserve existing preParsing and preHandler hooks (one)', async () => {
      let preParsingCalled = false
      let preHandlerCalled = false

      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
          preParsing: (_request, _reply, payload, done) => {
            preParsingCalled = true
            done(null, payload)
          },
          preHandler: (_request, _reply, done) => {
            preHandlerCalled = true
            done()
          },
        },
        () => {
          return { success: true }
        },
      )

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
        headers: { ...webhookSignature },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ success: true })
      expect(preParsingCalled).toBe(true)
      expect(preHandlerCalled).toBe(true)
    })

    it('should preserve existing preParsing and preHandler hooks (many)', async () => {
      let preParsingCalls = 0
      let preHandlerCalls = 0

      fastify.post(
        '/webhook',
        {
          config: { lineWebhook: true },
          preParsing: [
            (_request, _reply, payload, done) => {
              preParsingCalls++
              done(null, payload)
            },
            (_request, _reply, payload, done) => {
              preParsingCalls++
              done(null, payload)
            },
          ],
          preHandler: [
            (_request, _reply, done) => {
              preHandlerCalls++
              done()
            },
            (_request, _reply, done) => {
              preHandlerCalls++
              done()
            },
          ],
        },
        () => {
          return { success: true }
        },
      )

      await fastify.ready()

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          events: [webhook],
          destination: DESTINATION,
        },
        headers: { ...webhookSignature },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ success: true })
      expect(preParsingCalls).toBe(2)
      expect(preHandlerCalls).toBe(2)
    })
  })
})
