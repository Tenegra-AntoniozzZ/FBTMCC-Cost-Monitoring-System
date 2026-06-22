export default function HealthCard({ title, amount, colorClass, textClass }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden flex flex-col justify-between transition-colors duration-300">
      <div className={`absolute top-0 left-0 w-1 h-full ${colorClass}`}></div>
      <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</h3>
      <div className={`text-2xl font-black ${textClass} dark:opacity-90`}>
        ₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}