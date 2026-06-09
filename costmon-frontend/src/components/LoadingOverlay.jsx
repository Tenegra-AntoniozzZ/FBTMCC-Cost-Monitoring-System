import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ message = 'Loading...', subtext = 'Paki-antay lamang...' }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-1000">
      <div className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center text-center max-w-xs w-full animate-in zoom-in-95 duration-1000 border border-slate-100">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
          <div className="relative bg-blue-50 p-5 rounded-full text-blue-600">
            <Loader2 size={40} className="animate-spin" />
          </div>
        </div>
        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2 uppercase">{message}</h3>
        <p className="text-sm text-slate-500 font-medium">{subtext}</p>
      </div>
    </div>
  );
}