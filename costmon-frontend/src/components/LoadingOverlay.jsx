import { Loader2 } from 'lucide-react';

export default function LoadingOverlay({ message = "Loading...", subtext = "Please wait..." }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="bg-blue-50 p-4 rounded-full mb-4">
          <Loader2 size={40} className="text-blue-600 animate-spin" strokeWidth={2.5} />
        </div>
        <h3 className="text-xl font-black text-slate-800 tracking-tight text-center">
          {message}
        </h3>
        <p className="text-sm text-slate-500 font-medium mt-2 text-center">
          {subtext}
        </p>
      </div>
    </div>
  );
}