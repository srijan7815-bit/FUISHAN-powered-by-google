"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Github, Loader2, Code2, MonitorPlay, Save } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function FuishanApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const[view, setView] = useState<"preview" | "code">("preview");

  // GitHub States
  const [showGithubConfig, setShowGithubConfig] = useState(false);
  const[githubPAT, setGithubPAT] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const[isPushing, setIsPushing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load GitHub config from local storage on first mount
  useEffect(() => {
    const savedPAT = localStorage.getItem("fuishan_github_pat");
    const savedRepo = localStorage.getItem("fuishan_github_repo");
    if (savedPAT) setGithubPAT(savedPAT);
    if (savedRepo) setGithubRepo(savedRepo);
  },[]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages: Message[] = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      
      const data = await res.json();
      
      if (data.code) {
        setCurrentCode(data.code);
        setMessages((prev) =>[...prev, { role: "assistant", content: "Code generated. Vibe Check ready." }]);
      } else if (data.error) {
        setMessages((prev) =>[...prev, { role: "assistant", content: `API Error: ${data.error}` }]);
      } else {
        setMessages((prev) =>[...prev, { role: "assistant", content: "Error: AI responded but returned empty code." }]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) =>[...prev, { role: "assistant", content: "Network Error: Failed to connect to API." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubPush = async () => {
    if (!githubPAT || !githubRepo) {
      setShowGithubConfig(true);
      return;
    }
    if (!currentCode) return;

    setIsPushing(true);
    // Save locally so user doesn't have to enter it again
    localStorage.setItem("fuishan_github_pat", githubPAT);
    localStorage.setItem("fuishan_github_repo", githubRepo);

    try {
      const path = "index.html";
      const url = `https://api.github.com/repos/${githubRepo}/contents/${path}`;
      
      // 1. Check if file exists to get the SHA
      const getRes = await fetch(url, { headers: { Authorization: `token ${githubPAT}` } });
      let sha = null;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      // 2. Base64 encode the code in the browser safely
      const base64Content = btoa(unescape(encodeURIComponent(currentCode)));

      // 3. Push file
      const putRes = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `token ${githubPAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "FUISHAN: Vibe-coded update 🚀",
          content: base64Content,
          ...(sha ? { sha } : {}),
        }),
      });

      if (putRes.ok) {
        alert("Successfully pushed to GitHub!");
        setShowGithubConfig(false);
      } else {
        const err = await putRes.json();
        alert(`Failed to push: ${err.message}`);
      }
    } catch (error) {
      alert("An error occurred pushing to GitHub.");
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white bg-dot-matrix font-mono">
      {/* LEFT PANEL: Chat & Controls */}
      <div className="w-1/3 flex flex-col border-r border-[#222] bg-black/80 backdrop-blur-md">
        
        {/* Header */}
        <div className="p-6 border-b border-[#222] flex justify-between items-center">
          <h1 className="text-3xl font-bold font-dot tracking-widest text-red-500">FUISHAN</h1>
          <button 
            onClick={() => setShowGithubConfig(!showGithubConfig)}
            className={`p-2 rounded-md transition-colors ${showGithubConfig ? "bg-red-500/20 text-red-500" : "hover:bg-[#222]"}`}
            title="GitHub Settings"
          >
            <Github size={20} />
          </button>
        </div>

        {/* GitHub Config Dropdown */}
        {showGithubConfig && (
          <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
            <p className="text-xs text-gray-400 mb-4 font-sans">
              Enter your credentials to push generated apps directly to a repo. Credentials are saved locally.
            </p>
            <input
              type="password"
              placeholder="GitHub PAT"
              value={githubPAT}
              onChange={(e) => setGithubPAT(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-2 rounded focus:outline-none focus:border-red-500"
            />
            <input
              type="text"
              placeholder="Username/Repo (e.g. jdoe/my-app)"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-4 rounded focus:outline-none focus:border-red-500"
            />
            <button 
              onClick={() => {
                localStorage.setItem("fuishan_github_pat", githubPAT);
                localStorage.setItem("fuishan_github_repo", githubRepo);
                setShowGithubConfig(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded text-sm hover:bg-gray-200 transition-colors"
            >
              <Save size={16} /> Save Locally
            </button>
          </div>
        )}

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-[#555] flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-4xl font-dot text-[#333]">VIBE IT INTO EXISTENCE</div>
              <p className="text-sm font-sans max-w-xs">Describe your app idea naturally. E.g. "Build me a minimalist pomodoro timer with a lo-fi aesthetic."</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`px-4 py-2 rounded-lg text-sm max-w-[85%] ${
                msg.role === "user" ? "bg-[#111] border border-[#333] text-gray-200" : "bg-transparent text-red-500 font-dot text-lg"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center text-red-500 space-x-2">
              <Loader2 className="animate-spin" size={16} />
              <span className="font-dot">Generating Code...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-[#222] bg-black">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your app vibe..."
              className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-3 pr-12 text-sm text-gray-200 focus:outline-none focus:border-red-500 resize-none h-24"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute bottom-3 right-3 p-2 bg-white text-black rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Sandbox Output */}
      <div className="w-2/3 flex flex-col relative bg-white">
        {/* Top bar over iframe */}
        <div className="absolute top-0 w-full h-12 bg-black/90 border-b border-[#222] flex items-center justify-between px-4 z-10">
          <div className="flex gap-1 bg-[#111] p-1 rounded-md border border-[#333]">
            <button 
              onClick={() => setView("preview")}
              className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${view === "preview" ? "bg-[#333] text-white" : "text-gray-400 hover:text-white"}`}
            >
              <MonitorPlay size={14} /> Preview
            </button>
            <button 
              onClick={() => setView("code")}
              className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${view === "code" ? "bg-[#333] text-white" : "text-gray-400 hover:text-white"}`}
            >
              <Code2 size={14} /> Code
            </button>
          </div>

          <button
            onClick={handleGithubPush}
            disabled={!currentCode || isPushing}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded text-xs border border-red-500/30 disabled:opacity-50"
          >
            {isPushing ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
            Push to GitHub
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full h-full pt-12 bg-black">
          {!currentCode ? (
             <div className="flex h-full items-center justify-center text-[#333] font-dot text-2xl tracking-widest bg-dot-matrix">
               AWAITING INSTRUCTIONS_
             </div>
          ) : view === "preview" ? (
            <iframe
              srcDoc={currentCode}
              title="Sandbox"
              className="w-full h-full bg-white border-none"
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
            />
          ) : (
            <div className="w-full h-full overflow-auto bg-[#0a0a0a] p-6 text-gray-300 text-sm">
              <pre className="whitespace-pre-wrap break-words"><code>{currentCode}</code></pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
