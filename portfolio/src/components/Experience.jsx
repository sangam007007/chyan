import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const experiences = [
  {
    role: 'Senior Backend Developer',
    company: 'Independent Freelancer – Logistics Tech Startup',
    location: 'Bangalore (NDA)',
    period: 'Jul 2025 – Present',
    highlights: [
      'Designed scalable REST APIs for real-time shipment tracking — 10,000+ daily transactions',
      'Built event-driven microservices with Apache Kafka for async order updates',
      'Deployed backend on AWS (EC2, S3, RDS, Lambda) — reduced server downtime by 35%',
      'Implemented JWT + RBAC for multi-role access (Admin, Driver, Customer)',
      'Optimized MySQL queries — improved API response by ~30% under peak load',
      'Containerized with Docker + CI/CD via GitHub Actions — 50% faster deployments',
    ],
  },
  {
    role: 'Senior Backend Developer',
    company: 'Artech Infosystems (Client: IBM India)',
    location: 'Connected Vehicle Platform – MSIL',
    period: 'Feb 2025 – Jun 2025',
    highlights: [
      'Built Node.js microservices for real-time vehicle & user management (Gen2/Gen3)',
      'Integrated Apache Kafka for telemetry — reduced system latency by ~30%',
      'Multi-region deployment (India, Europe, Japan) with geo-failover support',
      'Real-time push notifications via Kafka event streams for mobile apps',
      'Reduced MTTR by 30% with monitoring and log-based debugging on IBM Cloud',
    ],
  },
  {
    role: 'Backend Developer',
    company: 'Tech Mahindra Pvt. Ltd.',
    location: 'Enterprise LMS Platform',
    period: 'Sep 2021 – Feb 2025',
    highlights: [
      'Built RESTful APIs with Node.js, Express.js, MongoDB — serving 5000+ users',
      'Integrated Udemy, HackerRank, Mettl via REST API hooks',
      'Optimized MongoDB aggregation pipelines — 20% faster queries',
      'Deployed on AWS with auto-scaling — achieved 99.9% uptime',
      '2x Pat on Back Award for exceptional contributions',
    ],
  },
]

const Experience = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="experience" className="relative py-24 px-6 z-10">
      <div className="max-w-4xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Work <span className="gradient-text">Experience</span>
          </h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-16">
            Building production systems at scale for enterprise clients
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-4 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-transparent" />

          {experiences.map((exp, index) => (
            <motion.div
              key={exp.company}
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative pl-12 md:pl-20 mb-12 last:mb-0"
            >
              {/* Timeline Dot */}
              <div className="absolute left-2.5 md:left-6.5 top-2 w-3.5 h-3.5 rounded-full bg-indigo-500 border-4 border-[#0a0a0f] glow" />

              <div className="glass rounded-2xl p-6 card-hover">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">{exp.role}</h3>
                    <p className="text-indigo-400 text-sm font-medium">{exp.company}</p>
                    <p className="text-zinc-500 text-xs">{exp.location}</p>
                  </div>
                  <span className="text-zinc-500 text-sm mt-2 md:mt-0 shrink-0">
                    {exp.period}
                  </span>
                </div>
                <ul className="space-y-2">
                  {exp.highlights.map((point, i) => (
                    <li key={i} className="text-zinc-400 text-sm flex items-start gap-2">
                      <span className="text-indigo-400 mt-1.5 shrink-0">▹</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Experience
