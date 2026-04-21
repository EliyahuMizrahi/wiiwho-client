import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Renderer-side security assertions — fire on page load. If the launcher's
// BrowserWindow ever regresses on contextIsolation/nodeIntegration/sandbox,
// one of these will fail loudly in the console.
console.assert(
  typeof (globalThis as unknown as { process?: unknown }).process ===
    'undefined',
  'SECURITY: process is defined in renderer — nodeIntegration is NOT off'
)
console.assert(
  typeof (globalThis as unknown as { require?: unknown }).require ===
    'undefined',
  'SECURITY: require is defined in renderer — contextIsolation or sandbox is NOT set'
)

function App(): React.JSX.Element {
  const handlePlay = async (): Promise<void> => {
    const result = await window.wiiwho.game.play()
    // Phase 1: { ok: true, stub: true, reason: 'Phase 1 scaffold ...' }
    console.log('Play clicked:', result)
  }

  useEffect(() => {
    ;(async (): Promise<void> => {
      const audit = await window.wiiwho.__debug.securityAudit()
      console.log('Security audit:', audit)
    })()
  }, [])

  return (
    <div className="h-screen w-screen bg-neutral-900 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-[#16e0ee] mb-8">Wiiwho Client</h1>
      <Button
        size="lg"
        className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-xl px-12 py-6"
        onClick={handlePlay}
      >
        Play
      </Button>
      <p className="text-neutral-500 text-sm mt-8">v0.1.0-dev</p>
    </div>
  )
}

export default App
