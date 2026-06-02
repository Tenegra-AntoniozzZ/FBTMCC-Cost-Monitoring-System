import { Wallet, Receipt, BarChart3, LayoutDashboard } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      {/* BRANDING SECTION */}
      <div className="flex flex-col items-center mb-12 text-center">
        <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
          <LayoutDashboard size={64} strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl font-black text-slate-800 tracking-tight leading-none uppercase">
          FBTMCC <span className="text-indigo-600 block mt-2 text-4xl">COST MONITORING</span>
        </h1>
        <div className="h-1.5 w-24 bg-indigo-600 rounded-full mt-6 shadow-sm shadow-indigo-100"></div>
        <p className="text-slate-400 mt-6 font-bold uppercase tracking-[0.2em] text-sm">Select Your Access Role</p>
      </div>

      {/* ROLE SELECTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
        {/* ENCODER */}
        <div 
          onClick={() => onLogin('encoder')}
          className="group bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-indigo-100 transition-colors"></div>
          <div className="bg-slate-100 p-5 rounded-2xl text-slate-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner">
            <Receipt size={32} strokeWidth={2.5} />
          </div>
          <h3 className="font-black text-2xl text-slate-800">ENCODER</h3>
          <p className="text-slate-400 mt-3 font-medium text-sm leading-relaxed">Daily encoding of financial <br/> disbursements & vouchers</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase tracking-widest">Write Access</div>
        </div>

        {/* PROJECT ENGINEER */}
        <div 
          onClick={() => onLogin('engineer')}
          className="group bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-emerald-100 transition-colors"></div>
          <div className="bg-slate-100 p-5 rounded-2xl text-slate-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-inner">
            <BarChart3 size={32} strokeWidth={2.5} />
          </div>
          <h3 className="font-black text-2xl text-slate-800">ENGINEER</h3>
          <p className="text-slate-400 mt-3 font-medium text-sm leading-relaxed">Project tracking & site <br/> budget monitoring</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all uppercase tracking-widest">Read Only</div>
        </div>

        {/* CEO / ADMIN */}
        <div 
          onClick={() => onLogin('ceo')}
          className="group bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 cursor-pointer hover:border-amber-500 hover:bg-amber-50/30 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-amber-100 transition-colors"></div>
          <div className="bg-slate-100 p-5 rounded-2xl text-slate-600 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 shadow-inner">
            <LayoutDashboard size={32} strokeWidth={2.5} />
          </div>
          <h3 className="font-black text-2xl text-slate-800">ADMIN / CEO</h3>
          <p className="text-slate-400 mt-3 font-medium text-sm leading-relaxed">Full system configuration <br/> & financial health view</p>
          <div className="mt-8 px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 group-hover:bg-amber-600 group-hover:text-white transition-all uppercase tracking-widest">Full Access</div>
        </div>
      </div>

      <footer className="mt-16 text-slate-400 text-xs font-bold tracking-widest uppercase">
        FBTMCC Construction & Business Development Corp. © 2026
      </footer>
    </div>
  );
}
