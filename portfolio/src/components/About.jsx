import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { FiMapPin, FiPhone, FiAward, FiBriefcase } from 'react-icons/fi'

const About = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const bentoItems = [
    {
      icon: <FiBriefcase className="text-indigo-400" size={24} />,
      title: '4+ Years',
      subtitle: 'Professional Experience',
      span: 'col-span-1',
    },
    {
      icon: <FiMapPin className="text-indigo-400" size={24} />,
      title: 'Bangalore / Noida',
      subtitle: 'Based in India',
      span: 'col-span-1',
    },
    {
      icon: <FiAward className="text-indigo-400" size={24} />,
      title: 'Pat on Back Award',
      subtitle: 'Tech Mahindra (2x)',
      span: 'col-span-1',
    },
    {
      icon: <FiPhone className="text-indigo-400" size={24} />,
      title: '+91 7839694157',
      subtitle: 'Available for opportunities',
      span: 'col-span-1',
    },
  ]

  return (
    <section id="about" className="relative py-24 px-6 z-10">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            About <span className="gradient-text">Me</span>
          </h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
            Senior Backend Developer specializing in scalable microservices, event-driven systems,
            and cloud infrastructure. Delivered production-grade solutions for IBM and enterprise clients.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bentoItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`${item.span} glass rounded-2xl p-6 card-hover`}
            >
              <div className="mb-3">{item.icon}</div>
              <h3 className="text-white font-semibold text-lg">{item.title}</h3>
              <p className="text-zinc-500 text-sm">{item.subtitle}</p>
            </motion.div>
          ))}
        </div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 glass rounded-2xl p-8"
        >
          <p className="text-zinc-300 leading-relaxed text-base md:text-lg">
            I build high-performance backend systems that handle real-time data at scale. 
            My work on the <span className="text-indigo-400 font-medium">Connected Vehicle Platform (IBM × Maruti Suzuki)</span> involved 
            multi-region deployments across India, Europe, and Japan — processing vehicle telemetry, 
            event alerts, and remote control features for thousands of vehicles in real-time. 
            I'm passionate about system design, distributed architectures, and writing clean, maintainable code.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

export default About
