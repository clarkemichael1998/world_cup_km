export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-black tracking-tight text-green-950">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-base font-medium text-green-900/75">{subtitle}</p> : null}
    </div>
  );
}
