"use client"

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Activity, Database, CreditCard, Mail, MessageSquare, Webhook, AlertTriangle } from 'lucide-react'
import { MetricsPanel } from '@/components/monitoring/MetricsPanel'
import { ErrorFeed } from '@/components/monitoring/ErrorFeed'
import { PerformancePanel } from '@/components/monitoring/PerformancePanel'

interface HealthCheck {
  status: string
  [key: string]: any
}

interface HealthData {
  timestamp: string
  overall: string
  checks: {
    database?: HealthCheck
    stripe?: HealthCheck
    email?: HealthCheck
    sms?: HealthCheck
    webhooks?: HealthCheck
    errors?: HealthCheck
  }
  responseTime?: number
}

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [errors, setErrors] = useState<any[]>([])
  const [performance, setPerformance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sentryConfigured, setSentryConfigured] = useState(true)

  const fetchAllData = useCallback(async () => {
    const startTime = Date.now()
    setRefreshing(true)
    
    try {
      console.log('[Monitoring] Starting refresh...')
      
      // Fetch health, metrics, errors, and performance in parallel
      const [healthRes, metricsRes, errorsRes, perfRes] = await Promise.all([
        fetch('/api/monitoring/health').catch(() => null),
        fetch('/api/monitoring/metrics').catch(() => null),
        fetch('/api/monitoring/errors').catch(() => null),
        fetch('/api/monitoring/performance').catch(() => null),
      ])

      if (healthRes?.ok) {
        const data = await healthRes.json()
        setHealth(data)
      }

      if (metricsRes?.ok) {
        const data = await metricsRes.json()
        setMetrics(data.metrics)
      }

      if (errorsRes?.ok) {
        const data = await errorsRes.json()
        setSentryConfigured(data.configured)
        setErrors(data.errors || [])
      } else {
        console.error('Failed to fetch errors:', errorsRes?.status)
      }

      if (perfRes?.ok) {
        const data = await perfRes.json()
        setPerformance(data.performance)
      }

      // Force state update with new Date
      const now = new Date()
      setLastUpdate(now)
      console.log(`[Monitoring] Refresh complete in ${Date.now() - startTime}ms`)
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      console.log('[Monitoring] Auto-refresh triggered')
      fetchAllData()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, fetchAllData])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'active':
        return 'bg-green-500'
      case 'ready':
        return 'bg-blue-500'
      case 'degraded':
      case 'warning':
        return 'bg-yellow-500'
      case 'unhealthy':
      case 'error':
      case 'critical':
      case 'down':
        return 'bg-red-500'
      case 'not_configured':
        return 'bg-gray-400'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'active':
        return '🟢'
      case 'ready':
        return '🔵'
      case 'degraded':
      case 'warning':
        return '⚠️'
      case 'unhealthy':
      case 'error':
      case 'critical':
      case 'down':
        return '🔴'
      case 'not_configured':
        return '⚙️'
      default:
        return '⚪'
    }
  }

  const getStatusLabel = (status: string, configured?: boolean) => {
    if (status === 'not_configured') return 'Not Configured'
    if (status === 'ready') return 'Ready'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatTimestamp = (date: Date) => {
    const now = Date.now()
    const then = date.getTime()
    const seconds = Math.floor((now - then) / 1000)
    
    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading monitoring data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Monitoring</h1>
          <p className="text-gray-600">
            Real-time health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Last updated: {formatTimestamp(lastUpdate)}
          </div>
          <Button
            onClick={() => {
              console.log('[Monitoring] Manual refresh clicked')
              fetchAllData()
            }}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Overall Status Banner */}
      {health && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${getStatusColor(health.overall)}`} />
                <div>
                  <h3 className="text-lg font-semibold capitalize">{health.overall}</h3>
                  <p className="text-sm text-gray-600">
                    All systems {health.overall === 'healthy' ? 'operational' : 'status'}
                  </p>
                </div>
              </div>
              {health.responseTime && (
                <Badge variant="outline">
                  Response: {health.responseTime}ms
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database Card */}
        {health?.checks.database && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  <CardTitle>Database</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.database.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.database.status)}>
                    {getStatusLabel(health.checks.database.status)}
                  </Badge>
                </div>
                {health.checks.database.responseTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-medium">{health.checks.database.responseTime}ms</span>
                  </div>
                )}
                {health.checks.database.rlsActive !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">RLS</span>
                    <span className="font-medium">{health.checks.database.rlsActive ? 'Active' : 'Inactive'}</span>
                  </div>
                )}
                {health.checks.database.message && (
                  <div className="text-xs text-gray-600 mt-2">
                    {health.checks.database.message}
                  </div>
                )}
                {health.checks.database.error && (
                  <div className="text-xs text-red-600 mt-2">
                    {health.checks.database.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stripe Card */}
        {health?.checks.stripe && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  <CardTitle>Stripe</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.stripe.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.stripe.status)}>
                    {getStatusLabel(health.checks.stripe.status)}
                  </Badge>
                </div>
                {health.checks.stripe.mode && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mode</span>
                    <span className="font-medium capitalize">{health.checks.stripe.mode}</span>
                  </div>
                )}
                {health.checks.stripe.responseTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-medium">{health.checks.stripe.responseTime}ms</span>
                  </div>
                )}
                {health.checks.stripe.message && (
                  <div className="text-xs text-gray-600 mt-2">
                    {health.checks.stripe.message}
                  </div>
                )}
                {health.checks.stripe.error && (
                  <div className="text-xs text-red-600 mt-2">
                    {health.checks.stripe.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Card */}
        {health?.checks.email && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  <CardTitle>Email</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.email.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.email.status)}>
                    {getStatusLabel(health.checks.email.status)}
                  </Badge>
                </div>
                {health.checks.email.message && (
                  <div className="text-xs text-gray-600 mt-2 italic">
                    {health.checks.email.message}
                  </div>
                )}
                {health.checks.email.successRate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-medium">{health.checks.email.successRate}%</span>
                  </div>
                )}
                {health.checks.email.sent24h !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sent (24h)</span>
                    <span className="font-medium">{health.checks.email.sent24h}</span>
                  </div>
                )}
                {health.checks.email.failed24h > 0 && (
                  <div className="flex justify-between text-sm text-yellow-600">
                    <span>Failed (24h)</span>
                    <span className="font-medium">{health.checks.email.failed24h}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SMS Card */}
        {health?.checks.sms && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  <CardTitle>SMS</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.sms.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.sms.status)}>
                    {getStatusLabel(health.checks.sms.status)}
                  </Badge>
                </div>
                {health.checks.sms.message && (
                  <div className="text-xs text-gray-600 mt-2 italic">
                    {health.checks.sms.message}
                  </div>
                )}
                {health.checks.sms.sent24h !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sent (24h)</span>
                    <span className="font-medium">{health.checks.sms.sent24h}</span>
                  </div>
                )}
                {health.checks.sms.failed24h > 0 && (
                  <div className="flex justify-between text-sm text-yellow-600">
                    <span>Failed (24h)</span>
                    <span className="font-medium">{health.checks.sms.failed24h}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Webhooks Card */}
        {health?.checks.webhooks && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  <CardTitle>Webhooks</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.webhooks.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.webhooks.status)}>
                    {getStatusLabel(health.checks.webhooks.status)}
                  </Badge>
                </div>
                {health.checks.webhooks.message && (
                  <div className="text-xs text-gray-600 mt-2 italic">
                    {health.checks.webhooks.message}
                  </div>
                )}
                {health.checks.webhooks.successRate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-medium">{health.checks.webhooks.successRate}%</span>
                  </div>
                )}
                {health.checks.webhooks.total24h !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total (24h)</span>
                    <span className="font-medium">{health.checks.webhooks.total24h}</span>
                  </div>
                )}
                {health.checks.webhooks.failed24h > 0 && (
                  <div className="flex justify-between text-sm text-yellow-600">
                    <span>Failed (24h)</span>
                    <span className="font-medium">{health.checks.webhooks.failed24h}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Rate Card */}
        {health?.checks.errors && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <CardTitle>Errors</CardTitle>
                </div>
                <span className="text-2xl">{getStatusIcon(health.checks.errors.status)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <Badge className={getStatusColor(health.checks.errors.status)}>
                    {getStatusLabel(health.checks.errors.status)}
                  </Badge>
                </div>
                {health.checks.errors.message && (
                  <div className="text-xs text-gray-600 mt-2 italic">
                    {health.checks.errors.message}
                  </div>
                )}
                {health.checks.errors.lastHour !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Hour</span>
                    <span className="font-medium">{health.checks.errors.lastHour}</span>
                  </div>
                )}
                {health.checks.errors.rate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rate</span>
                    <span className="font-medium">{health.checks.errors.rate}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Business Metrics & Error Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <MetricsPanel metrics={metrics} loading={loading} />
        <ErrorFeed errors={errors} loading={loading} configured={sentryConfigured} />
      </div>

      {/* Performance Panel */}
      <div className="mt-6">
        <PerformancePanel performance={performance} loading={loading} />
      </div>
    </div>
  )
}
