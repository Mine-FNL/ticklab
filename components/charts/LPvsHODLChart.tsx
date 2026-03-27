'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LPvsHODLChartProps {
  data: Array<{
    priceChange: number;
    lpValue: number;
    hodlValue: number;
    fees: number;
    netReturn: number;
  }>;
  currentPriceChange?: number;
  depositAmount: number;
}

export function LPvsHODLChart({
  data,
  currentPriceChange = 0,
  depositAmount,
}: LPvsHODLChartProps) {
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-400 text-sm mb-2">
            Price Change: {formatPercent(label)}
          </p>
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
          LP vs HODL by Price Change
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Compare position value vs holding at different price scenarios
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="priceChange"
                tickFormatter={formatPercent}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={currentPriceChange}
                stroke="#10b981"
                strokeDasharray="5 5"
                label={{
                  value: 'Current',
                  fill: '#10b981',
                  fontSize: 12,
                  position: 'top',
                }}
              />
              <ReferenceLine y={depositAmount} stroke="#71717a" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="lpValue"
                name="LP Value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="hodlValue"
                name="HODL Value"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="netReturn"
                name="Net Return"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </ComposedChart>
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
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-zinc-400">Net Return</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
