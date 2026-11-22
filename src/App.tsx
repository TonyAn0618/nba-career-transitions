import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import AgeAtlas from "./components/AgeAtlas";
import CareerTransitions from "./components/CareerTransitions";
import type { Dataset } from "./lib/types";

const query = new URLSearchParams(window.location.search);

export default function App() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("./data/nba.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Dataset not found");
        const result = (await response.json()) as Dataset;
        if (result.metadata?.schemaVersion !== 1 || !result.rows?.length)
          throw new Error("Dataset format is invalid");
        setData(result);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  if (!data)
    return (
      <div className="loading-screen">
        <img src="./ball.svg" alt="" />
        {error ? (
          <>
            <p>Import data / 请先导入数据</p>
            <code>npm run data</code>
            <button
              onClick={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              <RotateCcw size={15} />
              Retry / 重试
            </button>
            <small>{error}</small>
          </>
        ) : (
          <p>Loading… / 载入中…</p>
        )}
      </div>
    );
  if (query.get("view") === "interval" || query.has("from"))
    return <CareerTransitions data={data} query={query} />;
  return <AgeAtlas data={data} query={query} />;
}
