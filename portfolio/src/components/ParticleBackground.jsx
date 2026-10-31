import { useEffect, useRef } from 'react'

const ParticleBackground = () => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let particles = []
    let codeLines = []
    let orbs = []
    let mouseX = 0
    let mouseY = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      particles = []
      const numParticles = Math.floor((canvas.width * canvas.height) / 12000)
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.6 + 0.1,
          pulse: Math.random() * Math.PI * 2,
        })
      }
    }

    const createCodeLines = () => {
      codeLines = []
      const snippets = [
        'const server = express()',
        'app.listen(3000)',
        'kafka.produce(event)',
        'await db.query(sql)',
        'docker build -t app .',
        'git push origin main',
        'npm run deploy',
        'redis.set(key, value)',
        'jwt.verify(token)',
        'aws s3 sync ./',
        'kubectl apply -f',
        'SELECT * FROM users',
        'mongoose.connect(uri)',
        'res.json({ status })',
        'next() // middleware',
      ]
      for (let i = 0; i < 8; i++) {
        codeLines.push({
          text: snippets[Math.floor(Math.random() * snippets.length)],
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          opacity: 0,
          targetOpacity: Math.random() * 0.12 + 0.03,
          speed: Math.random() * 0.3 + 0.1,
          fadeDir: 1,
        })
      }
    }

    const createOrbs = () => {
      orbs = [
        { x: canvas.width * 0.2, y: canvas.height * 0.3, radius: 200, color: '99, 102, 241', speed: 0.0005, angle: 0 },
        { x: canvas.width * 0.8, y: canvas.height * 0.7, radius: 250, color: '139, 92, 246', speed: 0.0003, angle: Math.PI },
        { x: canvas.width * 0.5, y: canvas.height * 0.5, radius: 180, color: '6, 182, 212', speed: 0.0004, angle: Math.PI / 2 },
      ]
    }

    const handleMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw floating orbs (gradient blobs)
      orbs.forEach((orb) => {
        orb.angle += orb.speed
        const offsetX = Math.sin(orb.angle) * 50
        const offsetY = Math.cos(orb.angle * 0.7) * 30

        const gradient = ctx.createRadialGradient(
          orb.x + offsetX, orb.y + offsetY, 0,
          orb.x + offsetX, orb.y + offsetY, orb.radius
        )
        gradient.addColorStop(0, `rgba(${orb.color}, 0.08)`)
        gradient.addColorStop(0.5, `rgba(${orb.color}, 0.03)`)
        gradient.addColorStop(1, `rgba(${orb.color}, 0)`)

        ctx.beginPath()
        ctx.arc(orb.x + offsetX, orb.y + offsetY, orb.radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      })

      // Draw code lines (floating code snippets)
      ctx.font = '12px "JetBrains Mono", "Fira Code", monospace'
      codeLines.forEach((line) => {
        line.opacity += 0.003 * line.fadeDir
        if (line.opacity >= line.targetOpacity) line.fadeDir = -1
        if (line.opacity <= 0) {
          line.fadeDir = 1
          line.x = Math.random() * canvas.width
          line.y = Math.random() * canvas.height
        }
        line.y -= line.speed

        ctx.fillStyle = `rgba(99, 102, 241, ${line.opacity})`
        ctx.fillText(line.text, line.x, line.y)
      })

      // Draw particles with mouse interaction
      particles.forEach((p) => {
        p.pulse += 0.02
        const pulseFactor = Math.sin(p.pulse) * 0.3 + 0.7

        p.x += p.speedX
        p.y += p.speedY

        // Mouse repulsion
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const dist = Math.hypot(dx, dy)
        if (dist < 150) {
          const force = (150 - dist) / 150
          p.x += (dx / dist) * force * 2
          p.y += (dy / dist) * force * 2
        }

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * pulseFactor, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity * pulseFactor})`
        ctx.fill()
      })

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    resize()
    createParticles()
    createCodeLines()
    createOrbs()
    animate()

    window.addEventListener('resize', () => {
      resize()
      createParticles()
      createCodeLines()
      createOrbs()
    })
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  )
}

export default ParticleBackground
