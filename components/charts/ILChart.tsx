'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ILChartProps {
  data: Array<{
    priceChange: number;
    ilPercent: number;
  }>;
  currentPriceChange?: number;
}

export function ILChart({ data, currentPriceChange = 0 }: ILChartProps) {
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-400 text-sm mb-1">
            Price Change: {formatPercent(label)}
          </p>
          <p className="text-rose-400 text-sm font-medium">
            IL: {formatPercent(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Color based on IL severity
  const getBarColor = (value: number) => {
    if (value < 0.01) return '#10b981'; // Green for low IL
    if (value < 0.05) return '#f59e0b'; // Yellow for medium IL
    return '#f43f5e'; // Red for high IL
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-zinc-100">
          Impermanent Loss by Price Move
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Estimated divergence loss at different price scenarios
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="priceChange"
                tickFormatter={formatPercent}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatPercent}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" />
              <ReferenceLine
                x={currentPriceChange}
                stroke="#10b981"
                strokeDasharray="5 5"
              />
              <Bar dataKey="ilPercent" name="IL %" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.ilPercent)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-sm text-zinc-400">Low IL (&lt;1%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-sm text-zinc-400">Medium IL (1-5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-rose-500" />
            <span className="text-sm text-zinc-400">High IL (&gt;5%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
