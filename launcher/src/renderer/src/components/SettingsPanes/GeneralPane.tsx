/**
 * Settings modal → General pane.
 *
 * Contents (D-10):
 *  - RAM slider (migrated from Phase 3 SettingsDrawer).
 *  - Open crash-reports folder shortcut → window.wiiwho.logs.openCrashFolder().
 *  - List recent crashes → window.wiiwho.logs.listCrashReports() (stub; full
 *    viewer already ships in Phase 3 CrashViewer).
 */
import type React from 'react'
import { RamSlider } from '../RamSlider'

export function GeneralPane(): React.JSX.Element {
  return (
    <div data-testid="general-pane" className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold text-neutral-200">General</h2>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Memory
        </h3>
        <RamSlider />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Logs &amp; Crashes
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void window.wiiwho.logs.openCrashFolder()
            }}
            className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open crash-reports folder
          </button>
          <button
            type="button"
            onClick={() => {
              void window.wiiwho.logs
                .listCrashReports()
                .then((r) => console.info('Crashes:', r))
            }}
            className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            List recent crashes
          </button>
        </div>
      </section>
    </div>
  )
}
