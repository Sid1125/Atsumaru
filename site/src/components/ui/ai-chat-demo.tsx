"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

const CHAT_SCRIPT: ChatMessage[] = [
  { role: "user", text: "What's a good spot for ramen in Shibuya tonight?" },
  { role: "ai", text: "Try Fuunji near Shinjuku — their tsukemen is incredible. There's a Board Game Night meetup nearby at 8 PM if you want company!" },
  { role: "user", text: "Anyone into hiking near Tokyo this weekend?" },
  { role: "ai", text: "Found 3 groups heading to Mt. Takao on Saturday. One has a spot open — they're grabbing yakiniku after. Want me to hold your spot?" },
  { role: "user", text: "I just moved to Japan. How do I meet people?" },
  { role: "ai", text: "You're already in the right place. I'll match you with 4-5 people nearby who share your interests. No swiping, no profiles — just real plans." },
];

function ThinkingDots() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex items-center gap-2 text-white/50">
        <Sparkles className="w-4 h-4 text-accent animate-pulse" />
        <span className="text-sm font-medium">AtsumaruAI is thinking</span>
      </div>
      <div className="flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent typing-dot"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function TypingBubble({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (index < text.length) {
        index += 1;
        setDisplayed(text.substring(0, index));
        timer = setTimeout(tick, 18 + Math.random() * 22);
      } else {
        timer = setTimeout(onDone, 2000);
      }
    }

    tick();

    return () => clearTimeout(timer);
  }, [text, onDone]);

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
      </div>
      <div className="text-sm text-white/90 leading-relaxed max-w-md">
        {displayed}
        {displayed.length < text.length && (
          <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}

export function AIChatDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  // A ref, not state: the script loop polls it and nothing renders from it.
  const visibleRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(scrollToBottom, [messages, typingIdx, scrollToBottom]);

  // Start only when the component is in view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !visibleRef.current) {
            visibleRef.current = true;
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    function sleep(ms: number) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
      });
    }

    async function waitForVisible() {
      while (!visibleRef.current && !signal.aborted) {
        await sleep(100);
      }
    }

    async function run() {
      await waitForVisible();
      if (signal.aborted) return;
      setMessages([]);
      setTypingIdx(null);
      setThinking(false);
      await sleep(1500);

      while (!signal.aborted) {
        for (let i = 0; i < CHAT_SCRIPT.length; i++) {
          if (signal.aborted) return;
          const msg = CHAT_SCRIPT[i];

          if (msg.role === "user") {
            setMessages((prev) => [...prev, msg]);
            setThinking(true);
            await sleep(1200 + Math.random() * 600);
          } else {
            setThinking(false);
            setMessages((prev) => {
              const next = [...prev, msg];
              setTypingIdx(next.length - 1);
              return next;
            });
            await sleep(msg.text.length * 20 + 2500);
            setTypingIdx(null);
          }
        }

        await sleep(3000);
        if (signal.aborted) return;
        setMessages([]);
        setTypingIdx(null);
        setThinking(false);
        await sleep(1000);
      }
    }

    run().catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-lg mx-auto">
      <div className="rounded-3xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AtsumaruAI</p>
            <p className="text-[10px] text-white/40">Always learning, always matching</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-[320px] max-h-[400px] overflow-y-auto py-4 space-y-2">
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex justify-end px-5">
                <div className="bg-accent-strong text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%] leading-relaxed">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={i}>
                {i === typingIdx ? (
                  <TypingBubble text={msg.text} onDone={() => setTypingIdx(null)} />
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="text-sm text-white/90 leading-relaxed max-w-md">
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {thinking && <ThinkingDots />}
        </div>
      </div>
    </div>
  );
}
