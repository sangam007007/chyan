import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { FiMail, FiPhone, FiMapPin, FiGithub, FiLinkedin, FiSend } from 'react-icons/fi'

const Contact = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const mailtoLink = `mailto:sangamyadav926@gmail.com?subject=Portfolio Contact from ${formData.name}&body=${encodeURIComponent(formData.message)}%0A%0AFrom: ${formData.email}`
    window.open(mailtoLink)
  }

  const contactInfo = [
    { icon: <FiMail />, text: 'sangamyadav926@gmail.com', href: 'mailto:sangamyadav926@gmail.com' },
    { icon: <FiPhone />, text: '+91 7839694157', href: 'tel:+917839694157' },
    { icon: <FiMapPin />, text: 'Bangalore / Noida, India', href: '#' },
    { icon: <FiGithub />, text: 'github.com/sangamyadav', href: 'https://github.com/sangamyadav' },
    { icon: <FiLinkedin />, text: 'linkedin.com/in/sangamyadav', href: 'https://linkedin.com/in/sangamyadav' },
  ]

  return (
    <section id="contact" className="relative py-24 px-6 z-10">
      <div className="max-w-5xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Let's <span className="gradient-text">Connect</span>
          </h2>
          <p className="text-zinc-400 text-center max-w-xl mx-auto mb-12">
            Open for opportunities, freelance projects, and interesting collaborations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {contactInfo.map((info) => (
              <a
                key={info.text}
                href={info.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 glass rounded-xl p-4 card-hover group"
              >
                <span className="text-indigo-400 group-hover:scale-110 transition-transform">
                  {info.icon}
                </span>
                <span className="text-zinc-300 text-sm">{info.text}</span>
              </a>
            ))}
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            onSubmit={handleSubmit}
            className="glass rounded-2xl p-6 space-y-4"
          >
            <div>
              <label htmlFor="name" className="text-zinc-400 text-sm block mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-zinc-400 text-sm block mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label htmlFor="message" className="text-zinc-400 text-sm block mb-1">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={4}
                className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="Tell me about your project..."
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all duration-300 glow"
            >
              <FiSend size={16} />
              Send Message
            </button>
          </motion.form>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="mt-20 text-center"
        >
          <p className="text-zinc-600 text-sm">
            © 2026 Sangam Singh Yadav. Built with React, Tailwind CSS & Framer Motion.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

export default Contact
