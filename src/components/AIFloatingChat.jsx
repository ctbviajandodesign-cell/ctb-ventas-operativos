'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, Send, X, Bot, User, Loader2, Trash2, HelpCircle } from 'lucide-react'

export default function AIFloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dataContext, setDataContext] = useState(null)
  const [dataLoadingState, setDataLoadingState] = useState('idle') // idle, loading, ready, error
  const [profile, setProfile] = useState(null)

  const messagesEndRef = useRef(null)
  const chatWindowRef = useRef(null)

  // Scroll automatico
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, dataLoadingState])

  // Cerrar chat si se hace clic fuera en pantallas grandes
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

  // Cargar datos contextuales cuando se abre por primera vez
  const handleToggleChat = async () => {
    setIsOpen(!isOpen)
    if (!isOpen && dataLoadingState === 'idle') {
      await loadKnowledgeBase()
    }
  }

  const loadKnowledgeBase = async () => {
    setDataLoadingState('loading')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setDataLoadingState('error')
        return
      }

      // Obtener perfil del usuario
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)
      const isAdmin = profileData?.rol === 'admin' || profileData?.rol === 'superadmin'

      // Obtener lista de operativos si es admin
      let ops = []
      if (isAdmin) {
        const { data: opsData } = await supabase
          .from('profiles')
          .select('id, nombre, ciudad, meta_mensual')
          .eq('rol', 'operativo')
        ops = opsData || []
      }

      // Fecha de inicio del año actual para tener suficiente cobertura
      const startDate = new Date()
      startDate.setMonth(0, 1) // 1 de Enero
      startDate.setHours(0, 0, 0, 0)
      const startIso = startDate.toISOString()

      // Consulta de pipeline y cotizaciones de forma segura
      let pipelineQuery = supabase
        .from('cotizaciones')
        .select('operativo_id, codigo, agencia, destino, estado, valor_total, valor_comision, valor_utilidad, created_at, comercial, numero_pasajeros, nombres_pasajeros, motivo_perdida, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!left(nombre, ciudad), ventas(id, estado, vouchers(codigo))')
        .gte('created_at', startIso)

      // Si no es admin, filtrar por la ciudad del operativo
      if (!isAdmin) {
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
      
      // Mensaje de bienvenida inicial de la IA
      setMessages([
        {
          role: 'assistant',
          content: `¡Hola ${profileData.nombre.split(' ')[0]}! Soy tu Asistente IA Comercial. He cargado los datos del sistema de este año. ¿En qué puedo ayudarte hoy? Puedes preguntarme resúmenes de ventas, rendimiento de asesores o buscar información específica.`
        }
      ])
    } catch (err) {
      console.error('Error loading chat database context:', err)
      setDataLoadingState('error')
    }
  }

  const handleSend = async (textToSend) => {
    const questionText = textToSend || input
    if (!questionText.trim() || isLoading || dataLoadingState !== 'ready') return

    const userMessage = { role: 'user', content: questionText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          dataset: dataContext.quotes,
          leaderboard: dataContext.leaderboard,
          operatives: dataContext.operatives
        })
      })

      const result = await response.json()
      if (result.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, ocurrió un error: ${result.answer}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.answer }])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hubo un error de conexión al consultar con la IA.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    if (window.confirm('¿Deseas limpiar el historial de conversación?')) {
      setMessages([
        {
          role: 'assistant',
          content: 'Chat reiniciado. ¿Qué consulta deseas realizar sobre las estadísticas de ventas y cotizaciones?'
        }
      ])
    }
  }

  // Parseador de Markdown local y ligero
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

  const quickSuggestions = [
    'Resumen de ventas general',
    '¿Quién cotizó más este año?',
    '¿Cómo va la conversión de ventas?'
  ]

  return (
    <>
      {/* BOTÓN FLOTANTE (FAB) */}
      <button
        onClick={handleToggleChat}
        className="ai-chat-trigger fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white p-3.5 sm:p-4 rounded-full shadow-[0_10px_30px_rgba(0,102,204,0.3)] hover:shadow-[0_15px_35px_rgba(0,102,204,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center border border-white/10"
        title="Consultar al Asistente IA"
      >
        {isOpen ? <X size={20} className="sm:w-[22px] sm:h-[22px]" /> : <Sparkles size={20} className="sm:w-[22px] sm:h-[22px] animate-pulse" />}
      </button>

      {/* VENTANA DE CHAT EMERGENTE */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[550px] bg-white border border-gray-100 sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-8 duration-300"
        >
          {/* Cabecera del Chat */}
          <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-xl text-primary border border-primary/20">
                <Sparkles size={16} className="text-primary animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">Asistente IA Comercial</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping"></span>
                  Conexión en Tiempo Real
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  onClick={handleClearChat}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Reiniciar chat"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Cerrar chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Estado de carga de base de datos */}
          {dataLoadingState === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-gray-50/50">
              <Loader2 size={32} className="text-primary animate-spin" />
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                Cargando base de conocimiento comercial...
              </p>
              <p className="text-[10px] text-gray-400 max-w-[220px]">
                Analizando base de datos de cotizaciones, proformas y vouchers vigentes.
              </p>
            </div>
          )}

          {dataLoadingState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-gray-50/50">
              <HelpCircle size={32} className="text-rose-500" />
              <p className="text-xs font-black text-rose-500 uppercase tracking-widest">
                Error al conectar con la base de datos
              </p>
              <button
                onClick={loadKnowledgeBase}
                className="bg-primary text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg shadow-primary/10 hover:bg-primary/95 transition-all"
              >
                Reintentar
              </button>
            </div>
          )}

          {dataLoadingState === 'ready' && (
            <>
              {/* Historial de Mensajes */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/30 scrollbar-thin">
                {messages.map((msg, index) => {
                  const isAssistant = msg.role === 'assistant'
                  return (
                    <div
                      key={index}
                      className={`flex gap-2.5 max-w-[85%] ${
                        isAssistant ? 'self-start' : 'self-end ml-auto flex-row-reverse'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border text-[10px] font-black uppercase ${
                          isAssistant
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                            : 'bg-primary/10 border-primary/20 text-primary'
                        }`}
                      >
                        {isAssistant ? <Bot size={14} /> : <User size={14} />}
                      </div>
                      <div
                        className={`rounded-2xl p-3.5 shadow-sm text-xs font-semibold ${
                          isAssistant
                            ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                            : 'bg-primary text-white rounded-tr-none'
                        }`}
                      >
                        {isAssistant ? (
                          <div className="space-y-1">{formatMessageContent(msg.content)}</div>
                        ) : (
                          <p className="leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Burbuja de pensando */}
                {isLoading && (
                  <div className="flex gap-2.5 max-w-[80%] self-start animate-pulse">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 text-xs">
                      <Loader2 size={13} className="animate-spin" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-none p-3.5 border border-gray-100 shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}

                {/* Sugerencias iniciales si solo está el mensaje de bienvenida */}
                {messages.length === 1 && !isLoading && (
                  <div className="pt-4 space-y-2 animate-in fade-in duration-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Consultas sugeridas:</p>
                    <div className="flex flex-col gap-1.5">
                      {quickSuggestions.map((suggest, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(suggest)}
                          className="w-full text-left bg-white hover:bg-indigo-50/50 border border-gray-100 hover:border-indigo-100 text-gray-600 hover:text-primary px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center justify-between group active:scale-[0.99]"
                        >
                          {suggest}
                          <span className="text-[10px] text-gray-300 group-hover:text-primary transition-colors font-bold uppercase tracking-widest shrink-0">Preguntar →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Formulario */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="p-4 border-t border-gray-100 bg-white flex gap-2 items-center"
              >
                <input
                  type="text"
                  placeholder="Pregunta algo sobre ventas..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl pl-4 pr-3 py-3 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-primary text-white p-3 rounded-2xl shadow-md shadow-primary/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
