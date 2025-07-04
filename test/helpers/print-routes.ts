import type { RouteOptions } from 'fastify'
import fp from 'fastify-plugin'

export const kRoutes = Symbol('fastify:printRoutes')

declare module 'fastify' {
  interface FastifyInstance {
    [kRoutes]: () => RouteOptions[]
  }
}

const printRoutes = fp((fastify, _options, next) => {
  const routes: RouteOptions[] = []

  fastify.decorate(kRoutes, () => routes)

  fastify.addHook('onRoute', (routeOptions) => {
    routes.push(routeOptions)
  })

  next()
})

export { printRoutes }
