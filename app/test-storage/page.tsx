'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Storage Test Page - Diagnose Safari blocking issues
 */
export default function TestStoragePage() {
  const [results, setResults] = useState<Record<string, any>>({})

  useEffect(() => {
    runTests()
  }, [])

  async function runTests() {
    const tests: Record<string, any> = {}

    // Test 1: localStorage write
    try {
      localStorage.setItem('test', 'value')
      localStorage.removeItem('test')
      tests.localStorage = '✅ Working'
    } catch (e: any) {
      tests.localStorage = `❌ Blocked: ${e.message}`
    }

    // Test 2: sessionStorage write
    try {
      sessionStorage.setItem('test', 'value')
      sessionStorage.removeItem('test')
      tests.sessionStorage = '✅ Working'
    } catch (e: any) {
      tests.sessionStorage = `❌ Blocked: ${e.message}`
    }

    // Test 3: Cookies
    try {
      document.cookie = 'test=value; path=/'
      const hasCookie = document.cookie.includes('test=value')
      document.cookie = 'test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      tests.cookies = hasCookie ? '✅ Working' : '⚠️ Partial (may be blocked)'
    } catch (e: any) {
      tests.cookies = `❌ Blocked: ${e.message}`
    }

    // Test 4: Private Browsing Detection
    try {
      // Try to use quota API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        tests.privateBrowsing = estimate.quota === 0 
          ? '⚠️ Possibly Private Browsing' 
          : '✅ Normal Mode'
        tests.quota = `${((estimate.quota || 0) / 1024 / 1024 / 1024).toFixed(2)} GB available`
      } else {
        tests.privateBrowsing = '❓ Cannot detect'
      }
    } catch (e: any) {
      tests.privateBrowsing = '❓ Cannot detect'
    }

    // Test 5: IndexedDB
    try {
      const request = indexedDB.open('test-db', 1)
      await new Promise((resolve, reject) => {
        request.onsuccess = resolve
        request.onerror = reject
      })
      indexedDB.deleteDatabase('test-db')
      tests.indexedDB = '✅ Working'
    } catch (e: any) {
      tests.indexedDB = `❌ Blocked: ${e.message}`
    }

    // Test 6: Third-party cookie settings
    tests.userAgent = navigator.userAgent
    tests.isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    
    setResults(tests)
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Storage & Privacy Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {Object.entries(results).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 border rounded">
                <span className="font-medium">{key}:</span>
                <span className={
                  String(value).includes('✅') ? 'text-green-600' : 
                  String(value).includes('❌') ? 'text-red-600' : 
                  'text-yellow-600'
                }>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-bold">Diagnosis:</h3>
            {results.localStorage?.includes('❌') && (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="font-bold text-red-900">⚠️ localStorage is BLOCKED</p>
                <p className="text-sm text-red-800 mt-2">
                  This is why Supabase auth is hanging. Safari's Intelligent Tracking Prevention is blocking storage.
                </p>
                <p className="text-sm text-red-800 mt-2">
                  <strong>Fix:</strong> Safari → Settings → Privacy → "Manage Website Data" → Remove localhost → Restart Safari
                </p>
              </div>
            )}
            
            {results.privateBrowsing?.includes('Private') && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-bold text-yellow-900">⚠️ You may be in Private Browsing mode</p>
                <p className="text-sm text-yellow-800 mt-2">
                  Private Browsing blocks localStorage completely. Exit Private Browsing to use the app.
                </p>
              </div>
            )}

            {results.isSafari && !results.localStorage?.includes('❌') && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="font-bold text-green-900">✅ Storage is working!</p>
                <p className="text-sm text-green-800 mt-2">
                  Safari storage is accessible. The login issue might be elsewhere.
                </p>
              </div>
            )}
          </div>

          <Button onClick={runTests} className="w-full">
            Re-run Tests
          </Button>

          <div className="text-center">
            <a href="/login" className="text-sm text-primary hover:underline">
              Back to Login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
