import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [showMadeBy, setShowMadeBy] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Loading progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 2
      })
    }, 30)

    // Show "Made by Engiigenius" after 2.5 seconds
    const madeByTimeout = setTimeout(() => {
      setShowMadeBy(true)
    }, 2500)

    // Start fade out after 3 seconds
    const fadeOutTimeout = setTimeout(() => {
      setFadeOut(true)
    }, 3000)

    // Complete splash screen after 3.5 seconds
    const completeTimeout = setTimeout(() => {
      onComplete()
    }, 3500)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(madeByTimeout)
      clearTimeout(fadeOutTimeout)
      clearTimeout(completeTimeout)
    }
  }, [onComplete])

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-red-500/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
        {!showMadeBy ? (
          <>
            {/* Logo Section - Clean and Centered */}
            <div className="mb-16 animate-fade-in">
              <img 
                src="/images/logo.png" 
                alt="SGU Incubation Centre" 
                className="w-64 h-64 object-contain drop-shadow-2xl mx-auto"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              {/* Fallback Logo */}
              <div className="hidden w-56 h-56 flex-col items-center justify-center bg-white rounded-lg shadow-2xl mx-auto" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)' }}>
                <div className="absolute inset-0 border-4 border-red-600 rounded-lg" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)' }} />
                <div className="flex space-x-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5" viewBox="0 0 20 20">
                      <polygon points="10,1 13,7 19,7 14,11 16,17 10,13 4,17 6,11 1,7 7,7" fill="#dc2626" />
                    </svg>
                  ))}
                </div>
                <div className="text-6xl font-black text-gray-900 mb-3">SGU</div>
                <div className="w-16 h-16 mb-3">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="18" fill="white" stroke="#dc2626" strokeWidth="3" />
                    {[...Array(12)].map((_, i) => {
                      const angle = (i * 30) * Math.PI / 180
                      return (
                        <line 
                          key={i} 
                          x1={50 + Math.cos(angle) * 22} 
                          y1={50 + Math.sin(angle) * 22} 
                          x2={50 + Math.cos(angle) * 32} 
                          y2={50 + Math.sin(angle) * 32} 
                          stroke="#dc2626" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                        />
                      )
                    })}
                  </svg>
                </div>
                <div className="text-[10px] font-bold text-gray-900 tracking-wider">INCUBATION CENTRE</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-80 bg-gray-200 rounded-full h-2 overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-600 mt-3 text-sm font-medium animate-fade-in" style={{ animationDelay: '0.3s' }}>{progress}%</p>
          </>
        ) : (
          // "Made by Engiigenius" section - Simple and Clean
          <div className="animate-cinematic-fade-in">
            <p className="text-lg text-gray-500 mb-3">Made by</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Engiigenius
            </h2>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes cinematic-fade-in {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-cinematic-fade-in {
          animation: cinematic-fade-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
