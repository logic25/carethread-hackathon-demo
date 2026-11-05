export function KeyNeeded() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-accent bg-warning p-6 text-warning-foreground">
      <h3 className="text-lg font-bold">A Meta Model API key is needed</h3>
      <p className="mt-1">Open Settings (the gear, top right) and paste your key. CareThread never invents a response — nothing runs until a real model answers.</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-destructive/40 bg-card p-6">
      <h3 className="text-lg font-bold text-destructive">The Meta Model API call didn't go through</h3>
      <p className="mt-1 text-muted-foreground">No result is shown because none came back. Check your key in Settings and try again.</p>
      <p className="mt-2 break-words font-mono text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
