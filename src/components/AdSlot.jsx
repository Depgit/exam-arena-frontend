import { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, AD_SLOTS, isInApp } from '../lib/ads'

/**
 * One AdSense display ad. Renders nothing until its slot ID is set in
 * lib/ads.js (AD_SLOTS), in development, and inside the Android app.
 * Never place one on a live-match screen.
 */
export default function AdSlot({ name }) {
  const slot = AD_SLOTS[name]
  const show = Boolean(slot) && import.meta.env.PROD && !isInApp()
  const pushed = useRef(false)

  useEffect(() => {
    if (!show || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // Ad blocker or script not loaded: the slot just stays empty.
    }
  }, [show])

  if (!show) return null
  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
