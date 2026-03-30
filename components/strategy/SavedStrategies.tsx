'use client';

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  saveStrategy,
  getSavedStrategies,
  deleteStrategy,
  updateStrategyName,
  type SavedStrategy
} from '@/lib/saved-strategies'

interface SavedStrategiesProps {
  currentStrategy?: import('@/types/strategy').Strategy | null
  onLoadStrategy?: (strategy: SavedStrategy) => void
}

export function SavedStrategies({ currentStrategy, onLoadStrategy }: SavedStrategiesProps) {
  const [strategies, setStrategies] = useState<SavedStrategy[]>([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    setStrategies(getSavedStrategies())
  }, [])

  const handleSave = () => {
    if (!currentStrategy) return
    const saved = saveStrategy(currentStrategy, newName || undefined)
    setStrategies(prev => [...prev, saved])
    setNewName('')
  }

  const handleDelete = (id: string) => {
    deleteStrategy(id)
    setStrategies(prev => prev.filter(s => s.id !== id))
  }

  const handleRename = (id: string, name: string) => {
    updateStrategyName(id, name)
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  return (
    <div className="space-y-4">
      {/* Save Current Strategy */}
      {currentStrategy && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-300">Save Current Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Strategy name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#111] border-[#2a2a2a] text-sm"
            />
            <Button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Save Strategy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Saved Strategies List */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-300">
            Saved Strategies ({strategies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <p className="text-zinc-500 text-sm">No saved strategies</p>
          ) : (
            <div className="space-y-2">
              {strategies.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#1f1f1f]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{s.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {s.strategy.token0?.symbol}/{s.strategy.token1?.symbol} &bull;{' '}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLoadStrategy?.(s)}
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 text-xs"
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(s.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-950 text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
