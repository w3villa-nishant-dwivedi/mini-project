"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function appendMessages(current, incoming) {
  const messagesById = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messagesById.set(message.id, message));
  return [...messagesById.values()].slice(-100);
}

export default function RoomChat({ roomId, fullscreen = false }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [openReactionMenu, setOpenReactionMenu] = useState(null);
  const [composerEmojiMenuOpen, setComposerEmojiMenuOpen] = useState(false);
  const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉"];
  const cursorRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const [scrollIndicator, setScrollIndicator] = useState({
    height: 0,
    top: 0,
    visible: false,
  });

  useEffect(() => {
    let active = true;
    let timeoutId;

    async function pollMessages() {
      const cursor = cursorRef.current;
      const query = cursor
        ? `?after=${encodeURIComponent(cursor.createdAt)}&afterId=${encodeURIComponent(cursor.id)}`
        : "";

      try {
        const response = await fetch(`/api/rooms/${roomId}/chat${query}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load chat");
        }

        if (active) {
          if (data.messages.length > 0) {
            const lastMessage = data.messages[data.messages.length - 1];
            cursorRef.current = {
              createdAt: lastMessage.createdAt,
              id: lastMessage.id,
            };
            setMessages((current) => appendMessages(current, data.messages));
          } else if (!cursorRef.current) {
            cursorRef.current = {
              createdAt: new Date().toISOString(),
              id: "",
            };
          }
          setError("");
        }
      } catch (pollError) {
        if (active) setError(pollError.message);
      }

      if (active) timeoutId = setTimeout(pollMessages, 2500);
    }

    pollMessages();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(
    () => () => {
      clearTimeout(scrollTimeoutRef.current);
    },
    []
  );

  function handleMessagesScroll(event) {
    const element = event.currentTarget;
    const viewportHeight = element.clientHeight;
    const scrollableHeight = element.scrollHeight;

    if (scrollableHeight <= viewportHeight) return;

    const thumbHeight = Math.max(
      16,
      (viewportHeight / scrollableHeight) * viewportHeight
    );
    const maxThumbTop = viewportHeight - thumbHeight;
    const scrollProgress =
      element.scrollTop / (scrollableHeight - viewportHeight);

    setScrollIndicator({
      height: thumbHeight,
      top: maxThumbTop * scrollProgress,
      visible: true,
    });
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setScrollIndicator((current) => ({ ...current, visible: false }));
    }, 700);
  }

  async function postMessage(content, clearDraft = true) {
    if (!content || sending) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not send message");
      }
      cursorRef.current = {
        createdAt: data.message.createdAt,
        id: data.message.id,
      };
      setMessages((current) => appendMessages(current, [data.message]));
      if (clearDraft) setDraft("");
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    void postMessage(draft.trim());
  }

  function sendEmojiMessage(emoji) {
    setComposerEmojiMenuOpen(false);
    void postMessage(emoji, false);
  }

  async function toggleReaction(messageId, emoji) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not add reaction");
      }
      setMessages((current) => appendMessages(current, [data.message]));
      setOpenReactionMenu(null);
    } catch (reactionError) {
      setError(reactionError.message);
    }
  }

  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border border-white/10 bg-transparent p-14 sm:p-6 ${
        fullscreen
          ? "relative h-full w-full  min-h-0 max-h-none rounded-none border-0"
          : "max-h-100 absolute bottom-15 right-5 min-w-10 md:h-[420px] md:min-h-0 md:self-start lg:h-[460px]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        {/* <h2 className="text-lg font-semibold">Live chat</h2> */}
        <span className="flex absolute right-10 items-center gap-2 text-xs text-gray-400">
          <span className="h-2 w-2   rounded-full bg-emerald-400" aria-hidden="true" />
          Room chat
        </span>
      </div>

      <div className="relative mt-4 min-h-0 flex-1">
        <div
          aria-live="polite"
          onScroll={handleMessagesScroll}
          className="room-chat-messages h-full min-h-0 space-y-4 overflow-y-auto bg-transparent"
        >
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">No messages yet. Say hello!</p>
          )}
          {messages.map((message) => (
            <article key={message.id} className="break-words">
              <p className="text-xs font-medium text-purple-300">
                {message.user.name || "User"}
                <time className="ml-2 font-normal text-gray-500">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-200">
                {message.content}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(message.reactions || []).map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => toggleReaction(message.id, reaction.emoji)}
                    aria-label={`${reaction.reacted ? "Remove" : "Add"} ${reaction.emoji} reaction`}
                    className={`rounded-full border px-2 py-0.5 text-xs transition ${
                      reaction.reacted
                        ? "border-purple-400/70 bg-purple-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {reaction.emoji} <span className="text-gray-300">{reaction.count}</span>
                  </button>
                ))}
                <div className="relative">
                  
                  {openReactionMenu === message.id && (
                    <div className="absolute bottom-8 left-0 z-20 flex gap-1 rounded-xl border border-white/10 bg-neutral-950 p-2 shadow-xl">
                      {reactionEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(message.id, emoji)}
                          aria-label={`React with ${emoji}`}
                          className="rounded-md px-1.5 py-1 text-base transition hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {scrollIndicator.visible && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-10 w-1 rounded-full bg-gray-400/80"
            style={{
              height: `${scrollIndicator.height}px`,
              transform: `translateY(${scrollIndicator.top}px)`,
            }}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={sendMessage} className="mt-4 flex gap-2 border-t border-white/10 pt-4">
        <Input
          className="min-w-0 flex-1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Write a message..."
          aria-label="Chat message"
        />
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            aria-label="Send an emoji"
            aria-expanded={composerEmojiMenuOpen}
            onClick={() => setComposerEmojiMenuOpen((open) => !open)}
            disabled={sending}
          >
            🙂
          </Button>
          {composerEmojiMenuOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-2 flex gap-1 rounded-xl border border-white/10 bg-neutral-950 p-2 shadow-xl">
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendEmojiMessage(emoji)}
                  aria-label={`Send ${emoji}`}
                  className="rounded-md px-1.5 py-1 text-base transition hover:bg-white/10"
                  disabled={sending}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </form>
    </section>
  );
}
