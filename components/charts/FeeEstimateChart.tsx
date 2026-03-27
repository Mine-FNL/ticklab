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
  ErrorBar,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeeEstimateResult } from '@/types';

interface FeeEstimateChartProps {
  estimates: FeeEstimateResult;
  horizonDays: number;
  depositAmount: number;
}

export function FeeEstimateChart({
  estimates,
  horizonDays,
  depositAmount,
}: FeeEstimateChartProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const formatPercent = (value: number) =>
    `${((value / depositAmount) * 100).toFixed(2)}%`;

  // Create data for different scenarios
  const data = [
    {
      scenario: 'Conservative',
      value: estimates.min,
      error: [(estimates.base - estimates.min) / 2],
      color: '#f43f5e',
    },
    {
      scenario: 'Base Case',
      value: estimates.base,
      error: [(estimates.max - estimates.min) / 4],
      color: '#3b82f6',
    },
    {
      scenario: 'Optimistic',
      value: estimates.max,
      error: [(estimates.max - estimates.base) / 2],
      color: '#10b981',
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-100 font-medium mb-1">{item.scenario}</p>
          <p className="text-zinc-400 text-sm">
            Estimated Fees: {formatCurrency(item.value)}
          </p>
          <p className="text-zinc-500 text-sm">
            ({formatPercent(item.value)} over {horizonDays} days)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-zinc-100">
          Fee Estimates by Scenario
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Projected fee income across different volume scenarios
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="scenario"
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                stroke="#71717a"
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <ErrorBar dataKey="error" width={8} stroke="#71717a" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800">
          <div className="text-center">
            <p className="text-rose-400 font-semibold">{formatCurrency(estimates.min)}</p>
            <p className="text-xs text-zinc-500">Conservative</p>
          </div>
          <div className="text-center">
            <p className="text-blue-400 font-semibold">{formatCurrency(estimates.base)}</p>
            <p className="text-xs text-zinc-500">Base Case</p>
          </div>
          <div className="text-center">
            <p className="text-emerald-400 font-semibold">{formatCurrency(estimates.max)}</p>
            <p className="text-xs text-zinc-500">Optimistic</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
