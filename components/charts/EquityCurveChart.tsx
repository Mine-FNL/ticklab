'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EquityPoint } from '@/types';

interface EquityCurveChartProps {
  data: EquityPoint[];
  depositAmount: number;
}

export function EquityCurveChart({ data, depositAmount }: EquityCurveChartProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-400 text-sm mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-zinc-100">
          Equity Curve
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Position value over time vs HODL benchmark
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorHodl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDate}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={formatCurrency}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={depositAmount} stroke="#52525b" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="lpValue"
                name="LP Value"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorLp)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="hodlValue"
                name="HODL Value"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#colorHodl)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-zinc-400">LP Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-zinc-400">HODL Value</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
