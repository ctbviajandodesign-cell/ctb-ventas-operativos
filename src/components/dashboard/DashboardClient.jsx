'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { showToast } from '@/utils/toast'
import { logActivity } from '@/utils/audit'
import StatsCard from '@/components/StatsCard'
import QuotesTable from '@/components/QuotesTable'
import GlobalSearch from '@/components/GlobalSearch'
import PaymentAlerts from '@/components/PaymentAlerts'
import AIInsightCard from '@/components/AIInsightCard'
import DashboardCharts from '@/components/DashboardCharts'
import VoucherEditModal from '@/components/dashboard/VoucherEditModal'
import OperativePanelModal from '@/components/dashboard/OperativePanelModal'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Target,
  Trophy,
  Users,
  Search,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  MapPin,
  Calendar,
  Building2,
  X,
  XCircle,
  Edit,
  QrCode,
  Share2,
  Save,
  ExternalLink
} from 'lucide-react'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

import { getPeriodRange, getPeriodLabel, getEcuadorTime, isExpired } from '@/utils/dateHelpers'

export default function DashboardClient() {
  const [profile, setProfile] = useState(null)
  const [activeDashboardTab, setActiveDashboardTab] = useState('kpis')
  const [selectedOperative, setSelectedOperative] = useState('global')
  const [selectedCity, setSelectedCity] = useState('global')
  const [selectedPeriod, setSelectedPeriod] = useState('mes') // 'dia', 'semana', 'mes', 'año'
  const [focusDate, setFocusDate] = useState(() => getEcuadorTime())
  const [operatives, setOperatives] = useState([])

  const handleNavigatePeriod = (direction) => {
    setFocusDate((prev) => {
      const d = new Date(prev)
      if (selectedPeriod === 'dia') {
        d.setDate(d.getDate() + direction)
      } else if (selectedPeriod === 'semana') {
        d.setDate(d.getDate() + direction * 7)
      } else if (selectedPeriod === 'mes') {
        d.setMonth(d.getMonth() + direction)
      } else if (selectedPeriod === 'año') {
        d.setFullYear(d.getFullYear() + direction)
      }
      return d
    })
  }

  const [operativePanel, setOperativePanel] = useState(null) // para drill-down de admin
  const [profileTab, setProfileTab] = useState('resumen')
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [metrics, setMetrics] = useState({
    totalVendido: 0,
    metaComputable: 0,
    cotizacionesAbiertas: 0,
    cotizacionesCaducadas: 0,
    porcentajeMeta: 0,
    pipeline: 0,
    topDestino: 'N/A',
    globalGoal: 50000,
    vouchersEmitidos: 0,
    conversionRate: 0,
    ganadas: 0
  })
  const [leaderboard, setLeaderboard] = useState([])
  const [chartData, setChartData] = useState([])
  const [individualStats, setIndividualStats] = useState([])
  const [quotes, setQuotes] = useState([])
  const [lostQuotes, setLostQuotes] = useState([])
  const [pipelineDataState, setPipelineDataState] = useState([])
  const [lostFilter, setLostFilter] = useState('ALL') // Filtro inteligente de perdidas
  const [loading, setLoading] = useState(true)
  const [loadingPanelAi, setLoadingPanelAi] = useState(false)
  const [errorState, setErrorState] = useState(null)

  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleAiQuestionSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!aiQuestion.trim()) return

    setAiLoading(true)
    setAiAnswer(null)
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: aiQuestion,
          dataset: pipelineDataState,
          leaderboard: leaderboard,
          operativos: operatives  // Lista completa de operativos con ciudad
        })
      })
      const result = await response.json()
      if (result.error) {
        setAiAnswer(`Error: ${result.answer}`)
      } else {
        setAiAnswer(result.answer)
      }
    } catch (err) {
      console.error(err)
      setAiAnswer('Hubo un error de red o de servidor al consultar con la IA.')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [selectedOperative, selectedCity, selectedPeriod, focusDate])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener Perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)
      const isAdmin = profileData?.rol === 'admin' || profileData?.rol === 'superadmin'
      const activeOpId = isAdmin && selectedOperative !== 'global' ? selectedOperative : user.id
      
      let initialOperatives = operatives;
      if (isAdmin && operatives.length === 0) {
        // Will fetch in parallel later
      }

      const { startIso, endIso } = getPeriodRange(selectedPeriod, focusDate)

      const targetIdForIndividual = (!isAdmin || selectedOperative !== 'global') ? (isAdmin ? selectedOperative : user.id) : null

      // CONSTRUIR QUERIES EN PARALELO
      const activeCityFilter = isAdmin ? selectedCity : profileData?.ciudad

      // ── MODO RENDIMIENTO EXTREMO (RPC) ──
      const rpcPromise = supabase.rpc('get_dashboard_metrics', {
        p_start_iso: startIso,
        p_end_iso: endIso,
        p_operativo_id: targetIdForIndividual,
        p_city: activeCityFilter !== 'global' ? activeCityFilter : null
      });

      // EJECUTAR PROMISE.ALL PARA MAXIMA VELOCIDAD Y PARALELIZACIÓN COMPLETA
      const opsPromise = (isAdmin && operatives.length === 0) 
        ? supabase.from('profiles').select('id, nombre, ciudad, meta_mensual').eq('rol', 'operativo')
        : Promise.resolve({ data: operatives });

      const leaderboardPromise = fetch(`/api/leaderboard?period=${selectedPeriod}&startIso=${startIso}&endIso=${endIso}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .catch(err => {
          console.error("Leaderboard fetch failed:", err);
          return { leaderboard: [] };
        });

      const [
        { data: rpcData, error: rpcError },
        { data: quotesData },
        { data: pipelineData },
        resBoard,
        opsRes
      ] = await Promise.all([
        rpcPromise,
        quotesQuery,
        pipelineQuery,
        leaderboardPromise,
        opsPromise
      ])

      if (opsRes?.data && isAdmin && operatives.length === 0) {
        setOperatives(opsRes.data)
      }

      if (rpcError) {
        console.error("RPC query failed", rpcError)
        showToast("Error al calcular métricas en el servidor.", 'error')
      }

      const totalPipeline = pipelineData?.length || 0

      setQuotes(quotesData || [])
      // Enriquecer pipeline con bandera isVenta antes de guardar en estado
      const pipelineEnriched = (pipelineData || []).map(q => ({
        ...q,
        _esVenta: q.estado !== 'anulada' && q.estado !== 'perdida' && (
          q.estado === 'ganada' || (
            Array.isArray(q.ventas) && q.ventas.some(v =>
              v.estado !== 'anulada' && (
                Array.isArray(v.vouchers) ? v.vouchers.length > 0
                : (v.vouchers && (v.vouchers.codigo || Object.keys(v.vouchers).length > 0))
              )
            )
          )
        )
      }))
      setPipelineDataState(pipelineEnriched)

      const rawBoard = resBoard?.success ? resBoard.leaderboard : []
      const userCity = profileData?.ciudad
      const board = !isAdmin
        ? rawBoard.filter(op => op.ciudad && userCity && op.ciudad.trim().toLowerCase() === userCity.trim().toLowerCase())
        : (selectedCity !== 'global'
            ? rawBoard.filter(op => op.ciudad?.trim().toLowerCase() === selectedCity.trim().toLowerCase())
            : rawBoard)
      setLeaderboard(board || [])
      setChartData(board || [])

      // Las métricas y estadísticas del embudo se calculan en memoria a partir de pipelineEnriched al final del flujo.

      // Calcular motivos principales de pérdida para el periodo actual
      const lostFromPipeline = pipelineEnriched.filter(q => q.estado === 'perdida' || q.estado === 'anulada')
      setLostQuotes(lostFromPipeline)
      
      const motivesMap = {}
      lostFromPipeline.forEach(q => {
        if (q.motivo_perdida) {
          motivesMap[q.motivo_perdida] = (motivesMap[q.motivo_perdida] || 0) + 1
        }
      })
      const topMotivosText = Object.entries(motivesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([motivo, count]) => `${motivo} (${count})`)
        .join(', ') || 'Ninguno registrado aún'

      // Optimización del destino más popular
      const destMap = {}
      pipelineData?.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const popular = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      const multiplier = selectedPeriod === 'año' ? 12 : 1
      const globalM = board?.reduce((acc, op) => acc + (Number(op.meta) || 0), 0) || (50000 * multiplier)
      const myMeta = !isAdmin
        ? ((Number(profileData?.meta_mensual) || 5000) * multiplier)
        : selectedOperative === 'global'
        ? globalM
        : (Number(board?.find(o => o.id === selectedOperative)?.meta) || (5000 * multiplier))

      const metaBase = isAdmin && selectedOperative === 'global' ? globalM : myMeta

      setMetrics(prev => ({
        ...prev,
        porCobrarMes,
        porCobrarGlobal,
        pipeline: totalPipeline,
        topDestino: popular,
        globalGoal: metaBase,
        porcentajeMeta: metaBase > 0 ? ((rpcData?.totalGanancia || 0) / metaBase) * 100 : 0,
        totalAporte: rpcData?.totalGanancia || 0,
        metaComputable: rpcData?.totalGanancia || 0,
        topMotivos: topMotivosText
      }))

      // ── OVERRIDE FINAL: métricas usando la respuesta del RPC ──
      
      const ganadasCount   = rpcData?.ganadas || 0
      const totalVendidoReal = rpcData?.totalVendido || 0
      const totalGananciaReal = rpcData?.totalGanancia || 0
      const vouchersCount = rpcData?.vouchersEmitidos || 0
      const porCobrarMes = rpcData?.porCobrarMes || 0
      const porCobrarGlobal = rpcData?.porCobrarMes || 0 // Usamos el del mes temporalmente
      
      const caducadasReal  = rpcData?.caducadas || 0
      const abiertasReal   = rpcData?.abiertas || 0
      const perdidasReal   = rpcData?.perdidas || 0
      const anuladasReal   = rpcData?.anuladas || 0
      const totalReal      = rpcData?.totalPipeline || 0
      const convReal       = totalReal > 0 ? (ganadasCount / totalReal * 100) : 0

      // Si estamos en modo individual o para el embudo de visualización personal
      const indStats = [
        { name: 'Ganadas', value: ganadasCount, color: '#16A34A' },
        { name: 'En Espera', value: abiertasReal, color: '#0066CC' },
        { name: 'Caducadas', value: caducadasReal, color: '#EF4444' },
        { name: 'Perdidas', value: perdidasReal, color: '#F5A623' },
        { name: 'Anuladas', value: anuladasReal, color: '#DC2626' }
      ]
      setIndividualStats(indStats)

      setMetrics(prev => ({
        ...prev,
        totalVendido:    totalVendidoReal,
        metaComputable:  totalGananciaReal,
        totalAporte:     totalGananciaReal,
        ganadas:         ganadasCount,
        vouchersEmitidos: vouchersCount,
        abiertas:        abiertasReal,
        cotizacionesAbiertas: abiertasReal,
        cotizacionesCaducadas: caducadasReal,
        perdidas:        perdidasReal,
        total:           totalReal,
        conversionRate:  convReal,
        conversion:      convReal.toFixed(1),
        porcentajeMeta:  metaBase > 0 ? (totalGananciaReal / metaBase) * 100 : 0,
        porCobrarMes:    porCobrarMes,
        porCobrarGlobal: porCobrarGlobal
      }))

    } catch (error) {
      console.error('Error fetching data:', error)
      setErrorState('No pudimos cargar los datos del dashboard. Por favor, verifica tu conexión o intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Función de Exportación a CSV / Excel de Ventas No Concretadas
  const handleExportLostQuotes = () => {
    const filteredForExport = lostFilter === 'ALL'
      ? lostQuotes 
      : lostFilter === 'ANULADAS' 
        ? lostQuotes.filter(q => (q.estado || '').trim() === 'anulada')
        : lostQuotes.filter(q => (q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase()) && q.estado !== 'anulada')
    
    if (filteredForExport.length === 0) {
      showToast('No hay datos para exportar con el filtro actual.', 'error')
      return
    }

    const headers = ['Codigo,Agencia,Destino,Motivo,Notas,Asesor,Fecha']
    const rows = filteredForExport.map(q => {
      const fecha = new Date(q.created_at).toLocaleDateString()
      const asesor = q.profiles?.nombre || 'N/A'
      const notas = (q.notas_seguimiento || '').replace(/,/g, ';').replace(/\n/g, ' ')
      const motivo = (q.motivo_perdida || '').replace(/,/g, ';')
      const agencia = (q.agencia || 'Directo').replace(/,/g, ';')
      const destino = (q.destino || '').replace(/,/g, ';')
      return `${q.codigo},${agencia},${destino},${motivo},${notas},${asesor},${fecha}`
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Analisis_Perdidas_CTB_${selectedOperative}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }



  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50/50">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-6 text-gray-500 font-bold uppercase tracking-widest animate-pulse">Cargando métricas de éxito...</p>
      </div>
    )
  }

  if (errorState) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-6 text-center">
        <AlertTriangle size={64} className="text-red-500 mb-6" />
        <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase">Error de Conexión</h2>
        <p className="text-gray-500 max-w-md mb-8">{errorState}</p>
        <button 
          onClick={() => { setErrorState(null); fetchDashboardData(); }}
          className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all uppercase tracking-widest text-sm flex items-center gap-2"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    )
  }

  const isAdmin = profile?.rol === 'admin' || profile?.rol === 'superadmin'
  const handleOpenOperativePanel = async (op) => {
    const { data: { user } } = await supabase.auth.getUser()
    const isAdmin = profile?.rol === 'admin' || profile?.rol === 'superadmin'
    if (!isAdmin && op.id !== user?.id) return

    // Carga detallada de ese operativo (Usando zona horaria de Ecuador)
    const nowPanel = new Date()
    const ecTimePanel = new Date(nowPanel.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
    const startOfMonthIso = new Date(Date.UTC(ecTimePanel.getFullYear(), ecTimePanel.getMonth(), 1, 5, 0, 0, 0)).toISOString()
    const [
      { data: ventas },
      { data: cots },
      { data: vouchersList }
    ] = await Promise.all([
      supabase.from('ventas').select('*, cotizaciones(*)').eq('operativo_id', op.id).order('created_at', { ascending: false }),
      supabase.from('cotizaciones').select('*, profiles!left(nombre, ciudad), ventas(id, estado, vouchers(codigo))').eq('operativo_id', op.id).gte('created_at', startOfMonthIso).order('created_at', { ascending: false }),
      supabase.from('vouchers').select('*, profiles!left(nombre, ciudad), ventas(id, cotizaciones(comercial))').eq('operativo_id', op.id).gte('created_at', startOfMonthIso).order('created_at', { ascending: false })
    ])

    // Filtrar para el mes actual para calcular el cumplimiento de meta
    const ventasMes = ventas?.filter(v => v.estado === 'activa' && v.created_at >= startOfMonthIso) || []

    // IMPORTANTE: ganancia = comision + utilidad (aporte CTB), totalVendido = valor cliente
    const ganancia = ventasMes.reduce((a,v)=>a+(Number(v.comision)||0)+(Number(v.utilidad)||0),0)||0
    
    // Aporte a meta = comision + utilidad de cotizaciones ganadas
    const aporteVentasCots = cots?.filter(c=>c.estado==='ganada').reduce((a,c)=>a+(Number(c.valor_comision||0))+(Number(c.valor_utilidad||0)),0)||0
    const totalVendido = aporteVentasCots  // Aporte CTB (comision+utilidad), para info
    const valorTotalCliente = cots?.filter(c=>c.estado==='ganada').reduce((a,c)=>a+(Number(c.valor_total)||0),0)||0
    const ganadas = cots?.filter(c=>c.estado==='ganada').length||0
    const abiertas = cots?.filter(c=>c.estado==='abierta' && !isExpired(c)).length||0
    const caducadas = cots?.filter(c=>c.estado==='abierta' && isExpired(c)).length||0
    const perdidas = cots?.filter(c=>['perdida','anulada'].includes(c.estado)).length||0
    const totalCots = cots?.length||0

    // Calcular destino favorito del operativo
    const destMap = {}
    cots?.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
    const topDestino = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

    // Calcular motivos principales de pérdida para el panel del operativo
    const panelMotivesMap = {}
    cots?.filter(c => ['perdida', 'anulada'].includes(c.estado)).forEach(q => {
      if (q.motivo_perdida) {
        panelMotivesMap[q.motivo_perdida] = (panelMotivesMap[q.motivo_perdida] || 0) + 1
      }
    })
    const topMotivosOp = Object.entries(panelMotivesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([motivo, count]) => `${motivo} (${count})`)
      .join(', ') || 'Ninguno registrado aún'

    const panelData = {
      ...op,
      ganancia,
      totalVendido,
      valorTotalCliente,
      ganadas,
      abiertas,
      caducadas,
      perdidas,
      totalCots,
      vouchers: vouchersList?.length || 0,
      conversion: totalCots>0 ? ((ganadas/totalCots)*100).toFixed(1) : 0,
      topDestino,
      aiInsight: null,
      cotizacionesList: cots || [],
      ventasList: ventas || [],
      vouchersList: vouchersList || []
    }

    setOperativePanel(panelData)

    // Trigger AI insight generation automatically immediately after opening the panel
    try {
      setLoadingPanelAi(true)
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'INDIVIDUAL_ADMIN',
          metricas: {
            nombreAsesor: panelData.nombreCompleto || panelData.nombre,
            meta: panelData.meta,
            cumplimiento: panelData.cumplimiento,
            vouchers: panelData.vouchers || 0,
            total: panelData.totalCots,
            abiertas: panelData.abiertas,
            ganadas: panelData.ganadas,
            perdidas: panelData.perdidas,
            conversion: panelData.conversion,
            totalAporte: panelData.ganancia,
            topDestino: panelData.topDestino,
            topMotivos: topMotivosOp
          }
        })
      })
      const aiData = await res.json()
      if (aiData.insight) {
        setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null)
      }
    } catch (err) {
      console.error('Error generating AI audit:', err)
    } finally {
      setLoadingPanelAi(false)
    }
  }

  const handleUpdateVoucher = async (e) => {
    e.preventDefault()
    const pasajerosArr = typeof editingVoucher.pasajeros === 'string'
      ? editingVoucher.pasajeros.split('\n').map(s => s.trim()).filter(Boolean)
      : editingVoucher.pasajeros || []
    const { error } = await supabase
      .from('vouchers')
      .update({
        agencia: editingVoucher.agencia,
        destino: editingVoucher.destino,
        pasajeros: pasajerosArr,
        fecha_viaje_desde: editingVoucher.fecha_viaje_desde,
        fecha_viaje_hasta: editingVoucher.fecha_viaje_hasta,
        fecha_caducidad: editingVoucher.fecha_viaje_hasta,
        notas: editingVoucher.notas,
        recordatorio_texto: editingVoucher.recordatorio_texto || null,
        recordatorio_dias_antes: editingVoucher.recordatorio_dias_antes || null
      })
      .eq('id', editingVoucher.id)
    if (!error) {
      logActivity('editar_voucher', `Se editó el voucher ${editingVoucher.codigo} (Agencia: ${editingVoucher.agencia}, Destino: ${editingVoucher.destino}).`)
      showToast('Voucher actualizado correctamente.')
      setEditingVoucher(null)
      
      // Actualizar los datos del panel operativo para refrescar la lista
      if (operativePanel) {
        handleOpenOperativePanel(operativePanel)
      }
      fetchDashboardData()
    } else {
      showToast(error.message, 'error')
    }
  }

  const renderFormattedAnswer = (text) => {
    if (!text) return null
    return text
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map((line, idx) => {
        let isBullet = false
        let isSubBullet = false
        let content = line.replace(/^[#\s]+/, '')
        const trimmed = line.trim()
        
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          isBullet = true
          isSubBullet = line.startsWith('  ') || line.startsWith('\t')
          content = trimmed.substring(2)
        }

        const parts = content.split('**')
        const parsedElements = parts.map((part, i) => {
          if (i % 2 === 1) {
            return <strong key={i} className="font-extrabold text-gray-950">{part}</strong>
          }
          return part
        })

        if (isBullet) {
          return (
            <div key={idx} className={`flex items-start gap-2 text-gray-700 mt-1 ${isSubBullet ? 'pl-6' : 'pl-2'}`}>
              <span className={isSubBullet ? "text-gray-400 select-none mt-0.5 font-bold" : "text-primary font-black select-none mt-0.5"}>
                {isSubBullet ? "◦" : "•"}
              </span>
              <div className="flex-1 leading-relaxed">{parsedElements}</div>
            </div>
          )
        }

        return (
          <p key={idx} className="text-gray-750 mt-1 pl-2 leading-relaxed">
            {parsedElements}
          </p>
        )
      })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-10 pb-20"
    >

      {/* PANEL DRILL-DOWN DE OPERATIVO (ADMIN) */}
      <OperativePanelModal
        operativePanel={operativePanel}
        setOperativePanel={setOperativePanel}
        onClose={() => { setOperativePanel(null); setProfileTab('resumen'); }}
        isAdmin={isAdmin}
        selectedOperative={selectedOperative}
        setSelectedOperative={setSelectedOperative}
        setEditingVoucher={setEditingVoucher}
      />

      {/* Modal Editar Voucher */}
      {editingVoucher && (
        <VoucherEditModal
          voucher={editingVoucher}
          onClose={() => setEditingVoucher(null)}
          onSuccess={() => {
            setEditingVoucher(null);
            if (operativePanel) {
              handleOpenOperativePanel(operativePanel);
            }
            fetchDashboardData();
          }}
        />
      )}

      {/* HEADER & FILTROS */}
      <DashboardFilters
        isAdmin={isAdmin}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        selectedOperative={selectedOperative}
        setSelectedOperative={setSelectedOperative}
        operatives={operatives}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        handleNavigatePeriod={handleNavigatePeriod}
        focusDate={focusDate}
        setFocusDate={setFocusDate}
        getPeriodLabel={getPeriodLabel}
        profile={profile}
        handleOpenOperativePanel={handleOpenOperativePanel}
      />

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex bg-white/60 p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit mt-6 mb-8">
        {[
          { id: 'kpis', label: 'Visión General & KPIs' },
          { id: 'charts', label: 'Inteligencia & Embudos' },
          { id: 'operations', label: 'Operaciones (Cotizaciones)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveDashboardTab(tab.id)}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeDashboardTab === tab.id
                ? 'bg-white text-primary shadow-md'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeDashboardTab === 'kpis' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          {/* SECCIÓN DE BÚSQUEDA Y CONSULTAS IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* BUSCADOR GLOBAL */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between h-full">
          <div className="mb-4">
            <h4 className="text-sm font-black text-gray-905 uppercase tracking-tighter italic">Buscador CTB</h4>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Busca cotizaciones, proformas o vouchers por código o pasajero</p>
          </div>
          <div className="w-full flex-1 flex items-center">
            <GlobalSearch />
          </div>
        </div>

        {/* GOOGLE-STYLE AI SEARCH BAR */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between space-y-4 animate-in fade-in duration-500">
          <div>
            <h4 className="text-sm font-black text-gray-905 uppercase tracking-tighter italic">Asistente IA Comercial</h4>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Realiza consultas inteligentes en lenguaje natural sobre tus datos</p>
          </div>
          <form onSubmit={handleAiQuestionSubmit} className="relative flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary shrink-0">
                <Sparkles size={20} className={aiLoading ? "animate-pulse text-indigo-500" : ""} />
              </div>
              <input
                type="text"
                placeholder="Pregunta a la IA (ej. ¿Qué agencia cotizó más?)"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                disabled={aiLoading}
                className="w-full pl-14 pr-4 sm:pr-36 py-4 bg-gray-50 border border-gray-100 rounded-full text-[16px] sm:text-sm font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || !aiQuestion.trim()}
              className="w-full sm:w-auto sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 bg-primary text-white px-6 py-3 sm:py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
            >
              {aiLoading ? 'Pensando...' : 'Preguntar'}
            </button>
          </form>

          {/* AI Answer Reveal Panel / Loading */}
          {aiLoading && (
            <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50 flex items-center gap-3 animate-pulse">
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Analizando datos en tiempo real...</span>
            </div>
          )}

          {aiAnswer && (
            <div className="p-6 bg-gradient-to-r from-primary/[0.02] to-indigo-500/[0.02] border border-primary/10 rounded-3xl relative animate-in slide-in-from-top-4 duration-300">
              <button 
                onClick={() => { setAiAnswer(null); setAiQuestion(''); }}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all duration-300 active:scale-95"
                title="Cerrar respuesta"
              >
                <X size={14} className="stroke-[2.5]" />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div className="bg-primary/10 p-2 rounded-2xl text-primary shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-1.5 text-sm text-gray-750 leading-relaxed font-semibold w-full">
                  {renderFormattedAnswer(aiAnswer)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* KPI GRID FINANCIERO PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard 
          title="Ventas Totales (Mes Actual)"
          value={`$${(metrics.totalVendido || 0).toLocaleString()}`} 
          icon={DollarSign}
          color="success"
          description="Volumen bruto de proformas cerradas"
          href={`/dashboard/ventas?dateFilter=${selectedPeriod}`}
        />
        <StatsCard 
          title="Por Cobrar (Generado este Mes)"
          value={`$${(metrics.porCobrarMes || 0).toLocaleString()}`} 
          icon={Target}
          color="warning"
          description="Deuda (faltante) de ventas de este periodo"
          href={`/dashboard/ventas?dateFilter=${selectedPeriod}&deuda=con_deuda`}
        />
        <StatsCard 
          title="Por Cobrar GLOBAL (Histórico Total)"
          value={`$${(metrics.porCobrarGlobal || 0).toLocaleString()}`} 
          icon={AlertTriangle}
          color="danger"
          description="Toda la deuda acumulada a la fecha"
          href={`/dashboard/ventas?dateFilter=todas&deuda=con_deuda`}
        />
      </div>

      {/* KPI GRID SECUNDARIO */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard 
          title="Total Ventas"
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          color="success"
          description="Volumen bruto cliente"
        />
        <StatsCard 
          title="Proformas Vendidas"
          value={(metrics.ganadas || 0).toLocaleString()} 
          icon={Trophy}
          color="accent"
          description="Ventas concretadas"
        />
        <StatsCard 
          title={isAdmin && selectedOperative === 'global' ? 'Ganancia CTB (Equipo)' : 'Mi Ganancia CTB'} 
          value={`$${metrics.metaComputable.toLocaleString()}`} 
          icon={TrendingUp}
          color="primary"
          description="Comisión + Utilidad (Meta)"
        />
        <StatsCard 
          title="En Espera" 
          value={metrics.cotizacionesAbiertas.toLocaleString()} 
          icon={Target}
          color="warning"
          description="Cotizaciones vigentes"
        />
        <StatsCard 
          title="Caducadas" 
          value={metrics.cotizacionesCaducadas.toLocaleString()} 
          icon={AlertTriangle}
          color="danger"
          description="Excedieron 24h/límite"
        />
        <StatsCard 
          title="Vouchers Emitidos" 
          value={metrics.vouchersEmitidos.toLocaleString()} 
          icon={FileText}
          color="primary"
          description="Vouchers activos"
        />
      </div>
        </div>
      )}

      {activeDashboardTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-500">
        
        {/* COLUMNA IZQUIERDA: GRÁFICOS Y TABLA */}
        <div className="lg:col-span-2 space-y-10">
          <DashboardCharts 
            isAdmin={isAdmin}
            selectedOperative={selectedOperative}
            chartData={chartData}
            individualStats={individualStats}
            metrics={metrics}
            pipelineData={pipelineDataState}
            operatives={operatives}
          />



          {/* WIDGET COMPACTO: TOP DESTINOS MES ACTUAL */}
          {(() => {
            // Destinos más cotizados (todos los de pipeline)
            const quotedMap = {}
            pipelineDataState.forEach(q => {
              if (q.destino) quotedMap[q.destino] = (quotedMap[q.destino] || 0) + 1
            })
            const topQuoted = Object.entries(quotedMap).sort((a,b) => b[1]-a[1]).slice(0,4)

            // Destinos más vendidos (cotizaciones confirmadas: estado ganada O con voucher activo)
            const soldMap = {}
            pipelineDataState.filter(q => q._esVenta).forEach(q => {
              if (q.destino) soldMap[q.destino] = (soldMap[q.destino] || 0) + 1
            })
            const topSold = Object.entries(soldMap).sort((a,b) => b[1]-a[1]).slice(0,4)

            // Destinos con más objeciones (de pipeline perdidas o anuladas)
            const objMap = {}
            pipelineDataState.filter(q => q.estado === 'perdida' || q.estado === 'anulada').forEach(q => {
              if (q.destino) objMap[q.destino] = (objMap[q.destino] || 0) + 1
            })
            const topObj = Object.entries(objMap).sort((a,b) => b[1]-a[1]).slice(0,4)

            if (topQuoted.length === 0 && topSold.length === 0 && topObj.length === 0) return null

            return (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                    <MapPin size={20} className="text-primary" /> Radar de Destinos
                  </h3>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">
                    {selectedPeriod === 'mes' ? 'Mes Actual' : 'Año Actual'}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Más Cotizados */}
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span> Más Cotizados
                    </p>
                    <div className="space-y-2">
                      {topQuoted.length > 0 ? topQuoted.map(([destino, count], i) => (
                        <div key={destino} className="flex items-center justify-between bg-primary/5 px-4 py-2.5 rounded-2xl border border-primary/10">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{destino}</span>
                          </div>
                          <span className="text-xs font-black text-primary">{count} cotizació{count > 1 ? 'nes' : 'n'}</span>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Sin cotizaciones aún</p>}
                    </div>
                  </div>

                  {/* Más Vendidos */}
                  <div>
                    <p className="text-[10px] font-black text-success uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-success inline-block"></span> Más Vendidos
                    </p>
                    <div className="space-y-2">
                      {topSold.length > 0 ? topSold.map(([destino, count], i) => (
                        <div key={destino} className="flex items-center justify-between bg-success/5 px-4 py-2.5 rounded-2xl border border-success/10">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{destino}</span>
                          </div>
                          <span className="text-xs font-black text-success">{count} cierre{count > 1 ? 's' : ''}</span>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Sin cierres aún</p>}
                    </div>
                  </div>

                  {/* Más Objeciones */}
                  <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Con Más Objeciones
                    </p>
                    <div className="space-y-2">
                      {topObj.length > 0 ? topObj.map(([destino, count], i) => (
                        <div key={destino} className="flex items-center justify-between bg-amber-50 px-4 py-2.5 rounded-2xl border border-amber-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{destino}</span>
                          </div>
                          <span className="text-xs font-black text-amber-600">{count} pérdida{count > 1 ? 's' : ''}</span>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Sin objeciones registradas</p>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* RADAR DE AGENCIAS Y CANALES */}
          {(() => {
            const agencyQuotesMap = {}
            const agencyWonMap = {}
            const agencyLostMap = {}
            const agencySalesVal = {}

            pipelineDataState.forEach(q => {
              const agency = q.agencia || 'Directo'
              agencyQuotesMap[agency] = (agencyQuotesMap[agency] || 0) + 1
              // Detectar venta: estado ganada O tiene voucher activo
              if (q._esVenta) {
                agencyWonMap[agency] = (agencyWonMap[agency] || 0) + 1
                agencySalesVal[agency] = (agencySalesVal[agency] || 0) + (Number(q.valor_total) || 0)
              } else if (q.estado === 'perdida' || q.estado === 'anulada') {
                agencyLostMap[agency] = (agencyLostMap[agency] || 0) + 1
              }
            })

            const topQuotedAgencies = Object.entries(agencyQuotesMap)
              .sort((a,b) => b[1] - a[1])
              .slice(0, 4)

            const topSoldAgencies = Object.entries(agencyWonMap)
              .sort((a,b) => b[1] - a[1])
              .slice(0, 4)

            const conversionAgencies = Object.entries(agencyQuotesMap)
              .filter(([agency, total]) => total >= 2)
              .map(([agency, total]) => {
                const won = agencyWonMap[agency] || 0
                const lost = agencyLostMap[agency] || 0
                const rate = (won / total) * 100
                return { agency, total, won, lost, rate }
              })
              .sort((a, b) => {
                if (a.rate !== b.rate) return a.rate - b.rate
                return b.lost - a.lost
              })
              .slice(0, 4)

            if (topQuotedAgencies.length === 0 && topSoldAgencies.length === 0 && conversionAgencies.length === 0) return null

            return (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-50 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                    <Building2 size={20} className="text-primary" /> Radar de Agencias (Análisis de Canales)
                  </h3>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">
                    Métricas de Conversión y Volumen
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Mayor Volumen (Cotizaciones) */}
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span> Mayor Demanda (Cotizó más)
                    </p>
                    <div className="space-y-2">
                      {topQuotedAgencies.length > 0 ? topQuotedAgencies.map(([agency, count], i) => (
                        <div key={agency} className="flex items-center justify-between bg-primary/5 px-4 py-2.5 rounded-2xl border border-primary/10">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 truncate uppercase tracking-tight" title={agency}>{agency}</span>
                          </div>
                          <span className="text-xs font-black text-primary shrink-0 ml-2">{count} cotiz.</span>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Sin datos aún</p>}
                    </div>
                  </div>

                  {/* Líderes de Venta (Mayor Cierre) */}
                  <div>
                    <p className="text-[10px] font-black text-success uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-success inline-block"></span> Mayor Cierre (Compró más)
                    </p>
                    <div className="space-y-2">
                      {topSoldAgencies.length > 0 ? topSoldAgencies.map(([agency, count], i) => (
                        <div key={agency} className="flex items-center justify-between bg-success/5 px-4 py-2.5 rounded-2xl border border-success/10">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 truncate uppercase tracking-tight" title={agency}>{agency}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-xs font-black text-success">{count} cierres</div>
                            <div className="text-[9px] font-bold text-gray-400">${(agencySalesVal[agency] || 0).toLocaleString()} USD</div>
                          </div>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Sin cierres aún</p>}
                    </div>
                  </div>

                  {/* Mayor Fricción (Cotiza más y compra menos) */}
                  <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Mayor Fricción (Menor Conversión)
                    </p>
                    <div className="space-y-2">
                      {conversionAgencies.length > 0 ? conversionAgencies.map(({ agency, total, won, rate }, i) => (
                        <div key={agency} className="flex items-center justify-between bg-amber-50 px-4 py-2.5 rounded-2xl border border-amber-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                            <span className="text-xs font-black text-gray-800 truncate uppercase tracking-tight" title={agency}>{agency}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-xs font-black text-amber-600">{rate.toFixed(0)}% conv.</div>
                            <div className="text-[9px] font-bold text-gray-400">{won} de {total} cotiz.</div>
                          </div>
                        </div>
                      )) : <p className="text-xs text-gray-400 italic">Se requiere mín. 2 cotizaciones por canal</p>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* MÓDULO INTELIGENTE DE ANÁLISIS DE VENTAS NO CONCRETADAS (PÉRDIDAS) */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                  <AlertTriangle size={22} className="text-amber-500" />
                  Análisis de Ventas No Concretadas
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-widest">
                  {selectedOperative === 'global' ? 'Monitoreo global de motivos de pérdida' : 'Causas de anulación de tu embudo'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select 
                  className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={lostFilter}
                  onChange={e => setLostFilter(e.target.value)}
                >
                  <option value="ALL">Todos los Motivos</option>
                  <option value="Precio">Precio</option>
                  <option value="No cerró Agencia">No cerró Agencia</option>
                  <option value="No contestó Operador">No contestó Operador</option>
                  <option value="Otro">Otros Motivos</option>
                  <option value="ANULADAS">Canceladas (Anuladas)</option>
                </select>

                <button 
                  onClick={handleExportLostQuotes}
                  className="bg-gray-900 hover:bg-primary text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                  title="Descargar reporte en Excel / CSV"
                >
                  <Download size={16} /> Exportar XLS
                </button>
              </div>
            </div>

            {/* Listado de Pérdidas Filtradas */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {lostQuotes.filter(q => lostFilter === 'ALL' || (lostFilter === 'ANULADAS' ? q.estado === 'anulada' : ((q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase()) && q.estado !== 'anulada'))).length === 0 ? (
                <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No se encontraron cotizaciones perdidas con este filtro</p>
                </div>
              ) : (
                lostQuotes
                  .filter(q => lostFilter === 'ALL' || (lostFilter === 'ANULADAS' ? q.estado === 'anulada' : ((q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase()) && q.estado !== 'anulada')))
                  .map((q, idx) => (
                    <div key={idx} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-amber-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {q.motivo_perdida || 'Sin Motivo'}
                          </span>
                          <span className="text-xs font-black text-gray-900">{q.codigo}</span>
                          <span className="text-xs text-gray-400 font-bold">· {q.agencia || 'Directo'} {q.comercial ? `(${q.comercial})` : ''}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700 italic pt-1">
                          "{q.notas_seguimiento || 'Sin observaciones registradas'}"
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right border-t md:border-t-0 pt-2 md:pt-0 border-gray-200">
                        <div>
                          <p className="text-xs font-black text-gray-800 uppercase">{q.destino}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{q.profiles?.nombre || 'Asesor'}</p>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                          {q.created_at ? q.created_at.split('T')[0] : '---'}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>


        {/* COLUMNA DERECHA: META, LEADERBOARD, INSIGHTS */}
        <div className="space-y-10">
          
          {/* CUMPLIMIENTO DE META */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Trophy size={120} /></div>
            <div className="flex items-center justify-between mb-10">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy className="text-amber-500" size={24} />
                Meta {selectedOperative === 'global' ? 'Global' : 'Individual'}
              </h3>
              <div className="bg-primary/10 px-3 py-1 rounded-full"><span className="text-xs font-black text-primary uppercase">Mes Actual</span></div>
            </div>

            <div className="flex items-end justify-between mb-4">
              <div><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Completado</p><p className="text-4xl font-black text-gray-900 tracking-tighter">${metrics.metaComputable.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Objetivo</p><p className="text-2xl font-black text-gray-400">${metrics.globalGoal.toLocaleString()}</p></div>
            </div>
            <div className="w-full bg-gray-100 h-8 rounded-full overflow-hidden mb-6 p-1.5 border border-gray-50">
              <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,102,204,0.3)] relative overflow-hidden" style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}>
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-sm font-black text-gray-800"><TrendingUp size={18} className="text-success" />{metrics.porcentajeMeta.toFixed(1)}% Cumplido</div>
              <div className="text-xs font-bold text-gray-400 uppercase">Restan ${(metrics.globalGoal - metrics.metaComputable).toLocaleString()}</div>
            </div>
          </div>

          {/* RANKING DEL EQUIPO — visible para todos, con contexto motivacional */}
          <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy size={22} className="text-amber-500" />Ranking del Equipo
              </h3>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">Mes Actual</span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-6">
              Posiciones calculadas según el aporte a la meta (comisión + utilidad)
            </p>
            <div className="space-y-4">
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin datos este mes aún</p>
              )}
              {leaderboard.map((op, idx) => {
                const isMe = profile?.id === op.id || profile?.nombre?.split(' ')[0] === op.nombre || profile?.nombre === op.nombreCompleto
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
                const barColor = op.cumplimiento >= 100 ? '#16A34A' : op.cumplimiento >= 60 ? '#0066CC' : '#F5A623'
                return (
                  <div
                    key={op.id}
                    className={`p-5 rounded-2xl border transition-all group ${
                      isMe
                        ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10'
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                    } ${(isAdmin || isMe) ? 'cursor-pointer hover:shadow-md' : ''}`}
                    onClick={() => (isAdmin || isMe) && handleOpenOperativePanel(op)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medal}</span>
                        <div>
                          <p className={`text-base font-black leading-none ${ isMe ? 'text-primary' : 'text-gray-800'} group-hover:text-primary transition-colors`}>
                            {op.nombre} {isMe && <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1 uppercase">Tú</span>}
                          </p>
                          <p className="text-xs text-gray-400 font-bold uppercase mt-1">Meta: ${op.meta.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-gray-900">${op.total.toLocaleString()}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider -mt-0.5">Aporte CTB</p>
                        <p className={`text-xs font-black uppercase mt-0.5 ${ op.cumplimiento >= 100 ? 'text-success' : op.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{op.cumplimiento.toFixed(0)}% de meta</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(op.cumplimiento, 100)}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

                   {/* INTELIGENCIA COMERCIAL */}
          <div className="bg-gray-900 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-6 relative z-10 flex items-center gap-3"><PieIcon size={24} className="text-primary" />Inteligencia Comercial</h3>
            <div className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5"><p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Destino más pedido</p><p className="text-xl font-black uppercase italic truncate">{metrics.topDestino}</p></div>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5"><p className="text-xs font-black text-success uppercase tracking-widest mb-1">Tasa de Cierre</p><p className="text-3xl font-black">{metrics.conversionRate.toFixed(0)}%</p></div>
              </div>
              <div className="mt-4">
                <AIInsightCard 
                  modo={isAdmin && selectedOperative === 'global' ? 'GLOBAL_ADMIN' : 'OPERATIVE'}
                  metricas={{
                    total: metrics.total,
                    abiertas: metrics.abiertas,
                    ganadas: metrics.ganadas,
                    perdidas: metrics.perdidas,
                    anuladas: metrics.anuladas || 0,
                    conversion: metrics.conversion,
                    totalAporte: metrics.totalAporte,
                    topDestino: metrics.topDestino,
                    globalGoal: metrics.globalGoal,
                    porcentajeMeta: metrics.porcentajeMeta,
                    topMotivos: metrics.topMotivos
                  }} 
                />
              </div>
            </div>
          </div>

        </div>
      </div>
      )}

      {activeDashboardTab === 'operations' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          {/* RADAR DE COBROS */}
          {profile && <PaymentAlerts userId={isAdmin && selectedOperative !== 'global' ? selectedOperative : profile.id} isAdmin={isAdmin && selectedOperative === 'global'} />}

          {/* TABLA DE EXPEDIENTES */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                <FileText size={22} className="text-gray-400" />
                Últimas Cotizaciones
              </h3>
              <Link href="/dashboard/cotizaciones" className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                Ver Todo <ChevronRight size={14} />
              </Link>
            </div>
            <QuotesTable quotes={quotes} isAdmin={isAdmin} onUpdate={fetchDashboardData} />
          </div>
        </div>
      )}
    </motion.div>
  )
}
