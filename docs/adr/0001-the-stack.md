# 0001. The stack: Kotlin and Spring Boot on the server, React and TypeScript in the browser

- Status: accepted
- Date: 2026-09-01

## Context

Occurrent is a JVM library, so choosing it fixes the server to the JVM family. The developer is one person with a
Kotlin and JVM background, building an experimental game where the cost of change matters more than the cost of the
first version. The browser side is not constrained by the server choice, beyond wanting a large ecosystem to
experiment inside.

## Decision

Kotlin on Java 21 with Spring Boot on the server, built by Gradle with the Kotlin DSL, a version catalog and the
wrapper checked in. React with TypeScript in the browser, built by Vite.

## Consequences

Occurrent 0.33 requires Java 21, so the Gradle toolchain is pinned to 21 and the build fails loudly on an older JDK.
Sealed hierarchies and data classes express commands, events and state with very little ceremony, which is what a
domain layer under constant revision needs. Spring brings WebSocket, AMQP, MongoDB, Actuator and Testcontainers
support without integration work, at the price of a framework in the outer layers; it is kept out of the domain and
application modules entirely. React has the largest ecosystem of the candidates, which matters while the interface is
being discovered, and its cost is low here because the map is wrapped imperatively in a single component either way.

## Alternatives considered

- Ktor instead of Spring Boot: lighter and more explicit, and every integration becomes hand-wiring for a solo
  developer who would rather spend the time on the game.
- Java records and sealed interfaces instead of Kotlin: workable, and noticeably more verbose for the same domain.
- Svelte or plain TypeScript instead of React: less boilerplate, smaller ecosystem. Worth revisiting only if React
  becomes the thing slowing the interface down.
