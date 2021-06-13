export {}

declare global {
  interface CastSession {
    stop(): void

    onConnected?: () => void
    onClosed?: () => void
  }
}
