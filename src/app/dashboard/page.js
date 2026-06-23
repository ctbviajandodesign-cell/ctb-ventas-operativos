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

const isExpired = (q) => {
  if (q.fecha_caducidad) {
    const timeStr = q.hora_caducidad ? q.hora_caducidad : '23:59:59'
    const expiryDate = new Date(`${q.fecha_caducidad}T${timeStr}`)
    return expiryDate < new Date()
  }
  if (q.created_at) {
    const hours = (new Date() - new Date(q.created_at)) / (1000 * 60 * 60)
    return hours > 24
  }
  return false
}

export default function DashboardPage() {
  const getEcuadorTime = (date = new Date()) => {
    return new Date(date.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
  }

  const [profile, setProfile] = useState(null)
  const [selectedOperative, setSelectedOperative] = useState('global')
  const [selectedCity, setSelectedCity] = useState('global')
  const [selectedPeriod, setSelectedPeriod] = useState('mes') // 'dia', 'semana', 'mes', 'año'
  const [focusDate, setFocusDate] = useState(() => getEcuadorTime())
  const [operatives, setOperatives] = useState([])

  const getPeriodRange = (period, date) => {
    const d = new Date(date)
    let start, end

    if (period === 'dia') {
      start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0, 0))
      end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1, 4, 59, 59, 999))
    } else if (period === 'semana') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      start = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 5, 0, 0, 0))
      end = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, 4, 59, 59, 999))
    } else if (period === 'mes') {
      start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 5, 0, 0, 0))
      end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 4, 59, 59, 999))
    } else { // 'año'
      start = new Date(Date.UTC(d.getFullYear(), 0, 1, 5, 0, 0, 0))
      end = new Date(Date.UTC(d.getFullYear() + 1, 0, 1, 4, 59, 59, 999))
    }

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString()
    }
  }

  const getPeriodLabel = (period, date) => {
    const d = new Date(date)
    if (period === 'dia') {
      return format(d, "d 'de' MMMM, yyyy", { locale: es })
    } else if (period === 'semana') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(new Date(d).setDate(diff))
      const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6))
      const startStr = format(monday, "d MMM", { locale: es })
      const endStr = format(sunday, "d MMM, yyyy", { locale: es })
      return `${startStr} - ${endStr}`
    } else if (period === 'mes') {
      return format(d, "MMMM yyyy", { locale: es })
    } else {
      return `Año ${d.getFullYear()}`
    }
  }

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

      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id, abono_1, abono_2, abono_tarjeta').gte('created_at', startIso).lte('created_at', endIso)
      let globalDebtQuery = supabase.from('ventas').select('total, abono_1, abono_2, abono_tarjeta')
      let vouchersQuery = supabase.from('vouchers').select('id', { count: 'exact', head: true }).eq('estado', 'activo').gte('created_at', startIso).lte('created_at', endIso)
      let quotesQuery = supabase.from('cotizaciones').select('id, operativo_id, codigo, agencia, destino, numero_pasajeros, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, valor_bono, comercial, estado, motivo_perdida, created_at, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!left(nombre, ciudad), ventas(*, vouchers(*))').order('created_at', { ascending: false }).limit(10)
      let pipelineQuery = supabase.from('cotizaciones').select('operativo_id, codigo, agencia, destino, estado, valor_total, valor_comision, valor_utilidad, created_at, comercial, numero_pasajeros, nombres_pasajeros, motivo_perdida, notas_iniciales, notas_seguimiento, fecha_caducidad, hora_caducidad, profiles!left(nombre, ciudad), ventas(id, estado, vouchers(codigo))').gte('created_at', startIso).lte('created_at', endIso)

      if (targetIdForIndividual) {
        // MODO INDIVIDUAL: Filtrar exclusivamente por ID del operativo, sin joins complejos para evitar errores de RLS
        ventasQuery = ventasQuery.eq('operativo_id', targetIdForIndividual)
        globalDebtQuery = globalDebtQuery.eq('operativo_id', targetIdForIndividual)
        vouchersQuery = vouchersQuery.eq('operativo_id', targetIdForIndividual)
        quotesQuery = quotesQuery.eq('operativo_id', targetIdForIndividual)
        pipelineQuery = pipelineQuery.eq('operativo_id', targetIdForIndividual)
      } else if (activeCityFilter && activeCityFilter !== 'global') {
        // MODO GLOBAL/ADMIN: Filtrar por ciudad haciendo join manual con profiles (requiere foreign keys intactas)
        ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id, abono_1, abono_2, abono_tarjeta, profiles!inner(ciudad)').gte('created_at', startIso).lte('created_at', endIso).eq('profiles.ciudad', activeCityFilter)
        globalDebtQuery = supabase.from('ventas').select('total, abono_1, abono_2, abono_tarjeta, profiles!inner(ciudad)').eq('profiles.ciudad', activeCityFilter)
        
        // Vouchers no tiene foreign key directa con perfiles fácil de hacer join aquí, 
        // pero la app asume que se verán todos o filtraremos en memoria si es necesario.
        // Asumimos que los operativos de la ciudad se obtienen vía profiles.
        vouchersQuery = supabase.from('vouchers').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).eq('estado', 'activo').gte('created_at', startIso).lte('created_at', endIso).eq('profiles.ciudad', activeCityFilter)

        quotesQuery = supabase.from('cotizaciones').select('id, operativo_id, codigo, agencia, destino, numero_pasajeros, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, valor_bono, comercial, estado, motivo_perdida, created_at, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!inner(nombre, ciudad), ventas(*, vouchers(*))').order('created_at', { ascending: false }).limit(10).eq('profiles.ciudad', activeCityFilter)
        pipelineQuery = supabase.from('cotizaciones').select('operativo_id, codigo, agencia, destino, estado, valor_total, valor_comision, valor_utilidad, created_at, comercial, numero_pasajeros, nombres_pasajeros, motivo_perdida, notas_iniciales, notas_seguimiento, fecha_caducidad, hora_caducidad, profiles!inner(nombre, ciudad), ventas(id, estado, vouchers(codigo))').gte('created_at', startIso).lte('created_at', endIso).eq('profiles.ciudad', activeCityFilter)
      } else {
        // MODO GLOBAL TOTAL
      }

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
        resVentas,
        { data: quotesData },
        { data: pipelineData },
        resBoard,
        resGlobalDebt,
        { count: vouchersCount },
        opsRes
      ] = await Promise.all([
        ventasQuery,
        quotesQuery,
        pipelineQuery,
        leaderboardPromise,
        globalDebtQuery,
        vouchersQuery,
        opsPromise
      ])

      if (opsRes?.data && isAdmin && operatives.length === 0) {
        setOperatives(opsRes.data)
      }

      if (resVentas.error) {
        console.error("Ventas query failed", resVentas.error)
        showToast.error("Error al cargar ventas: " + resVentas.error.message)
      }
      if (resGlobalDebt.error) {
        console.error("GlobalDebt query failed", resGlobalDebt.error)
      }

      const ventasData = resVentas.data || [];
      const globalDebtData = resGlobalDebt.data || [];

      // Función auxiliar para calcular faltante protegiéndose de los NULL (COALESCE en JS)
      const getFaltanteReal = (v) => {
        const t = Number(v.total) || 0
        const a1 = Number(v.abono_1) || 0
        const a2 = Number(v.abono_2) || 0
        const at = Number(v.abono_tarjeta) || 0
        return t - (a1 + a2 + at)
      }

      const totalMetaComp = ventasData?.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0) || 0
      const porCobrarMes = ventasData?.reduce((acc, v) => acc + Math.max(0, getFaltanteReal(v)), 0) || 0
      const porCobrarGlobal = globalDebtData?.reduce((acc, v) => acc + Math.max(0, getFaltanteReal(v)), 0) || 0
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
        porcentajeMeta: metaBase > 0 ? (totalMetaComp / metaBase) * 100 : 0,
        totalAporte: totalMetaComp,
        metaComputable: totalMetaComp,
        topMotivos: topMotivosText
      }))

      // ── OVERRIDE FINAL: métricas correctas desde ventasData y embudo de pipeline ──
      
      const ganadasCount   = ventasData?.length || 0
      
      // El total vendido debe ser la suma de la tabla ventas de este periodo
      const totalVendidoReal = ventasData?.reduce((a, v) => a + (Number(v.total) || 0), 0) || 0
      
      // La ganancia real debe ser la suma de comisión + utilidad de la tabla ventas
      const totalGananciaReal = totalMetaComp
      
      const caducadasReal  = pipelineEnriched.filter(q => !q._esVenta && q.estado !== 'perdida' && q.estado !== 'anulada' && isExpired(q)).length
      const abiertasReal   = pipelineEnriched.filter(q => !q._esVenta && q.estado !== 'perdida' && q.estado !== 'anulada' && !isExpired(q)).length
      const perdidasReal   = pipelineEnriched.filter(q => q.estado === 'perdida').length
      const anuladasReal   = pipelineEnriched.filter(q => q.estado === 'anulada').length
      const totalReal      = pipelineEnriched.length
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
        vouchersEmitidos: vouchersCount || 0,
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
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">

      {/* PANEL DRILL-DOWN DE OPERATIVO (ADMIN) */}
      {operativePanel && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setOperativePanel(null); setProfileTab('resumen'); }}>
          <div className="bg-white rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white p-8 flex items-start justify-between shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">{operativePanel.avatar}</div>
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Perfil de Operativo</p>
                  <h2 className="text-2xl font-black tracking-tight">{operativePanel.nombreCompleto || operativePanel.nombre}</h2>
                  <p className="text-xs text-gray-400 mt-0.5 font-bold uppercase tracking-wider">{operativePanel.ciudad} · Meta mensual: ${operativePanel.meta?.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => { setOperativePanel(null); setProfileTab('resumen'); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl font-black relative z-10">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-150 bg-gray-50 px-6 pt-2 shrink-0">
              {[
                { id: 'resumen', label: 'Resumen', count: null },
                { id: 'cotizaciones', label: 'Cotizaciones', count: operativePanel.cotizacionesList?.length },
                { id: 'proformas', label: 'Proformas', count: operativePanel.ventasList?.length },
                { id: 'vouchers', label: 'Vouchers', count: operativePanel.vouchersList?.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setProfileTab(tab.id)}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all mr-4 relative ${
                    profileTab === tab.id
                      ? 'border-primary text-primary font-black'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                      profileTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              {profileTab === 'resumen' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Cumplimiento de Meta (Mes)</span>
                      <span className={`text-xs font-black uppercase ${operativePanel.cumplimiento >= 100 ? 'text-success' : operativePanel.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{Number(operativePanel.cumplimiento).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(operativePanel.cumplimiento, 100)}%`, background: operativePanel.cumplimiento >= 100 ? '#16A34A' : operativePanel.cumplimiento >= 60 ? '#0066CC' : '#F5A623' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-success font-black">Ganancia CTB: ${operativePanel.ganancia?.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 font-bold">Restan: ${Math.max(0, (operativePanel.meta||0) - (operativePanel.ganancia||0)).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <p className="text-xs font-black text-gray-400 uppercase">Total de Ventas</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">${(operativePanel.valorTotalCliente || operativePanel.totalVendido)?.toLocaleString()}</p>
                    </div>
                    <div className="bg-success/5 p-5 rounded-2xl border border-success/10">
                      <p className="text-xs font-black text-success/80 uppercase">Ganancia CTB</p>
                      <p className="text-2xl font-black text-success mt-1">${operativePanel.ganancia?.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <p className="text-xs font-black text-gray-400 uppercase">Tasa de Cierre</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.conversion}%</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <p className="text-xs font-black text-gray-400 uppercase">Vouchers Emitidos</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.vouchers}</p>
                    </div>
                  </div>

                  {/* FEEDBACK DE OPENAI BAJO DEMANDA */}
                  <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-3xl text-white relative overflow-hidden border border-indigo-500/20 shadow-xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-center justify-between gap-4 mb-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded-xl border border-primary/30 text-primary">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">OpenAI Analytics</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Auditoría Inteligente de Asesor</p>
                        </div>
                      </div>
                      {operativePanel.aiInsight && (
                        <button
                          onClick={() => {
                            // Re-fetch insight
                            setLoadingPanelAi(true)
                            fetch('/api/insight', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                modo: 'INDIVIDUAL_ADMIN',
                                metricas: {
                                  nombreAsesor: operativePanel.nombreCompleto || operativePanel.nombre,
                                  meta: operativePanel.meta,
                                  cumplimiento: operativePanel.cumplimiento,
                                  vouchers: operativePanel.vouchers || 0,
                                  total: operativePanel.totalCots,
                                  abiertas: operativePanel.abiertas,
                                  ganadas: operativePanel.ganadas,
                                  perdidas: operativePanel.perdidas,
                                  conversion: operativePanel.conversion,
                                  totalAporte: operativePanel.ganancia,
                                  topDestino: operativePanel.topDestino
                                }
                              })
                            })
                            .then(r => r.json())
                            .then(aiData => { if (aiData.insight) setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null) })
                            .finally(() => setLoadingPanelAi(false))
                          }}
                          disabled={loadingPanelAi}
                          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                          title="Actualizar auditoría"
                        >
                          <RefreshCw size={14} className={`text-gray-400 ${loadingPanelAi ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                    <div className="relative z-10 min-h-[60px] flex items-center justify-center">
                      {loadingPanelAi ? (
                        <div className="space-y-2 w-full py-2">
                          <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-full"></div>
                          <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-5/6"></div>
                          <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-2/3"></div>
                        </div>
                      ) : operativePanel.aiInsight ? (
                        <p className="text-xs sm:text-sm leading-relaxed text-gray-200 italic font-medium w-full">
                          "{operativePanel.aiInsight}"
                        </p>
                      ) : (
                        <div className="text-center py-2 space-y-3 w-full">
                          <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            No se pudo cargar la auditoría automática.
                          </p>
                          <button
                            onClick={() => {
                              setLoadingPanelAi(true)
                              fetch('/api/insight', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  modo: 'INDIVIDUAL_ADMIN',
                                  metricas: {
                                    nombreAsesor: operativePanel.nombreCompleto || operativePanel.nombre,
                                    meta: operativePanel.meta,
                                    cumplimiento: operativePanel.cumplimiento,
                                    vouchers: operativePanel.vouchers || 0,
                                    total: operativePanel.totalCots,
                                    abiertas: operativePanel.abiertas,
                                    ganadas: operativePanel.ganadas,
                                    perdidas: operativePanel.perdidas,
                                    conversion: operativePanel.conversion,
                                    totalAporte: operativePanel.ganancia,
                                    topDestino: operativePanel.topDestino
                                  }
                                })
                              })
                              .then(r => r.json())
                              .then(aiData => { if (aiData.insight) setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null) })
                              .finally(() => setLoadingPanelAi(false))
                            }}
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                          >
                            <RefreshCw size={14} />
                            Reintentar Carga
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Cotizaciones (histórico total)</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Ganadas', val: operativePanel.ganadas, color: 'text-success bg-success/10 border-success/20' },
                        { label: 'En Espera', val: operativePanel.abiertas, color: 'text-primary bg-primary/10 border-primary/20' },
                        { label: 'Caducadas', val: operativePanel.caducadas, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                        { label: 'Perdidas', val: operativePanel.perdidas, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                      ].map(item => (
                        <div key={item.label} className={`p-3 rounded-2xl text-center border ${item.color} min-w-0`}>
                          <p className="text-2xl font-black truncate">{item.val}</p>
                          <p className="text-[10px] font-black uppercase mt-0.5 truncate">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {profileTab === 'cotizaciones' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Cotizaciones Registradas</h3>
                    <Link href="/dashboard/cotizaciones/nueva" onClick={() => setOperativePanel(null)} className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline">
                      + Nueva Cotización
                    </Link>
                  </div>
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Agencia / Destino</th>
                          <th className="py-3 px-4 text-right">Total</th>
                          <th className="py-3 px-4">Estado</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-xs">
                        {(!operativePanel.cotizacionesList || operativePanel.cotizacionesList.length === 0) ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin cotizaciones</td>
                          </tr>
                        ) : operativePanel.cotizacionesList.map(q => {
                          const status = (q.estado || '').toString().trim().toLowerCase()
                          const isGanada = status === 'ganada' || (Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada'))
                          return (
                            <tr key={q.id} className="hover:bg-gray-50/50 font-semibold">
                              <td className="py-3.5 px-4 font-mono font-black text-primary">#{q.codigo}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-gray-800">{q.agencia || 'Directo'}</div>
                                <div className="text-[10px] text-gray-450 uppercase">{q.destino}</div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-gray-900">${Number(q.valor_total || 0).toLocaleString()}</td>
                              <td className="py-3.5 px-4">
                                {isGanada ? (
                                  <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">VENDIDA</span>
                                ) : status === 'perdida' || status === 'anulada' ? (
                                  <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">CANCELADA</span>
                                ) : isExpired(q) ? (
                                  <span className="bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">CADUCADA</span>
                                ) : (
                                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">ACTIVA</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <Link 
                                  href={`/dashboard/cotizaciones/editar/${q.id}`} 
                                  onClick={() => { setOperativePanel(null); setProfileTab('resumen'); }}
                                  className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg inline-block transition-colors"
                                  title="Editar Cotización"
                                >
                                  <Edit size={14} />
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profileTab === 'proformas' && (
                <div className="space-y-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Proformas / Ventas Activas</h3>
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Agencia / Destino</th>
                          <th className="py-3 px-4 text-right">Aporte CTB</th>
                          <th className="py-3 px-4 text-right">Total Venta</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-xs">
                        {(!operativePanel.ventasList || operativePanel.ventasList.length === 0) ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin ventas</td>
                          </tr>
                        ) : operativePanel.ventasList.map(v => (
                          <tr key={v.id} className={`hover:bg-gray-50/50 font-semibold ${v.estado === 'anulada' ? 'opacity-50 grayscale' : ''}`}>
                            <td className="py-3.5 px-4 font-mono font-black text-primary">#{v.cotizaciones?.codigo || v.numero_proforma}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-gray-800">{v.cotizaciones?.agencia || 'Directo'}</div>
                              <div className="text-[10px] text-gray-450 uppercase">{v.cotizaciones?.destino}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right text-success font-black">${(Number(v.comision || 0) + Number(v.utilidad || 0)).toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right font-black text-gray-900">${Number(v.total || 0).toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right">
                              {v.estado === 'activa' && (
                                <button 
                                  onClick={() => {
                                    setOperativePanel(null);
                                    setProfileTab('resumen');
                                    window.dispatchEvent(new CustomEvent('open-sales-modal', {
                                      detail: {
                                        ...v.cotizaciones,
                                        id: v.cotizaciones?.id,
                                        agencia: v.cotizaciones?.agencia,
                                        destino: v.cotizaciones?.destino,
                                        codigo: v.cotizaciones?.codigo,
                                        nombres_pasajeros: v.cotizaciones?.nombres_pasajeros,
                                        existingSale: v
                                      }
                                    }))
                                  }}
                                  className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Editar Venta"
                                >
                                  <Edit size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profileTab === 'vouchers' && (
                <div className="space-y-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Vouchers Emitidos</h3>
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Agencia / Destino</th>
                          <th className="py-3 px-4">Vigencia</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-xs">
                        {(!operativePanel.vouchersList || operativePanel.vouchersList.length === 0) ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin vouchers</td>
                          </tr>
                        ) : operativePanel.vouchersList.map(vch => (
                          <tr key={vch.id} className="hover:bg-gray-50/50 font-semibold">
                            <td className="py-3.5 px-4 font-mono font-bold text-success">{vch.codigo}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-gray-800">{vch.agencia || 'Directo'}</div>
                              <div className="text-[10px] text-gray-455 uppercase">{vch.destino}</div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-500 font-bold leading-tight">
                              {vch.fecha_viaje_desde} al {vch.fecha_viaje_hasta}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button 
                                onClick={() => setEditingVoucher(vch)}
                                className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                title="Editar Voucher"
                              >
                                <Edit size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {isAdmin && selectedOperative !== operativePanel.id && (
              <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                <button
                  onClick={() => { setSelectedOperative(operativePanel.id); setOperativePanel(null); setProfileTab('resumen'); }}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-tighter text-sm hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
                >
                  Ver Dashboard Completo de {operativePanel.nombre} →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Voucher */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
          <form onSubmit={handleUpdateVoucher} className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-primary p-8 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Editar Voucher</h2>
                <button type="button" onClick={() => setEditingVoucher(null)}><XCircle size={24} /></button>
              </div>
              <p className="text-xs opacity-80 mt-1 uppercase tracking-widest font-bold">{editingVoucher.codigo}</p>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Agencia</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.agencia || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, agencia: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Destino</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.destino || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, destino: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">Nombres de Pasajeros (uno por línea)</label>
                <textarea 
                  className="input text-sm min-h-[90px] font-mono" 
                  placeholder="Juan Pérez&#10;María García&#10;Carlos López..."
                  value={Array.isArray(editingVoucher.pasajeros) ? editingVoucher.pasajeros.join('\n') : (editingVoucher.pasajeros || '')}
                  onChange={e => setEditingVoucher({...editingVoucher, pasajeros: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Válido Desde</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_desde || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_desde: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Válido Hasta</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_hasta || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_hasta: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Días antes para Recordatorio</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="Ej: 5"
                    className="input text-sm" 
                    value={editingVoucher.recordatorio_dias_antes || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, recordatorio_dias_antes: e.target.value ? Number(e.target.value) : null})}
                  />
                  <p className="text-[10px] text-gray-400 font-bold">Aviso en Telegram antes del inicio del viaje</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Nota del Recordatorio</label>
                  <input 
                    className="input text-sm" 
                    placeholder="Ej: Pagar a hotel y traslados"
                    value={editingVoucher.recordatorio_texto || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, recordatorio_texto: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">Notas Adicionales</label>
                <textarea 
                  className="input text-sm min-h-[80px]" 
                  value={editingVoucher.notes || editingVoucher.notas || ''}
                  onChange={e => setEditingVoucher({...editingVoucher, notas: e.target.value})}
                />
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              <button 
                type="submit"
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                <Save size={20} /> Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* HEADER & FILTROS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2 rounded-xl text-white">
              <BarChart3 size={20} />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
              Control Center
            </h1>
          </div>
          <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em] ml-1">
            {isAdmin ? 'Panel de Control de Operaciones Globales' : 'Tu Resumen de Inteligencia Comercial'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          {/* Card de Filtros de Negocio (solo para Admin/Superadmin) */}
          {isAdmin && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100/85 w-full sm:w-auto">
              {/* Ciudad Capsule */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all flex-1 sm:flex-initial">
                <Filter size={14} className="text-primary shrink-0" />
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Ciudad:</span>
                <select 
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value)
                    setSelectedOperative('global')
                  }}
                  className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none py-1 pr-8 pl-1 cursor-pointer focus:ring-0 w-full sm:w-auto bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                >
                  <option value="global">Todas las Ciudades</option>
                  <option value="Quito">Quito</option>
                  <option value="Guayaquil">Guayaquil</option>
                  <option value="Cuenca">Cuenca</option>
                  <option value="Manta">Manta</option>
                  <option value="Loja">Loja</option>
                </select>
              </div>

              <div className="h-6 w-px bg-gray-200 hidden sm:block" />

              {/* Operativo Capsule */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all flex-1 sm:flex-initial">
                <Users size={14} className="text-primary shrink-0" />
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Operativo:</span>
                <select 
                  value={selectedOperative}
                  onChange={(e) => setSelectedOperative(e.target.value)}
                  className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none py-1 pr-8 pl-1 cursor-pointer focus:ring-0 w-full sm:w-auto max-w-full sm:max-w-[150px] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                >
                  <option value="global">Todos</option>
                  {operatives
                    .filter(op => selectedCity === 'global' || op.ciudad === selectedCity)
                    .map(op => (
                      <option key={op.id} value={op.id}>{op.nombre}</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Card de Calendario Inteligente */}
          <div className="flex items-center bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100/85 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-3 bg-gray-50/60 rounded-2xl border border-gray-100 p-1 flex-1 sm:flex-initial">
              {/* Selector de Modo */}
              <div className="flex bg-white/80 p-0.5 rounded-xl border border-gray-200/50 shadow-sm">
                {[
                  { key: 'dia', label: 'Día' },
                  { key: 'semana', label: 'Sem' },
                  { key: 'mes', label: 'Mes' },
                  { key: 'año', label: 'Año' }
                ].map(mode => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setSelectedPeriod(mode.key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      selectedPeriod === mode.key
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Navegador Temporal */}
              <div className="flex items-center gap-1.5 px-1 py-0.5 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={() => handleNavigatePeriod(-1)}
                  className="p-1 hover:bg-white active:scale-95 rounded-lg border border-gray-200/40 text-gray-400 hover:text-gray-700 transition-all shadow-sm shrink-0"
                >
                  <ChevronLeft size={14} />
                </button>

                <div className="relative flex items-center justify-center min-w-[125px] hover:text-primary transition-colors cursor-pointer group">
                  <input
                    type="date"
                    value={format(focusDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        setFocusDate(new Date(e.target.value + 'T12:00:00'))
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest select-none flex items-center gap-1.5 group-hover:text-primary transition-colors">
                    <Calendar size={12} className="text-primary" />
                    {getPeriodLabel(selectedPeriod, focusDate)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigatePeriod(1)}
                  className="p-1 hover:bg-white active:scale-95 rounded-lg border border-gray-200/40 text-gray-400 hover:text-gray-700 transition-all shadow-sm shrink-0"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* QUICK ACTION — Mi Perfil (solo para operatives/no-admins) */}
          {!isAdmin && profile && (
            <button
              onClick={() => handleOpenOperativePanel(profile)}
              className="flex items-center justify-center gap-2 bg-white text-gray-800 border border-gray-200 px-6 py-3.5 rounded-[1.8rem] font-black text-sm uppercase tracking-tighter shadow-sm hover:bg-gray-50 active:scale-95 transition-all whitespace-nowrap"
            >
              <Users size={18} className="text-primary" /> Mi Perfil
            </button>
          )}

          {/* QUICK ACTION — Nueva Cotización */}
          <Link
            href="/dashboard/cotizaciones/nueva"
            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-[1.8rem] font-black text-sm uppercase tracking-tighter shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
          >
            <Plus size={18} /> Nueva Cotización
          </Link>
        </div>
      </div>

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


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
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
    </div>
  )
}
