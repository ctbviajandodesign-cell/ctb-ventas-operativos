export default function StatsCard({ title, value, icon: Icon, trend, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
  }

  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <p className={`text-xs mt-2 font-semibold ${trend.startsWith('+') ? 'text-success' : 'text-danger'}`}>
            {trend} <span className="text-gray-400 font-normal ml-1">vs mes pasado</span>
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={24} />
      </div>
    </div>
  )
}
