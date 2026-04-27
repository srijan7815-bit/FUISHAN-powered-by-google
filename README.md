# FUISHAN-powered-by-google
<div align="center">
  <img src="https://img.icons8.com/fluency-systems-regular/96/a855f7/hexagon.png" alt="Fuishan Logo" width="80" />
  
  # FUISHAN 
  **The Zero-Setup Vibe Coding Sandbox**
  
  Go from an idea to a functional web app using only natural language. No terminal, no local environment, no manual coding. Just pure creation.

  [![Next.js](https://img.shields.io/badge/Built_with-Next.js-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Styled_with-Tailwind-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
  [![Firebase](https://img.shields.io/badge/Powered_by-Firebase-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](https://opensource.org/licenses/MIT)
</div>

---

## 🌌 What is FUISHAN?
FUISHAN is an open-source, AI-powered IDE designed for "Vibe Coding." It leverages Google's open-weights **Gemma 4** models to instantly generate, render, and iterate on Single-Page Applications (SPAs) in a secure, hot-reloading iframe sandbox. 

Whether you want to build a Pomodoro timer, a futuristic dashboard, or a multi-page portfolio, you just describe it, and FUISHAN writes the HTML, Tailwind, and Vanilla JS in real-time.

## ✨ Features

- **🎨 Liquid Glassmorphism UI:** A stunning, fully animated, responsive workspace built with Tailwind CSS.
- **🧠 Bring Your Own Key (BYOK):** 100% free to use. Plug in your own Google AI Studio key and never hit a paywall.
- **🛡️ Inception Shield:** Intelligent iframe sandboxing that intercepts broken links to prevent sandbox crashes.
- **⏪ Time Travel Version Control:** Instantly Undo or Redo code iterations if the AI takes the UI in the wrong direction.
- **☁️ Firebase Cloud Sync:** Sign in with Google to automatically save your workspaces, chat history, and generated code to the cloud.
- **🚀 One-Click Deployments:** Push your AI-generated app directly to a GitHub repository, or deploy it instantly to a live URL via Vercel.

---

## 🛠️ Tech Stack
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend:** Next.js Route Handlers.
- **AI Integration:** Google AI Studio (OpenAI-compatible endpoint targeting `gemma-4-31b-it`).
- **Database & Auth:** Firebase Auth (Google Provider) & Firestore.

---

## 🚀 Getting Started (Run it Locally)

Want to run your own instance of FUISHAN? It takes less than 3 minutes.

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/fuishan.git
cd fuishan
npm install
