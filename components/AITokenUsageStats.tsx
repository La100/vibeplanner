"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from '@/components/providers/ProjectProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Zap, Database, TrendingUp, CheckCircle } from "lucide-react";

const AITokenUsageStats = () => {
  const { project } = useProject();
  
  const tokenUsage = useQuery(
    api.aiTokenUsage.getProjectTokenUsage,
    project ? { projectId: project._id, days: 30 } : "skip"
  );

  if (!project || !tokenUsage) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              AI Token Usage
            </CardTitle>
            <CardDescription>Loading usage statistics...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { summary, byMode, dailyBreakdown, recentRequests } = tokenUsage;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">AI Token Usage Statistics</h2>
        <p className="text-muted-foreground">Last 30 days • Project: {project.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {summary.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {summary.averageTokensPerRequest.toLocaleString()}/request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalCostUSD.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: ${(summary.averageCostPerRequest / 100).toFixed(4)}/request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Input vs Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {((summary.totalOutputTokens / summary.totalTokens) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalInputTokens.toLocaleString()} in / {summary.totalOutputTokens.toLocaleString()} out
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList>
          <TabsTrigger value="breakdown">Mode Breakdown</TabsTrigger>
          <TabsTrigger value="daily">Daily Usage</TabsTrigger>
          <TabsTrigger value="recent">Recent Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Full Mode
                </CardTitle>
                <CardDescription>Complete project data (small projects)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Requests:</span>
                    <span className="font-medium">{byMode.full.requests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens:</span>
                    <span className="font-medium">{byMode.full.tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost:</span>
                    <span className="font-medium">${(byMode.full.cost / 100).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg tokens/request:</span>
                    <span className="font-medium">
                      {byMode.full.requests > 0 ? Math.round(byMode.full.tokens / byMode.full.requests).toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Smart Mode
                </CardTitle>
                <CardDescription>Recent data + historical search (large projects)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Requests:</span>
                    <span className="font-medium">{byMode.smart.requests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tokens:</span>
                    <span className="font-medium">{byMode.smart.tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost:</span>
                    <span className="font-medium">${(byMode.smart.cost / 100).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg tokens/request:</span>
                    <span className="font-medium">
                      {byMode.smart.requests > 0 ? Math.round(byMode.smart.tokens / byMode.smart.requests).toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {byMode.full.requests > 0 && byMode.smart.requests > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Efficiency Comparison</CardTitle>
                <CardDescription>Smart Mode vs Full Mode performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(((byMode.full.tokens / byMode.full.requests) - (byMode.smart.tokens / byMode.smart.requests)) / (byMode.full.tokens / byMode.full.requests) * 100).toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">Token Reduction</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(((byMode.full.cost / byMode.full.requests) - (byMode.smart.cost / byMode.smart.requests)) / (byMode.full.cost / byMode.full.requests) * 100).toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">Cost Reduction</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {((byMode.smart.requests + byMode.full.requests) / summary.totalRequests * 100).toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">Smart Usage</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Breakdown</CardTitle>
              <CardDescription>Token usage over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dailyBreakdown.slice(0, 10).map((day: { date: string; requests: number; totalTokens: number; costCents: number; }) => (
                  <div key={day.date} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                      <div className="text-sm text-muted-foreground">{day.requests} requests</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{day.totalTokens.toLocaleString()} tokens</div>
                      <div className="text-sm text-muted-foreground">${(day.costCents / 100).toFixed(4)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Last 10 AI requests details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentRequests.map((request: { success: boolean; mode?: string; date: string; responseTime?: number; totalTokens: number; costCents?: number; inputTokens: number; outputTokens: number; }, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${request.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {request.mode === 'full' ? (
                              <>
                                <Database className="h-2 w-2 mr-1" />
                                Full
                              </>
                            ) : (
                              <>
                                <Zap className="h-2 w-2 mr-1" />
                                Smart
                              </>
                            )}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(request.date).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.responseTime ? `${request.responseTime}ms` : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{request.totalTokens.toLocaleString()} tokens</div>
                      <div className="text-sm text-muted-foreground">
                        ${((request.costCents || 0) / 100).toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AITokenUsageStats;







