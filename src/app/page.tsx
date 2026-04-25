const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages: Message[] =[...messages, { role: "user", content: input }];
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
        // Now it will actually show you the specific API error!
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
