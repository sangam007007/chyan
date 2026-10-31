import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { FiMapPin, FiAward, FiCode, FiCloud, FiBookOpen } from 'react-icons/fi'

const journeyPoints = [
  {
    year: '2014',
    title: 'BCA — DAMS Kanpur',
    subtitle: 'Started my journey in Computer Applications',
    icon: <FiBookOpen />,
    location: 'Kanpur, UP',
    color: '#22c55e',
    x: 10,
    y: 75,
  },
  {
    year: '2017',
    title: 'MCA — KNIT Sultanpur',
    subtitle: 'Deep dive into advanced computing & algorithms',
    icon: <FiBookOpen />,
    location: 'Sultanpur, UP',
    color: '#06b6d4',
    x: 25,
    y: 45,
  },
  {
    year: '2021',
    title: 'Backend Developer — Tech Mahindra',
    subtitle: 'Built enterprise LMS serving 5000+ users. 2x Award winner.',
    icon: <FiCode />,
    location: 'India',
    color: '#8b5cf6',
    x: 45,
    y: 65,
  },
  {
    year: '2025',
    title: 'Senior Dev — IBM (Artech)',
    subtitle: 'Connected Vehicle Platform for Maruti Suzuki. Multi-region: India, Europe, Japan.',
    icon: <FiCloud />,
    location: 'India → Europe → Japan',
    color: '#6366f1',
    x: 68,
    y: 35,
  },
  {
    year: '2025+',
    title: 'Freelancer — Logistics Startup',
    subtitle: '10K+ daily transactions. Event-driven systems on AWS.',
    icon: <FiAward />,
    location: 'Bangalore',
    color: '#f59e0b',
    x: 88,
    y: 55,
  },
]

const JourneyMap = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <section id="journey" className="relative py-24 px-6 z-10 overflow-hidden">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            My <span className="gradient-text">Journey</span> Map
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            From Kanpur to Bangalore — a visual map of my career path across cities, companies, and technologies
          </p>
        </motion.div>

        {/* Map Container */}
        <div className="relative w-full h-[500px] md:h-[600px] glass rounded-3xl overflow-hidden p-6">
          {/* Grid pattern background */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Animated path connecting points */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              d={`M ${journeyPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}`}
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="0.3"
              strokeDasharray="1 0.5"
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : {}}
              transition={{ duration: 2.5, ease: 'easeInOut' }}
            />
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="25%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="75%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>

          {/* Animated plane/dot traveling the path */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 2.5 }}
            className="absolute"
            style={{ left: `${journeyPoints[journeyPoints.length - 1].x}%`, top: `${journeyPoints[journeyPoints.length - 1].y}%` }}
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-3 h-3 bg-amber-400 rounded-full"
            />
          </motion.div>

          {/* Journey Points */}
          {journeyPoints.map((point, index) => (
            <motion.div
              key={point.year}
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.3 }}
              className="absolute group cursor-pointer"
              style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Pin */}
              <div className="relative">
                {/* Pulse ring */}
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, delay: index * 0.5 }}
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: point.color, opacity: 0.3 }}
                />

                {/* Icon circle */}
                <div
                  className="relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-sm shadow-lg border-2 z-10"
                  style={{
                    backgroundColor: `${point.color}20`,
                    borderColor: point.color,
                    boxShadow: `0 0 20px ${point.color}40`,
                  }}
                >
                  {point.icon}
                </div>

                {/* Year label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] md:text-xs font-bold" style={{ color: point.color }}>
                    {point.year}
                  </span>
                </div>

                {/* Hover card */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                  <div className="glass rounded-xl p-3 min-w-[180px] md:min-w-[220px] text-center">
                    <p className="text-white font-semibold text-xs md:text-sm">{point.title}</p>
                    <p className="text-zinc-400 text-[10px] md:text-xs mt-1">{point.subtitle}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <FiMapPin size={10} className="text-indigo-400" />
                      <span className="text-zinc-500 text-[10px]">{point.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Decorative elements - Floating cities */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="absolute bottom-4 right-4 text-[10px] text-zinc-600 font-mono"
          >
            📍 Kanpur → Sultanpur → Noida → Bangalore → Global
          </motion.div>

          {/* Region labels */}
          <div className="absolute top-4 left-4 flex gap-3">
            {['🇮🇳 India', '🇪🇺 Europe', '🇯🇵 Japan'].map((region, i) => (
              <motion.span
                key={region}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 0.5, x: 0 } : {}}
                transition={{ delay: 2 + i * 0.2 }}
                className="text-[10px] text-zinc-500 glass px-2 py-1 rounded-full"
              >
                {region}
              </motion.span>
            ))}
          </div>
        </div>

        {/* Stats below map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 2, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8"
        >
          {[
            { num: '4+', label: 'Years Experience' },
            { num: '3', label: 'Companies' },
            { num: '5+', label: 'Cities' },
            { num: '3', label: 'Countries Deployed' },
          ].map((stat, i) => (
            <div key={stat.label} className="glass rounded-xl p-4 text-center card-hover">
              <p className="text-2xl md:text-3xl font-bold gradient-text">{stat.num}</p>
              <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default JourneyMap
