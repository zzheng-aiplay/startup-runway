import { useRef, useState } from 'react'
import { MAX_LINK_LENGTH, encodePlan } from '../state/share'
import { downloadPlan, readPlanFile } from '../state/planFile'
import type { Store } from '../state/store'
import { Banner, QuietButton, TextButton } from './primitives'

/**
 * Three ways to keep a plan, none of which involves an account or a server.
 *
 * The link carries the plan in the URL fragment, which browsers never send to the
 * host — so a shared plan does not touch this site, its logs, or anyone else's.
 * The file is plain JSON on your own disk. And the plan you are looking at is
 * already saved in this browser as you type.
 */
export function SavePlan({ store }: { store: Store }) {
  const [copied, setCopied] = useState<'ok' | 'long' | 'failed' | null>(null)
  const [fileError, setFileError] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const copyLink = async () => {
    const token = await encodePlan(store.state)
    if (token.length > MAX_LINK_LENGTH) {
      setCopied('long')
      return
    }
    const link = `${window.location.origin}${window.location.pathname}#plan=${token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied('ok')
    } catch {
      // Clipboard access can be refused; the plan is still in the address bar.
      window.location.hash = `plan=${token}`
      setCopied('failed')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <QuietButton primary glyph="⧉" onClick={copyLink}>
          Copy a link to this plan
        </QuietButton>
        <QuietButton glyph="↓" onClick={() => downloadPlan(store.state)}>
          Download it as a file
        </QuietButton>
        <QuietButton glyph="↑" onClick={() => input.current?.click()}>
          Open a plan file
        </QuietButton>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Open a plan file"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const plan = await readPlanFile(file)
            if (plan) {
              store.adoptPlan(plan)
              setFileError(false)
            } else {
              setFileError(true)
            }
          }}
        />
      </div>

      <p className="t-small mt-2 max-w-[68ch]">
        Your plan is already saved in this browser as you type. A link carries it in the part of the
        URL that never reaches a server, so it stays as private as wherever you paste it — and it is
        in your browser history. Nothing is encrypted and nothing is uploaded.
      </p>

      {copied === 'ok' && (
        <Banner tone="info" heading="Copied">
          The link holds the whole plan — all three scenarios. Anyone who opens it sees these
          numbers, so treat it like the numbers themselves.
        </Banner>
      )}
      {copied === 'long' && (
        <Banner tone="warn">
          This plan has grown too long for a link that survives most chat apps. Download it as a file
          instead.
        </Banner>
      )}
      {copied === 'failed' && (
        <Banner tone="info" heading="Copy it from the address bar">
          This browser would not let the page write to your clipboard, so the plan is in the URL
          above instead.
        </Banner>
      )}
      {fileError && (
        <Banner tone="error">
          That file is not a plan this app wrote. Nothing was changed.
        </Banner>
      )}
    </div>
  )
}

/** Shown when a plan arrived from a link or a file and displaced the one that was here. */
export function ReplacedPlanNotice({ store }: { store: Store }) {
  if (!store.replaced) return null
  return (
    <Banner tone="info" heading="Opened a plan">
      This replaced the plan that was in this browser.{' '}
      <TextButton onClick={store.restoreReplaced}>Put the old one back</TextButton>{' '}
      <TextButton onClick={store.dismissReplaced}>Keep this one</TextButton>
    </Banner>
  )
}
