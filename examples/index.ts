import Fastify from 'fastify'
import fastifyLine, {
  InvalidSignatureError,
  MissingSignatureError,
  type WebhookRequestBody,
} from '../src/index.js'

const fastify = Fastify({ logger: true })

await fastify.register(fastifyLine, {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

fastify.post<{ Body: WebhookRequestBody }>(
  '/webhook',
  {
    config: { lineWebhook: true }, // Enable LINE webhook handling for this route
  },
  async (request, reply) => {
    const { events } = request.body

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await fastify.line.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: `You said: ${event.message.text}`,
            },
          ],
        })
      }
    }

    reply.send({ ok: true })
  },
)

fastify.setErrorHandler((err, _request, reply) => {
  if (err instanceof MissingSignatureError) {
    reply.status(401).send({
      error: err.message,
      message: 'The X-Line-Signature header is missing.',
    })
  }

  if (err instanceof InvalidSignatureError) {
    reply.status(401).send({
      error: err.message,
      message: 'The X-Line-Signature header is invalid.',
      signature: err.signature,
    })
  }

  // Default error handling
  reply.send(err)
})

await fastify.listen({ port: 3000 })
