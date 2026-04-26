"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Github, Loader2, Code2, MonitorPlay, Save, Settings, Maximize, Minimize, Undo2, Redo2, FolderPlus, MessageSquare, Cloud, UserCircle, Triangle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; isCode?: boolean };
type Project = { id: string; name: string; messages: Message[]; codeHistory: string[] };

export default function FuishanApp() {
  // App Settings
  const[showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const[model, setModel] = useState("gemma-4-31b-it");

  // GitHub & Vercel
  const [showGithubConfig, setShowGithubConfig] = useState(false);
  const[githubPAT, setGithubPAT] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [fileName, setFileName] = useState("index.html");
  const[isPushing, setIsPushing] = useState(false);

  // Projects & History (Features 1 & 4)
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // UI States
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false); // Feature 6
  const[toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Current Project Helpers
  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentCode = currentProject?.codeHistory[historyIndex] || null;

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initialization
  useEffect(() => {
    const savedPAT = localStorage.getItem("fuishan_github_pat");
    const savedRepo = localStorage.getItem("fuishan_github_repo");
    const savedApiKey = localStorage.getItem("fuishan_api_key");
    const savedModel = localStorage.getItem("fuishan_model");
    const savedProjects = localStorage.getItem("fuishan_projects");

    if (savedPAT) setGithubPAT(savedPAT);
    if (savedRepo) setGithubRepo(savedRepo);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);

    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      setProjects(parsed);
      if (parsed.length > 0) {
        setCurrentProjectId(parsed[0].id);
        setHistoryIndex(parsed[0].codeHistory.length - 1);
      }
    } else {
      createNewProject();
    }
  },[]);

  // Save projects to LocalStorage
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem("fuishan_projects", JSON.stringify(projects));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [projects]);

  const createNewProject = () => {
    const newProj: Project = {
      id: Date.now().toString(),
      name: `Project ${projects.length + 1}`,
      messages: [],
      codeHistory:[]
    };
    setProjects(prev => [...prev, newProj]);
    setCurrentProjectId(newProj.id);
    setHistoryIndex(-1);
  };

  // Feature 1: Undo / Redo Logic
  const handleUndo = () => {
    if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  };
  const handleRedo = () => {
    if (currentProject && historyIndex < currentProject.codeHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentProjectId) return;
    if (!apiKey) {
      showToast("Please set your API Key in Settings.", "error");
      setShowSettings(true);
      return;
    }

    const newMessage: Message = { role: "user", content: input };
    
    // Update local state instantly for UI
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId ? { ...p, messages: [...p.messages, newMessage] } : p
    ));
    setInput("");
    setIsLoading(true);

    const projectMessages = currentProject?.messages || [];
    const payloadMessages =[...projectMessages, newMessage].map((msg, idx, arr) => {
      if (msg.role === "assistant" && msg.isCode && idx < arr.length - 2) {
        return { role: "assistant", content: "[Previous code omitted for memory.]" };
      }
      return msg;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, apiKey, model }),
      });
      
      const data = await res.json();
      
      setProjects(prev => prev.map(p => {
        if (p.id !== currentProjectId) return p;
        
        let updatedHistory = [...p.codeHistory];
        let newMsg: Message;

        if (data.isCode) {
          // Slice history to current index in case they hit Undo then generated new code
          updatedHistory = updatedHistory.slice(0, historyIndex + 1);
          updatedHistory.push(data.code);
          setHistoryIndex(updatedHistory.length - 1);
          newMsg = { role: "assistant", content: "Code updated! Check the preview.", isCode: true };
        } else {
           // AI Asked a question (Feature 5)
          newMsg = { role: "assistant", content: data.raw, isCode: false };
        }

        return { ...p, messages: [...p.messages, newMsg], codeHistory: updatedHistory };
      }));

    } catch (error) {
      showToast("Generation failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubPush = async () => {
    if (!githubPAT || !githubRepo) { setShowGithubConfig(true); return; }
    if (!currentCode) return;

    setIsPushing(true);
    localStorage.setItem("fuishan_github_pat", githubPAT);
    localStorage.setItem("fuishan_github_repo", githubRepo);

    try {
      const [repoOwner, repoName] = githubRepo.split('/');
      const repoUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
      const repoRes = await fetch(repoUrl, { headers: { Authorization: `token ${githubPAT}` } });

      if (repoRes.status === 404) {
        await fetch(`https://api.github.com/user/repos`, {
          method: "POST",
          headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: repoName, auto_init: true }),
        });
        await new Promise(r => setTimeout(r, 1500));
      }

      const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;
      const getRes = await fetch(fileUrl, { headers: { Authorization: `token ${githubPAT}` } });
      let sha = null;
      if (getRes.ok) sha = (await getRes.json()).sha;

      const base64Content = btoa(unescape(encodeURIComponent(currentCode)));
      const putRes = await fetch(fileUrl, {
        method: "PUT",
        headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `FUISHAN Update 🚀`, content: base64Content, ...(sha ? { sha } : {}) }),
      });

      if (putRes.ok) showToast("Pushed to GitHub!", "success");
      else throw new Error("Failed to write to GitHub.");
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setIsPushing(false);
    }
  };

  return (
    // LIQUID GLASS BACKGROUND
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-[#0a0514] to-black text-white p-4 flex gap-4 font-sans selection:bg-purple-500/30 overflow-hidden relative transition-all duration-500">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all animate-in fade-in slide-in-from-top-5 ${
          toast.type === "success" ? "bg-green-500/20 border-green-500/50 text-green-300" : "bg-red-500/20 border-red-500/50 text-red-300"
        }`}>
          {toast.message}
        </div>
      )}

      {/* PANE 1: SIDEBAR (Projects & Auth) */}
      <div className={`${isFullscreen ? "hidden" : "w-64"} bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col gap-6 shadow-2xl transition-all duration-300`}>
        <div className="flex items-center gap-3 text-purple-400 font-bold tracking-widest text-xl">
          <Triangle className="fill-purple-500" size={24} /> FUISHAN
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          <div className="text-xs font-semibold text-gray-500 mb-3 tracking-wider">WORKSPACE</div>
          {projects.map(p => (
            <button 
              key={p.id} 
              onClick={() => { setCurrentProjectId(p.id); setHistoryIndex(p.codeHistory.length - 1); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all ${currentProjectId === p.id ? "bg-purple-500/20 text-purple-200 border border-purple-500/30" : "text-gray-400 hover:bg-white/5"}`}
            >
              <MessageSquare size={16} /> <span className="truncate">{p.name}</span>
            </button>
          ))}
          <button onClick={createNewProject} className="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 text-gray-400 hover:bg-white/5 hover:text-white transition-all mt-2">
            <FolderPlus size={16} /> New Project
          </button>
        </div>

        {/* Auth & Drive Integrations (Feature 3 & 7) */}
        <div className="space-y-2 pt-4 border-t border-white/10">
           <button onClick={() => showToast("OAuth Setup Required. See instructions.", "error")} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-white/10 text-gray-300 transition-all">
              <UserCircle size={16} /> Sign In
           </button>
           <button onClick={() => showToast("Google Cloud API Required. See instructions.", "error")} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-white/10 text-gray-300 transition-all">
              <Cloud size={16} /> Link G-Drive
           </button>
        </div>
      </div>

      {/* PANE 2: CHAT INTERFACE */}
      <div className={`${isFullscreen ? "hidden" : "w-[400px]"} bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col shadow-2xl relative transition-all duration-300`}>
        
        {/* Chat Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 rounded-t-3xl">
           <span className="font-medium text-gray-200">Vibe Console</span>
           <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-purple-400 transition-colors">
             <Settings size={18} />
           </button>
        </div>

        {/* Settings Overlay */}
        {showSettings && (
          <div className="absolute top-16 left-0 w-full bg-[#13072e]/95 backdrop-blur-3xl border-b border-white/10 p-5 z-20 shadow-2xl">
            <input type="password" placeholder="Google AI Studio Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-black/50 border border-white/10 text-sm p-3 mb-3 rounded-xl focus:outline-none focus:border-purple-500 transition-all" />
            <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-black/50 border border-white/10 text-sm p-3 mb-4 rounded-xl focus:outline-none focus:border-purple-500 text-gray-300 appearance-none">
              <option value="gemma-4-31b-it">Gemma 4 (31B)</option>
              <option value="gemma-2-27b-it">Gemma 2 (27B)</option>
            </select>
            <button onClick={() => setShowSettings(false)} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-sm transition-all shadow-lg shadow-purple-500/20">Save Configuration</button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {currentProject?.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 blur-xl absolute opacity-20"></div>
              <p className="text-sm z-10">Describe your app vibe...</p>
            </div>
          )}
          {currentProject?.messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] leading-relaxed ${
                msg.role === "user" ? "bg-purple-600/80 backdrop-blur-md text-white shadow-lg" : "bg-white/10 backdrop-blur-md border border-white/5 text-gray-200"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center text-purple-400 gap-2 text-sm bg-white/5 self-start px-4 py-3 rounded-2xl w-fit">
              <Loader2 className="animate-spin" size={16} /> Forging code...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-3xl">
          <div className="relative flex items-center bg-black/40 border border-white/10 rounded-2xl focus-within:border-purple-500/50 transition-all overflow-hidden">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="E.g. build a glassmorphic music player..."
              className="w-full bg-transparent p-4 pr-12 text-sm text-gray-200 focus:outline-none resize-none h-14"
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="absolute right-2 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-50 transition-all">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* PANE 3: PREVIEW / SANDBOX */}
      <div className={`${isFullscreen ? "fixed inset-4 z-50" : "flex-1"} bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col shadow-2xl relative transition-all duration-500 overflow-hidden`}>
        
        {/* Sandbox Topbar */}
        <div className="h-16 border-b border-white/10 bg-white/5 flex items-center justify-between px-6">
          <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <button onClick={() => setView("preview")} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all ${view === "preview" ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"}`}>
              <MonitorPlay size={14} /> Preview
            </button>
            <button onClick={() => setView("code")} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all ${view === "code" ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"}`}>
              <Code2 size={14} /> Code
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Feature 1: Undo/Redo Version Control */}
            <div className="flex items-center gap-1 bg-black/40 rounded-xl border border-white/5 p-1">
              <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all" title="Undo Code"><Undo2 size={16}/></button>
              <button onClick={handleRedo} disabled={!currentProject || historyIndex >= currentProject.codeHistory.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all" title="Redo Code"><Redo2 size={16}/></button>
            </div>

            {/* Feature 6: Fullscreen */}
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-400 hover:text-white bg-black/40 rounded-xl border border-white/5 transition-all">
              {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
            </button>

            {/* Deploy Config */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
               {showGithubConfig ? (
                 <div className="flex items-center gap-2">
                   <input type="text" placeholder="user/repo" value={githubRepo} onChange={(e)=>setGithubRepo(e.target.value)} className="bg-black/50 border border-white/10 text-xs p-2 rounded-lg focus:border-purple-500 w-24" />
                   <input type="password" placeholder="PAT" value={githubPAT} onChange={(e)=>setGithubPAT(e.target.value)} className="bg-black/50 border border-white/10 text-xs p-2 rounded-lg focus:border-purple-500 w-20" />
                   <button onClick={() => setShowGithubConfig(false)} className="bg-purple-600 text-xs px-3 py-2 rounded-lg hover:bg-purple-500">Save</button>
                 </div>
               ) : (
                 <>
                   <button onClick={() => setShowGithubConfig(true)} className="p-2 text-gray-400 hover:text-white transition-all"><Settings size={16}/></button>
                   <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="bg-black/40 border border-white/5 text-xs p-2 rounded-xl text-gray-300 focus:outline-none focus:border-purple-500 w-28" />
                   <button onClick={handleGithubPush} disabled={!currentCode || isPushing} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all rounded-xl shadow-lg shadow-purple-500/20 text-sm font-medium disabled:opacity-50">
                    {isPushing ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />} Push
                   </button>
                   
                   {/* Feature 2: Deploy to Vercel */}
                   {githubRepo && (
                     <a href={`https://vercel.com/new/clone?repository-url=https://github.com/${githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-[#111] text-white border border-white/20 transition-all rounded-xl shadow-lg text-sm font-medium">
                       ▲ Vercel
                     </a>
                   )}
                 </>
               )}
            </div>
          </div>
        </div>

        {/* Sandbox Frame */}
        <div className="flex-1 w-full bg-[#050505] relative rounded-b-3xl overflow-hidden">
          {!currentCode ? (
             <div className="flex h-full items-center justify-center text-gray-600 font-medium tracking-widest bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
               WAITING FOR INPUT...
             </div>
          ) : view === "preview" ? (
            <iframe
              srcDoc={currentCode}
              title="Sandbox"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
            />
          ) : (
            <div className="w-full h-full overflow-auto p-6 text-gray-300 text-sm font-mono leading-relaxed bg-[#0a0514]">
              <pre><code>{currentCode}</code></pre>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
