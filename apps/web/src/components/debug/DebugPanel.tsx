import { useDebugMode } from "../../hooks/useDebugMode";

export function DebugPanel() {
  const { parseAll, generatePosts, warning, isLoading, isPending, updateDebugMode } = useDebugMode();

  return (
    <section className="mt-8 rounded border border-dashed border-danger bg-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-lg text-danger">Developer debug tools</h3>
        <span className="rounded border border-danger px-2 py-0.5 font-mono text-[10px] text-danger">DEV ONLY</span>
      </div>

      {isLoading ? <p className="text-xs text-text-tertiary">Loading debug mode...</p> : null}

      {parseAll ? (
        <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          Parse mode active - all incoming emails are being processed
          {generatePosts ? " + LLM pipeline running" : ""}
        </div>
      ) : null}

      {warning ? <p className="mb-4 text-xs text-text-secondary">{warning}</p> : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded border border-border bg-bg-primary p-3">
          <div>
            <p className="text-sm">Parse all incoming emails</p>
            <p className="text-xs text-text-tertiary">Bypass sender fingerprints and process any sender.</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              updateDebugMode({
                parseAll: !parseAll,
                generatePosts: !parseAll ? generatePosts : false,
              })
            }
            className={`rounded border px-3 py-1 text-xs ${parseAll ? "border-[#E8F94A] text-[#E8F94A]" : "border-border text-text-secondary"} disabled:opacity-50`}
          >
            {parseAll ? "ON" : "OFF"}
          </button>
        </div>

        <div className={`flex items-center justify-between rounded border border-border bg-bg-primary p-3 ${parseAll ? "" : "opacity-40"}`}>
          <div>
            <p className="text-sm">Also generate posts</p>
            <p className="text-xs text-text-tertiary">Run full LLM pipeline and consume API credits.</p>
          </div>
          <button
            type="button"
            disabled={isPending || !parseAll}
            onClick={() =>
              updateDebugMode({
                parseAll,
                generatePosts: !generatePosts,
              })
            }
            className={`rounded border px-3 py-1 text-xs ${generatePosts ? "border-[#E8F94A] text-[#E8F94A]" : "border-border text-text-secondary"} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {generatePosts ? "ON" : "OFF"}
          </button>
        </div>

        <p className="font-mono text-[11px] text-text-tertiary">
          Current mode:{" "}
          {!parseAll ? "Normal - fingerprint only" : generatePosts ? "Parse + generate - uses API credits" : "Parse only - no LLM cost"}
        </p>
      </div>
    </section>
  );
}
