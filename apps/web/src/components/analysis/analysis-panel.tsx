'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGuideStore } from '@/stores/guide-store'
import { ScoreDisplay } from './score-display'
import { StructuralMetrics } from './structural-metrics'
import { SemanticTermsList } from './semantic-terms-list'
import { AvoidTermsList } from './avoid-terms-list'
import { SerpBenchmark } from './serp-benchmark'

export function AnalysisPanel() {
  const activeTab = useGuideStore((s) => s.activeTab)
  const setActiveTab = useGuideStore((s) => s.setActiveTab)

  return (
    <div className="h-full flex flex-col border-l">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="grid grid-cols-7 mx-2 mt-2">
          <TabsTrigger value="assistant" disabled className="text-xs">🤖</TabsTrigger>
          <TabsTrigger value="plan" disabled className="text-xs">📑</TabsTrigger>
          <TabsTrigger value="intention" disabled className="text-xs">🎯</TabsTrigger>
          <TabsTrigger value="optimization" className="text-xs">🔍</TabsTrigger>
          <TabsTrigger value="links" disabled className="text-xs">🔗</TabsTrigger>
          <TabsTrigger value="meta" disabled className="text-xs">🧐</TabsTrigger>
          <TabsTrigger value="config" disabled className="text-xs">🔧</TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <ScoreDisplay />
              <StructuralMetrics />
              <SemanticTermsList />
              <AvoidTermsList />
              <SerpBenchmark />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Placeholder tabs */}
        {['assistant', 'plan', 'intention', 'links', 'meta', 'config'].map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Module a venir</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
