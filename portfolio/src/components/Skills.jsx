import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  FiServer,
  FiDatabase,
  FiCloud,
  FiShield,
  FiCode,
  FiLayers,
  FiCpu,
  FiActivity,
} from 'react-icons/fi'

const skillCategories = [
  {
    title: 'Backend',
    icon: <FiServer />,
    color: 'from-indigo-500 to-purple-500',
    skills: ['Node.js', 'Express.js', 'REST APIs', 'Microservices', 'Event-Driven'],
  },
  {
    title: 'Frontend',
    icon: <FiCode />,
    color: 'from-cyan-500 to-blue-500',
    skills: ['React.js', 'Next.js', 'TypeScript', 'Redux Toolkit', 'Tailwind CSS'],
  },
  {
    title: 'Databases',
    icon: <FiDatabase />,
    color: 'from-green-500 to-emerald-500',
    skills: ['MongoDB', 'MySQL', 'PostgreSQL', 'Redis'],
  },
  {
    title: 'Cloud & DevOps',
    icon: <FiCloud />,
    color: 'from-orange-500 to-amber-500',
    skills: ['AWS (EC2, S3, RDS, Lambda)', 'Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions'],
  },
  {
    title: 'Messaging',
    icon: <FiActivity />,
    color: 'from-red-500 to-pink-500',
    skills: ['Apache Kafka', 'Event Streaming', 'Real-time Processing'],
  },
  {
    title: 'Security',
    icon: <FiShield />,
    color: 'from-violet-500 to-fuchsia-500',
    skills: ['JWT Auth', 'OAuth2', 'RBAC', 'API Security'],
  },
  {
    title: 'Concepts',
    icon: <FiCpu />,
    color: 'from-teal-500 to-cyan-500',
    skills: ['System Design (HLD/LLD)', 'DSA', 'Distributed Systems', 'Performance Optimization'],
  },
  {
    title: 'Tools',
    icon: <FiLayers />,
    color: 'from-yellow-500 to-orange-500',
    skills: ['Git', 'Postman', 'Swagger', 'JIRA', 'Jenkins'],
  },
]

const Skills = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="skills" className="relative py-24 px-6 z-10">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Tech <span className="gradient-text">Stack</span>
          </h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-12">
            Technologies I work with to build scalable, production-ready systems
          </p>
        </motion.div>

        {/* Bento Skill Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skillCategories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="glass rounded-2xl p-5 card-hover group"
            >
              <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${category.color} text-white mb-3`}>
                {category.icon}
              </div>
              <h3 className="text-white font-semibold mb-3">{category.title}</h3>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 group-hover:border-indigo-500/30 transition-colors"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Skills
