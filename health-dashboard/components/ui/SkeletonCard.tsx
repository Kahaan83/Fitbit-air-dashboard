export default function SkeletonCard({ height = 200 }: { height?: number }) {
  return (
    <div style={{
      height, borderRadius: 16,
      background: "linear-gradient(90deg, #111 25%, #1C1C1C 50%, #111 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      border: "0.5px solid rgba(255,255,255,0.08)"
    }} />
  )
}
