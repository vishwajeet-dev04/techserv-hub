interface LogoProps {
  className?: string
  height?: number
}

/** Official TECHSERV.ai wordmark from techserv.ai brand assets. */
export default function Logo({ className = '', height = 36 }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="TECHSERV.ai"
      height={height}
      className={`w-auto object-contain object-left ${className}`}
      style={{ height }}
    />
  )
}
