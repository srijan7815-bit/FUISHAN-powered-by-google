"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Github, Loader2, Code2, MonitorPlay, Save, Settings, Maximize, Minimize, Undo2, Redo2, FolderPlus, MessageSquare, Cloud, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen, Hexagon, Trash2 } from "lucide-react";
// FIREBASE IMPORTS
import { auth, db, googleProvider } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

type Message = { role: "user" | "assistant"; content: string; isCode?: boolean };
type Project = { id: string; name: string; messages: Message[]; codeHistory: string[] };

export default function FuishanApp() {
  const[showSettings, setShowSettings] = useState(false);
  const[apiKey, setApiKey] = useState("");
  const[model, setModel] = useState("gemma-4-31b-it");

  const[showGithubConfig, setShowGithubConfig] = useState(false);
  const [githubPAT, setGithubPAT] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const[fileName, setFileName] = useState("index.html");
  const [isPushing, setIsPushing] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const[currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [user, setUser] = useState<User | null>(null);
  const[isSyncing, setIsSyncing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false); 
  
  const [input, setInput] = useState("");
  const[isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const[isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat"); 
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentCode = currentProject?.codeHistory[historyIndex] || null;

  // INCEPTION SHIELD
  const injectedScript = `<script>
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (!href || href === '/' || href === '#' || href.endsWith('.html')) {
          e.preventDefault();
        }
      }
    });
  </script>`;
  
  let safeCurrentCode = currentCode || "";
  if (safeCurrentCode && safeCurrentCode.includes("</head>")) {
    safeCurrentCode = safeCurrentCode.replace("</head>", injectedScript + "</head>");
  } else if (safeCurrentCode) {
    safeCurrentCode = injectedScript + safeCurrentCode;
  }

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // INITIALIZATION & FIREBASE AUTH
  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);

    const savedPAT = localStorage.getItem("fuishan_github_pat");
    const savedRepo = localStorage.getItem("fuishan_github_repo");
    const savedApiKey = localStorage.getItem("fuishan_api_key");
    const savedModel = localStorage.getItem("fuishan_model");

    if (savedPAT) setGithubPAT(savedPAT);
    if (savedRepo) setGithubRepo(savedRepo);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()?.projects?.length > 0) {
            const cloudProjects = docSnap.data().projects;
            setProjects(cloudProjects);
            setCurrentProjectId(cloudProjects[0].id);
            setHistoryIndex(cloudProjects[0].codeHistory.length - 1);
          } else {
            createNewProject();
          }
        } catch (error) {
          showToast("Firebase Error: Check Firestore Security Rules!", "error");
          createNewProject();
        }
      } else {
        const savedProjects = localStorage.getItem("fuishan_projects");
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
      }
      setIsLoaded(true); 
    });

    return () => unsubscribe();
  },[]);

  // AUTO-SAVE
  useEffect(() => {
    if (!isLoaded || projects.length === 0) return;
    localStorage.setItem("fuishan_projects", JSON.stringify(projects));
    
    if (user) {
      const syncToCloud = async () => {
        setIsSyncing(true);
        try { 
          const sanitizedProjects = JSON.parse(JSON.stringify(projects));
          await setDoc(doc(db, "users", user.uid), { projects: sanitizedProjects }, { merge: true }); 
        } catch (e) { 
          showToast("Cloud Sync Blocked: Check Firebase Rules!", "error"); 
        } finally { 
          setIsSyncing(false); 
        }
      };
      const timeoutId = setTimeout(syncToCloud, 2000);
      return () => clearTimeout(timeoutId);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  },[projects, user, isLoaded]);

  // WORKSPACE CONTROLS
  const createNewProject = () => {
    const newProj: Project = { id: Date.now().toString(), name: `Project ${projects.length + 1}`, messages:[], codeHistory:[] };
    setProjects(prev =>[...prev, newProj]);
    setCurrentProjectId(newProj.id);
    setHistoryIndex(-1);
    if (window.innerWidth < 768) setIsSidebarOpen(false); 
  };

  const deleteProject = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation(); 
    if (!confirm("Are you sure you want to delete this project?")) return;
    setProjects(prev => {
      const updatedProjects = prev.filter(p => p.id !== idToDelete);
      if (updatedProjects.length === 0) {
        const freshProj: Project = { id: Date.now().toString(), name: `Project 1`, messages: [], codeHistory:[] };
        setCurrentProjectId(freshProj.id);
        setHistoryIndex(-1);
        return [freshProj];
      }
      if (currentProjectId === idToDelete) {
        setCurrentProjectId(updatedProjects[0].id);
        setHistoryIndex(updatedProjects[0].codeHistory.length - 1);
      }
      return updatedProjects;
    });
    showToast("Project deleted.", "success");
  };

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); showToast("Signed in!", "success"); } catch (error) { showToast("Sign in failed. Check config.", "error"); } };
  const handleLogout = async () => { await signOut(auth); setProjects([]); showToast("Signed out.", "success"); };
  const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(prev => prev - 1); };
  const handleRedo = () => { if (currentProject && historyIndex < currentProject.codeHistory.length - 1) setHistoryIndex(prev => prev + 1); };

  // AI REQUEST
  const handleSend = async () => {
    if (!input.trim() || !currentProjectId) return;
    if (!apiKey) { showToast("Please set your API Key in Settings.", "error"); setShowSettings(true); return; }

    const newMessage: Message = { role: "user", content: input };
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, messages:[...p.messages, newMessage] } : p));
    setInput("");
    setIsLoading(true);

    const projectMessages = currentProject?.messages ||[];
    const payloadMessages =[...projectMessages, newMessage].map((msg, idx, arr) => {
      if (msg.role === "assistant" && msg.isCode && idx < arr.length - 2) return { role: "assistant", content: "[Code omitted]" };
      return msg;
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, apiKey, model }),
      });
      const data = await res.json();
      
      if (!res.ok || data.error) throw new Error(data.error || "The AI Provider returned an error.");
      
      setProjects(prev => prev.map(p => {
        if (p.id !== currentProjectId) return p;
        let updatedHistory =[...p.codeHistory];
        let newMsg: Message;
        
        if (data.isCode) {
          updatedHistory = updatedHistory.slice(0, historyIndex + 1);
          updatedHistory.push(data.code);
          setHistoryIndex(updatedHistory.length - 1);
          newMsg = { role: "assistant", content: "Code updated! Check the preview.", isCode: true };
          if (window.innerWidth < 768) setMobileTab("preview"); 
        } else {
          newMsg = { role: "assistant", content: data.raw, isCode: false };
        }
        return { ...p, messages:[...p.messages, newMsg], codeHistory: updatedHistory };
      }));
    } catch (error) {
      showToast(`API Error: ${(error as Error).message}`, "error");
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
        await fetch(`https://api.github.com/user/repos`, { method: "POST", headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: repoName, auto_init: true }) });
        await new Promise(r => setTimeout(r, 1500));
      }
      const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;
      const getRes = await fetch(fileUrl, { headers: { Authorization: `token ${githubPAT}` } });
      let sha = null;
      if (getRes.ok) sha = (await getRes.json()).sha;
      const base64Content = btoa(unescape(encodeURIComponent(currentCode)));
      const putRes = await fetch(fileUrl, {
        method: "PUT", headers: { Authorization: `token ${githubPAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: `FUISHAN Update 🚀`, content: base64Content, ...(sha ? { sha } : {}) }),
      });
      if (putRes.ok) showToast("Pushed to GitHub!", "success");
      else throw new Error("Failed to write to GitHub.");
    } catch (error) { showToast((error as Error).message, "error"); } finally { setIsPushing(false); }
  };

  return (
    <>
      <style>{`
        /* FLUID GLASSMORPHISM BACKGROUND */
        @keyframes fluid1 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(5%, -10%) scale(1.2); } 66% { transform: translate(-5%, 5%) scale(0.9); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes fluid2 { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-10%, 5%) scale(1.1); } 66% { transform: translate(10%, -5%) scale(1.3); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes fluid3 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(5%, 10%) scale(1.4); } 100% { transform: translate(0, 0) scale(1); } }
        .fluid-bg { position: absolute; inset: 0; overflow: hidden; background: #030303; z-index: 0; }
        .f-blob1 { position: absolute; top: -20%; left: -10%; width: 70%; height: 70%; background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 60%); animation: fluid1 15s infinite ease-in-out; filter: blur(60px); }
        .f-blob2 { position: absolute; bottom: -20%; right: -10%; width: 80%; height: 80%; background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 60%); animation: fluid2 18s infinite ease-in-out reverse; filter: blur(60px); }
        .f-blob3 { position: absolute; top: 30%; left: 30%; width: 50%; height: 50%; background: radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 60%); animation: fluid3 20s infinite ease-in-out; filter: blur(60px); }
        .glass-overlay { position: absolute; inset: 0; backdrop-filter: blur(40px); background: rgba(0,0,0,0.4); z-index: 10; }
        .glass-content { position: relative; z-index: 20; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      `}</style>

      {/* 100dvh for Mobile browsers to ignore URL bar height */}
      <div className="h-[100dvh] w-screen overflow-hidden bg-[#030303] text-white p-2 md:p-4 flex gap-2 md:gap-4 font-sans selection:bg-purple-500/30 relative">
        
        {toast && (
          <div className={`absolute top-4 md:top-6 left-1/2 transform -translate-x-1/2 z-[99999] w-[90%] md:w-auto px-6 py-3 text-center rounded-full backdrop-blur-xl border shadow-2xl transition-all animate-in fade-in slide-in-from-top-5 ${toast.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {toast.message}
          </div>
        )}

        {/* MOBILE SIDEBAR BACKDROP */}
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] transition-opacity duration-300 md:hidden ${isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} 
          onClick={() => setIsSidebarOpen(false)} 
        />

        {/* PANE 1: SIDEBAR */}
        <div className={`
          bg-[#0a0a0a]/95 md:bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-2xl md:rounded-3xl flex flex-col gap-6 shadow-2xl overflow-hidden shrink-0 transition-all duration-500
          absolute inset-y-2 left-2 z-[100] w-[260px] p-4 border border-white/5 
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-[120%]"}
          md:relative md:inset-auto md:translate-x-0 md:z-auto
          ${!isSidebarOpen ? "md:w-0 md:p-0 md:border-none md:opacity-0" : "md:w-64 md:p-5 md:border md:border-white/5"}
        `}>
          <div className="flex items-center justify-between min-w-max">
            <div className="flex items-center gap-3 text-white font-bold tracking-widest text-xl">
              <Hexagon className="text-purple-500 fill-purple-500/10" size={24} /> FUISHAN
            </div>
            {isSyncing && <span title="Syncing to Cloud..."><Cloud size={16} className="text-purple-500 animate-pulse" /></span>}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide min-w-max">
            <div className="text-xs font-semibold text-gray-500 mb-3 tracking-wider">WORKSPACE</div>
            {projects.map(p => (
              <div key={p.id} className={`group w-full rounded-xl text-sm flex items-center justify-between transition-all border ${currentProjectId === p.id ? "bg-white/10 text-white border-white/10 shadow-lg" : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                <button onClick={() => { setCurrentProjectId(p.id); setHistoryIndex(p.codeHistory.length - 1); if(window.innerWidth<768) setIsSidebarOpen(false); }} className="flex-1 flex items-center gap-3 px-3 py-2 truncate text-left outline-none">
                  <MessageSquare size={16} className="shrink-0" /> <span className="truncate">{p.name}</span>
                </button>
                <button onClick={(e) => deleteProject(e, p.id)} className="px-3 py-2 md:opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0 outline-none" title="Delete Project"><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={createNewProject} className="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 text-gray-500 hover:bg-white/5 hover:text-white transition-all active:scale-95 mt-2">
              <FolderPlus size={16} /> New Project
            </button>
          </div>

          <div className="space-y-2 pt-4 border-t border-white/5 min-w-max">
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 bg-white/5 rounded-xl border border-white/5">
                   <img src={user.photoURL || ""} alt="User" className="w-6 h-6 rounded-full border border-white/20" />
                   <span className="truncate">{user.displayName}</span>
                </div>
                <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 transition-all active:scale-95">
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-white/10 text-gray-300 transition-all active:scale-95 border border-white/5">
                <UserCircle size={16} /> Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* PANE 2: CHAT INTERFACE */}
        <div className={`
          bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/5 rounded-2xl md:rounded-3xl flex-col shadow-2xl relative transition-all duration-300 shrink-0
          ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex w-full flex-1'}
          ${isFullscreen ? "md:hidden" : "md:w-[400px] md:flex-none"}
        `}>
          <div className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-3 md:px-4 bg-white/5 rounded-t-2xl md:rounded-t-3xl shrink-0">
             <div className="flex items-center gap-2 md:gap-3">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95">
                 {isSidebarOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}
               </button>
               <span className="font-medium text-gray-200 text-sm tracking-wide">Vibe Console</span>
             </div>
             <div className="flex items-center gap-1 md:gap-2">
               <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:text-purple-400 hover:bg-white/10 rounded-xl transition-all active:scale-95"><Settings size={18} /></button>
               {/* MOBILE ONLY: Switch to Preview Tab */}
               <button onClick={() => setMobileTab('preview')} className="md:hidden p-2 text-purple-400 hover:bg-white/10 rounded-xl transition-all active:scale-95">
                 <MonitorPlay size={18} />
               </button>
             </div>
          </div>

          {showSettings && (
            <div className="absolute top-14 md:top-16 left-0 w-full bg-[#050505]/95 backdrop-blur-3xl border-b border-white/10 p-5 z-20 shadow-2xl">
              <input type="password" placeholder="Google AI Studio Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} 
                className="w-full bg-white/5 border border-white/10 text-sm p-3 mb-3 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all relative z-50" />
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-white/5 border border-white/10 text-sm p-3 mb-4 rounded-xl focus:outline-none focus:border-purple-500 text-gray-300 appearance-none transition-all">
                <option value="gemma-4-31b-it">Gemma 4 (31B)</option>
                <option value="gemma-2-27b-it">Gemma 2 (27B)</option>
              </select>
              <button onClick={() => setShowSettings(false)} className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-sm transition-all active:scale-95 border border-white/10">Save Configuration</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 scrollbar-hide min-h-0">
            {currentProject?.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
                <Hexagon className="w-12 h-12 text-gray-400" />
                <p className="text-sm z-10 tracking-wide">Describe your app vibe...</p>
              </div>
            )}
            {currentProject?.messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm max-w-[90%] leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-white/10 border border-white/10 backdrop-blur-md text-white shadow-lg" : "bg-transparent text-gray-300"}`}>{msg.content}</div>
              </div>
            ))}
            {isLoading && <div className="flex items-center text-gray-400 gap-2 text-sm bg-white/5 border border-white/5 self-start px-4 py-3 rounded-2xl w-fit shadow-lg"><Loader2 className="animate-spin" size={16} /> Forging code...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 md:p-4 border-t border-white/5 bg-white/5 rounded-b-2xl md:rounded-b-3xl shrink-0">
            <div className="relative flex items-end bg-[#050505] border border-white/10 rounded-2xl focus-within:border-purple-500/50 focus-within:-translate-y-1 md:focus-within:-translate-y-2 focus-within:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden group">
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                placeholder="Build a glassmorphic..." 
                className="w-full bg-transparent p-4 pr-12 text-sm text-gray-200 focus:outline-none resize-none h-14 focus:h-[120px] md:focus:h-32 transition-all duration-300 scrollbar-hide" 
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()} className="absolute right-2 bottom-2 p-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl disabled:opacity-50 transition-all active:scale-90"><Send size={16} /></button>
            </div>
          </div>
        </div>

        {/* PANE 3: PREVIEW / SANDBOX */}
        <div className={`
          bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/5 rounded-2xl md:rounded-3xl flex-col shadow-2xl relative transition-all duration-500 overflow-hidden
          ${mobileTab === 'chat' ? 'hidden md:flex' : 'flex'}
          flex-1 min-w-0
          ${isFullscreen ? "!fixed !inset-0 z-[9999] !bg-[#050505] !rounded-none !border-none" : ""}
        `}>
          <div className="h-14 md:h-16 border-b border-white/5 bg-white/5 flex items-center justify-between px-2 md:px-6 shrink-0 overflow-x-auto scrollbar-hide">
            
            {/* LEFT SIDE CONTROLS */}
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {/* MOBILE ONLY: Switch back to Chat Tab */}
              <button onClick={() => setMobileTab('chat')} className="md:hidden p-2 text-purple-400 hover:bg-white/10 rounded-xl shrink-0 active:scale-95">
                 <MessageSquare size={18} />
              </button>

              <div className="flex gap-1 bg-[#050505] p-1 rounded-xl border border-white/5 shrink-0">
                <button onClick={() => setView("preview")} className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 rounded-lg text-sm transition-all active:scale-95 ${view === "preview" ? "bg-white/10 text-white shadow-md border border-white/5" : "text-gray-500 hover:text-white"}`}><MonitorPlay size={14} /> <span className="hidden sm:inline">Preview</span></button>
                <button onClick={() => setView("code")} className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 rounded-lg text-sm transition-all active:scale-95 ${view === "code" ? "bg-white/10 text-white shadow-md border border-white/5" : "text-gray-500 hover:text-white"}`}><Code2 size={14} /> <span className="hidden sm:inline">Code</span></button>
              </div>
            </div>

            {/* RIGHT SIDE CONTROLS */}
            <div className="flex items-center gap-1 md:gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-[#050505] rounded-xl border border-white/5 p-1 shrink-0">
                <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all active:scale-90" title="Undo"><Undo2 size={16}/></button>
                <button onClick={handleRedo} disabled={!currentProject || historyIndex >= currentProject.codeHistory.length - 1} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all active:scale-90" title="Redo"><Redo2 size={16}/></button>
              </div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="hidden md:block p-2 text-gray-500 hover:text-white bg-[#050505] rounded-xl border border-white/5 transition-all active:scale-90 shrink-0">
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
              </button>

              <div className="flex items-center gap-2 ml-2 md:ml-4 pl-2 md:pl-4 border-l border-white/10 shrink-0">
                 {showGithubConfig ? (
                   <div className="flex items-center gap-1 md:gap-2 group">
                     <input type="text" placeholder="user/repo" value={githubRepo} onChange={(e)=>setGithubRepo(e.target.value)} className="bg-white/5 border border-white/10 text-xs p-2 rounded-lg focus:outline-none focus:border-purple-500 transition-all w-20 md:w-24 focus:w-28 md:focus:w-32" />
                     <input type="password" placeholder="PAT" value={githubPAT} onChange={(e)=>setGithubPAT(e.target.value)} className="bg-white/5 border border-white/10 text-xs p-2 rounded-lg focus:outline-none focus:border-purple-500 transition-all w-16 md:w-20 focus:w-20 md:focus:w-28" />
                     <button onClick={() => setShowGithubConfig(false)} className="bg-white/10 text-xs px-2 md:px-3 py-2 rounded-lg border border-white/10 hover:bg-white/20 active:scale-95 transition-all shrink-0">Save</button>
                   </div>
                 ) : (
                   <>
                     <button onClick={() => setShowGithubConfig(true)} className="p-2 text-gray-500 hover:text-white transition-all active:scale-90 shrink-0"><Settings size={16}/></button>
                     <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="bg-[#050505] border border-white/5 text-xs p-2 rounded-xl text-gray-300 focus:outline-none focus:border-white/20 transition-all w-24 md:w-28 focus:w-28 md:focus:w-36 hidden sm:block shrink-0" />
                     <button onClick={handleGithubPush} disabled={!currentCode || isPushing} className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 rounded-xl border border-white/10 text-xs md:text-sm font-medium disabled:opacity-50 shrink-0">
                      {isPushing ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Github size={14} className="shrink-0" />} <span className="hidden sm:inline">Push</span>
                     </button>
                     {githubRepo && (
                       <a href={`https://vercel.com/new/clone?repository-url=https://github.com/${githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-black hover:bg-[#111] text-white border border-white/20 transition-all active:scale-95 rounded-xl shadow-lg text-xs md:text-sm font-medium shrink-0">
                         ▲ <span className="hidden sm:inline">Vercel</span>
                       </a>
                     )}
                   </>
                 )}
              </div>
            </div>
          </div>

          <div className={`flex-1 min-h-0 w-full bg-[#030303] relative overflow-hidden flex flex-col ${isFullscreen ? "rounded-none" : "rounded-b-2xl md:rounded-b-3xl"}`}>
            {!safeCurrentCode ? (
               <div className="flex h-full items-center justify-center relative">
                 <div className="fluid-bg">
                   <div className="f-blob1"></div>
                   <div className="f-blob2"></div>
                   <div className="f-blob3"></div>
                   <div className="glass-overlay"></div>
                   <div className="glass-content">
                     <div className="font-bold tracking-[0.3em] md:tracking-[0.5em] text-white/50 z-10 text-lg md:text-xl pointer-events-none text-center px-4">AWAITING INPUT</div>
                   </div>
                 </div>
               </div>
            ) : view === "preview" ? (
              <iframe srcDoc={safeCurrentCode} className="w-full h-full border-none bg-white flex-1" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
            ) : (
              <div className="w-full flex-1 overflow-auto p-4 md:p-6 text-gray-300 text-xs md:text-sm font-mono leading-relaxed bg-[#050505]">
                <pre><code>{currentCode}</code></pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
