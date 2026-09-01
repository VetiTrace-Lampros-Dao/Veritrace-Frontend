import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useDisconnect } from 'wagmi'
import { getContractEvents } from '@wagmi/core'
import { parseAbi } from 'viem'
import { config } from '../wagmiConfig'
import { ethers } from 'ethers'
import { toast } from 'sonner'
import {
  User, Camera, Download, ExternalLink, Shield, Copy, Check,
  FileText, Image as ImageIcon, Video, Hash, Calendar,
  Wallet, LogOut, Edit3, Save, X, ChevronRight, Eye,
  TrendingUp, Award, Clock, Lock, Layers
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/ui/spinner'
import { Alert } from '../components/ui/alert'
import { Modal, ModalHeader } from '../components/ui/modal'
import { SpotlightCard } from '../components/aceternity/SpotlightCard'
import { ArbitrumLogo } from '../components/ArbitrumLogo'
import { ScrollReveal } from '../components/ui/scroll-reveal'
import { CONTRACT_ADDRESS, CONTRACT_ABI, ARBITRUM_SEPOLIA, CORE_BACKEND_API } from '../config'
import { downloadCertificate } from '../utils/generateCertificate'
import { cn } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vt_profile'
const REGISTRATIONS_CACHE = 'vt_registrations_cache'

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveProfile(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function formatAddress(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getGatewayUrl(url) {
  if (!url) return null
  if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/')
    return `https://gateway.pinata.cloud/ipfs/${parts[parts.length - 1]}`
  }
  return url
}

function fileTypeIcon(ipfsCid, aiTool) {
  if (aiTool?.toLowerCase().includes('video')) return <Video size={14} className="text-[var(--accent)]" />
  if (aiTool?.toLowerCase().includes('pdf') || aiTool?.toLowerCase().includes('doc')) return <FileText size={14} className="text-[var(--success-text)]" />
  return <ImageIcon size={14} className="text-violet-500" />
}

// ─── Certificate Generator ───────────────────────────────────────────────────

async function generateCertificate(item, displayName, address) {
  const txObj = {
    sha256: item.sha256,
    blockNumber: item.blockNumber,
    timestamp: item.timestamp,
    ipfsCid: item.ipfsCid,
    aiTool: item.aiTool,
    mediaS3Url: item.mediaS3Url,
    mediaIpfsUrl: item.mediaIpfsUrl,
    hash: item.txHash || ''
  }
  await downloadCertificate(txObj, address || item.creator, CORE_BACKEND_API)
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'var(--accent)' }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <Card hover className="card-hover-glow p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <div className="text-xl font-extrabold text-[var(--text)] leading-none">{value}</div>
          <div className="text-xs text-[var(--text-3)] mt-1">{label}</div>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Asset Row ───────────────────────────────────────────────────────────────

function AssetRow({ item, index, onDownloadCert, onView, address }) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(item.sha256 || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const handleCert = async () => {
    setDownloading(true)
    try { await onDownloadCert(item) } finally { setDownloading(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
      className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] transition-all duration-200"
    >
      {/* File type icon */}
      <div className="w-9 h-9 rounded-xl bg-[var(--bg-2)] flex items-center justify-center flex-shrink-0">
        {fileTypeIcon(item.ipfsCid, item.aiTool)}
      </div>

      {/* Hash */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-[var(--text)] truncate">
          {item.sha256 ? `${item.sha256.slice(0, 14)}...${item.sha256.slice(-6)}` : '—'}
        </div>
        <div className="text-[10px] text-[var(--text-3)] mt-0.5 flex items-center gap-2">
          <Calendar size={9} />
          {formatTs(item.timestamp)}
          {item.aiTool && (
            <span className="bg-[var(--arb-bg)] text-[var(--accent)] px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide">
              {item.aiTool}
            </span>
          )}
        </div>
      </div>

      {/* Block */}
      <div className="hidden sm:block text-xs text-[var(--text-3)] font-mono min-w-[72px] text-right">
        #{item.blockNumber?.toLocaleString() || '—'}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 transition-opacity">
        <button
          onClick={handleCopy}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-all"
          title="Copy hash"
        >
          {copied ? <Check size={13} className="text-[var(--success-text)]" /> : <Copy size={13} />}
        </button>
        {item.txHash && (
          <a
            href={`${ARBITRUM_SEPOLIA.explorer}/tx/${item.txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--arb-bg)] transition-all"
            title="View on Arbiscan"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button
          onClick={() => onView(item)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-all"
          title="Preview asset"
        >
          <Eye size={13} />
        </button>
        <button
          onClick={handleCert}
          disabled={downloading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--success-text)] hover:bg-[var(--success-bg)] transition-all disabled:opacity-40"
          title="Download certificate"
        >
          {downloading ? <Spinner size="xs" /> : <Download size={13} />}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Avatar Upload ────────────────────────────────────────────────────────────

function AvatarUpload({ avatar, onAvatarChange }) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Avatar must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => onAvatarChange(ev.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <div className="w-24 h-24 rounded-full border-2 border-[var(--border-2)] overflow-hidden bg-[var(--bg-2)] flex items-center justify-center">
        {avatar
          ? <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
          : <User size={36} className="text-[var(--text-4)]" />
        }
      </div>
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera size={18} className="text-white" />
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[var(--accent)] border-2 border-[var(--bg)] flex items-center justify-center">
        <Camera size={12} className="text-white" />
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── Asset Preview Modal ──────────────────────────────────────────────────────

function AssetModal({ item, onClose, displayName, address, onDownloadCert }) {
  const [mediaUrl, setMediaUrl] = useState(null)
  const [mediaType, setMediaType] = useState('image')
  const [loading, setLoading] = useState(false)
  const [certDl, setCertDl] = useState(false)

  useEffect(() => {
    if (!item) return
    let isMounted = true
    const fetchMedia = async () => {
      // 1. Try local storage cache first
      try {
        const localKey = `vt_media_${item.sha256?.toLowerCase()}`
        const cached = localStorage.getItem(localKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.media_s3_url || parsed.media_ipfs_url) {
            if (isMounted) {
              setMediaUrl(getGatewayUrl(parsed.media_s3_url || parsed.media_ipfs_url))
              setMediaType(parsed.media_type || 'image')
              return
            }
          }
        }
      } catch {}

      if (!item.ipfsCid) return
      if (isMounted) setLoading(true)

      const gateways = [
        `https://gateway.pinata.cloud/ipfs/${item.ipfsCid}`,
        `https://cloudflare-ipfs.com/ipfs/${item.ipfsCid}`,
        `https://ipfs.io/ipfs/${item.ipfsCid}`
      ]

      for (const gw of gateways) {
        try {
          const res = await fetch(gw, { signal: AbortSignal.timeout(4000) })
          if (res.ok) {
            const meta = await res.json()
            if (isMounted) {
              setMediaUrl(getGatewayUrl(meta.media_s3_url || meta.media_ipfs_url))
              setMediaType(meta.media_type || 'image')
            }
            break
          }
        } catch {}
      }
      if (isMounted) setLoading(false)
    }
    fetchMedia()
    return () => { isMounted = false }
  }, [item])

  if (!item) return null

  return (
    <Modal open onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader title="Asset Record" onClose={onClose} icon={<Shield size={18} className="text-[var(--accent)]" />} />
      <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
        {/* Media preview container with fixed max height */}
        <div className="relative w-full h-44 sm:h-52 rounded-xl bg-[var(--bg-2)] overflow-hidden flex items-center justify-center border border-[var(--border)]">
          {loading ? (
            <div className="text-center"><Spinner /><div className="text-xs text-[var(--text-3)] mt-2">Retrieving media from IPFS...</div></div>
          ) : mediaUrl ? (
            mediaType === 'video'
              ? <video src={mediaUrl} controls controlsList="nodownload" className="max-w-full max-h-full" />
              : <img src={mediaUrl} alt="Asset" className="max-w-full max-h-full object-contain pointer-events-none select-none" />
          ) : (
            <div className="text-center p-4 flex flex-col items-center">
              <Lock size={28} className="text-[var(--text-3)] mb-1" />
              <div className="text-xs font-semibold text-[var(--text)]">Protected Registry Node</div>
              <div className="text-[11px] text-[var(--text-3)] mt-1 mb-3 max-w-[240px]">{item.ipfsCid ? 'Media not resolved from IPFS gateways.' : 'Legacy registration: File was not pinned to storage.'}</div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" as="span">Select local file to view</Button>
                <input type="file" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) { setMediaUrl(URL.createObjectURL(file)); setMediaType(file.type.startsWith('video/') ? 'video' : 'image') } }} />
              </label>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'SHA-256 Hash', value: item.sha256, mono: true },
            { label: 'Block Number', value: `#${item.blockNumber?.toLocaleString()}`, mono: true },
            { label: 'Registered', value: formatTs(item.timestamp) },
            { label: 'AI Tool', value: item.aiTool || 'Not specified' },
            { label: 'IPFS CID', value: item.ipfsCid || '—', mono: true },
            { label: 'pHash', value: item.phash || '—', mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-[var(--bg-2)] rounded-xl p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-4)] mb-1">{label}</div>
              <div className={cn('text-xs text-[var(--text)] break-all', mono && 'font-mono')}>{value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {item.txHash && (
            <a href={`${ARBITRUM_SEPOLIA.explorer}/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink size={13} /> View on Arbiscan</Button>
            </a>
          )}
          <Button
            variant="success"
            size="sm"
            disabled={certDl}
            onClick={async () => {
              setCertDl(true)
              try { await onDownloadCert(item) } finally { setCertDl(false) }
            }}
          >
            {certDl ? <Spinner size="xs" /> : <Download size={13} />}
            Download Certificate
          </Button>
          {mediaUrl && (
            <a href={mediaUrl} download target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><Download size={13} /> Download Original</Button>
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [profile, setProfile] = useState(() => loadProfile())
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile.displayName || '')
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [activeTab, setActiveTab] = useState('uploads')

  // Persist avatar and displayName
  const handleAvatarChange = (dataUrl) => {
    const updated = { ...profile, avatar: dataUrl }
    setProfile(updated)
    saveProfile(updated)
    toast.success('Profile picture updated')
  }

  const saveName = () => {
    const trimmed = nameInput.trim()
    const updated = { ...profile, displayName: trimmed }
    setProfile(updated)
    saveProfile(updated)
    setEditingName(false)
    toast.success('Display name saved')
  }

  // Fetch all registrations from chain
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      setError(null)
      try {
        const events = await getContractEvents(config, {
          address: CONTRACT_ADDRESS,
          abi: parseAbi(CONTRACT_ABI),
          eventName: 'ContentRegistered',
          fromBlock: 0n,
          toBlock: 'latest',
        })
        const parsed = events.map(ev => {
          const a = ev.args || {}
          return {
            sha256: a.sha256hash,
            creator: a.creator,
            phash: a.phash?.toString() || '0',
            timestamp: Number(a.timestamp || 0n),
            ipfsCid: a.ipfsCid || '',
            aiTool: a.aitool || '',
            txHash: ev.transactionHash,
            blockNumber: Number(ev.blockNumber),
          }
        })
        setRegistrations(parsed.reverse())
      } catch (err) {
        setError(`Failed to read on-chain registry: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  // Filter to wallet-owned uploads
  const myUploads = registrations.filter(r =>
    address && r.creator?.toLowerCase() === address.toLowerCase()
  )

  const [certGenerating, setCertGenerating] = useState(false)

  const handleDownloadCert = useCallback(async (item) => {
    if (certGenerating) {
      toast.info('Certificate generation in progress…')
      return
    }
    setCertGenerating(true)
    toast.loading('Generating certificate…', { id: 'cert' })
    try {
      await generateCertificate(item, profile.displayName, address)
      toast.success('Certificate downloaded!', { id: 'cert' })
    } catch {
      toast.error('Failed to generate certificate', { id: 'cert' })
    } finally {
      setCertGenerating(false)
    }
  }, [profile.displayName, address, certGenerating])

  const stats = [
    { icon: Layers, label: 'Total Registrations', value: myUploads.length, color: 'var(--accent)' },
    { icon: Award, label: 'Certificates Available', value: myUploads.length, color: 'var(--success-text)' },
    { icon: Clock, label: 'First Registration', value: myUploads.length ? formatTs(myUploads[myUploads.length - 1]?.timestamp) : '—', color: '#6366f1' },
    { icon: TrendingUp, label: 'On-Chain Records', value: registrations.length, color: '#f59e0b' },
  ]

  const tabs = [
    { id: 'uploads', label: 'My Uploads', count: myUploads.length },
    { id: 'all', label: 'All Records', count: registrations.length },
  ]

  const displayItems = activeTab === 'uploads' ? myUploads : registrations

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--arb-bg)] border border-[var(--arb-border)] flex items-center justify-center mx-auto mb-5">
            <Wallet size={28} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text)] mb-2">Connect your wallet</h2>
          <p className="text-sm text-[var(--text-3)] leading-relaxed">
            Connect a Web3 wallet to view your profile, content library, and download authenticity certificates.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <ScrollReveal variant="fade-up">
    <div className="max-w-[1200px] mx-auto px-5 py-8 space-y-8">

      {/* ── Profile Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <Card className="overflow-hidden">
          {/* Banner */}
          <div className="h-28 bg-gradient-to-r from-indigo-500/20 via-sky-500/10 to-emerald-500/10 relative">
            <div className="absolute inset-0"
              style={{ backgroundImage: 'linear-gradient(90deg,rgba(99,102,241,.06) 1px,transparent 1px),linear-gradient(rgba(99,102,241,.06) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
          </div>

          <CardBody className="pt-0 px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              {/* Avatar */}
              <AvatarUpload avatar={profile.avatar} onAvatarChange={handleAvatarChange} />

              {/* Name & address */}
              <div className="flex-1 min-w-0 sm:mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                      placeholder="Display name…"
                      className="bg-[var(--bg-2)] border border-[var(--border-2)] rounded-xl px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] w-full max-w-xs"
                    />
                    <button onClick={saveName} className="w-7 h-7 rounded-lg bg-[var(--success-text)]/15 text-[var(--success-text)] flex items-center justify-center hover:bg-[var(--success-text)]/25 transition-colors"><Save size={13} /></button>
                    <button onClick={() => setEditingName(false)} className="w-7 h-7 rounded-lg bg-[var(--bg-2)] text-[var(--text-3)] flex items-center justify-center hover:bg-[var(--bg-3)] transition-colors"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl font-extrabold text-[var(--text)] truncate">
                      {profile.displayName || 'Anonymous Creator'}
                    </h1>
                    <button
                      onClick={() => { setNameInput(profile.displayName || ''); setEditingName(true) }}
                      className="w-6 h-6 rounded-lg text-[var(--text-4)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] flex items-center justify-center transition-colors"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[var(--text-3)] bg-[var(--bg-2)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                    {address}
                  </span>
                  <ArbitrumLogo size={14} />
                  <Badge variant="success" className="text-[10px]">Connected</Badge>
                </div>
              </div>

              {/* Disconnect */}
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition-all border border-transparent hover:border-[var(--danger-border)] sm:self-start sm:mt-1"
              >
                <LogOut size={13} /> Disconnect
              </button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 220, damping: 22 }}>
            <StatCard {...s} value={loading ? '…' : s.value} />
          </motion.div>
        ))}
      </div>

      {/* ── Content Library ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 18 }}>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Shield size={16} className="text-[var(--accent)]" />
              Content Library
            </CardTitle>

            {/* Tabs & Bulk Action */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl bg-[var(--bg-2)] border border-[var(--border)] p-0.5 gap-0.5">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all',
                      activeTab === t.id
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                        : 'text-[var(--text-3)] hover:text-[var(--text)]'
                    )}
                  >
                    {t.label}
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                      activeTab === t.id ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[var(--bg-3)] text-[var(--text-4)]'
                    )}>
                      {loading ? '…' : t.count}
                    </span>
                  </button>
                ))}
              </div>

              {myUploads.length > 0 && (
                <Button
                  size="sm"
                  variant="success"
                  disabled={certGenerating}
                  onClick={async () => {
                    if (certGenerating) return
                    setCertGenerating(true)
                    toast.loading(`Generating ${myUploads.length} certificates…`, { id: 'bulk' })
                    try {
                      for (const item of myUploads) {
                        await generateCertificate(item, profile.displayName, address)
                        await new Promise(r => setTimeout(r, 100))
                      }
                      toast.success('All certificates downloaded!', { id: 'bulk' })
                    } catch {
                      toast.error('Failed to generate all certificates', { id: 'bulk' })
                    } finally {
                      setCertGenerating(false)
                    }
                  }}
                >
                  {certGenerating ? <Spinner size="xs" /> : <Download size={13} />} Download All Certs
                </Button>
              )}
            </div>
          </CardHeader>

          <CardBody>
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
                  <Hash size={22} className="text-[var(--text-4)]" />
                </div>
                <p className="font-semibold text-sm text-[var(--text)]">
                  {activeTab === 'uploads' ? 'No uploads yet' : 'No records found'}
                </p>
                <p className="text-xs text-[var(--text-3)] mt-1">
                  {activeTab === 'uploads'
                    ? 'Register your first asset to see it here'
                    : 'No blockchain events detected'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayItems.map((item, i) => (
                  <AssetRow
                    key={item.txHash || i}
                    item={item}
                    index={i}
                    address={address}
                    onDownloadCert={handleDownloadCert}
                    onView={setSelectedAsset}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>



      {/* ── Asset Detail Modal ── */}
      <AnimatePresence>
        {selectedAsset && (
          <AssetModal
            item={selectedAsset}
            displayName={profile.displayName}
            address={address}
            onClose={() => setSelectedAsset(null)}
            onDownloadCert={handleDownloadCert}
          />
        )}
      </AnimatePresence>
    </div>
    </ScrollReveal>
  )
}
