import type { JSX, ReactNode } from 'react'
import type { DeviceKind } from '../store/types'
import { KIND_LABEL } from '../store/catalog'
import pcPng from '@resources/pc.png'
import wifiRouterPng from '@resources/wifi-router.png'
import serverPng from '@resources/server.png'
import cloudServerPng from '@resources/cloud-server.png'
import databasePng from '@resources/database-management.png'
import worldwidePng from '@resources/worldwide.png'
import mailBoxPng from '@resources/mail-box.png'
import gatewayPng from '@resources/gateway.png'

interface IconProps {
  className?: string
}

function iconClass(className?: string): string {
  return ['device-icon', className].filter(Boolean).join(' ')
}

function svg(children: ReactNode, className?: string): JSX.Element {
  return (
    <svg
      className={iconClass(className)}
      viewBox="0 0 32 32"
      width="48"
      height="48"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function ClientIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <rect x="4" y="6" width="24" height="16" rx="2" />
      <path d="M10 26h12M16 22v4" />
      <circle cx="16" cy="14" r="3" />
    </>,
    className
  )
}

export function LoadBalancerIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <path d="M16 4v6M8 14h16" />
      <circle cx="16" cy="12" r="3" />
      <path d="M8 14l-3 10h8l-1-10M24 14l3 10h-8l1-10" />
    </>,
    className
  )
}

export function AppServerIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <rect x="6" y="5" width="20" height="7" rx="1.5" />
      <rect x="6" y="13" width="20" height="7" rx="1.5" />
      <rect x="6" y="21" width="20" height="6" rx="1.5" />
      <circle cx="10" cy="8.5" r="1" fill="currentColor" />
      <circle cx="10" cy="16.5" r="1" fill="currentColor" />
      <circle cx="10" cy="24" r="1" fill="currentColor" />
    </>,
    className
  )
}

export function CacheIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <path d="M14 5l-7 12h8l-2 10 11-14h-8l4-8z" />
    </>,
    className
  )
}

export function DatabaseIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <ellipse cx="16" cy="8" rx="9" ry="4" />
      <path d="M7 8v16c0 2.2 4 4 9 4s9-1.8 9-4V8" />
      <path d="M7 16c0 2.2 4 4 9 4s9-1.8 9-4" />
    </>,
    className
  )
}

export function MessageQueueIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <rect x="4" y="7" width="8" height="18" rx="1" />
      <rect x="12" y="7" width="8" height="18" rx="1" />
      <rect x="20" y="7" width="8" height="18" rx="1" />
      <path d="M7 12h2M15 12h2M23 12h2M7 17h2M15 17h2M23 17h2" />
    </>,
    className
  )
}

export function ApiGatewayIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <rect x="5" y="8" width="22" height="16" rx="2" />
      <path d="M11 8v16M21 8v16M5 16h22" />
      <path d="M16 4v4M16 24v4" />
    </>,
    className
  )
}

export function CdnIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <circle cx="16" cy="16" r="10" />
      <path d="M6 16h20M16 6c3 3.2 4.5 6.8 4.5 10S19 22.8 16 26c-3-3.2-4.5-6.8-4.5-10S13 9.2 16 6z" />
    </>,
    className
  )
}

const DEVICE_IMAGES: Partial<Record<DeviceKind, string>> = {
  client: pcPng,
  loadBalancer: wifiRouterPng,
  apiGateway: gatewayPng,
  appServer: serverPng,
  cache: cloudServerPng,
  database: databasePng,
  messageQueue: mailBoxPng,
  cdn: worldwidePng
}

const FALLBACK_ICONS: Record<DeviceKind, (props: IconProps) => JSX.Element> = {
  client: ClientIcon,
  loadBalancer: LoadBalancerIcon,
  apiGateway: ApiGatewayIcon,
  appServer: AppServerIcon,
  cache: CacheIcon,
  database: DatabaseIcon,
  messageQueue: MessageQueueIcon,
  cdn: CdnIcon
}

export function ApiIcon({ className }: IconProps): JSX.Element {
  return svg(
    <>
      <path d="M9 10c-1.8 0-2.5 1.2-2.5 2.8v6.4c0 1.6.7 2.8 2.5 2.8" />
      <path d="M23 10c1.8 0 2.5 1.2 2.5 2.8v6.4c0 1.6-.7 2.8-2.5 2.8" />
      <path d="M13 16h6M16 13v6" />
    </>,
    className
  )
}

export function DeviceIcon({
  kind,
  className
}: {
  kind: DeviceKind
  className?: string
}): JSX.Element {
  const src = DEVICE_IMAGES[kind]
  if (src) {
    return (
      <img
        className={iconClass(className)}
        src={src}
        alt={KIND_LABEL[kind]}
        draggable={false}
      />
    )
  }

  const Fallback = FALLBACK_ICONS[kind]
  return <Fallback className={className} />
}
