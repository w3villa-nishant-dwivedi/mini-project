"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function appendMessages(current, incoming) {
  const ids = new Set(current.map((message) => message.id));
  return [
    ...current,
    ...incoming.filter((message) => !ids.has(message.id)),
  ].slice(-100);
}

export default function RoomChat({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
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
      setDraft("");
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex max-h-100 absolute bottom-20 right-5 min-w-10 flex-col rounded-2xl border border-white/10 bg-transparent p-4 sm:p-6 md:h-[420px] md:min-h-0 md:self-start lg:h-[460px]">
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
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Write a message..."
          aria-label="Chat message"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </form>
    </section>
  );
}
