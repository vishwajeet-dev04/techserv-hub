interface LogoProps {
  className?: string
  height?: number
}

export default function Logo({ className = '', height = 36 }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="TECHSERV.ai"
      height={height}
      className={`w-auto object-contain object-left ${className}`}
      style={{ height }}
    />
  )
}
