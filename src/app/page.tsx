"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Github, Loader2, Code2, MonitorPlay, Save, Settings, Maximize, Minimize, Undo2, Redo2, FolderPlus, MessageSquare, Cloud, UserCircle, Triangle, LogOut, PanelLeftClose, PanelLeftOpen, Hexagon } from "lucide-react";
import { auth, db, googleProvider } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

type Message = { role: "user" | "assistant"; content: string; isCode?: boolean };
type Project = { id: string; name: string; messages: Message[]; codeHistory: string[] };

export default function FuishanApp() {
  const[showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const[model, setModel] = useState("gemma-4-31b-it");

  const[showGithubConfig, setShowGithubConfig] = useState(false);
  const [githubPAT, setGithubPAT] = useState("");
  const[githubRepo, setGithubRepo] = useState("");
  const [fileName, setFileName] = useState("index.html");
  const[isPushing, setIsPushing] = useState(false);

  const[projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const[user, setUser] = useState<User | null>(null);
  const[isSyncing, setIsSyncing] = useState(false);
  
  const [input, setInput] = useState("");
  const[isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const[isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentCode = currentProject?.codeHistory[historyIndex] || null;

  // INCEPTION SHIELD: Inject JS into the generated code to block standard <a> tags from crashing the iframe
  const injectedScript = `<script>
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (!href || href === '/' || href === '#' || href.endsWith('.html')) {
          e.preventDefault();
          console.log('FUISHAN SHIELD: Blocked bad link navigation.');
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
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
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
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().projects?.length > 0) {
          const cloudProjects = docSnap.data().projects;
          setProjects(cloudProjects);
          setCurrentProjectId(cloudProjects[0].id);
          setHistoryIndex(cloudProjects[0].codeHistory.length - 1);
        } else createNewProject();
      } else {
        const savedProjects = localStorage.getItem("fuishan_projects");
        if (savedProjects) {
          const parsed = JSON.parse(savedProjects);
          setProjects(parsed);
          if (parsed.length > 0) {
             setCurrentProjectId(parsed[0].id);
             setHistoryIndex(parsed[0].codeHistory.length - 1);
          }
        } else createNewProject();
      }
    });

    return () => unsubscribe();
  },[]);

  useEffect(() => {
    if (projects.length === 0) return;
    localStorage.setItem("fuishan_projects", JSON.stringify(projects));
    
    if (user) {
      const syncToCloud = async () => {
        setIsSyncing(true);
        try { await setDoc(doc(db, "users", user.uid), { projects }, { merge: true }); } 
        catch (e) { console.error("Cloud sync failed", e); } 
        finally { setIsSyncing(false); }
      };
      const timeoutId = setTimeout(syncToCloud, 2000);
      return () => clearTimeout(timeoutId);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [projects, user]);

  const createNewProject = () => {
    const newProj: Project = { id: Date.now().toString(), name: `Project ${projects.length + 1}`, messages: [], codeHistory:[] };
    setProjects(prev => [...prev, newProj]);
    setCurrentProjectId(newProj.id);
    setHistoryIndex(-1);
  };

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); showToast("Signed in!", "success"); } catch (error) { showToast("Sign in failed. Check Firebase config.", "error"); } };
  const handleLogout = async () => { await signOut(auth); setProjects([]); showToast("Signed out.", "success"); };
  const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(prev => prev - 1); };
  const handleRedo = () => { if (currentProject && historyIndex < currentProject.codeHistory.length - 1) setHistoryIndex(prev => prev + 1); };

  const handleSend = async () => {
    if (!input.trim() || !currentProjectId) return;
    if (!apiKey) { showToast("Please set your API Key in Settings.", "error"); setShowSettings(true); return; }

    const newMessage: Message = { role: "user", content: input };
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, messages:[...p.messages, newMessage] } : p));
    setInput("");
    setIsLoading(true);

    const projectMessages = currentProject?.messages || [];
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
      
      setProjects(prev => prev.map(p => {
        if (p.id !== currentProjectId) return p;
        let updatedHistory =[...p.codeHistory];
        let newMsg: Message;
        if (data.isCode) {
          updatedHistory = updatedHistory.slice(0, historyIndex + 1);
          updatedHistory.push(data.code);
          setHistoryIndex(updatedHistory.length - 1);
          newMsg = { role: "assistant", content: "Code updated! Check the preview.", isCode: true };
        } else {
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
        @keyframes liquidWobble {
          0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: scale(1) rotate(0deg); }
          50% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: scale(1.05) rotate(180deg); }
          100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: scale(1) rotate(360deg); }
        }
        .liquid-drop {
          animation: liquidWobble 12s ease-in-out infinite;
          background: linear-gradient(135deg, #a855f7, #6366f1, #ec4899);
          box-shadow: inset 0 0 50px rgba(255,255,255,0.3), 0 20px 50px rgba(168,85,247,0.4);
        }
      `}</style>

      <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-[#0a0514] to-black text-white p-4 flex gap-4 font-sans selection:bg-purple-500/30">
        
        {toast && (
          <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full backdrop-blur-md border shadow-2xl transition-all animate-in fade-in slide-in-from-top-5 ${toast.type === "success" ? "bg-green-500/20 border-green-500/50 text-green-300" : "bg-red-500/20 border-red-500/50 text-red-300"}`}>
            {toast.message}
          </div>
        )}

        {/* PANE 1: SIDEBAR */}
        <div className={`${isFullscreen || !isSidebarOpen ? "w-0 p-0 border-none opacity-0" : "w-64 p-5 border border-white/10"} bg-white/5 backdrop-blur-xl rounded-3xl flex flex-col gap-6 shadow-2xl transition-all duration-500 overflow-hidden shrink-0`}>
          <div className="flex items-center justify-between min-w-max">
            <div className="flex items-center gap-3 text-white font-bold tracking-widest text-xl">
              <Hexagon className="text-purple-500 fill-purple-500/20 animate-pulse" size={24} /> FUISHAN
            </div>
            {isSyncing && <span title="Syncing to Cloud..."><Cloud size={16} className="text-purple-400 animate-pulse" /></span>}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide min-w-max">
            <div className="text-xs font-semibold text-gray-500 mb-3 tracking-wider">WORKSPACE</div>
            {projects.map(p => (
              <button key={p.id} onClick={() => { setCurrentProjectId(p.id); setHistoryIndex(p.codeHistory.length - 1); }} className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all active:scale-95 ${currentProjectId === p.id ? "bg-purple-500/20 text-purple-200 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]" : "text-gray-400 hover:bg-white/5"}`}>
                <MessageSquare size={16} /> <span className="truncate">{p.name}</span>
              </button>
            ))}
            <button onClick={createNewProject} className="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 text-gray-400 hover:bg-white/5 hover:text-white transition-all active:scale-95 mt-2">
              <FolderPlus size={16} /> New Project
            </button>
          </div>

          <div className="space-y-2 pt-4 border-t border-white/10 min-w-max">
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-3 py-2 text-sm text-green-400 bg-green-500/10 rounded-xl">
                   <img src={user.photoURL || ""} alt="User" className="w-6 h-6 rounded-full" />
                   <span className="truncate">{user.displayName}</span>
                </div>
                <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-300 transition-all active:scale-95">
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="w-full px-3 py-2 rounded-xl text-sm flex items-center gap-3 bg-white/5 hover:bg-white/10 text-gray-300 transition-all active:scale-95">
                <UserCircle size={16} /> Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* PANE 2: CHAT INTERFACE */}
        <div className={`${isFullscreen ? "hidden" : "w-[400px]"} bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col shadow-2xl relative transition-all duration-300 shrink-0`}>
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 bg-white/5 rounded-t-3xl shrink-0">
             <div className="flex items-center gap-3">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95">
                 {isSidebarOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}
               </button>
               <span className="font-medium text-gray-200 text-sm">Vibe Console</span>
             </div>
             <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-400 hover:text-purple-400 hover:bg-white/10 rounded-xl transition-all active:scale-95"><Settings size={18} /></button>
          </div>

          {showSettings && (
            <div className="absolute top-16 left-0 w-full bg-[#13072e]/95 backdrop-blur-3xl border-b border-white/10 p-5 z-20 shadow-2xl">
              <input type="password" placeholder="Google AI Studio Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} 
                className="w-full bg-black/50 border border-white/10 text-sm p-3 mb-3 rounded-xl focus:outline-none focus:border-purple-500 focus:scale-[1.02] focus:shadow-[0_10px_30px_rgba(168,85,247,0.3)] transition-all relative z-50" />
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-black/50 border border-white/10 text-sm p-3 mb-4 rounded-xl focus:outline-none focus:border-purple-500 text-gray-300 appearance-none transition-all">
                <option value="gemma-4-31b-it">Gemma 4 (31B)</option>
                <option value="gemma-2-27b-it">Gemma 2 (27B)</option>
              </select>
              <button onClick={() => setShowSettings(false)} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-purple-500/20">Save Configuration</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide min-h-0">
            {currentProject?.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                <Hexagon className="w-12 h-12 text-purple-400 opacity-50" />
                <p className="text-sm z-10">Describe your app vibe...</p>
              </div>
            )}
            {currentProject?.messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm max-w-[90%] leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-purple-600/80 backdrop-blur-md text-white shadow-lg shadow-purple-900/20" : "bg-white/10 backdrop-blur-md border border-white/5 text-gray-200"}`}>{msg.content}</div>
              </div>
            ))}
            {isLoading && <div className="flex items-center text-purple-400 gap-2 text-sm bg-white/5 self-start px-4 py-3 rounded-2xl w-fit shadow-lg"><Loader2 className="animate-spin" size={16} /> Forging code...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-3xl shrink-0">
            <div className="relative flex items-end bg-black/40 border border-white/10 rounded-2xl focus-within:border-purple-500/50 focus-within:-translate-y-2 focus-within:shadow-[0_20px_50px_rgba(168,85,247,0.3)] transition-all duration-300 overflow-hidden group">
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                placeholder="E.g. build a glassmorphic music player..." 
                className="w-full bg-transparent p-4 pr-12 text-sm text-gray-200 focus:outline-none resize-none h-14 focus:h-32 transition-all duration-300 scrollbar-hide" 
              />
              <button onClick={handleSend} disabled={isLoading || !input.trim()} className="absolute right-2 bottom-2 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-50 transition-all active:scale-90"><Send size={16} /></button>
            </div>
          </div>
        </div>

        {/* PANE 3: PREVIEW / SANDBOX - FULLSCREEN FIXED! */}
        <div className={`${isFullscreen ? "fixed inset-0 z-[999] rounded-none border-none bg-[#0a0514]" : "flex-1 min-w-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl"} flex flex-col shadow-2xl relative transition-all duration-500 overflow-hidden`}>
          <div className="h-16 border-b border-white/10 bg-white/5 flex items-center justify-between px-6 shrink-0">
            <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
              <button onClick={() => setView("preview")} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all active:scale-95 ${view === "preview" ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"}`}><MonitorPlay size={14} /> Preview</button>
              <button onClick={() => setView("code")} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-all active:scale-95 ${view === "code" ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"}`}><Code2 size={14} /> Code</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-black/40 rounded-xl border border-white/5 p-1">
                <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all active:scale-90" title="Undo"><Undo2 size={16}/></button>
                <button onClick={handleRedo} disabled={!currentProject || historyIndex >= currentProject.codeHistory.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-all active:scale-90" title="Redo"><Redo2 size={16}/></button>
              </div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-400 hover:text-white bg-black/40 rounded-xl border border-white/5 transition-all active:scale-90">
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
              </button>

              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                 {showGithubConfig ? (
                   <div className="flex items-center gap-2 group">
                     <input type="text" placeholder="user/repo" value={githubRepo} onChange={(e)=>setGithubRepo(e.target.value)} className="bg-black/50 border border-white/10 text-xs p-2 rounded-lg focus:outline-none focus:border-purple-500 focus:scale-[1.05] focus:shadow-xl transition-all w-24 focus:w-32" />
                     <input type="password" placeholder="PAT" value={githubPAT} onChange={(e)=>setGithubPAT(e.target.value)} className="bg-black/50 border border-white/10 text-xs p-2 rounded-lg focus:outline-none focus:border-purple-500 focus:scale-[1.05] focus:shadow-xl transition-all w-20 focus:w-28" />
                     <button onClick={() => setShowGithubConfig(false)} className="bg-purple-600 text-xs px-3 py-2 rounded-lg hover:bg-purple-500 active:scale-95 transition-all">Save</button>
                   </div>
                 ) : (
                   <>
                     <button onClick={() => setShowGithubConfig(true)} className="p-2 text-gray-400 hover:text-white transition-all active:scale-90"><Settings size={16}/></button>
                     <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="bg-black/40 border border-white/5 text-xs p-2 rounded-xl text-gray-300 focus:outline-none focus:border-purple-500 focus:scale-[1.05] focus:shadow-lg transition-all w-28 focus:w-36" />
                     <button onClick={handleGithubPush} disabled={!currentCode || isPushing} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all active:scale-95 rounded-xl shadow-lg shadow-purple-500/20 text-sm font-medium disabled:opacity-50">
                      {isPushing ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />} Push
                     </button>
                     {githubRepo && (
                       <a href={`https://vercel.com/new/clone?repository-url=https://github.com/${githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-[#111] text-white border border-white/20 transition-all active:scale-95 rounded-xl shadow-lg text-sm font-medium">▲ Vercel</a>
                     )}
                   </>
                 )}
              </div>
            </div>
          </div>

          <div className={`flex-1 min-h-0 w-full bg-[#050505] relative overflow-hidden flex flex-col ${isFullscreen ? "rounded-none" : "rounded-b-3xl"}`}>
            {!safeCurrentCode ? (
               <div className="flex h-full items-center justify-center bg-[#0a0514] relative">
                 <div className="liquid-drop w-64 h-64 opacity-80"></div>
                 <div className="absolute font-bold tracking-[0.5em] text-white/50 z-10 text-xl pointer-events-none mix-blend-overlay">AWAITING INPUT</div>
               </div>
            ) : view === "preview" ? (
              <iframe srcDoc={safeCurrentCode} className="w-full h-full border-none bg-white flex-1" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
            ) : (
              <div className="w-full flex-1 overflow-auto p-6 text-gray-300 text-sm font-mono leading-relaxed bg-[#0a0514]">
                <pre><code>{currentCode}</code></pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
