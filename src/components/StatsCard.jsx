export default function StatsCard({ title, value, icon: Icon, color = 'primary', description }) {
  const colorSchemes = {
    primary: {
      bg: 'bg-blue-50/60 hover:bg-blue-50/80',
      iconBg: 'bg-blue-600/10 text-blue-600',
      border: 'border-blue-100/50',
      glow: 'shadow-blue-500/5 hover:shadow-blue-500/10',
    },
    accent: {
      bg: 'bg-indigo-50/60 hover:bg-indigo-50/80',
      iconBg: 'bg-indigo-600/10 text-indigo-600',
      border: 'border-indigo-100/50',
      glow: 'shadow-indigo-500/5 hover:shadow-indigo-500/10',
    },
    success: {
      bg: 'bg-emerald-50/60 hover:bg-emerald-50/80',
      iconBg: 'bg-emerald-600/10 text-emerald-600',
      border: 'border-emerald-100/50',
      glow: 'shadow-emerald-500/5 hover:shadow-emerald-500/10',
    },
    warning: {
      bg: 'bg-amber-50/60 hover:bg-amber-50/80',
      iconBg: 'bg-amber-600/10 text-amber-600',
      border: 'border-amber-100/50',
      glow: 'shadow-amber-500/5 hover:shadow-amber-500/10',
    },
    danger: {
      bg: 'bg-rose-50/60 hover:bg-rose-50/80',
      iconBg: 'bg-rose-600/10 text-rose-600',
      border: 'border-rose-100/50',
      glow: 'shadow-rose-500/5 hover:shadow-rose-500/10',
    },
  }

  const scheme = colorSchemes[color] || colorSchemes.primary

  return (
    <div className={`backdrop-blur-md p-5 rounded-[2.2rem] border ${scheme.border} ${scheme.bg} flex flex-col justify-between gap-3 hover:scale-[1.03] shadow-lg ${scheme.glow} transition-all duration-500 ease-out group cursor-default h-full min-h-[135px]`}>
      <div className="flex items-start justify-between w-full gap-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-normal group-hover:text-gray-500 transition-colors pr-2 break-words">
          {title}
        </p>
        <div className={`p-2.5 rounded-[1.1rem] ${scheme.iconBg} shrink-0 group-hover:scale-110 transition-all duration-500 ease-out`}>
          <Icon size={16} className="stroke-[2.5]" />
        </div>
      </div>
      <div className="space-y-1 mt-auto">
        <h3 className="text-2xl md:text-3xl font-black text-gray-950 tracking-tighter leading-none">
          {value}
        </h3>
        {description && (
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none mt-1 group-hover:text-gray-500 transition-colors">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
