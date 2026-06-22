export default function NavItem({ active, icon, label, onClick, isSidebarOpen }) {
  return (
    <button 
      onClick={onClick} 
      title={!isSidebarOpen ? label : ""}
      className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-3 rounded-lg transition-colors text-left ${ active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-900/50 hover:text-white' }`}
    >
      {icon}
      {isSidebarOpen && <span className="font-medium text-sm truncate">{label}</span>}
    </button>
  );
}