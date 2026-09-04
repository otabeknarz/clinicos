import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Plus, Search, Send, Users } from 'lucide-react'

import {
  createChatGroup,
  getMessages,
  listChatGroups,
  markGroupRead,
  sendMessage,
} from '@/api/chat'
import { listUsers } from '@/api/auth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dayDiff, time } from '@/lib/format'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { ChatMessage } from '@/types/models'

/**
 * Xodimlar chati.
 *
 * Ikki ustunli: chapda suhbatlar, o'ngda yozishma. Telefonda suhbat
 * tanlanganda ro'yxat yashiriladi.
 *
 * DEMO REJIMDA xabarlar darhol yetib bormaydi — realtime uchun
 * WebSocket kerak. Tafsilotlar `src/api/chat.ts` boshidagi izohda.
 */
export function ChatPage() {
  const { t } = useI18n()
  const { session } = useAuth()

  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [version, setVersion] = useState(0)

  const debounced = useDebounced(search, 250)
  const userId = session?.user.id ?? ''

  const groups = useAsync(
    () => listChatGroups(userId, debounced),
    [userId, debounced, version],
    { skip: !userId },
  )

  // Birinchi suhbatni avtomatik ochamiz
  useEffect(() => {
    if (activeId || !groups.data?.length) return
    setActiveId(groups.data[0].id)
  }, [groups.data, activeId])

  const active = groups.data?.find((g) => g.id === activeId) ?? null

  return (
    <>
      <PageHeader
        title={t('chat.title')}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setNewGroupOpen(true)}>
            <span className="hidden sm:inline">{t('chat.newGroup')}</span>
          </Button>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="grid min-h-[32rem] md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* ============ Suhbatlar ro'yxati ============ */}
          <aside
            className={cn(
              'hairline flex flex-col border-r md:border-r',
              // Telefonda suhbat ochilganda ro'yxat yashiriladi
              activeId ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="hairline p-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t('action.search')}
                icon={<Search size={16} />}
              />
            </div>

            {groups.error ? (
              <ErrorState onRetry={groups.reload} />
            ) : groups.loading ? (
              <CardSkeleton className="m-3 border-0 shadow-none" />
            ) : (groups.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<MessageSquare size={22} strokeWidth={1.75} />}
                title={t('chat.noGroups')}
                description=""
                className="py-10"
              />
            ) : (
              <ul className="scroll-slim min-h-0 flex-1 overflow-y-auto">
                {groups.data!.map((group) => {
                  const isActive = group.id === activeId
                  return (
                    <li key={group.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(group.id)}
                        className={cn(
                          'hairline flex w-full items-center gap-3 px-4 py-3 text-left',
                          'transition-colors duration-150',
                          isActive ? 'bg-accent-soft' : 'hover:bg-fill-4',
                        )}
                      >
                        <Avatar name={group.name} size="sm" />

                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-subhead font-medium',
                                isActive ? 'text-accent' : 'text-label',
                              )}
                            >
                              {group.name}
                            </span>
                            {group.lastMessage ? (
                              <span className="shrink-0 text-caption-2 tnum text-label-tertiary">
                                {time(group.lastMessage.createdAt)}
                              </span>
                            ) : null}
                          </span>

                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-caption text-label-tertiary">
                              {group.lastMessage
                                ? `${group.lastMessage.authorName.split(' ')[0]}: ${group.lastMessage.text}`
                                : t('chat.empty')}
                            </span>
                            {group.unreadCount > 0 ? (
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-caption-2 font-semibold text-white">
                                {group.unreadCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>

          {/* ============ Yozishma ============ */}
          <section className={cn('flex flex-col', activeId ? 'flex' : 'hidden md:flex')}>
            {active ? (
              <Conversation
                groupId={active.id}
                groupName={active.name}
                memberCount={active.memberIds.length}
                onBack={() => setActiveId(null)}
                onSent={() => setVersion((v) => v + 1)}
              />
            ) : (
              <EmptyState
                icon={<MessageSquare size={24} strokeWidth={1.75} />}
                title={t('chat.selectGroup')}
                description={t('chat.selectGroupHint')}
              />
            )}
          </section>
        </div>
      </Card>

      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={(id) => {
          setVersion((v) => v + 1)
          setActiveId(id)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Yozishma                                                            */
/* ------------------------------------------------------------------ */

function Conversation({
  groupId,
  groupName,
  memberCount,
  onBack,
  onSent,
}: {
  groupId: string
  groupName: string
  memberCount: number
  onBack: () => void
  onSent: () => void
}) {
  const { t } = useI18n()
  const { session } = useAuth()

  const [text, setText] = useState('')
  const [version, setVersion] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const userId = session?.user.id ?? ''
  const { data, loading, error, reload } = useAsync(
    () => getMessages(groupId),
    [groupId, version],
  )

  const send = useAction(async () =>
    sendMessage({
      groupId,
      authorId: userId,
      authorName: session?.user.fullName ?? '',
      text: text.trim(),
    }),
  )

  // Suhbat ochilganda o'qilgan deb belgilaymiz
  useEffect(() => {
    if (!userId) return
    void markGroupRead(groupId, userId).then(onSent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId])

  // Yangi xabar kelganda pastga suramiz
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [data])

  async function submit() {
    if (!text.trim()) return
    const result = await send.run()
    if (!result) return
    setText('')
    setVersion((v) => v + 1)
    onSent()
  }

  return (
    <>
      {/* --- Sarlavha --- */}
      <header className="hairline flex items-center gap-3 px-4 py-3">
        <IconButton label={t('action.back')} onClick={onBack} className="md:hidden">
          <span className="text-lg">←</span>
        </IconButton>

        <Avatar name={groupName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-subhead font-medium text-label">{groupName}</p>
          <p className="truncate text-caption text-label-tertiary">
            {t('chat.membersCount', { count: memberCount })}
          </p>
        </div>
      </header>

      {/* --- Xabarlar --- */}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <CardSkeleton className="border-0 shadow-none" />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title={t('chat.empty')} description={t('chat.emptyHint')} />
        ) : (
          <MessageList messages={data!} currentUserId={userId} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* --- Yozish maydoni --- */}
      <div className="hairline-t flex items-end gap-2 p-3">
        <textarea
          rows={1}
          value={text}
          placeholder={t('chat.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter — yuborish, Shift+Enter — yangi qator
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          className={cn(
            'max-h-32 min-h-10 flex-1 resize-none rounded-[12px] bg-sunken px-3.5 py-2.5',
            'text-subhead text-label placeholder:text-label-tertiary',
            'border border-transparent outline-none transition-colors duration-150',
            'focus:border-accent focus:bg-raised',
          )}
        />
        <Button
          icon={<Send size={16} />}
          disabled={!text.trim()}
          loading={send.pending}
          onClick={submit}
        >
          <span className="hidden sm:inline">{t('chat.send')}</span>
        </Button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Xabarlar ro'yxati                                                   */
/* ------------------------------------------------------------------ */

function MessageList({
  messages,
  currentUserId,
}: {
  messages: ChatMessage[]
  currentUserId: string
}) {
  const { t } = useI18n()

  /** Sana ajratgichi matni */
  function dayLabel(iso: string): string {
    const diff = dayDiff(new Date(iso), new Date())
    if (diff === 0) return t('chat.today')
    if (diff === -1) return t('chat.yesterday')
    return new Date(iso).toLocaleDateString()
  }

  let lastDay = ''

  return (
    <ul className="space-y-1">
      {messages.map((message, index) => {
        const mine = message.authorId === currentUserId
        const day = message.createdAt.slice(0, 10)
        const showDay = day !== lastDay
        lastDay = day

        // Ketma-ket kelgan o'z xabarlarida ism takrorlanmaydi
        const previous = messages[index - 1]
        const grouped =
          previous?.authorId === message.authorId &&
          previous.createdAt.slice(0, 10) === day

        return (
          <li key={message.id}>
            {showDay ? (
              <p className="my-3 text-center text-caption text-label-tertiary">
                {dayLabel(message.createdAt)}
              </p>
            ) : null}

            <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-[14px] px-3.5 py-2',
                  mine
                    ? 'bg-accent text-white'
                    : 'bg-sunken text-label',
                  // Ketma-ket xabarlarda burchak yumshoqroq
                  grouped && (mine ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]'),
                )}
              >
                {!mine && !grouped ? (
                  <p className="mb-0.5 text-caption font-semibold text-accent">
                    {message.authorName}
                  </p>
                ) : null}

                <p className="whitespace-pre-wrap break-words text-subhead">{message.text}</p>

                <p
                  className={cn(
                    'mt-0.5 text-right text-caption-2 tnum',
                    mine ? 'text-white/70' : 'text-label-tertiary',
                  )}
                >
                  {time(message.createdAt)}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Yangi guruh                                                         */
/* ------------------------------------------------------------------ */

function NewGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { session } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [touched, setTouched] = useState(false)

  const { data: users } = useAsync(() => listUsers(), [])

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setName('')
    setDescription('')
    setMembers([])
  }, [open])

  const create = useAction(async () =>
    createChatGroup(
      { name: name.trim(), description: description.trim(), memberIds: members },
      session?.user.id ?? '',
    ),
  )

  const nameError = touched && !name.trim() ? t('valid.required') : undefined

  async function submit() {
    setTouched(true)
    if (!name.trim()) return

    const result = await create.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('chat.created'))
    onCreated(result.id)
    onClose()
  }

  // O'zimizni ro'yxatda ko'rsatmaymiz — yaratuvchi doim a'zo
  const candidates = (users ?? []).filter((u) => u.id !== session?.user.id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('chat.newGroup')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={create.pending}>
            {t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('chat.groupName')}
          required
          value={name}
          error={nameError}
          onChange={(e) => setName(e.target.value)}
        />

        <TextArea
          label={t('chat.groupDescription')}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <p className="mb-2 text-footnote font-medium text-label-secondary">
            {t('chat.members')}
            {members.length > 0 ? ` · ${members.length}` : ''}
          </p>

          <ul className="max-h-64 space-y-1 overflow-y-auto scroll-slim rounded-[12px] bg-sunken p-2">
            {candidates.map((user) => {
              const selected = members.includes(user.id)
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setMembers((current) =>
                        selected
                          ? current.filter((id) => id !== user.id)
                          : [...current, user.id],
                      )
                    }
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left',
                      'transition-colors duration-150',
                      selected ? 'bg-accent-soft' : 'hover:bg-fill-4',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="h-4 w-4 shrink-0 accent-[var(--ios-blue)]"
                    />
                    <Avatar name={user.fullName} src={user.avatarUrl} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-subhead text-label">
                        {user.fullName}
                      </span>
                      <span className="block truncate text-caption text-label-tertiary">
                        {t(`role.${user.role}`)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2 text-caption text-warn">
          <Users size={14} className="mt-0.5 shrink-0" />
          {t('chat.realtimeNote')}
        </p>
      </div>
    </Modal>
  )
}
