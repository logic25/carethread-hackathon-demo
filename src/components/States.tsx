export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-destructive/40 bg-card p-6">
      <h3 className="text-lg font-bold text-destructive">The Meta Model API call didn't go through</h3>
      <p className="mt-1 text-muted-foreground">No result is shown because none came back. Please try again in a moment.</p>
      <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
