import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, ThumbsUp, MessageCircle, Bot, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { forumAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

const CATEGORIES = ['general', 'disease', 'weather', 'market', 'soil', 'government_schemes']

export default function ForumPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState('')
  const [form, setForm] = useState({ title: '', content: '', category: 'general' })
  const [submitting, setSubmitting] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)

  useEffect(() => { fetchPosts() }, [category])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const res = await forumAPI.posts(category || undefined)
      setPosts(res.data)
    } catch { toast.error('Failed to load posts') }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('content', form.content)
      fd.append('category', form.category)
      fd.append('language', user?.language || 'hi')
      await forumAPI.createPost(fd)
      toast.success('Post submitted!')
      setShowForm(false)
      setForm({ title: '', content: '', category: 'general' })
      fetchPosts()
    } catch { toast.error('Failed to post') }
    finally { setSubmitting(false) }
  }

  const handleUpvote = async (postId: number) => {
    await forumAPI.upvote(postId)
    setPosts((p) => p.map((post) => post.id === postId ? { ...post, upvotes: post.upvotes + 1 } : post))
  }

  const openPost = async (id: number) => {
    try {
      const res = await forumAPI.post(id)
      setSelectedPost(res.data)
    } catch { toast.error('Failed to load post') }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-3">
            <Users className="text-brand-400" size={28} />
            {t('forum.title')}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{t('forum.subtitle')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {t('forum.new_post')}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCategory('')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize
            ${!category ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-gray-400 hover:text-white border border-surface-border'}`}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize
              ${category === c ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-gray-400 hover:text-white border border-surface-border'}`}>
            {c.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="glass-card p-6 h-24 shimmer" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <motion.div key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 hover:border-brand-500/30 transition-all cursor-pointer"
              onClick={() => openPost(post.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 capitalize">
                      {post.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white truncate">{post.title}</h3>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{post.content}</p>
                  {post.ai_suggestion && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20">
                      <Bot size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-brand-300 line-clamp-2">{post.ai_suggestion}</p>
                    </div>
                  )}
                </div>
                {post.image_url && (
                  <img src={post.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <button onClick={(e) => { e.stopPropagation(); handleUpvote(post.id) }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-400 transition-colors">
                  <ThumbsUp size={13} /> {post.upvotes}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MessageCircle size={13} /> Comments
                </span>
                <span className="text-xs text-gray-600 ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* New post modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-white">{t('forum.new_post')}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('forum.post_title')} className="input-field" required />
                <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={t('forum.post_content')} className="input-field resize-none" rows={4} required />
                <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                  className="input-field">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('forum.submit')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post detail modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between">
                <h2 className="font-display font-semibold text-white text-lg">{selectedPost.title}</h2>
                <button onClick={() => setSelectedPost(null)} className="text-gray-500 hover:text-white ml-4">
                  <X size={20} />
                </button>
              </div>
              <p className="text-gray-300 text-sm">{selectedPost.content}</p>
              {selectedPost.ai_suggestion && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <Bot size={16} className="text-brand-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-brand-400 font-medium mb-1">{t('forum.ai_suggestion')}</p>
                    <p className="text-sm text-brand-200">{selectedPost.ai_suggestion}</p>
                  </div>
                </div>
              )}
              <div className="border-t border-surface-border pt-4">
                <h3 className="text-sm font-medium text-white mb-3">Comments ({selectedPost.comments?.length || 0})</h3>
                {selectedPost.comments?.map((c: any) => (
                  <div key={c.id} className="px-4 py-3 rounded-xl bg-surface-elevated mb-2">
                    <p className="text-sm text-gray-300">{c.content}</p>
                    {c.is_ai && <span className="text-xs text-brand-400 flex items-center gap-1 mt-1"><Bot size={10} /> AI</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
