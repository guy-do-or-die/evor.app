/**
 * Debug logger for approval scanner
 * Tracks scan execution and helps identify inconsistencies
 */

interface ScanDebugInfo {
  scanId: string
  timestamp: number
  address: string
  chain: string
  step: string
  data: any
}

class ScanDebugger {
  private logs: ScanDebugInfo[] = []
  private currentScanId: string | null = null

  startScan(address: string, chain: string): string {
    const scanId = `${address.slice(0, 8)}-${chain}-${Date.now()}`
    this.currentScanId = scanId
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔍 SCAN ${scanId} STARTED`)
    console.log(`${'='.repeat(80)}`)
    
    this.log('START', { address, chain })
    return scanId
  }

  log(step: string, data: any) {
    if (!this.currentScanId) return

    const entry: ScanDebugInfo = {
      scanId: this.currentScanId,
      timestamp: Date.now(),
      address: '',
      chain: '',
      step,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
    }
    
    this.logs.push(entry)
    
    // Pretty print
    console.log(`\n📍 STEP: ${step}`)
    console.log(JSON.stringify(data, null, 2))
  }

  endScan(scanId: string, result: { total: number; active: number; revoked: number }) {
    this.log('END', result)
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ SCAN ${scanId} COMPLETE`)
    console.log(`   Total: ${result.total} | Active: ${result.active} | Revoked: ${result.revoked}`)
    console.log(`${'='.repeat(80)}\n`)
    
    this.currentScanId = null
  }

  error(scanId: string, error: any) {
    this.log('ERROR', { error: error.message || String(error) })
    console.error(`\n❌ SCAN ${scanId} FAILED:`, error)
    this.currentScanId = null
  }

  compareLast(count: number = 2) {
    const scans = this.getLast(count)
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔬 COMPARING LAST ${count} SCANS`)
    console.log(`${'='.repeat(80)}`)
    
    scans.forEach((scan, i) => {
      const endLog = scan.find(l => l.step === 'END')
      console.log(`\nScan ${i + 1}: ${scan[0].scanId}`)
      console.log(`  Result:`, endLog?.data)
    })
  }

  private getLast(count: number) {
    const scanIds = [...new Set(this.logs.map(l => l.scanId))].slice(-count)
    return scanIds.map(id => this.logs.filter(l => l.scanId === id))
  }

  exportLastScan() {
    if (this.logs.length === 0) return null
    
    const lastScanId = this.logs[this.logs.length - 1].scanId
    const scanLogs = this.logs.filter(l => l.scanId === lastScanId)
    
    return {
      scanId: lastScanId,
      steps: scanLogs.map(l => ({ step: l.step, data: l.data }))
    }
  }
}

export const scanDebugger = new ScanDebugger()

// Make available in console for debugging
if (typeof window !== 'undefined') {
  (window as any).__scanDebugger = scanDebugger
}
