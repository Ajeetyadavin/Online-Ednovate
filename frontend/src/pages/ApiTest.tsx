import { useEffect, useState } from "react";
import { testAllEndpoints } from "@/services/api";

const ApiTest = () => {
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });

  useEffect(() => {
    testAllEndpoints((done, total, current) => {
      setProgress({ done, total, current });
    }).then((r) => {
      setResults(r);
      console.log("API Results:", JSON.stringify(r, null, 2));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="p-8 text-center">
      <div className="text-lg font-semibold">Testing {progress.done}/{progress.total} endpoints...</div>
      <p className="text-sm text-muted-foreground mt-1">Current: /{progress.current}</p>
      <div className="w-64 mx-auto mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </div>
    </div>
  );

  const entries = results ? Object.entries(results) : [];
  const working = entries.filter(([, r]) => r.upstream_status === 200);
  const hasData = entries.filter(([, r]) => r.data && !r.error && r.upstream_status !== 200);
  const failed = entries.filter(([, r]) => r.error);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-20">
      <h1 className="text-2xl font-bold mb-2">API Endpoint Test - {entries.length} Endpoints</h1>
      <div className="flex gap-4 mb-4 text-sm flex-wrap">
        <span className="font-semibold">✅ 200 OK: {working.length}</span>
        <span className="font-semibold">⚠️ Has Response: {hasData.length}</span>
        <span className="font-semibold">❌ Failed: {failed.length}</span>
      </div>

      {working.length > 0 && <Section title="✅ 200 OK — Data Available" items={working} />}
      {hasData.length > 0 && <Section title="⚠️ Response (non-200)" items={hasData} />}
      {failed.length > 0 && <Section title="❌ Failed" items={failed} />}
    </div>
  );
};

const Section = ({ title, items }: { title: string; items: [string, any][] }) => (
  <div className="mb-6">
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    {items.map(([ep, r]) => (
      <details key={ep} className="mb-2 border rounded-lg">
        <summary className="p-2 cursor-pointer font-medium text-sm">
          /{ep} — {r.method || "?"} — upstream: {r.upstream_status || "error"}
        </summary>
        <pre className="text-xs p-2 overflow-auto max-h-48 bg-muted rounded-b-lg">
          {JSON.stringify(r.data || r.error, null, 2)}
        </pre>
      </details>
    ))}
  </div>
);

export default ApiTest;
