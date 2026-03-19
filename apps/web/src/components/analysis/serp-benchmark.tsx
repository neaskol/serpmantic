'use client'

import { useState } from 'react'
import { useGuideStore } from '@/stores/guide-store'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SortKey = 'position' | 'score' | 'words'

export function SerpBenchmark() {
  const pages = useGuideStore((s) => s.serpPages)
  const [sortBy, setSortBy] = useState<SortKey>('position')
  const [sortAsc, setSortAsc] = useState(true)

  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Lancez une analyse SERP pour voir le benchmark.</p>
  }

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(key)
      setSortAsc(true)
    }
  }

  const sorted = [...pages].sort((a, b) => {
    let aVal: number, bVal: number
    switch (sortBy) {
      case 'score':
        aVal = a.score; bVal = b.score; break
      case 'words':
        aVal = a.metrics.words; bVal = b.metrics.words; break
      default:
        aVal = a.position; bVal = b.position; break
    }
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  function SortButton({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSort(sortKey)}
        className="h-auto p-0 font-medium text-xs hover:bg-transparent"
      >
        {label}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    )
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold px-4 pt-3">Benchmark SERP</h3>
      <div className="px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <SortButton label="#" sortKey="position" />
              </TableHead>
              <TableHead>Page</TableHead>
              <TableHead className="w-16 text-right">
                <SortButton label="Score" sortKey="score" />
              </TableHead>
              <TableHead className="w-16 text-right">
                <SortButton label="Mots" sortKey="words" />
              </TableHead>
              <TableHead className="w-14 text-right">Titres</TableHead>
              <TableHead className="w-14 text-right">Liens</TableHead>
              <TableHead className="w-14 text-right">Img</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((page) => (
              <TableRow key={page.id} className={page.is_excluded ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs">{page.position}</TableCell>
                <TableCell>
                  <div className="max-w-[180px]">
                    <p className="font-medium text-xs truncate">{page.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{page.url}</p>
                    {page.is_excluded && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">exclu</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">{page.score}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.words}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.headings}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.links}</TableCell>
                <TableCell className="text-right font-mono text-xs">{page.metrics.images}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
