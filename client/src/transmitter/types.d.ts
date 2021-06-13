export {}

declare global {
  interface CastSession {
    close(): void
    onOpen: () => void
    onClose: () => void
    onError: (isTransient?: boolean) => void
  }
}
