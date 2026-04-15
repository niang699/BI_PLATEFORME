'use client'
import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, CheckCircle2, CornerDownRight, ChevronDown, ChevronUp, Lock, Trash2, ShieldAlert } from 'lucide-react'
import { MOCK_COMMENTS, type ReportComment, type CommentReply } from '@/lib/mockData'
import { getCurrentUser } from '@/lib/auth'
import type { Role } from '@/lib/types'

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'

const ROLE_CFG: Record<Role, { label: string; color: string; bg: string }> = {
  super_admin:  { label: 'Super Admin',  color: '#1F3B72', bg: 'rgba(31,59,114,.10)'  },
  admin_metier: { label: 'Admin Métier', color: '#4a7c10', bg: 'rgba(150,193,30,.12)' },
  analyste:     { label: 'Analyste',     color: '#6d28d9', bg: 'rgba(109,40,217,.10)' },
  lecteur_dt:   { label: 'Lecteur DT',   color: '#475569', bg: 'rgba(71,85,105,.10)'  },
  dt:           { label: 'Directeur DT', color: '#d97706', bg: 'rgba(217,119,6,.10)'  },
}

/* ─── Règles d'accès ────────────────────────────────────────────────────────
   canComment  : peut publier / répondre
   canResolve  : peut marquer résolu (sur tous les rapports ou sa propre DR)
   canDelete   : peut supprimer ses propres commentaires
   isReadOnly  : lecture seule
──────────────────────────────────────────────────────────────────────────── */
function getPermissions(role: Role | undefined) {
  return {
    canComment:  role !== undefined && role !== 'lecteur_dt',
    canResolve:  role === 'super_admin' || role === 'admin_metier' || role === 'dt',
    canDelete:   role !== undefined && role !== 'lecteur_dt',
    isReadOnly:  role === 'lecteur_dt' || role === undefined,
  }
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return `Il y a ${Math.floor(diff / 86400)}j`
}

function Avatar({ initials, role, size = 32 }: { initials: string; role: Role; size?: number }) {
  const cfg = ROLE_CFG[role]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, color: '#fff', fontFamily: F_TITLE,
      boxShadow: `0 2px 8px ${cfg.color}44`,
    }}>
      {initials}
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CFG[role]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase',
      color: cfg.color, background: cfg.bg, borderRadius: 99, padding: '2px 7px',
    }}>{cfg.label}</span>
  )
}

interface CommentCardProps {
  comment: ReportComment
  currentUserId: string | undefined
  currentUserName: string | undefined
  currentUserAvatar: string
  currentUserRole: Role | undefined
  onResolve: (id: string) => void
  onDelete:  (id: string) => void
  onReply:   (id: string, content: string) => void
}

function CommentCard({ comment, currentUserId, currentUserName, currentUserAvatar, currentUserRole, onResolve, onDelete, onReply }: CommentCardProps) {
  const [showReplies, setShowReplies] = useState(true)
  const [replying,    setReplying]    = useState(false)
  const [replyText,   setReplyText]   = useState('')
  const [confirmDel,  setConfirmDel]  = useState(false)

  const perms       = getPermissions(currentUserRole)
  const isMyComment = comment.authorId === currentUserId
  const canComment  = perms.canComment
  const canResolve  = perms.canResolve && !comment.resolved
  const canDelete   = perms.canDelete && (isMyComment || currentUserRole === 'super_admin') && !comment.resolved

  const submitReply = () => {
    if (!replyText.trim() || !currentUserRole) return
    onReply(comment.id, replyText.trim())
    setReplyText(''); setReplying(false)
  }

  return (
    <div style={{
      background: comment.resolved ? '#fafbff' : '#fff',
      border: `1px solid ${comment.resolved ? '#e8edf5' : '#e0e9f8'}`,
      borderLeft: `3px solid ${comment.resolved ? '#cbd5e1' : C_NAVY}`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 10,
      opacity: comment.resolved ? 0.7 : 1,
      transition: 'all .2s',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <Avatar initials={comment.authorAvatar} role={comment.authorRole} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{comment.authorName}</span>
            <RoleBadge role={comment.authorRole} />
            {comment.resolved && (
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#4a7c10', background: 'rgba(150,193,30,.12)', borderRadius: 99, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={9} strokeWidth={2.5} /> Résolu
              </span>
            )}
          </div>
          <span style={{ fontSize: 10.5, color: 'rgba(31,59,114,.4)', fontWeight: 500 }}>{timeAgo(comment.createdAt)}</span>
        </div>

        {/* Actions header */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {canResolve && (
            <button onClick={() => onResolve(comment.id)} title="Marquer comme résolu" style={{
              background: 'none', border: '1px solid #e8edf5', borderRadius: 7,
              cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(150,193,30,.08)'; e.currentTarget.style.color='#4a7c10'; e.currentTarget.style.borderColor='rgba(150,193,30,.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='rgba(31,59,114,.45)'; e.currentTarget.style.borderColor='#e8edf5' }}>
              <CheckCircle2 size={11} strokeWidth={2.2} /> Résoudre
            </button>
          )}
          {canDelete && (
            confirmDel ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => onDelete(comment.id)} style={{ background: '#E84040', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                  Confirmer
                </button>
                <button onClick={() => setConfirmDel(false)} style={{ background: '#f4f6fb', border: '1px solid #e8edf5', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.5)' }}>
                  Annuler
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} title="Supprimer" style={{
                background: 'none', border: '1px solid #e8edf5', borderRadius: 7, cursor: 'pointer',
                width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.borderColor='#fca5a5' }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='#e8edf5' }}>
                <Trash2 size={11} color="rgba(232,64,64,.7)" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Contenu */}
      <p style={{ fontSize: 12.5, color: 'rgba(31,59,114,.75)', lineHeight: 1.65, margin: '0 0 10px', fontWeight: 500 }}>
        {comment.content}
      </p>

      {/* Barre d'actions basse */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        {comment.replies.length > 0 && (
          <button onClick={() => setShowReplies(v => !v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 700, color: 'rgba(31,59,114,.45)', borderRadius: 6,
          }}>
            {showReplies ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {comment.replies.length} réponse{comment.replies.length > 1 ? 's' : ''}
          </button>
        )}

        {comment.resolved && comment.resolvedBy && (
          <span style={{ fontSize: 10, color: 'rgba(31,59,114,.32)', fontStyle: 'italic' }}>
            Résolu par {comment.resolvedBy}
          </span>
        )}

        {!comment.resolved && canComment && (
          <button onClick={() => setReplying(v => !v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 700,
            color: replying ? C_NAVY : 'rgba(31,59,114,.45)',
            borderRadius: 6, marginLeft: 'auto',
          }}>
            <CornerDownRight size={11} strokeWidth={2.5} /> Répondre
          </button>
        )}
      </div>

      {/* Réponses */}
      {showReplies && comment.replies.length > 0 && (
        <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: '2px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comment.replies.map(reply => (
            <div key={reply.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Avatar initials={reply.authorAvatar} role={reply.authorRole} size={24} />
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{reply.authorName}</span>
                  <RoleBadge role={reply.authorRole} />
                  <span style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginLeft: 2 }}>{timeAgo(reply.createdAt)}</span>
                </div>
                <p style={{ fontSize: 11.5, color: 'rgba(31,59,114,.7)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone réponse */}
      {replying && currentUserRole && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Avatar initials={currentUserAvatar} role={currentUserRole} size={26} />
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              autoFocus
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() } }}
              placeholder="Votre réponse… (Entrée pour envoyer)"
              rows={2}
              style={{
                width: '100%', padding: '8px 40px 8px 10px', borderRadius: 8, resize: 'none',
                border: '1.5px solid #e0e9f8', background: '#f8fafc', outline: 'none',
                fontSize: 11.5, color: C_NAVY, fontFamily: F_BODY, fontWeight: 500,
                boxSizing: 'border-box', transition: 'border-color .15s',
              }}
              onFocus={e => { e.target.style.borderColor = C_NAVY; e.target.style.background = '#fff' }}
              onBlur={e  => { e.target.style.borderColor = '#e0e9f8'; e.target.style.background = '#f8fafc' }}
            />
            <button onClick={submitReply} disabled={!replyText.trim()} style={{
              position: 'absolute', right: 6, bottom: 6,
              background: replyText.trim() ? C_NAVY : '#e8edf5', border: 'none', borderRadius: 6,
              cursor: replyText.trim() ? 'pointer' : 'default',
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}>
              <Send size={11} color={replyText.trim() ? '#fff' : '#94a3b8'} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   PANNEAU PRINCIPAL
══════════════════════════════════════════════════════════════════════════════ */
interface CommentsPanelProps {
  reportId:    string
  reportTitle: string
  onClose:     () => void
}

export default function CommentsPanel({ reportId, reportTitle, onClose }: CommentsPanelProps) {
  const user        = getCurrentUser()
  const role        = user?.role as Role | undefined
  const perms       = getPermissions(role)
  const STORAGE_KEY = `seneau_comments_${reportId}`

  const currentUserAvatar = user
    ? (user.avatar ?? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase())
    : ''

  const [comments, setComments] = useState<ReportComment[]>(() => {
    if (typeof window === 'undefined') return MOCK_COMMENTS.filter(c => c.reportId === reportId)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : MOCK_COMMENTS.filter(c => c.reportId === reportId)
    } catch {
      return MOCK_COMMENTS.filter(c => c.reportId === reportId)
    }
  })

  const [filter,  setFilter]  = useState<'all' | 'open' | 'resolved'>('all')
  const [newText, setNewText] = useState('')
  const [visible, setVisible] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTimeout(() => setVisible(true), 10) }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(comments))
  }, [comments, STORAGE_KEY])

  const filtered      = comments.filter(c => filter === 'all' ? true : filter === 'open' ? !c.resolved : c.resolved)
  const openCount     = comments.filter(c => !c.resolved).length
  const resolvedCount = comments.filter(c =>  c.resolved).length

  const handleResolve = (id: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, resolved: true, resolvedBy: user?.name } : c))
  }

  const handleDelete = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
  }

  const handleReply = (commentId: string, content: string) => {
    if (!role || !user) return
    const reply: CommentReply = {
      id: `r_${Date.now()}`,
      authorId: user.id, authorName: user.name,
      authorAvatar: currentUserAvatar, authorRole: role,
      content, createdAt: new Date().toISOString(),
    }
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c))
  }

  const handleSubmit = () => {
    if (!newText.trim() || !role || !user) return
    const comment: ReportComment = {
      id: `c_${Date.now()}`, reportId,
      authorId: user.id, authorName: user.name,
      authorAvatar: currentUserAvatar, authorRole: role,
      content: newText.trim(),
      createdAt: new Date().toISOString(),
      resolved: false, replies: [],
    }
    setComments(prev => [comment, ...prev])
    setNewText('')
    textRef.current?.focus()
  }

  const handleClose = () => { setVisible(false); setTimeout(onClose, 250) }

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.18)',
        zIndex: 299, transition: 'opacity .25s', opacity: visible ? 1 : 0,
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#fff', zIndex: 300,
        boxShadow: '-8px 0 40px rgba(31,59,114,.14)',
        display: 'flex', flexDirection: 'column', fontFamily: F_BODY,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e8edf5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(31,59,114,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={16} color={C_NAVY} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: C_NAVY, fontFamily: F_TITLE, lineHeight: 1.1 }}>Commentaires</div>
                <div style={{ fontSize: 10.5, color: 'rgba(31,59,114,.4)', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reportTitle}</div>
              </div>
            </div>
            <button onClick={handleClose} style={{
              background: '#f4f6fb', border: '1px solid #e8edf5', borderRadius: 9,
              cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.borderColor='#fca5a5' }}
            onMouseLeave={e => { e.currentTarget.style.background='#f4f6fb'; e.currentTarget.style.borderColor='#e8edf5' }}>
              <X size={14} color="rgba(31,59,114,.55)" />
            </button>
          </div>

          {/* Bandeau lecture seule */}
          {perms.isReadOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(71,85,105,.07)', border: '1px solid rgba(71,85,105,.15)', borderRadius: 8, padding: '7px 10px', marginTop: 10 }}>
              <ShieldAlert size={13} color="#475569" strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                Accès lecture seule — votre rôle ne permet pas de commenter.
              </span>
            </div>
          )}

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {(['all', 'open', 'resolved'] as const).map(f => {
              const count  = f === 'all' ? comments.length : f === 'open' ? openCount : resolvedCount
              const active = filter === f
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '4px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, transition: 'all .15s',
                  background: active ? C_NAVY : '#f4f6fb',
                  color: active ? '#fff' : 'rgba(31,59,114,.55)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {{ all: 'Tous', open: 'Ouverts', resolved: 'Résolus' }[f]}
                  <span style={{
                    background: active ? 'rgba(255,255,255,.2)' : '#e8edf5',
                    color: active ? '#fff' : 'rgba(31,59,114,.55)',
                    borderRadius: 99, padding: '0 5px', fontSize: 10, fontWeight: 800, lineHeight: '16px',
                  }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Liste ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <MessageSquare size={38} color="rgba(31,59,114,.10)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: 'rgba(31,59,114,.38)', fontWeight: 700, marginBottom: 6 }}>
                {filter === 'resolved' ? 'Aucun commentaire résolu' : 'Aucun commentaire pour l\'instant'}
              </p>
              {filter === 'all' && perms.canComment && (
                <p style={{ fontSize: 11.5, color: 'rgba(31,59,114,.28)', fontWeight: 500 }}>
                  Soyez le premier à annoter ce rapport.
                </p>
              )}
            </div>
          ) : (
            filtered.map(comment => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                currentUserName={user?.name}
                currentUserAvatar={currentUserAvatar}
                currentUserRole={role}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={handleReply}
              />
            ))
          )}
        </div>

        {/* ── Zone saisie ── */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid #e8edf5', background: '#fafbff', flexShrink: 0 }}>
          {perms.canComment && user ? (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <Avatar initials={currentUserAvatar} role={role!} size={28} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{user.name}</span>
                  <RoleBadge role={role!} />
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={textRef}
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
                  placeholder="Ajouter une annotation, une remarque ou une alerte métier…"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, resize: 'none',
                    border: '1.5px solid #e0e9f8', background: '#fff', outline: 'none',
                    fontSize: 12.5, color: C_NAVY, fontFamily: F_BODY, fontWeight: 500,
                    boxSizing: 'border-box', lineHeight: 1.6, transition: 'all .15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = C_NAVY; e.target.style.boxShadow = '0 0 0 3px rgba(31,59,114,.06)' }}
                  onBlur={e  => { e.target.style.borderColor = '#e0e9f8'; e.target.style.boxShadow = 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(31,59,114,.3)', fontWeight: 500 }}>⌘+Entrée pour publier</span>
                  <button onClick={handleSubmit} disabled={!newText.trim()} style={{
                    padding: '7px 18px', borderRadius: 9, border: 'none',
                    background: newText.trim() ? `linear-gradient(135deg, ${C_NAVY}, #2B50A0)` : '#e8edf5',
                    color: newText.trim() ? '#fff' : '#94a3b8',
                    fontSize: 12, fontWeight: 800, cursor: newText.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
                    fontFamily: F_TITLE, boxShadow: newText.trim() ? '0 3px 12px rgba(31,59,114,.22)' : 'none',
                  }}>
                    <Send size={12} strokeWidth={2.5} /> Publier
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: '#f4f6fb', borderRadius: 10, border: '1px solid #e8edf5' }}>
              <Lock size={13} color="rgba(31,59,114,.4)" />
              <div>
                <div style={{ fontSize: 12, color: 'rgba(31,59,114,.6)', fontWeight: 700 }}>
                  {!user ? 'Connexion requise' : 'Commentaires désactivés'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', marginTop: 1 }}>
                  {!user ? 'Connectez-vous pour accéder aux commentaires.' : 'Votre rôle (Lecteur DT) est en lecture seule.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
