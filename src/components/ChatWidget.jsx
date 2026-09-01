import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Bot, CornerDownLeft, Sparkles, ArrowUp } from 'lucide-react'
import { RAG_BOT_API } from '../config'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Track scroll position for "Back to top" arrow
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('veritrace_chat_history')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Fallback
      }
    }
    return [
      {
        id: 'welcome',
        text: 'Hi! I am the VeriTrace Help Assistant, grounded in platform documentation. Ask me about fingerprinting, visual similarity matching thresholds, or request content verification checks and team alerts!',
        sender: 'bot',
        timestamp: new Date().toISOString(),
      },
    ]
  })
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    sessionStorage.setItem('veritrace_chat_history', JSON.stringify(messages))
    if (!isOpen && messages.length > 1 && messages[messages.length - 1].sender === 'bot') {
      setHasUnread(true)
    }
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      scrollToBottom()
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = {
      id: `user-${Date.now()}`,
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    const botMessageId = `bot-${Date.now()}`
    let messageAdded = false
    let accumulatedText = ''

    try {
      const response = await fetch(`${RAG_BOT_API.replace(/\/$/, '')}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.text }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Streaming response body not available')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const rawEvent of events) {
          const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())

          if (!dataLines.length) continue

          let eventObj
          try {
            eventObj = JSON.parse(dataLines.join('\n'))
          } catch {
            continue
          }

          if (eventObj.type === 'tool_start') {
            const toolName = eventObj.tool || 'Processing'
            setMessages((prev) => {
              if (!messageAdded) {
                messageAdded = true
                return [
                  ...prev,
                  {
                    id: botMessageId,
                    text: '',
                    sender: 'bot',
                    timestamp: new Date().toISOString(),
                    toolStatus: toolName,
                  },
                ]
              }
              return prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, toolStatus: toolName } : msg
              )
            })
          } else if (eventObj.type === 'tool_end') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, toolStatus: null } : msg
              )
            )
          } else if (eventObj.type === 'token') {
            accumulatedText += eventObj.content
            const currentText = accumulatedText
            setMessages((prev) => {
              if (!messageAdded) {
                messageAdded = true
                return [
                  ...prev,
                  {
                    id: botMessageId,
                    text: currentText,
                    sender: 'bot',
                    timestamp: new Date().toISOString(),
                    toolStatus: null,
                  },
                ]
              }
              return prev.map((msg) =>
                msg.id === botMessageId
                  ? { ...msg, text: currentText, toolStatus: null }
                  : msg
              )
            })
          } else if (eventObj.type === 'error') {
            throw new Error(eventObj.message || 'Stream error')
          }
        }
      }

      if (!accumulatedText && !messageAdded) {
        const botMessage = {
          id: botMessageId,
          text: "I couldn't process that request. Please try again.",
          sender: 'bot',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botMessage])
      }
    } catch (err) {
      console.error('Chat bot error:', err)
      const errorMessage = {
        id: `error-${Date.now()}`,
        text: 'Sorry, I am having trouble connecting to the helper service. Please verify the RAG Bot API deployment status.',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Simple formatter for bold text, hashes, bullet points, and newlines
  const formatMessageText = (text) => {
    if (!text) return ''
    
    // Split by newlines
    const lines = text.split('\n')
    
    return lines.map((line, lineIndex) => {
      let content = line

      // Handle bullet points
      const isBullet = content.startsWith('- ') || content.startsWith('* ')
      if (isBullet) {
        content = content.substring(2)
      }

      // Format bold text (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g
      const parts = []
      let lastIndex = 0
      let match

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index))
        }
        parts.push(
          <strong key={match.index} className="font-bold text-[var(--text)]">
            {match[1]}
          </strong>
        )
        lastIndex = boldRegex.lastIndex
      }

      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex))
      }

      // Check if line looks like code or hash
      const isHash = /0x[a-fA-F0-9]{40,64}/.test(content) || /[a-fA-F0-9]{64}/.test(content)

      const renderedLine = (
        <span className={isHash ? 'font-mono text-xs select-all bg-[var(--bg-3)] px-1.5 py-0.5 rounded border border-[var(--border-2)] text-[var(--accent-light)]' : ''}>
          {parts.length > 0 ? parts : content}
        </span>
      )

      if (isBullet) {
        return (
          <li key={lineIndex} className="ml-4 list-disc mb-1.5 text-[var(--text-2)] leading-relaxed">
            {renderedLine}
          </li>
        )
      }

      return (
        <p key={lineIndex} className="mb-2 leading-relaxed text-[var(--text-2)]">
          {renderedLine}
        </p>
      )
    })
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ originY: 1, originX: 1, willChange: 'transform, opacity' }}
            className="w-[calc(100vw-3rem)] max-w-[360px] sm:max-w-[380px] h-[520px] max-h-[calc(100vh-120px)] rounded-2xl glass-card flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-4 border border-[var(--border-2)] overflow-hidden transform-gpu"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-2)] bg-[var(--bg-2)]/60">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)]">
                  <Bot size={16} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--success-text)] border-2 border-[var(--bg)]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                    VeriTrace Assistant
                    <span className="flex items-center gap-0.5 text-[8px] font-semibold text-[var(--success-text)] uppercase bg-[var(--success-text)]/10 px-1 rounded">RAG</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-3)] flex items-center gap-1">
                    <Sparkles size={8} className="text-[var(--accent)]" />
                    <span>Gemini-Grounded Knowledge</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-3)] transition-colors active:scale-95"
              >
                <X size={15} />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar bg-[var(--bg)]/10">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user'
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}
                  >
                    {!isUser && (
                      <div className="w-6 h-6 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0 mt-0.5">
                        <Bot size={12} />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white rounded-tr-none'
                          : msg.isError
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-tl-none'
                          : 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <p className="leading-relaxed select-text">{msg.text}</p>
                      ) : (
                        <div className="select-text space-y-1">
                          {msg.toolStatus && (
                            <div className="flex items-center gap-1.5 text-[11px] text-[var(--accent)] mb-1.5 font-medium italic">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                              <span>{msg.toolStatus}...</span>
                            </div>
                          )}
                          {formatMessageText(msg.text)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Bouncing Loader */}
              {isLoading && messages[messages.length - 1]?.sender === 'user' && (
                <div className="flex justify-start items-start gap-2">
                  <div className="w-6 h-6 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
                    <Bot size={12} />
                  </div>
                  <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl rounded-tl-none px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="px-3 py-3 border-t border-[var(--border-2)] bg-[var(--bg-2)]/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about thresholds, duplicates..."
                className="flex-1 bg-[var(--bg)] border border-[var(--border-2)] focus:border-[var(--accent)]/50 rounded-xl px-3 py-2 text-xs text-[var(--text)] placeholder-[var(--text-4)] focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none transition-all hover:brightness-110"
              >
                <Send size={12} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Buttons Control Row */}
      <div className="flex items-end gap-3">
        {/* Scroll to Top Arrow */}
        <AnimatePresence>
          {showScrollTop && !isOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              onClick={scrollToTop}
              className="w-12 h-12 mb-2 rounded-full glass flex items-center justify-center text-[var(--accent)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:bg-[var(--surface-2)] active:scale-95 transition-all border border-[var(--border-2)] hover:border-[var(--accent)]"
              aria-label="Scroll to top"
            >
              <ArrowUp size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Floating Toggle Button */}
        <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 active:scale-95 relative group border border-[#e2e8f0] ${
          isOpen
            ? 'bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg-2)]'
            : 'bg-white hover:shadow-[0_8px_30px_rgba(var(--accent-rgb),0.12)] hover:scale-105'
        }`}
        aria-label="Toggle Help Chatbot"
      >
        {isOpen ? (
          <X size={22} className="text-gray-500 hover:text-gray-700" />
        ) : (
          <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Concentric circular rings around the mascot */}
            <circle cx="50" cy="50" r="38" stroke="#add6ff" strokeWidth="1.2" strokeOpacity="0.85" />
            <circle cx="50" cy="50" r="34" stroke="#add6ff" strokeWidth="1.2" strokeOpacity="0.45" />

            {/* Bear-like ears */}
            <circle cx="34" cy="27" r="6.5" fill="#add6ff" opacity="0.6" />
            <circle cx="66" cy="27" r="6.5" fill="#add6ff" opacity="0.6" />

            {/* Shoulders */}
            <path d="M32 55 C29 60 29 66 33 69" fill="none" stroke="#2b66ff" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M68 55 C71 60 71 66 67 69" fill="none" stroke="#2b66ff" strokeWidth="5.5" strokeLinecap="round" />

            {/* Shield Chestplate (VeriTrace Signature Logo) */}
            <path
              d="M50 52 L61 54.5 V64 C61 70 57 74 50 76 C43 74 39 70 39 64 V54.5 Z"
              fill="#2b66ff"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Checkmark inside chest shield */}
            <path d="M45.5 64.5 L48.5 67.5 L54.5 61.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Robot Head */}
            <rect x="29" y="26" width="42" height="26" rx="13" fill="#2b66ff" stroke="#ffffff" strokeWidth="1.2" />

            {/* Visor Area */}
            <rect x="35" y="31" width="30" height="13" rx="6.5" fill="#0c1424" stroke="#ffffff" strokeWidth="0.8" />

            {/* Glowing Eyes */}
            <rect x="40" y="34.5" width="8" height="6" rx="3" fill="#00e699" />
            <rect x="52" y="34.5" width="8" height="6" rx="3" fill="#00e699" />
            {/* Inner glowing dots */}
            <circle cx="44" cy="37.5" r="1" fill="#ffffff" />
            <circle cx="56" cy="37.5" r="1" fill="#ffffff" />

            {/* Smile Mouth */}
            <path d="M45 46 Q50 50 55 46" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
        
        {/* Unread indicator */}
        {!isOpen && hasUnread && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--success-text)] border-2 border-white rounded-full animate-pulse" />
        )}
      </button>
      </div>
    </div>
  )
}
