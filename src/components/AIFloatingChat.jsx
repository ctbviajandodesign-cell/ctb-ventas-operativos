'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, Send, X, Bot, User, Loader2, Trash2 } from 'lucide-react'

export default function AIFloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hola, soy tu Asistente de IA. Escribe tu pregunta sobre las cotizaciones, ventas y vouchers del sistema.'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dataContext, setDataContext] = useState(null)
  const [dataLoadingState, setDataLoadingState] = useState('idle') // idle, loading, ready, error

  const messagesEndRef = useRef(null)
  const chatWindowRef = useRef(null)

  // Scroll automático al recibir mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Cerrar chat al hacer clic fuera del widget en web
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target) &&
        !event.target.closest('.ai-chat-trigger')
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Carga silenciosa de la base de conocimientos al abrir el chat
  useEffect(() => {
    if (isOpen && dataLoadingState === 'idle') {
      loadKnowledgeBaseSilently()
    }
  }, [isOpen])

  const loadKnowledgeBaseSilently = async () => {
    setDataLoadingState('loading')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      const isAdmin = profileData?.rol === 'admin' || profileData?.rol === 'superadmin'

      // Cargar lista de operativos si es admin
      let ops = []
      if (isAdmin) {
        const { data: opsData } = await supabase
          .from('profiles')
          .select('id, nombre, ciudad, meta_mensual')
          .eq('rol', 'operativo')
        ops = opsData || []
      }

      // Rango de fechas: desde inicio de año
      const startDate = new Date()
      startDate.setMonth(0, 1)
      startDate.setHours(0, 0, 0, 0)
      const startIso = startDate.toISOString()

      // Consulta del pipeline de cotizaciones
      let pipelineQuery = supabase
        .from('cotizaciones')
        .select('operativo_id, codigo, agencia, destino, estado, valor_total, valor_comision, valor_utilidad, created_at, comercial, numero_pasajeros, nombres_pasajeros, motivo_perdida, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!left(nombre, ciudad), ventas(id, estado, vouchers(codigo))')
        .gte('created_at', startIso)

      if (!isAdmin && profileData) {
        pipelineQuery = pipelineQuery.eq('profiles.ciudad', profileData.ciudad)
      }

      const [resQuotes, resBoard] = await Promise.all([
        pipelineQuery,
        fetch('/api/leaderboard?period=mes').then(r => r.json()).catch(() => ({ ranking: [] }))
      ])

      if (resQuotes.error) throw resQuotes.error

      setDataContext({
        quotes: resQuotes.data || [],
        leaderboard: resBoard.ranking || [],
        operatives: ops
      })
      setDataLoadingState('ready')
    } catch (err) {
      console.error('Error cargando contexto IA:', err)
      setDataLoadingState('error')
    }
  }

  const handleSend = async (textToSend) => {
    const questionText = textToSend || input
    if (!questionText.trim() || isLoading) return

    const userMessage = { role: 'user', content: questionText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Si la base de conocimientos sigue cargándose, esperar unos segundos en segundo plano
      let currentContext = dataContext
      if (dataLoadingState === 'loading') {
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 250))
          if (dataContext) {
            currentContext = dataContext
            break
          }
        }
      }

      // Si falló la sincronización o no cargó a tiempo
      if (!currentContext) {
        setMessages(prev => [
          ...prev, 
          { role: 'assistant', content: 'Sigo conectando con la base de datos. Por favor, reintenta tu pregunta en unos segundos.' }
        ])
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          dataset: currentContext.quotes,
          leaderboard: currentContext.leaderboard,
          operatives: currentContext.operatives
        })
      })

      const result = await response.json()
      if (result.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Ocurrió un error: ${result.answer}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.answer }])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de red al conectar con el asistente.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat reiniciado. Escribe tu pregunta sobre las cotizaciones, ventas y vouchers del sistema.'
      }
    ])
  }

  // Parseador de formato ligero en base a viñetas y negrita
  const parseBoldText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  const formatMessageContent = (text) => {
    if (!text) return ''
    const lines = text.split('\n')
    return lines.map((line, i) => {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleanLine = line.trim().replace(/^[-*]\s+/, '')
        return (
          <li key={i} className="ml-4 list-disc text-xs py-0.5 text-gray-700">
            {parseBoldText(cleanLine)}
          </li>
        )
      }
      return (
        <p key={i} className="text-xs leading-relaxed py-0.5 text-gray-700 min-h-[1em]">
          {parseBoldText(line)}
        </p>
      )
    })
  }

  return (
    <>
      {/* BOTÓN FLOTANTE MÍNIMO */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ai-chat-trigger fixed bottom-6 right-6 z-50 bg-gradient-to-tr from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-500 text-white p-3.5 sm:p-4 rounded-full shadow-[0_10px_25px_rgba(0,102,204,0.25)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center border border-white/10 animate-in fade-in"
        title="Asistente de IA"
      >
        {isOpen ? <X size={20} /> : <Sparkles size={20} className="animate-pulse" />}
      </button>

      {/* FONDO OSCURO TRANSLÚCIDO PARA AISLAR EL CHAT EN MÓVIL Y EVITAR SOBREPOSICIONES */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* PANEL DE CHAT ULTRA LIMPIO */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className="fixed bottom-20 left-4 right-4 h-[75vh] max-h-[500px] sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[360px] sm:h-[500px] bg-white border border-gray-100 sm:rounded-[2rem] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-6 duration-300"
        >
          {/* Cabecera ultra-mínima */}
          <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">Asistente de IA</span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 1 && (
                <button
                  onClick={handleClearChat}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Reiniciar chat"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                title="Cerrar chat"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/20 scrollbar-thin">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant'
              return (
                <div
                  key={index}
                  className={`flex gap-2 max-w-[85%] ${
                    isAssistant ? 'self-start' : 'self-end ml-auto flex-row-reverse'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[9px] font-black uppercase ${
                      isAssistant
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    {isAssistant ? <Bot size={12} /> : <User size={12} />}
                  </div>
                  <div
                    className={`rounded-xl p-3 shadow-sm text-xs ${
                      isAssistant
                        ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100/80'
                        : 'bg-primary text-white rounded-tr-none font-medium'
                    }`}
                  >
                    {isAssistant ? (
                      <div className="space-y-0.5">{formatMessageContent(msg.content)}</div>
                    ) : (
                      <p className="leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Cargador sutil de "pensando" */}
            {isLoading && (
              <div className="flex gap-2 max-w-[80%] self-start animate-pulse">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                  <Loader2 size={11} className="animate-spin" />
                </div>
                <div className="bg-white rounded-xl rounded-tl-none p-3 border border-gray-100/80 shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center"
          >
            <input
              type="text"
              placeholder="Pregunta algo sobre ventas..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-xl pl-3 pr-2 py-2.5 text-[16px] sm:text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-primary text-white p-2.5 rounded-xl shadow-md shadow-primary/5 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
