import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircleCheck as CheckCircle2, Search, TriangleAlert as AlertTriangle, Lock, Cloud, ExternalLink } from 'lucide-react'
import { ARBITRUM_SEPOLIA, CORE_BACKEND_API, HASH_ENGINE_API } from '../config'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { EmptyState } from './ui/empty-state'
import { Modal, ModalHeader } from './ui/modal'
import { toast } from 'sonner'
import { downloadCertificate } from '../utils/generateCertificate'

const heatmapMemoryCache = new Map()
const activeHeatmapJobs = new Map()

export default function SearchResults({ results, loading, uploadedFile }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const [comparisonMatch, setComparisonMatch] = useState(null)
  const [heatmapBase64, setHeatmapBase64] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [resolvedOriginalUrl, setResolvedOriginalUrl] = useState(null)
  const [resolvedMediaType, setResolvedMediaType] = useState('image')
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [uploadingLegacy, setUploadingLegacy] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const handleDownloadCert = async () => {
    if (!comparisonMatch) return
    const txObj = {
      sha256: comparisonMatch.sha256Hash || comparisonMatch.sha256_hash || comparisonMatch.sha256,
      hash: comparisonMatch.onChainTxHash || comparisonMatch.on_chain_tx_hash || comparisonMatch.txHash,
      mediaS3Url: comparisonMatch.mediaS3Url,
      mediaIpfsUrl: comparisonMatch.mediaIpfsUrl
    }
    toast.loading('Generating cryptographic authenticity certificate...', { id: 'cert' })
    try {
      await downloadCertificate(txObj, comparisonMatch.creator || comparisonMatch.creatorAddress || comparisonMatch.creator_address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', CORE_BACKEND_API)
      toast.success('Certificate downloaded successfully!', { id: 'cert' })
    } catch (e) {
      toast.error('Failed to generate certificate: ' + e.message, { id: 'cert' })
    }
  }

  useEffect(() => {
    if (!uploadedFile || (!uploadedFile.type?.startsWith('image/') && !uploadedFile.type?.startsWith('video/'))) { setLocalPreviewUrl(null); return }
    const url = URL.createObjectURL(uploadedFile)
    setLocalPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [uploadedFile])

  const getGatewayUrl = (url) => { if (!url || typeof url !== 'string') return null; if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`; return url }

  useEffect(() => {
    if (!comparisonMatch) { setResolvedOriginalUrl(null); setResolvedMediaType('image'); setLoadingOriginal(false); return }
    const { mediaS3Url, mediaIpfsUrl, ipfsCid, mediaType, sha256, assetId } = comparisonMatch
    const hashKey = (sha256 || assetId || '').toLowerCase()
    const cachedMediaStr = localStorage.getItem(`vt_media_${hashKey}`)
    if (cachedMediaStr) { try { const cached = JSON.parse(cachedMediaStr); if (cached.media_ipfs_url || cached.media_s3_url) { setResolvedOriginalUrl(getGatewayUrl(cached.media_s3_url || cached.media_ipfs_url)); setResolvedMediaType(cached.media_type || mediaType || 'image'); return } } catch {} }
    const cachedUrl = localStorage.getItem(`vt_legacy_${hashKey}`)
    if (cachedUrl) { setResolvedOriginalUrl(getGatewayUrl(cachedUrl)); setResolvedMediaType(mediaType || 'image'); return }
    const initialUrl = getGatewayUrl(mediaS3Url) || getGatewayUrl(mediaIpfsUrl)
    if (initialUrl) { setResolvedOriginalUrl(initialUrl); setResolvedMediaType(mediaType || 'image'); return }
    if (ipfsCid && ipfsCid !== '' && !ipfsCid.startsWith('QmYourMetadataCid')) {
      setLoadingOriginal(true)
      const fetchMetadata = async () => {
        try { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 4000); const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`, { signal: controller.signal }); clearTimeout(timeoutId); if (res.ok) { const meta = await res.json(); setResolvedOriginalUrl(getGatewayUrl(meta.media_s3_url || meta.media_ipfs_url)); setResolvedMediaType(meta.media_type || mediaType || 'image') } } catch {} finally { setLoadingOriginal(false) }
      }
      fetchMetadata()
    } else { setResolvedOriginalUrl(null); setResolvedMediaType(mediaType || 'image'); setLoadingOriginal(false) }
  }, [comparisonMatch])

  const handleViewAlterations = useCallback(async () => {
    if (!uploadedFile || !resolvedOriginalUrl) return
    const cacheKey = `vt_heatmap_${uploadedFile.name}_${uploadedFile.size}_${resolvedOriginalUrl}`

    // 1. Check in-memory cache
    if (heatmapMemoryCache.has(cacheKey)) {
      const data = heatmapMemoryCache.get(cacheKey)
      setHeatmapBase64(data.heatmap_base64)
      if (data.similarity !== undefined && data.similarity < 100) {
        setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: data.similarity }) : null)
      } else if (data.altered_percentage !== undefined && data.altered_percentage > 0) {
        const visualSim = Math.max(10, Math.min(98.5, 100 - data.altered_percentage))
        setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: visualSim }) : null)
      }
      setHeatmapLoading(false)
      return
    }

    // 2. Check sessionStorage
    try {
      const sessionCached = sessionStorage.getItem(cacheKey)
      if (sessionCached) {
        const data = JSON.parse(sessionCached)
        heatmapMemoryCache.set(cacheKey, data)
        setHeatmapBase64(data.heatmap_base64)
        if (data.similarity !== undefined && data.similarity < 100) {
          setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: data.similarity }) : null)
        } else if (data.altered_percentage !== undefined && data.altered_percentage > 0) {
          const visualSim = Math.max(10, Math.min(98.5, 100 - data.altered_percentage))
          setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: visualSim }) : null)
        }
        setHeatmapLoading(false)
        return
      }
    } catch {}

    setHeatmapLoading(true)

    // 3. Attach to existing job or spawn a new background job
    let jobPromise = activeHeatmapJobs.get(cacheKey)
    if (!jobPromise) {
      jobPromise = (async () => {
        const res = await fetch(resolvedOriginalUrl)
        const blob = await res.blob()
        const fd = new FormData()
        fd.append('file1', blob, 'original.jpg')
        fd.append('file2', uploadedFile)
        const compareRes = await fetch(`https://api.hash.veritrace.dpkvtrading.online/api/v1/compare`, { method: 'POST', body: fd })
        if (!compareRes.ok) throw new Error('Compare failed')
        const data = await compareRes.json()
        heatmapMemoryCache.set(cacheKey, data)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {}
        return data
      })().finally(() => {
        activeHeatmapJobs.delete(cacheKey)
      })
      activeHeatmapJobs.set(cacheKey, jobPromise)
    }

    try {
      const data = await jobPromise
      setHeatmapBase64(data.heatmap_base64)
      if (data.similarity !== undefined && data.similarity < 100) {
        setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: data.similarity }) : null)
      } else if (data.altered_percentage !== undefined && data.altered_percentage > 0) {
        const visualSim = Math.max(10, Math.min(98.5, 100 - data.altered_percentage))
        setComparisonMatch(prev => prev ? ({ ...prev, visualSimilarity: visualSim }) : null)
      }
    } catch (err) {
      console.error('Heatmap analysis error:', err)
    } finally {
      setHeatmapLoading(false)
    }
  }, [uploadedFile, resolvedOriginalUrl])

  useEffect(() => {
    if (resolvedOriginalUrl && uploadedFile && resolvedMediaType === 'image') handleViewAlterations()
    else setHeatmapBase64(null)
  }, [resolvedOriginalUrl, uploadedFile, resolvedMediaType, handleViewAlterations])

  const handleArchiveLegacy = async () => {
    if (!uploadedFile || !comparisonMatch) return
    setUploadingLegacy(true)
    try {
      const formData = new FormData(); formData.append('file', uploadedFile)
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/pin-file`, { method: 'POST', body: formData })
      if (res.ok) { const data = await res.json(); const mediaUrl = data.media_s3_url || data.media_ipfs_url; if (mediaUrl) { const hashKey = (comparisonMatch.sha256 || comparisonMatch.assetId || '').toLowerCase(); localStorage.setItem(`vt_media_${hashKey}`, JSON.stringify({ sha256: hashKey, media_ipfs_url: data.media_ipfs_url, media_s3_url: data.media_s3_url, media_type: comparisonMatch.mediaType || 'image' })); localStorage.setItem(`vt_legacy_${hashKey}`, mediaUrl); setResolvedOriginalUrl(getGatewayUrl(mediaUrl)) } }
    } catch {} finally { setUploadingLegacy(false) }
  }

  const handleAnalyzeSync = async () => {
    if (!uploadedFile) return
    setSyncLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadedFile)
      const res = await fetch(`${HASH_ENGINE_API}/api/v1/analyze_sync`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setSyncResult(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSyncLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-stretch rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="w-1 bg-[var(--bg-3)]" />
            <div className="flex-1 p-3.5"><div className="skeleton h-3.5 rounded w-70% mb-2" /><div className="skeleton h-2.5 rounded w-50%" /></div>
            <div className="p-3.5"><div className="skeleton w-10 h-10 rounded-full" /></div>
          </div>
        ))}
      </div>
    )
  }

  if (!results) return <EmptyState icon={<Search size={28} />} title="Upload a file to search" description="We'll check for exact SHA-256 matches and visually similar content in the registry." />
  if (results.length === 0) return <EmptyState icon={<CheckCircle2 size={28} />} title="No matches found" description="This content hasn't been registered yet. You can be the first to register it!" />

  // Identify the earliest registered match
  let earliestMatchHash = null
  if (results && results.length > 0) {
    let earliestTime = Infinity
    for (const r of results) {
      if (r.registeredAt) {
        const t = new Date(r.registeredAt).getTime()
        if (!isNaN(t) && t < earliestTime) {
          earliestTime = t
          earliestMatchHash = r.sha256
        }
      }
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {results.map((result, index) => (
          <MatchCard 
            key={index} 
            result={result} 
            isEarliest={result.sha256 === earliestMatchHash}
            onSelect={() => setComparisonMatch(result)} 
          />
        ))}
      </div>

      {/* Inline Expanded Details — no modal */}
      {comparisonMatch && (
        <div className="mt-4 bg-[var(--surface)] border border-[var(--border-2)] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-2)]">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text)]">
              <Search size={16} className="text-[var(--accent)]" /> Authenticity Check — {(comparisonMatch.matchType === 'exact' ? 100 : (comparisonMatch.visualSimilarity || (comparisonMatch.similarity >= 100 ? 92.5 : comparisonMatch.similarity)))?.toFixed(1)}% Match
            </h3>
            <button onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); setSyncResult(null) }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors text-lg">×</button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* 3 Image Previews */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">Your Upload</div>
                <div className="aspect-[4/3] bg-[var(--bg-2)] rounded-xl border border-[var(--border)] overflow-hidden flex items-center justify-center cursor-pointer group" onClick={() => setLightboxOpen(true)}>
                  {uploadedFile?.type?.startsWith('video/') ? (
                    <video src={localPreviewUrl} className="w-full h-full object-contain" />
                  ) : localPreviewUrl ? (
                    <img src={localPreviewUrl} alt="Uploaded" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="text-xs text-[var(--text-3)]">No preview</span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-[var(--accent)] truncate">{comparisonMatch.assetId}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">On-Chain Match</div>
                <div className="aspect-[4/3] bg-[var(--bg-2)] rounded-xl border border-[var(--border)] overflow-hidden flex items-center justify-center cursor-pointer group" onClick={() => setLightboxOpen(true)}>
                  {loadingOriginal ? (
                    <Spinner />
                  ) : resolvedOriginalUrl ? (
                    resolvedMediaType === 'video' ? (
                      <video src={resolvedOriginalUrl} className="w-full h-full object-contain" />
                    ) : (
                      <img src={resolvedOriginalUrl} alt="Matched" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                    )
                  ) : (
                    <div className="text-center p-3"><Lock size={20} className="text-[var(--text-3)] mx-auto mb-1" /><div className="text-[10px] text-[var(--text-3)]">Not Archived</div></div>
                  )}
                </div>
                <div className="text-[10px] text-[var(--text-3)] truncate">{comparisonMatch.creator ? `${comparisonMatch.creator.slice(0, 8)}...${comparisonMatch.creator.slice(-6)}` : 'Unknown'} · {comparisonMatch.registeredAt}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF4D4D]">Pixel Diff Heatmap</div>
                <div className={`aspect-[4/3] rounded-xl border overflow-hidden flex items-center justify-center cursor-pointer group ${heatmapBase64 ? 'bg-[#FF4D4D]/5 border-[#FF4D4D]/20' : 'bg-[var(--bg-2)] border-dashed border-[var(--border)]'}`} onClick={() => heatmapBase64 && setLightboxOpen(true)}>
                  {heatmapLoading ? (
                    <div className="text-center"><Spinner /><div className="text-[10px] text-[var(--text-3)] mt-1">Analyzing...</div></div>
                  ) : heatmapBase64 ? (
                    <img src={heatmapBase64} alt="Heatmap" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="text-center p-3"><AlertTriangle size={20} className="text-[var(--text-3)] mx-auto mb-1" /><div className="text-[10px] text-[var(--text-3)]">{resolvedMediaType !== 'image' ? 'Images only' : 'Unavailable'}</div></div>
                  )}
                </div>
                <div className="text-[10px] text-[var(--text-3)]">{heatmapLoading ? 'Generating...' : heatmapBase64 ? 'Click to compare' : ''}</div>
              </div>
            </div>

            {/* Confidence & Badges */}
            {comparisonMatch.confidenceTier && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                Confidence: <span className="font-semibold text-[var(--success-text, #4CAF50)]">{comparisonMatch.confidenceScore?.toFixed(0)}% ({comparisonMatch.confidenceTier})</span>
                {(comparisonMatch.consensusCount || comparisonMatch.consensus_count) > 1 && (
                  <span className="text-emerald-400 font-semibold">🤝 {(comparisonMatch.consensusCount || comparisonMatch.consensus_count)} consensus</span>
                )}
              </div>
            )}

            {/* Temporal Integrity & Deepfake Sync */}
            {(comparisonMatch.temporalIntegrity !== undefined || comparisonMatch.mediaType === 'video') && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                {comparisonMatch.temporalIntegrity !== undefined && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)] mb-1">Temporal Sequence Integrity (DTW)</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={comparisonMatch.temporalIntegrity > 90 ? 'success' : 'danger'}>{comparisonMatch.temporalIntegrity.toFixed(1)}%</Badge>
                        <span className="text-xs text-[var(--text-3)]">{comparisonMatch.temporalIntegrity > 90 ? 'Video sequence matches original temporally.' : 'Video may be chopped, reversed, or sped-up!'}</span>
                      </div>
                    </div>
                  </div>
                )}
                {comparisonMatch.mediaType === 'video' && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)] mb-1">Deepfake Audio-Visual Sync</div>
                        <div className="text-xs text-[var(--text-3)]">Analyze lip movements and audio to detect AI voice-swaps.</div>
                      </div>
                      {syncResult ? (
                        <div className="text-right">
                          <Badge variant={syncResult.is_deepfake ? 'danger' : 'success'}>
                            {syncResult.is_deepfake ? 'DEEPFAKE DETECTED' : 'Sync Normal'}
                          </Badge>
                          <div className="text-[10px] text-[var(--text-3)] mt-1">Score: {syncResult.sync_score?.toFixed(2)}</div>
                        </div>
                      ) : (
                        <Button size="sm" onClick={handleAnalyzeSync} disabled={syncLoading}>
                          {syncLoading ? <Spinner /> : 'Run AI Analysis'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-3 border-t border-[var(--border)] pt-3">
              <Button variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]" onClick={handleDownloadCert}>
                📥 Download Certificate
              </Button>
              <Button variant="primary" onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); setSyncResult(null) }}>
                Back to Results
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — 2 on top, heatmap below */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/92 backdrop-blur-md flex items-center justify-center p-3" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" onClick={() => setLightboxOpen(false)}>×</button>
          <div className="flex flex-col items-center gap-2.5 max-w-[95vw] max-h-[95vh] w-full justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Top row: 2 images side-by-side */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-4xl justify-center items-center">
              {localPreviewUrl && (
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className="h-[37vh] w-full flex items-center justify-center bg-black/40 rounded-xl border border-white/10 p-1.5 overflow-hidden">
                    <img src={localPreviewUrl} alt="Uploaded" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
                  </div>
                  <span className="text-white/70 text-[11px] font-bold uppercase tracking-wider">Your Upload</span>
                </div>
              )}
              {resolvedOriginalUrl && (
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className="h-[37vh] w-full flex items-center justify-center bg-black/40 rounded-xl border border-white/10 p-1.5 overflow-hidden">
                    <img src={resolvedOriginalUrl} alt="Original" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
                  </div>
                  <span className="text-white/70 text-[11px] font-bold uppercase tracking-wider">On-Chain Match</span>
                </div>
              )}
            </div>

            {/* Bottom row: Pixel Diff Heatmap */}
            {heatmapBase64 && (
              <div className="flex flex-col items-center gap-1 w-full max-w-lg">
                <div className="h-[37vh] w-full flex items-center justify-center bg-red-950/20 rounded-xl border border-red-500/30 p-1.5 overflow-hidden shadow-2xl">
                  <img src={heatmapBase64} alt="Heatmap" className="max-h-full max-w-full object-contain rounded-lg" />
                </div>
                <span className="text-[#FF4D4D] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF4D4D] animate-pulse" /> Pixel Diff Heatmap
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MatchCard({ result, onSelect, isEarliest }) {
  const isExact = result.matchType === 'exact'
  const isDeepfake = result.matchType === 'deepfake' || result.isDeepfake
  const isAudioDeepfake = result.isAudioDeepfake
  const rawPercentage = result.similarity || 0
  const percentage = isExact ? 100 : (rawPercentage >= 100 ? 92.5 : rawPercentage)
  const getGatewayUrl = (url) => { if (!url || typeof url !== 'string') return null; return url.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${url.slice(7)}` : url }
  const isLegacy = !result.ipfsCid || result.ipfsCid === '' || (typeof result.ipfsCid === 'string' && result.ipfsCid.startsWith('QmYourMetadataCid'))
  const previewUrl = getGatewayUrl(result.mediaS3Url) || getGatewayUrl(result.mediaIpfsUrl)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} onClick={onSelect} className="flex items-stretch rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden cursor-pointer hover:border-[var(--border-2)] hover:shadow-md transition-all group">
      <div className="w-1 flex-shrink-0" style={{ background: isExact ? 'var(--success-text, #4CAF50)' : isDeepfake ? '#FF4D4D' : '#FF9B00' }} />
      <div className="flex items-center justify-center p-3 flex-shrink-0">
        {!previewUrl ? <div className="w-[140px] h-[95px] rounded-lg border border-[var(--border)] bg-[var(--bg-2)] flex items-center justify-center text-[10px] text-[var(--text-3)] text-center p-2 leading-tight">{isLegacy ? 'No preview (Legacy)' : 'Click to compare'}</div> : <img src={previewUrl} alt="Match" className="w-[140px] h-[95px] object-cover rounded-lg border border-[var(--border)] bg-[var(--bg-2)]" onError={(e) => { if (result.assetId && e.target.src !== `https://s3.veritrace.dpkvtrading.online/veritrace/${result.assetId}`) { e.target.src = `https://s3.veritrace.dpkvtrading.online/veritrace/${result.assetId}` } else { e.target.style.display = 'none' } }} />}
      </div>
      <div className="flex-1 p-3.5 flex flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isExact ? 'success' : isDeepfake ? 'danger' : 'warning'}>{isExact ? <><CheckCircle2 size={10} /> Exact Match</> : isDeepfake ? 'DEEPFAKE DETECTED' : '≈ Similar'}</Badge>
          {isAudioDeepfake && <Badge variant="danger" className="ml-1">AUDIO DEEPFAKE</Badge>}
          {isEarliest && <Badge variant="success" className="ml-1 bg-[var(--accent)] hover:bg-[var(--accent)] text-white border-none">Earliest Registry</Badge>}
          {result.confidenceTier && (
            <Badge variant={result.confidenceTier === 'High' ? 'success' : result.confidenceTier === 'Medium' ? 'warning' : 'danger'} className="ml-1">
              Confidence: {result.confidenceTier} ({result.confidenceScore?.toFixed(0)}%)
            </Badge>
          )}
          {(result.isPublisherVerified || result.is_publisher_verified) && (
            <Badge variant="success" className="ml-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 flex items-center gap-1 font-bold">
              ✓ Verified Source: {result.publisherName || result.publisher_name || 'Official Outlet'}
            </Badge>
          )}
          {(result.consensusCount || result.consensus_count) > 1 && (
            <Badge variant="success" className="ml-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
              🤝 Consensus: {(result.consensusCount || result.consensus_count)} Creators
            </Badge>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">{result.mediaType || 'unknown'}</span>
        </div>
        {result.assetId && <div className="text-xs"><span className="text-[var(--text-3)]">Asset: </span><span className="font-mono text-[var(--accent)]">{result.assetId}</span></div>}
        {result.creator && <div className="text-xs"><span className="text-[var(--text-3)]">Creator: </span><a href={`${ARBITRUM_SEPOLIA.explorer}/address/${result.creator}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[var(--accent)] hover:opacity-80" onClick={(e) => e.stopPropagation()}>{result.creator.slice(0, 10)}...{result.creator.slice(-6)}</a></div>}
        {result.registeredAt && <div className="text-xs text-[var(--text-3)]">Registered: {result.registeredAt}</div>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {result.mediaS3Url && <a href={getGatewayUrl(result.mediaS3Url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--success-text, #4CAF50)]/10 hover:bg-[var(--success-text, #4CAF50)]/20 text-[var(--success-text, #4CAF50)] rounded-md text-[11px] font-bold border border-[var(--success-text, #4CAF50)]/20 transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> S3 Media</a>}
          {result.mediaIpfsUrl && <a href={getGatewayUrl(result.mediaIpfsUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] rounded-md text-[11px] font-bold border border-[var(--accent)]/20 transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> IPFS Media</a>}
          {result.ipfsCid && <a href={`https://gateway.pinata.cloud/ipfs/${result.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-3)] hover:bg-[var(--border)] text-[var(--text-2)] rounded-md text-[11px] font-bold border border-[var(--border)] transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> IPFS JSON</a>}
        </div>
      </div>
      <div className="flex items-center justify-center px-5 flex-shrink-0">
        <div className="text-center">
          <div className="text-xl font-extrabold" style={{ color: isExact ? 'var(--success-text, #4CAF50)' : isDeepfake ? '#FF4D4D' : percentage >= 80 ? '#FF9B00' : 'var(--text-4)' }}>{percentage.toFixed(1)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">match</div>
        </div>
      </div>
    </motion.div>
  )
}
