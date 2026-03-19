'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGuideStore } from '@/stores/guide-store'
import { ScoreDisplay } from './score-display'
import { StructuralMetrics } from './structural-metrics'
import { SemanticTermsList } from './semantic-terms-list'
import { AvoidTermsList } from './avoid-terms-list'
import { SerpBenchmark } from './serp-benchmark'
import { AssistantPanel } from './assistant-panel'
import { PlanPanel } from './plan-panel'
import { IntentionPanel } from './intention-panel'
import { LinksPanel } from './links-panel'
import { MetaPanel } from './meta-panel'
import { ConfigPanel } from './config-panel'

export function AnalysisPanel() {
  const activeTab = useGuideStore((s) => s.activeTab)
  const setActiveTab = useGuideStore((s) => s.setActiveTab)

  return (
    <div className="h-full flex flex-col border-l">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="grid grid-cols-7 mx-2 mt-2">
          <TabsTrigger value="assistant" className="text-xs">🤖</TabsTrigger>
          <TabsTrigger value="plan" className="text-xs">📑</TabsTrigger>
          <TabsTrigger value="intention" className="text-xs">🎯</TabsTrigger>
          <TabsTrigger value="optimization" className="text-xs">🔍</TabsTrigger>
          <TabsTrigger value="links" className="text-xs">🔗</TabsTrigger>
          <TabsTrigger value="meta" className="text-xs">🧐</TabsTrigger>
          <TabsTrigger value="config" className="text-xs">🔧</TabsTrigger>
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

        <TabsContent value="assistant" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <AssistantPanel />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="plan" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <PlanPanel />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="intention" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <IntentionPanel />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="links" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <LinksPanel />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="meta" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <MetaPanel />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="config" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <ConfigPanel />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
