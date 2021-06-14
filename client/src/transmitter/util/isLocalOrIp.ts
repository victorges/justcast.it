import isIp from 'is-ip'
import isLocalHost from './isLocalHost'

export default function isLocalOrIp(hostname: string): boolean {
  return isLocalHost(hostname) || isIp(hostname)
}
