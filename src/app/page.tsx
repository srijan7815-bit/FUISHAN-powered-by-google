"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Github, Loader2, Code2, MonitorPlay, Save, Settings, Trash2 } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; isCode?: boolean };

export default function FuishanApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const[view, setView] = useState<"preview" | "code">("preview");

  // App Settings (API & Model)
  const [showSettings, setShowSettings] = useState(false);
  const[apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemma-4-31b-it");

  // GitHub States
  const [showGithubConfig, setShowGithubConfig] = useState(false);
  const [githubPAT, setGithubPAT] = useState("");
  const[githubRepo, setGithubRepo] = useState("");
  const [fileName, setFileName] = useState("index.html");
  const[isPushing, setIsPushing] = useState(false);

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Show Toast Helper
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load everything from local storage on mount
  useEffect(() => {
    const savedPAT = localStorage.getItem("fuishan_github_pat");
    const savedRepo = localStorage.getItem("fuishan_github_repo");
    const savedApiKey = localStorage.getItem("fuishan_api_key");
    const savedModel = localStorage.getItem("fuishan_model");
    const savedChat = localStorage.getItem("fuishan_chat_history");
    const savedCode = localStorage.getItem("fuishan_current_code");

    if (savedPAT) setGithubPAT(savedPAT);
    if (savedRepo) setGithubRepo(savedRepo);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);
    
    if (savedChat) setMessages(JSON.parse(savedChat));
    if (savedCode) setCurrentCode(savedCode);
  },[]);

  // Save chat history automatically when it updates
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("fuishan_chat_history", JSON.stringify(messages));
    }
    if (currentCode) {
      localStorage.setItem("fuishan_current_code", currentCode);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentCode]);

  const clearHistory = () => {
    if(confirm("Are you sure you want to clear the chat history and current project?")) {
      setMessages([]);
      setCurrentCode(null);
      localStorage.removeItem("fuishan_chat_history");
      localStorage.removeItem("fuishan_current_code");
      showToast("History cleared", "success");
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiKey) {
      showToast("Please set your API Key in Settings first.", "error");
      setShowSettings(true);
      return;
    }

    const newMessages: Message[] = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // MEMORY FIX: Compress old code blocks so we don't crash the API context limit
    const payloadMessages = newMessages.map((msg, index) => {
      if (msg.role === "assistant" && msg.isCode && index < newMessages.length - 2) {
        return { role: "assistant", content: "[Previous HTML omitted to save memory. Focus on the most recent request.]" };
      }
      return msg;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: payloadMessages, 
          apiKey, 
          model 
        }),
      });
      
      const data = await res.json();
      
      if (data.code) {
        setCurrentCode(data.code);
        setMessages((prev) => [...prev, { role: "assistant", content: "Code generated. Vibe Check ready.", isCode: true }]);
      } else if (data.error) {
        setMessages((prev) =>[...prev, { role: "assistant", content: `API Error: ${data.error}` }]);
        showToast("API Error occurred", "error");
      }
    } catch (error) {
      setMessages((prev) =>[...prev, { role: "assistant", content: "Network Error: Failed to connect to API." }]);
      showToast("Network connection failed", "error");
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
    if (!fileName.endsWith('.html')) {
      showToast("Filename must end with .html", "error");
      return;
    }

    setIsPushing(true);
    localStorage.setItem("fuishan_github_pat", githubPAT);
    localStorage.setItem("fuishan_github_repo", githubRepo);

    try {
      const repoParts = githubRepo.split('/');
      const repoOwner = repoParts[0];
      const repoName = repoParts[1];

      // 1. Check if repo exists
      const repoUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
      const repoRes = await fetch(repoUrl, { headers: { Authorization: `token ${githubPAT}` } });

      if (repoRes.status === 404) {
        const createRes = await fetch(`https://api.github.com/user/repos`, {
          method: "POST",
          headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: repoName,
            description: "App vibe-coded using FUISHAN 🚀",
            private: false,
            auto_init: true
          }),
        });
        if (!createRes.ok) throw new Error("Could not create repository.");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // 2. Push the file
      const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;
      const getRes = await fetch(fileUrl, { headers: { Authorization: `token ${githubPAT}` } });
      let sha = null;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      const base64Content = btoa(unescape(encodeURIComponent(currentCode)));

      const putRes = await fetch(fileUrl, {
        method: "PUT",
        headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `FUISHAN: Deployed ${fileName} 🚀`,
          content: base64Content,
          ...(sha ? { sha } : {}),
        }),
      });

      if (putRes.ok) {
        showToast(`Pushed ${fileName} to GitHub!`, "success");
        setShowGithubConfig(false);
      } else {
        throw new Error("Failed to write file to GitHub.");
      }
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white bg-dot-matrix font-mono relative overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute bottom-6 right-6 z-50 px-6 py-3 rounded border font-dot tracking-widest text-sm shadow-lg transform transition-all animate-in slide-in-from-bottom-5 ${
          toast.type === "success" ? "bg-black border-green-500 text-green-500" : "bg-black border-red-500 text-red-500"
        }`}>
          {toast.message}
        </div>
      )}

      {/* LEFT PANEL: Chat & Controls */}
      <div className="w-1/3 flex flex-col border-r border-[#222] bg-black/80 backdrop-blur-md z-10">
        
        {/* Header */}
        <div className="p-6 border-b border-[#222] flex justify-between items-center">
          <h1 className="text-3xl font-bold font-dot tracking-widest text-red-500">FUISHAN</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => { setShowSettings(!showSettings); setShowGithubConfig(false); }}
              className={`p-2 rounded-md transition-colors ${showSettings ? "bg-red-500/20 text-red-500" : "hover:bg-[#222]"}`}
              title="API Settings"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => { setShowGithubConfig(!showGithubConfig); setShowSettings(false); }}
              className={`p-2 rounded-md transition-colors ${showGithubConfig ? "bg-red-500/20 text-red-500" : "hover:bg-[#222]"}`}
              title="GitHub Setup"
            >
              <Github size={18} />
            </button>
          </div>
        </div>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
            <p className="text-xs text-gray-400 mb-4 font-sans">Configure your AI Provider. Keys are stored locally.</p>
            <input
              type="password"
              placeholder="Google AI Studio API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-2 rounded focus:outline-none focus:border-red-500"
            />
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-4 rounded focus:outline-none focus:border-red-500 text-gray-300"
            >
              <option value="gemma-4-31b-it">Google Gemma 4 (31B)</option>
              <option value="gemma-2-27b-it">Google Gemma 2 (27B)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            </select>
            <button 
              onClick={() => {
                localStorage.setItem("fuishan_api_key", apiKey);
                localStorage.setItem("fuishan_model", model);
                showToast("Settings Saved", "success");
                setShowSettings(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded text-sm hover:bg-gray-200 transition-colors"
            >
              <Save size={16} /> Save Settings
            </button>
          </div>
        )}

        {/* GitHub Config Dropdown */}
        {showGithubConfig && (
          <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
            <input
              type="password"
              placeholder="GitHub PAT (repo scope)"
              value={githubPAT}
              onChange={(e) => setGithubPAT(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-2 rounded focus:outline-none focus:border-red-500"
            />
            <input
              type="text"
              placeholder="Username/Repo (e.g. srijan/new-app)"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              className="w-full bg-black border border-[#333] text-sm p-2 mb-4 rounded focus:outline-none focus:border-red-500"
            />
            <button 
              onClick={() => {
                localStorage.setItem("fuishan_github_pat", githubPAT);
                localStorage.setItem("fuishan_github_repo", githubRepo);
                showToast("GitHub Credentials Saved", "success");
                setShowGithubConfig(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded text-sm hover:bg-gray-200 transition-colors"
            >
              <Save size={16} /> Save GitHub Settings
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

        {/* Chat Input & Clear History */}
        <div className="p-4 border-t border-[#222] bg-black">
          {messages.length > 0 && (
             <button onClick={clearHistory} className="text-xs text-gray-500 flex items-center gap-1 mb-2 hover:text-red-500 transition-colors">
               <Trash2 size={12}/> Clear History
             </button>
          )}
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

          {/* New Custom Filename Input */}
          <div className="flex items-center gap-2">
             <input 
               type="text"
               value={fileName}
               onChange={(e) => setFileName(e.target.value)}
               placeholder="filename.html"
               className="bg-[#111] border border-[#333] text-xs p-1.5 rounded text-gray-300 focus:outline-none focus:border-red-500 w-32"
             />
             <button
              onClick={handleGithubPush}
              disabled={!currentCode || isPushing}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded text-xs border border-red-500/30 disabled:opacity-50"
            >
              {isPushing ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
              Push
            </button>
          </div>
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
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
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
