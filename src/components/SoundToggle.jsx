import { useSettings } from '../context/SettingsContext'

/** Mute toggle — required by design_system.md §22 wherever sound can play. */
export default function SoundToggle({ className = '' }) {
  const { soundOn, toggleSound } = useSettings()

  return (
    <button
      type="button"
      className={`sound-toggle ${className}`}
      onClick={toggleSound}
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
      title={soundOn ? 'Sound on' : 'Sound off'}
    >
      <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
    </button>
  )
}
