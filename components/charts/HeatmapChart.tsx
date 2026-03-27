'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HeatmapChartProps {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
  xTitle: string;
  yTitle: string;
  colorScale?: string[];
  valueFormatter?: (value: number) => string;
}

export function HeatmapChart({
  data,
  xLabels,
  yLabels,
  xTitle,
  yTitle,
  colorScale = ['#10b981', '#f59e0b', '#f43f5e'],
  valueFormatter = (v) => `${(v * 100).toFixed(1)}%`,
}: HeatmapChartProps) {
  // Find min and max for color scaling
  const allValues = data.flat();
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Get color for a value
  const getColor = (value: number) => {
    const normalized = (value - minValue) / valueRange;
    
    if (normalized <= 0.33) return colorScale[0];
    if (normalized <= 0.66) return colorScale[1];
    return colorScale[2];
  };

  // Get text color based on background brightness
  const getTextColor = (value: number) => {
    const normalized = (value - minValue) / valueRange;
    return normalized > 0.5 ? '#fff' : '#18181b';
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-zinc-100">
          Sensitivity Analysis
        </CardTitle>
        <p className="text-sm text-zinc-500">
          {yTitle} vs {xTitle}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Y-axis label */}
            <div className="flex items-center mb-2">
              <span className="text-xs text-zinc-500 w-24 text-right pr-2">{yTitle}</span>
              <div className="flex-1" />
            </div>

            {/* Heatmap grid */}
            <div className="flex">
              {/* Y labels */}
              <div className="w-24 pr-2 space-y-1">
                {yLabels.map((label, i) => (
                  <div
                    key={i}
                    className="h-10 flex items-center justify-end text-xs text-zinc-400"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex-1">
                {/* X labels */}
                <div className="flex mb-1">
                  {xLabels.map((label, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-xs text-zinc-400 px-1"
                      style={{ minWidth: '60px' }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Cells */}
                <div className="space-y-1">
                  {data.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1">
                      {row.map((value, colIndex) => (
                        <div
                          key={colIndex}
                          className="flex-1 h-10 rounded flex items-center justify-center text-xs font-medium transition-all hover:scale-105 hover:ring-2 hover:ring-zinc-600"
                          style={{
                            backgroundColor: getColor(value),
                            color: getTextColor(value),
                            minWidth: '60px',
                          }}
                          title={`${yLabels[rowIndex]} × ${xLabels[colIndex]}: ${valueFormatter(value)}`}
                        >
                          {valueFormatter(value)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* X-axis label */}
            <div className="flex items-center mt-2">
              <div className="w-24" />
              <div className="flex-1 text-center">
                <span className="text-xs text-zinc-500">{xTitle}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">Low</span>
              <div className="flex gap-1">
                {colorScale.map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs text-zinc-500">High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
