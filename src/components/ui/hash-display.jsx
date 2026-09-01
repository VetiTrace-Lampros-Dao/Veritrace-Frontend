import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

export function HashDisplay({ label, hash, icon, variant = 'crypto', className }) {
  const colors = {
    crypto: { bg: 'bg-[var(--arb-bg)]', text: 'text-[var(--accent)]', label: 'SHA', tooltip: 'Cryptographic hash used for byte-for-byte exact matches on the blockchain.' },
    perceptual: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--success-text)]', label: 'pHash', tooltip: 'Perceptual hash used to find visually similar content and detect modifications.' },
    semantic: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'SEM', tooltip: 'Vision Transformer 64-dimensional semantic embedding vector for AI style and heatmap feature matching.' },
    face: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'FACE', tooltip: 'ArcFace 128D/512D facial landmark geometry mesh for facial recognition and deepfake detection.' },
    audio: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'AUD', tooltip: 'MFCC & wav2vec2 acoustic spectral vector for voice clone and audio deepfake detection.' },
  }
  const v = colors[variant] || colors.crypto

  return (
    <div className={cn('p-3 rounded-xl bg-[var(--bg-2)] border border-[var(--border)]', className)}>
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-2 mb-1.5 cursor-help">
          {icon && (
            <span className={cn('flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold', v.bg, v.text)}>
              {icon}
            </span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="max-w-[200px] text-xs">{v.tooltip}</p>
        </TooltipContent>
      </Tooltip>
      {hash ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 hash-display text-[var(--text)]">{hash}</span>
          <CopyButton text={hash} />
        </div>
      ) : (
        <div className="hash-display text-[var(--text-4)] italic">Awaiting file upload...</div>
      )}
    </div>
  )
}
