export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="skeleton h-7 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-72" />
    </div>
  );
}
