import { motion } from 'framer-motion'
import { FiGithub, FiLinkedin, FiMail, FiTerminal, FiServer, FiDatabase } from 'react-icons/fi'

const FloatingIcon = ({ icon, className, delay }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.5 }}
    className={`absolute ${className}`}
  >
    <motion.div
      animate={{ y: [0, -15, 0], rotate: [0, 5, -5, 0] }}
      transition={{ repeat: Infinity, duration: 4 + Math.random() * 2, ease: 'easeInOut' }}
      className="glass p-3 rounded-xl text-indigo-400/60"
    >
      {icon}
    </motion.div>
  </motion.div>
)

const TerminalWindow = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.5, duration: 0.8 }}
    className="absolute -bottom-10 right-0 md:right-10 lg:right-20 hidden md:block"
  >
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      className="glass rounded-xl p-4 w-72 opacity-40 hover:opacity-70 transition-opacity duration-500"
    >
      <div className="flex gap-1.5 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      </div>
      <div className="font-mono text-[10px] leading-relaxed">
        <p className="text-green-400">$ node server.js</p>
        <p className="text-zinc-500">🚀 Server running on port 3000</p>
        <p className="text-zinc-500">📦 Kafka consumer connected</p>
        <p className="text-zinc-500">🔗 MySQL pool established</p>
        <p className="text-indigo-400">✓ All microservices healthy</p>
      </div>
    </motion.div>
  </motion.div>
)

const ServerRack = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.8, duration: 0.8 }}
    className="absolute top-20 left-5 md:left-20 hidden md:block"
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      className="glass rounded-xl p-3 opacity-30 hover:opacity-60 transition-opacity duration-500"
    >
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 rounded">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
              className="w-1.5 h-1.5 rounded-full bg-green-400"
            />
            <div className="w-16 h-1 bg-zinc-700 rounded" />
            <div className="w-8 h-1 bg-indigo-500/50 rounded" />
          </div>
        ))}
      </div>
      <p className="text-[8px] text-zinc-600 mt-2 text-center">AWS EC2 Cluster</p>
    </motion.div>
  </motion.div>
)

const Hero = () => {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden"
    >
      {/* Floating Backend Icons */}
      <FloatingIcon icon={<FiTerminal size={20} />} className="top-[20%] left-[10%]" delay={2} />
      <FloatingIcon icon={<FiServer size={20} />} className="top-[30%] right-[12%]" delay={2.3} />
      <FloatingIcon icon={<FiDatabase size={20} />} className="bottom-[25%] left-[15%]" delay={2.6} />

      {/* Terminal Window */}
      <TerminalWindow />

      {/* Server Rack */}
      <ServerRack />

      <div className="max-w-4xl mx-auto text-center z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full mb-6"
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-2 h-2 rounded-full bg-green-400"
          />
          <span className="text-xs text-zinc-400">Available for opportunities</span>
        </motion.div>

        {/* Name */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4"
        >
          <span className="gradient-text">Sangam Singh</span>
          <br />
          <span className="text-white">Yadav</span>
        </motion.h1>

        {/* Animated Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-8"
        >
          {['MERN Stack', 'Microservices', 'AWS', 'Kafka'].map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.15 }}
              className="px-3 py-1 text-sm glass rounded-full text-indigo-300 border border-indigo-500/20"
            >
              {tag}
            </motion.span>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-zinc-400 text-lg max-w-xl mx-auto mb-8"
        >
          Building scalable backend systems that handle{' '}
          <span className="text-indigo-400 font-medium">10,000+ transactions/day</span> with
          multi-region deployments across the globe.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-10"
        >
          <a
            href="#journey"
            className="group px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-all duration-300 glow flex items-center gap-2"
          >
            <span>Explore My Journey</span>
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              →
            </motion.span>
          </a>
          <a
            href="#contact"
            className="px-8 py-3 border border-zinc-700 hover:border-indigo-500 text-zinc-300 hover:text-white rounded-full font-medium transition-all duration-300"
          >
            Get In Touch
          </a>
        </motion.div>

        {/* Social Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="flex items-center justify-center gap-5"
        >
          {[
            { icon: <FiGithub size={20} />, href: 'https://github.com/sangamyadav', label: 'GitHub' },
            { icon: <FiLinkedin size={20} />, href: 'https://linkedin.com/in/sangamyadav', label: 'LinkedIn' },
            { icon: <FiMail size={20} />, href: 'mailto:sangamyadav926@gmail.com', label: 'Email' },
          ].map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="p-3 rounded-full glass text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all duration-300 hover:glow"
            >
              {social.icon}
            </a>
          ))}
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-zinc-600 text-xs">Scroll to explore</span>
            <div className="w-5 h-8 border-2 border-zinc-600 rounded-full flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-1 h-2 bg-indigo-500 rounded-full mt-1"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
