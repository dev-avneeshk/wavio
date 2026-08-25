"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./reveal";

interface QueryScenario {
  id: string;
  name: string;
  engine: "SQL" | "Neo4j Cypher" | "Python / Pandas";
  description: string;
  code: string;
  output: {
    columns: string[];
    rows: (string | number)[][];
    metadata: {
      execTime: string;
      rowsScanned: string;
      anomalyCount: number;
    };
  };
}

const scenarios: QueryScenario[] = [
  {
    id: "aml-sql",
    name: "01. AML Velocity & Anomaly Window (SQL)",
    engine: "SQL",
    description: "Detecting sudden micro-structuring spikes and anomaly risk scores over rolling 60-minute transaction windows.",
    code: `WITH TransactionVelocity AS (
  SELECT 
    account_id,
    transaction_id,
    amount,
    timestamp,
    COUNT(*) OVER(
      PARTITION BY account_id 
      ORDER BY timestamp 
      RANGE BETWEEN INTERVAL '60 minutes' PRECEDING AND CURRENT ROW
    ) AS txn_velocity_60m,
    SUM(amount) OVER(
      PARTITION BY account_id 
      ORDER BY timestamp 
      RANGE BETWEEN INTERVAL '60 minutes' PRECEDING AND CURRENT ROW
    ) AS cumulative_volume_60m
  FROM public.financial_ledger
  WHERE timestamp >= NOW() - INTERVAL '24 hours'
)
SELECT 
  account_id,
  txn_velocity_60m,
  cumulative_volume_60m,
  ROUND((cumulative_volume_60m / NULLIF(txn_velocity_60m, 0)), 2) AS avg_ticket_size,
  CASE 
    WHEN txn_velocity_60m > 15 AND cumulative_volume_60m > 50000 THEN 'CRITICAL_HIGH_RISK'
    WHEN txn_velocity_60m > 8 THEN 'ELEVATED_WATCHLIST'
    ELSE 'NOMINAL'
  END AS risk_classification
FROM TransactionVelocity
WHERE txn_velocity_60m >= 5
ORDER BY cumulative_volume_60m DESC
LIMIT 5;`,
    output: {
      columns: ["account_id", "txn_velocity_60m", "cumulative_vol", "avg_ticket", "risk_classification"],
      rows: [
        ["ACC_7829104", 18, "$94,250.00", "$5,236.11", "CRITICAL_HIGH_RISK"],
        ["ACC_9921045", 16, "$78,500.00", "$4,906.25", "CRITICAL_HIGH_RISK"],
        ["ACC_1204882", 9, "$31,400.00", "$3,488.89", "ELEVATED_WATCHLIST"],
        ["ACC_4490123", 7, "$24,150.00", "$3,450.00", "ELEVATED_WATCHLIST"],
        ["ACC_3309187", 6, "$18,900.00", "$3,150.00", "NOMINAL"],
      ],
      metadata: {
        execTime: "14.2ms",
        rowsScanned: "482,910 rows",
        anomalyCount: 2,
      },
    },
  },
  {
    id: "graph-cypher",
    name: "02. Neo4j Money Mule Ring Traversal (Cypher)",
    engine: "Neo4j Cypher",
    description: "Traversing multi-hop layering relationships to unmask circular money laundering rings across proxy accounts.",
    code: `MATCH path = (source:Account)-[:TRANSFERRED*2..4]->(mule:Account)-[:TRANSFERRED]->(source)
WHERE ALL(r IN relationships(path) WHERE r.amount >= 10000)
  AND duration.between(relationships(path)[0].timestamp, last(relationships(path)).timestamp).hours <= 24
WITH path, 
     nodes(path) AS ring_nodes,
     [r IN relationships(path) | r.amount] AS transfer_amounts,
     reduce(total = 0, r IN relationships(path) | total + r.amount) AS total_laundered_volume
RETURN 
  [n IN ring_nodes | n.account_id] AS entity_chain,
  length(path) AS hop_depth,
  transfer_amounts,
  total_laundered_volume,
  "CIRCULAR_RING_DETECTED" AS alert_type
ORDER BY total_laundered_volume DESC
LIMIT 3;`,
    output: {
      columns: ["entity_chain", "hop_depth", "transfer_amounts", "total_laundered", "alert_type"],
      rows: [
        ["[ACC_812 -> MULE_44 -> MULE_91 -> ACC_812]", 3, "[$25k, $24.5k, $23.8k]", "$73,300.00", "CIRCULAR_RING_DETECTED"],
        ["[ACC_109 -> MULE_12 -> ACC_109]", 2, "[$40k, $38.9k]", "$78,900.00", "CIRCULAR_RING_DETECTED"],
        ["[ACC_554 -> MULE_89 -> MULE_03 -> MULE_71 -> ACC_554]", 4, "[$15k, $14.8k, $14.2k, $14k]", "$58,000.00", "CIRCULAR_RING_DETECTED"],
      ],
      metadata: {
        execTime: "28.6ms",
        rowsScanned: "12,400 graph nodes",
        anomalyCount: 3,
      },
    },
  },
  {
    id: "sports-etl",
    name: "03. Real-Time Player Prop Hit Rate (Python/Pandas)",
    engine: "Python / Pandas",
    description: "Computing rolling player stats against live bookmaker lines across BallDontLie and NBA API feeds.",
    code: `import pandas as pd
import numpy as np

def compute_player_prop_edge(game_logs_df, prop_odds_df, window=5):
    # Rolling feature engineering
    rolling_stats = (
        game_logs_df.groupby('player_name')
        .rolling(window=window, on='game_date')['pts']
        .agg(['mean', 'std', 'min', 'max'])
        .reset_index()
    )
    
    # Merge with real-time prop line
    merged = pd.merge(rolling_stats, prop_odds_df, on='player_name')
    
    # Calculate hit rate & confidence score
    merged['rolling_hit_rate'] = (merged['mean'] > merged['line_points']).astype(int)
    merged['confidence_grade'] = np.where(
        (merged['mean'] - merged['line_points']) > 3.5, 'A+',
        np.where((merged['mean'] - merged['line_points']) > 1.5, 'A', 'B')
    )
    
    return merged[['player_name', 'mean', 'line_points', 'rolling_hit_rate', 'confidence_grade']]

# Executing near-real-time transformation
pipeline_output = compute_player_prop_edge(raw_nba_feed, live_odds_stream)`,
    output: {
      columns: ["player_name", "5G_mean_pts", "sportsbook_line", "hit_rate", "confidence_grade"],
      rows: [
        ["Luka Dončić", "34.8 pts", "31.5 pts", "80% (4/5)", "A+ (High Value Over)"],
        ["Nikola Jokić", "27.4 pts", "25.5 pts", "80% (4/5)", "A (Value Over)"],
        ["Shai Gilgeous-Alexander", "31.2 pts", "30.5 pts", "60% (3/5)", "B (Neutral)"],
        ["Giannis Antetokounmpo", "32.6 pts", "30.5 pts", "80% (4/5)", "A+ (High Value Over)"],
      ],
      metadata: {
        execTime: "9.8ms",
        rowsScanned: "1,250 game logs",
        anomalyCount: 4,
      },
    },
  },
];

export function QuerySimulator() {
  const [selectedScenario, setSelectedScenario] = useState<QueryScenario>(scenarios[0]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasExecuted, setHasExecuted] = useState<boolean>(true);

  const handleRunQuery = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasExecuted(true);
    }, 450);
  };

  return (
    <section id="terminal" className="py-28 px-6 md:px-12 bg-bg relative">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                04 — Interactive Data Terminal
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                Live Query<br />
                Workbench<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <p className="text-sm text-white/50 max-w-md">
              Interactive playground demonstrating production queries and data transformation logic from Sentinel and lasyly.me platforms.
            </p>
          </div>
        </Reveal>

        {/* Terminal Card */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border bg-surface-card overflow-hidden shadow-2xl">
            {/* Terminal Header */}
            <div className="px-6 py-4 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="font-mono text-xs text-white/40 ml-3">
                  avneesh@analytics-node:~/production-pipelines
                </span>
              </div>

              {/* Scenario Selector Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenario(sc);
                      setHasExecuted(true);
                    }}
                    className={`font-mono text-xs px-3 py-1 rounded-md transition-all ${
                      selectedScenario.id === sc.id
                        ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/40"
                        : "bg-surface-card text-white/50 hover:text-white border border-transparent"
                    }`}
                  >
                    {sc.engine}
                  </button>
                ))}
              </div>
            </div>

            {/* Description & Run Button */}
            <div className="px-6 py-3.5 bg-surface-hover/30 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-white/70">
                <span className="font-mono text-accent-cyan font-semibold">Context:</span>
                <span>{selectedScenario.description}</span>
              </div>

              <button
                onClick={handleRunQuery}
                disabled={isRunning}
                className="font-mono text-xs px-4 py-1.5 rounded-md bg-gradient-to-r from-accent-cyan to-accent-teal text-bg font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                    </svg>
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Execute Pipeline</span>
                    <span className="text-[10px] opacity-70">({selectedScenario.engine})</span>
                  </>
                )}
              </button>
            </div>

            {/* Terminal Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Code Panel */}
              <div className="lg:col-span-7 p-6 bg-[#090b10] border-b lg:border-b-0 lg:border-r border-border font-mono text-xs overflow-x-auto">
                <div className="text-white/30 mb-2 font-mono text-[11px]">Query Definition: {selectedScenario.name}</div>
                <pre className="text-slate-200 leading-relaxed whitespace-pre font-mono">
                  <code>{selectedScenario.code}</code>
                </pre>
              </div>

              {/* Execution Output Panel */}
              <div className="lg:col-span-5 p-6 bg-surface-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                    <span className="font-mono text-xs text-accent-emerald flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                      Status: 200 OK (Stream Active)
                    </span>
                    <span className="font-mono text-[11px] text-white/40">
                      Latency: {selectedScenario.output.metadata.execTime}
                    </span>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-2.5 rounded bg-surface border border-border/70">
                      <span className="font-mono text-[10px] text-white/40 block">Records Processed</span>
                      <span className="font-mono text-xs font-bold text-white">
                        {selectedScenario.output.metadata.rowsScanned}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-surface border border-border/70">
                      <span className="font-mono text-[10px] text-white/40 block">Flagged Signals</span>
                      <span className="font-mono text-xs font-bold text-accent-cyan">
                        {selectedScenario.output.metadata.anomalyCount} Critical Signals
                      </span>
                    </div>
                  </div>

                  {/* Output Table */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-surface/80">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-card text-white/40">
                          {selectedScenario.output.columns.map((col) => (
                            <th key={col} className="p-2.5 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScenario.output.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-b border-border/40 hover:bg-surface-hover/50 text-white/80 transition-colors"
                          >
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-2.5 whitespace-nowrap">
                                {typeof cell === "string" && cell.includes("CRITICAL") ? (
                                  <span className="text-red-400 font-semibold">{cell}</span>
                                ) : typeof cell === "string" && cell.includes("A+") ? (
                                  <span className="text-accent-emerald font-semibold">{cell}</span>
                                ) : typeof cell === "string" && cell.includes("CIRCULAR") ? (
                                  <span className="text-amber-400 font-semibold">{cell}</span>
                                ) : (
                                  cell
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 text-[11px] font-mono text-white/30 flex items-center justify-between">
                  <span>Engine: {selectedScenario.engine}</span>
                  <span className="text-accent-cyan">Output validated & live</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
