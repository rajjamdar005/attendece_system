import { Loader2 } from 'lucide-react'

// Full page loader
export function PageLoader({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  )
}

// Button loader (inline)
export function ButtonLoader({ size = 'default' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-5 h-5',
    large: 'w-6 h-6'
  }

  return (
    <Loader2 className={`${sizeClasses[size]} animate-spin`} />
  )
}

// Skeleton loader for cards
export function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-lg shadow p-6">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
    </div>
  )
}

// Skeleton loader for table rows
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse">
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex space-x-4">
            {[...Array(cols)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded flex-1"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Spinner with overlay
export function SpinnerOverlay({ message = 'Processing...' }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-2xl">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  )
}

// Pulse loader (simple dots)
export function PulseLoader() {
  return (
    <div className="flex space-x-2">
      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}
