// @ts-nocheck
// This file is intentionally not type-checked because it runs in the WebView context

// Initialize Prism.js for syntax highlighting
(function() {
  // Load Prism.js if not already loaded
  if (typeof window.Prism === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
    script.onload = () => {
      // Load additional language support
      const languages = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash'];
      languages.forEach(lang => {
        const langScript = document.createElement('script');
        langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
        document.head.appendChild(langScript);
      });
    };
    document.head.appendChild(script);
  }
})();

(function() {
  // Get the VS Code API
  const vscode = acquireVsCodeApi();
  
  // Get UI elements
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const clearButton = document.getElementById('clear-button');
  const modelStatus = document.getElementById('model-status');
  const modelName = document.getElementById('model-name');
  
  // Keep track of streamed response
  let streamedMessageElement = null;
  
  // Initialize UI
  function initialize() {
    // Add event listeners
    if (messageInput) {
      messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
      
      // Add a hint about the Shift+Enter shortcut
      const shortcutHint = document.createElement('div');
      shortcutHint.classList.add('shortcut-hint');
      shortcutHint.textContent = 'Press Shift+Enter for new line';
      
      const statusBar = document.querySelector('.status-bar');
      if (statusBar) {
        statusBar.appendChild(shortcutHint);
      }
    }
    
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }
    
    if (clearButton) {
      clearButton.addEventListener('click', clearChat);
    }
    
    // Set up Change Model button
    const changeModelButton = document.getElementById('change-model-button');
    if (changeModelButton) {
      changeModelButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'changeModel' });
      });
    }
    
    // Focus the input
    if (messageInput) {
      messageInput.focus();
    }
    
    // Load Prism.js for syntax highlighting
    loadPrismForSyntaxHighlighting();
  }
  
  // Load Prism.js dynamically for syntax highlighting
  function loadPrismForSyntaxHighlighting() {
    // Define Prism.js implementation (minimal version)
    window.Prism = {
      manual: true,
      languages: {
        javascript: {
          'comment': [
            { pattern: /\/\/.*/, greedy: true },
            { pattern: /\/\*[\s\S]*?\*\//, greedy: true }
          ],
          'string': { pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/, greedy: true },
          'keyword': /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
          'boolean': /\b(?:true|false)\b/,
          'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
          'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
          'punctuation': /[{}[\];(),.:]/,
          'class-name': /\b[A-Z][a-zA-Z\d_]*\b/,
          'function': /\b[a-z][a-zA-Z\d_]*(?=\()/i
        },
        python: {
          'comment': { pattern: /#.*/, greedy: true },
          'string': { 
            pattern: /(['"])(?:\\.|(?!\1)[^\\\r\n])*\1/, 
            greedy: true
          },
          'keyword': /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
          'boolean': /\b(?:True|False|None)\b/,
          'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
          'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
          'punctuation': /[{}[\];(),.:]/,
          'decorator': /@\w+/,
          'function': /\bdef\s+([a-z_][a-z0-9_]*)/i,
          'class-name': /\bclass\s+([a-z_][a-z0-9_]*)/i
        },
        typescript: {
          'comment': [
            { pattern: /\/\/.*/, greedy: true },
            { pattern: /\/\*[\s\S]*?\*\//, greedy: true }
          ],
          'string': { pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/, greedy: true },
          'keyword': /\b(?:abstract|as|async|await|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|module|namespace|new|null|of|package|private|protected|public|readonly|return|require|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/,
          'boolean': /\b(?:true|false)\b/,
          'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
          'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
          'punctuation': /[{}[\];(),.:]/,
          'class-name': /\b[A-Z][a-zA-Z\d_]*\b/,
          'function': /\b[a-z][a-zA-Z\d_]*(?=\()/i,
          'builtin': /\b(?:Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|RegExp|String|Promise|Symbol)\b/
        },
        html: {
          'comment': /<!--[\s\S]*?-->/,
          'tag': {
            pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
            greedy: true,
            inside: {
              'tag': {
                pattern: /^<\/?[^\s>\/]+/,
                inside: {
                  'punctuation': /^<\/?/,
                  'namespace': /^[^\s>\/:]+:/
                }
              },
              'attr-value': {
                pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
                inside: {
                  'punctuation': [/^=/, /^"|"$|^'|'$/]
                }
              },
              'punctuation': /\/?>/,
              'attr-name': {
                pattern: /[^\s>\/]+/,
                inside: {
                  'namespace': /^[^\s>\/:]+:/
                }
              }
            }
          },
          'entity': /&[\da-z]{1,8};/i
        },
        css: {
          'comment': /\/\*[\s\S]*?\*\//,
          'selector': {
            pattern: /[^{}\s][^{};]*?(?=\s*\{)/,
            inside: {
              'pseudo-element': /::[\w-]+/,
              'pseudo-class': /:[\w-]+/,
              'class': /\.[\w-]+/,
              'id': /#[\w-]+/,
              'attribute': /\[[^\]]+\]/
            }
          },
          'property': /\b[\w-]+(?=\s*:)/i,
          'string': /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          'important': /\B!important\b/i,
          'function': /[-a-z0-9]+(?=\()/i,
          'punctuation': /[(){};:,]/
        },
        json: {
          'property': {
            pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
            lookbehind: true,
            greedy: true
          },
          'string': {
            pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
            lookbehind: true,
            greedy: true
          },
          'comment': /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
          'number': /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
          'punctuation': /[{}[\],]/,
          'boolean': /\b(?:true|false|null)\b/,
          'null': {
            pattern: /\bnull\b/,
            alias: 'keyword'
          }
        }
      },
      // Simple highlighter
      highlight: function(text, grammar, language) {
        if (!grammar) {return text;}
        
        // Simple tokenization
        let html = '';
        const tokens = tokenize(text, grammar);
        for (const token of tokens) {
          if (typeof token === 'string') {
            html += escapeHTML(token);
          } else {
            html += `<span class="token ${token.type}">${escapeHTML(token.content)}</span>`;
          }
        }
        
        return html.replace(/\n/g, '<span class="line"></span>\n');
      }
    };
    
    // Simple tokenizer
    function tokenize(text, grammar) {
      const tokens = [];
      let rest = text;
      
      // Very simple tokenization - in a real implementation this would be more sophisticated
      for (const type in grammar) {
        if (!grammar.hasOwnProperty(type)) {continue;}
        
        let pattern = grammar[type];
        if (Array.isArray(pattern)) {
          // Multiple patterns for this token type
          for (const p of pattern) {
            applyPattern(p.pattern || p, type);
          }
        } else if (typeof pattern === 'object') {
          // Handle nested grammar objects
          if (pattern.pattern) {
            applyPattern(pattern.pattern, type);
          }
        } else {
          applyPattern(pattern, type);
        }
      }
      
      // Add any remaining text
      if (rest) {
        tokens.push(rest);
      }
      
      return tokens;
      
      function applyPattern(pattern, type) {
        if (!pattern || !rest) {return;}
        
        const matches = rest.match(pattern);
        if (!matches || matches.index !== 0) {return;}
        
        const match = matches[0];
        if (!match) {return;}
        
        // Split text by match
        const beforeMatch = rest.substring(0, matches.index);
        if (beforeMatch) {
          tokens.push(beforeMatch);
        }
        
        tokens.push({
          type: type,
          content: match
        });
        
        // Update rest
        rest = rest.substring(matches.index + match.length);
      }
    }
  }
  
  // Send message to extension
  function sendMessage() {
    if (!messageInput) {return;}
    
    const text = messageInput.value.trim();
    
    if (!text) {
      return;
    }
    
    // Send message to extension
    vscode.postMessage({
      command: 'sendMessage',
      text
    });
    
    // Clear input
    messageInput.value = '';
  }
  
  // Format message content with improved code highlighting
  function formatMessageContent(content) {
    // Replace code blocks with language detection and syntax highlighting
    content = content.replace(/```(\w*)([\s\S]*?)```/g, (match, lang, code) => {
      // Enhanced language detection
      if (!lang || lang === '') {
        // JavaScript/TypeScript detection
        if (code.includes('function') || code.includes('var ') || code.includes('const ') || 
            code.includes('let ') || code.includes('class ') || code.includes('export ') || 
            code.includes('import ') && code.includes('from')) {
          if (code.includes('interface ') || code.includes('<T>') || code.includes('type ') || 
              code.includes('namespace ') || code.includes('readonly')) {
            lang = 'typescript';
          } else {
            lang = 'javascript';
          }
        }
        // Python detection
        else if (code.includes('def ') || code.includes('import ') && code.includes(':') ||
                 code.includes('class ') && code.includes(':') || code.includes('if __name__ == ')) {
          lang = 'python';
        }
        // HTML detection
        else if (code.includes('<html') || code.includes('<!DOCTYPE') || 
                 (code.includes('<div') && code.includes('</div>'))) {
          lang = 'html';
        }
        // CSS detection
        else if (code.includes('{') && code.includes('}') && 
                 (code.includes(':') && !code.includes('function') && code.includes(';'))) {
          lang = 'css';
        }
        // JSON detection
        else if ((code.includes('{') && code.includes('}')) && 
                 (code.includes('"') && code.includes(':')) && 
                 (!code.includes('function') && !code.includes('class'))) {
          lang = 'json';
        }
        else {
          lang = 'javascript'; // Default to JavaScript
        }
      }
      
      // Map common language names to Prism language keys
      const langMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'shell': 'bash',
        'bash': 'bash',
        'json': 'json',
        'html': 'html',
        'css': 'css',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'c': 'c',
        'cpp': 'cpp',
        'java': 'java'
      };
      
      const highlightLang = langMap[lang.toLowerCase()] || lang.toLowerCase() || 'javascript';
      let languageDisplay = lang || highlightLang;
      
      // Make language display prettier
      const langDisplayMap = {
        'javascript': 'JavaScript',
        'typescript': 'TypeScript',
        'python': 'Python',
        'html': 'HTML',
        'css': 'CSS',
        'json': 'JSON',
        'jsx': 'JSX',
        'tsx': 'TSX',
        'bash': 'Bash'
      };
      
      if (langDisplayMap[languageDisplay.toLowerCase()]) {
        languageDisplay = langDisplayMap[languageDisplay.toLowerCase()];
      }
      
      try {
        // Use Prism for syntax highlighting if available
        const highlighted = window.Prism ? 
          window.Prism.highlight(code.trim(), window.Prism.languages[highlightLang] || {}, highlightLang) : 
          escapeHTML(code.trim());
        
        // Create a container for the code block with line numbers
        const lines = highlighted.split('\n');
        const numberedCode = lines.map((line, index) => {
          return `<div class="line"><span class="line-number">${index + 1}</span><span class="line-content">${line}</span></div>`;
        }).join('\n');
        
        // Add language tag and copy button to pre element
        return `<pre data-language="${languageDisplay}"><div class="code-block-header"><button class="copy-code-button">Copy</button></div><code class="language-${highlightLang}">${numberedCode}</code></pre>`;
      } catch (e) {
        console.error('Error highlighting code:', e);
        return `<pre data-language="${languageDisplay}"><code class="language-${highlightLang}">${escapeHTML(code.trim())}</code></pre>`;
      }
    });
    
    // Replace inline code with better styling
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Replace links with styled links
    content = content.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="chat-link" target="_blank">$1</a>');
    
    // Replace line breaks
    content = content.replace(/\n/g, '<br>');
    
    return content;
  }
  
  // Add message to UI
  function addMessage(message) {
    const { role, content, id } = message;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(role === 'user' ? 'user-message' : 'assistant-message');
    messageElement.dataset.id = id;
    
    // Create message header
    const headerElement = document.createElement('div');
    headerElement.classList.add('message-header');
    
    // Use a more professional label for the message sender
    const senderLabel = document.createElement('span');
    senderLabel.classList.add('sender-label');
    senderLabel.textContent = role === 'user' ? 'You' : 'LogCAI';
    headerElement.appendChild(senderLabel);
    
    // Add timestamp element
    const timestamp = document.createElement('span');
    timestamp.classList.add('message-timestamp');
    timestamp.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    headerElement.appendChild(timestamp);
    
    // Create message content
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    
    // Format content with code highlighting
    const formattedContent = formatMessageContent(content);
    contentElement.innerHTML = formattedContent;
    
    // Add action buttons for assistant messages in the header
    if (role === 'assistant') {
      const actionsElement = document.createElement('div');
      actionsElement.classList.add('message-actions');
      
      // Copy button
      const copyButton = document.createElement('button');
      copyButton.classList.add('action-button');
      copyButton.title = 'Copy to clipboard';
      copyButton.textContent = 'Copy';
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        showToast('Copied to clipboard');
      });
      
      // Insert to editor button
      const insertButton = document.createElement('button');
      insertButton.classList.add('action-button');
      insertButton.title = 'Insert at cursor position';
      insertButton.textContent = 'Insert';
      insertButton.addEventListener('click', () => {
        const codeBlocks = contentElement.querySelectorAll('pre code');
        
        if (codeBlocks.length > 0) {
          // Insert first code block
          vscode.postMessage({
            command: 'copyToEditor',
            text: codeBlocks[0].textContent
          });
        } else {
          // Insert full content
          vscode.postMessage({
            command: 'copyToEditor',
            text: content
          });
        }
      });
      
      // Regenerate button
      const regenerateButton = document.createElement('button');
      regenerateButton.classList.add('action-button');
      regenerateButton.title = 'Regenerate response';
      regenerateButton.textContent = 'Regenerate';
      regenerateButton.addEventListener('click', () => {
        vscode.postMessage({
          command: 'regenerateResponse'
        });
      });
      
      actionsElement.appendChild(copyButton);
      actionsElement.appendChild(insertButton);
      actionsElement.appendChild(regenerateButton);
      headerElement.appendChild(actionsElement);
    }
    
    // Assemble message
    messageElement.appendChild(headerElement);
    messageElement.appendChild(contentElement);
    
    // Add to container
    if (messagesContainer) {
      messagesContainer.appendChild(messageElement);
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Add copy buttons to code blocks
      addCopyButtonsToCodeBlocks(messageElement);
    }
    
    return messageElement;
  }
  
  // Add copy buttons to code blocks
  function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre');
    
    codeBlocks.forEach(pre => {
      const copyButton = pre.querySelector('.copy-code-button');
      if (copyButton) {
        copyButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const code = pre.querySelector('code');
          if (code) {
            // Get text content without the line numbers
            const lines = code.querySelectorAll('.line-content');
            const codeText = Array.from(lines).map(line => line.textContent).join('\n');
            navigator.clipboard.writeText(codeText);
            
            // Visual feedback
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
              copyButton.textContent = 'Copy';
            }, 2000);
            
            showToast('Code copied to clipboard');
          }
        });
      }
    });
  }
  
  // Escape HTML
  function escapeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  
  // Show typing indicator
  function showTypingIndicator() {
    if (!messagesContainer) {return null;}
    
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('message', 'assistant-message', 'typing-indicator');
    typingIndicator.id = 'typing-indicator';
    
    const headerElement = document.createElement('div');
    headerElement.classList.add('message-header');
    headerElement.textContent = 'LogCAI';
    
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = '<div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>';
    
    typingIndicator.appendChild(headerElement);
    typingIndicator.appendChild(contentElement);
    
    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return typingIndicator;
  }
  
  // Hide typing indicator
  function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  // Update streamed response
  function updateStreamedResponse(text) {
    if (!messagesContainer) {return;}
    
    // If there's no streamed message yet, create one
    if (!streamedMessageElement) {
      // Remove typing indicator
      hideTypingIndicator();
      
      // Create a new message
      const message = {
        role: 'assistant',
        content: text,
        id: `streamed-${Date.now()}`
      };
      
      streamedMessageElement = addMessage(message);
    } else {
      // Update existing message
      const contentElement = streamedMessageElement.querySelector('.message-content');
      if (contentElement) {
        // Format content with code highlighting - detect code blocks in progress
        let formattedContent = text;
        
        // Check if we have complete code blocks
        const codeBlockMatches = text.match(/```(\w*)([\s\S]*?)```/g);
        if (codeBlockMatches) {
          // We have complete code blocks, format normally
          formattedContent = formatMessageContent(text);
        } else {
          // Check for incomplete code blocks
          const startCodeBlock = text.lastIndexOf('```');
          if (startCodeBlock !== -1 && !text.substring(startCodeBlock).includes('```', 3)) {
            // We have an incomplete code block
            const beforeCodeBlock = text.substring(0, startCodeBlock);
            const codeBlockContent = text.substring(startCodeBlock);
            
            // Format the part before the incomplete code block
            const formattedBefore = formatMessageContent(beforeCodeBlock);
            
            // For the incomplete block, just escape HTML
            formattedContent = formattedBefore + escapeHTML(codeBlockContent).replace(/\n/g, '<br>');
          } else {
            // No code blocks or all code blocks are complete
            formattedContent = formatMessageContent(text);
          }
        }
        
        contentElement.innerHTML = formattedContent;
        
        // Add copy buttons to new code blocks
        addCopyButtonsToCodeBlocks(streamedMessageElement);
      }
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Replace streamed response with final message
  function replaceStreamedResponse(message) {
    if (streamedMessageElement && messagesContainer) {
      // Remove the streamed message
      streamedMessageElement.remove();
      
      // Add the final message
      addMessage(message);
      
      // Reset streamed message
      streamedMessageElement = null;
    }
  }
  
  // Clear chat
  function clearChat() {
    if (!messagesContainer) {return;}
    
    // Send clear command to extension
    vscode.postMessage({
      command: 'clearChat'
    });
    
    // Clear UI
    while (messagesContainer.firstChild) {
      messagesContainer.removeChild(messagesContainer.firstChild);
    }
    
    // Add welcome message with suggestions
    const welcomeMessage = document.createElement('div');
    welcomeMessage.classList.add('welcome-message');
    welcomeMessage.innerHTML = `
      <h2>Welcome to LogCAI</h2>
      <p>Your intelligent coding assistant. Ask me about your code, get completions, explanations, or help with debugging.</p>
      <div class="suggestion-buttons">
        <button class="suggestion-button">Explain this file</button>
        <button class="suggestion-button">Help me debug</button>
        <button class="suggestion-button">Generate unit tests</button>
        <button class="suggestion-button">Optimize my code</button>
      </div>
    `;
    messagesContainer.appendChild(welcomeMessage);
    
    // Add click handlers for suggestion buttons
    const buttons = welcomeMessage.querySelectorAll('.suggestion-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        messageInput.value = button.textContent;
        sendMessage();
      });
    });
    
    // Reset streamed message
    streamedMessageElement = null;
  }
  
  // Update status display
  function updateStatus(status) {
    if (!modelStatus || !modelName) {
      return;
    }
    
    // Get the status icon element or create it if it doesn't exist
    let statusIcon = modelStatus.querySelector('.status-icon');
    if (!statusIcon) {
      statusIcon = document.createElement('span');
      statusIcon.className = 'status-icon';
      modelStatus.prepend(statusIcon);
    }
    
    // Remove any existing connect buttons
    const existingButtons = modelStatus.querySelectorAll('.connect-button, .check-button');
    existingButtons.forEach(button => button.remove());
    
    // Preserve the change model button if it exists
    const changeModelContainer = document.querySelector('.model-selector');
    
    if (status.isAvailable) {
      // Connected status
      statusIcon.className = 'status-icon status-success';
      statusIcon.textContent = '●';
      
      modelName.textContent = `${status.providerName}: ${status.modelName}`;
      modelName.classList.remove('status-error');
      modelName.classList.add('status-success');
    } else {
      // Disconnected status
      statusIcon.className = 'status-icon status-error';
      statusIcon.textContent = '●';
      
      // Set model name with error styling
      modelName.textContent = `${status.providerName} Disconnected`;
      modelName.classList.remove('status-success');
      modelName.classList.add('status-error');
      
      // Add connect button if Ollama is the provider
      if (status.providerName.toLowerCase() === 'ollama') {
        // Start Ollama button
        const connectButton = document.createElement('button');
        connectButton.className = 'connect-button';
        connectButton.textContent = 'Start Ollama';
        connectButton.title = 'Start Ollama server';
        connectButton.addEventListener('click', () => {
          vscode.postMessage({ command: 'startOllama' });
        });
        
        // Check connection button (for when Ollama is running but not detected)
        const checkButton = document.createElement('button');
        checkButton.className = 'connect-button check-button';
        checkButton.textContent = 'Check Connection';
        checkButton.title = 'Refresh Ollama connection';
        checkButton.addEventListener('click', () => {
          vscode.postMessage({ command: 'checkOllamaConnection' });
          
          // Show checking message
          addMessage({
            role: 'system',
            content: 'Checking Ollama connection...',
            timestamp: Date.now(),
            id: `status-${Date.now()}`
          });
        });
        
        modelStatus.appendChild(connectButton);
        modelStatus.appendChild(checkButton);
      }
    }
  }
  
  // Show error message
  function showError(error) {
    if (!messagesContainer) {return;}
    
    // Remove typing indicator
    hideTypingIndicator();
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.classList.add('message', 'error-message');
    
    // Create message header
    const headerElement = document.createElement('div');
    headerElement.classList.add('message-header');
    headerElement.textContent = 'Error';
    
    // Create message content
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.textContent = error.message || error.toString();
    
    // Add retry button
    const actionsElement = document.createElement('div');
    actionsElement.classList.add('message-actions');
    
    const retryButton = document.createElement('button');
    retryButton.classList.add('action-button');
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => {
      vscode.postMessage({
        command: 'regenerateResponse'
      });
    });
    
    actionsElement.appendChild(retryButton);
    headerElement.appendChild(actionsElement);
    
    // Assemble message
    errorElement.appendChild(headerElement);
    errorElement.appendChild(contentElement);
    
    // Add to container
    messagesContainer.appendChild(errorElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Show toast notification
  function showToast(message) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Remove after animation
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 3000);
  }
  
  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.command) {
      case 'addMessage':
        addMessage(message.message);
        break;
      case 'showTypingIndicator':
        showTypingIndicator();
        break;
      case 'hideTypingIndicator':
        hideTypingIndicator();
        break;
      case 'updateStreamedResponse':
        updateStreamedResponse(message.text);
        break;
      case 'replaceStreamedResponse':
        replaceStreamedResponse(message.message);
        break;
      case 'clearChat':
        clearChat();
        break;
      case 'updateStatus':
        updateStatus(message.status);
        break;
      case 'showError':
        showError(message.error);
        break;
      case 'showMessage':
        addMessage(message.message);
        break;
    }
  });
  
  // Initialize when the window loads
  window.addEventListener('load', initialize);
})();