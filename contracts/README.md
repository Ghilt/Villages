# Contracts

The wire format between the gateway and the browser, as checked-in JSON fixtures.

`fixtures/` holds one file per message type, plus vectors for the maths both sides must agree on, such as the mapping
from a location to a cell. The Kotlin `protocol` module and the TypeScript `protocol` package each have a test that
parses every fixture, round-trips it, and compares. Neither side owns the format: the fixtures do.

Add a fixture in the same change as the message type. The fixtures arrive in increment 1.3.
