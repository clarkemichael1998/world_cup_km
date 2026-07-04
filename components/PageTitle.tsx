export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="premium-page-title mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-green-950 via-green-900 to-amber-700 p-5 text-white shadow-xl sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/50">KMXI Command Centre</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/72 sm:text-base">{subtitle}</p> : null}
    </div>
  );
}
