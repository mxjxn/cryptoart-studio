'use client'

import { useColorScheme } from '../contexts/ColorSchemeContext'

export function HueSlider() {
  const { hue, setHue } = useColorScheme()

  return (
    <div className="px-4 py-2 border-t border-[#333333]">
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text)' }}>
        <label htmlFor="hue-slider" className="min-w-[35px] uppercase whitespace-nowrap text-[#999999]">
          HUE
        </label>
        <input
          type="range"
          id="hue-slider"
          min="0"
          max="360"
          value={hue}
          step="1"
          onChange={(e) => setHue(parseInt(e.target.value, 10))}
          className="flex-1 h-1 min-w-[100px]"
          style={{ 
            minWidth: '100px',
            accentColor: `hsl(${hue}, 70%, 60%)`
          }}
        />
        <span className="min-w-[35px] text-right tabular-nums whitespace-nowrap text-[#999999]">{hue}°</span>
      </div>
    </div>
  )
}

