export default function StatsCard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-purple-500/10 text-purple-650',
    success: 'bg-success/10 text-success',
    danger: 'bg-rose-500/10 text-rose-600',
    warning: 'bg-amber-500/10 text-amber-600',
  }

  return (
    <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-50 flex items-center justify-between gap-3 hover:scale-[1.01] hover:shadow-md transition-all duration-300">
      <div className="min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter truncate">{value}</h3>
        {trend && (
          <p className={`text-[10px] mt-1 font-bold ${trend.startsWith('+') ? 'text-success' : 'text-danger'}`}>
            {trend}
          </p>
        )}
      </div>
      <div className={`p-2.5 rounded-2xl ${colors[color] || colors.primary} shrink-0`}>
        <Icon size={18} />
      </div>
    </div>
  )
}
