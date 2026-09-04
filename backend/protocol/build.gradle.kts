plugins {
    id("villages.kotlin-module")
}

// The frames that cross the WebSocket, mirrored in TypeScript under frontend/packages/protocol and tested
// against the same fixtures in contracts/fixtures. Depends on no other module, so a frame can never leak
// a domain type by accident.
