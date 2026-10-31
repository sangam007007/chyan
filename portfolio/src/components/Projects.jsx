import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { FiExternalLink, FiGithub } from 'react-icons/fi'

const projects = [
  {
    title: 'Connected Vehicle Platform — MSIL',
    description:
      'Real-time vehicle monitoring platform for Maruti Suzuki supporting live tracking, event alerts, and remote control features for Gen2 & Gen3 vehicles. Multi-region deployment across India, Europe, and Japan.',
    tech: ['Node.js', 'Apache Kafka', 'MySQL', 'IBM Cloud', 'Docker', 'Microservices', 'JWT Auth'],
    highlights: [
      'Vehicle telemetry & event streaming',
      'Ignition, battery, seatbelt monitoring',
      'Push notifications via Kafka',
      'Multi-region geo-routing',
    ],
    color: 'from-indigo-500/20 to-purple-500/20',
    borderColor: 'hover:border-indigo-500/50',
  },
  {
    title: 'Logistics Platform — Real-time Tracking',
    description:
      'Scalable backend for a logistics startup enabling real-time shipment tracking and order management handling 10,000+ daily transactions with event-driven architecture.',
    tech: ['Node.js', 'Express.js', 'Apache Kafka', 'AWS', 'MySQL', 'Docker', 'GitHub Actions'],
    highlights: [
      '10K+ daily transactions',
      'Event-driven order updates',
      'Auto-scaling on AWS',
      '50% faster deployments',
    ],
    color: 'from-cyan-500/20 to-blue-500/20',
    borderColor: 'hover:border-cyan-500/50',
  },
  {
    title: 'Enterprise Learning Management System',
    description:
      'Full-featured LMS serving 5000+ users with integrated third-party e-learning platforms, real-time training data sync, and multi-role access control.',
    tech: ['Node.js', 'Express.js', 'MongoDB', 'AWS', 'Redis', 'REST APIs'],
    highlights: [
      '5000+ active users',
      'Udemy & HackerRank integration',
      '99.9% uptime on AWS',
      '20% faster queries',
    ],
    color: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'hover:border-green-500/50',
  },
]

const Projects = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="projects" className="relative py-24 px-6 z-10">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Key <span className="gradient-text">Projects</span>
          </h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-12">
            Production-grade systems built for scale and reliability
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className={`glass rounded-2xl p-6 card-hover border border-zinc-800/50 ${project.borderColor} group relative overflow-hidden`}
            >
              {/* Gradient overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${project.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`}
              />

              <div className="relative z-10">
                <h3 className="text-white font-bold text-lg mb-2">{project.title}</h3>
                <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{project.description}</p>

                {/* Highlights */}
                <ul className="space-y-1.5 mb-4">
                  {project.highlights.map((h, i) => (
                    <li key={i} className="text-zinc-500 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {h}
                    </li>
                  ))}
                </ul>

                {/* Tech */}
                <div className="flex flex-wrap gap-1.5">
                  {project.tech.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Projects
