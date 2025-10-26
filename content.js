(() => {
  console.log('📬 Gmail Cloud Editor Extension Loaded');

  function createButton() {
    document.body.addEventListener('click', (e) => {
      const sendDropdownButton = e.target.closest('div[aria-label*="אפשרויות שליחה"], div[aria-label*="Send options"]');
      if (!sendDropdownButton) return;
  
      setTimeout(() => {
        document.querySelectorAll('.J-M').forEach(dropdown => {
          if (dropdown.querySelector('.custom-send-edit')) return; 
  
          const newItem = document.createElement('div');
          newItem.className = 'J-N J-Ph custom-send-edit';
          newItem.textContent = 'שלח עם עריכה';
          newItem.style.cssText = `
            cursor: pointer;
            padding: 8px 16px;
            font-size: 14px bold;
          `;
          newItem.addEventListener('mouseenter', () => newItem.style.background = '#f1f3f4');
          newItem.addEventListener('mouseleave', () => newItem.style.background = 'transparent');
  
          newItem.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
              const composeWindow = dropdown.closest('div[role="dialog"]') || document;
              const bodyEl = composeWindow.querySelector(
                'div[aria-label="Message Body"], div[aria-label="Message body"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
              );
              if (!bodyEl) return console.warn('❌ Body not found');
  
              const content = bodyEl.innerHTML;
              const msgId = 'msg-' + Date.now();
  
              console.log('Preparing to send message with ID:', msgId);
  
              const response = await fetch(
                `https://email-editor-extension.onrender.com/api/message/${encodeURIComponent(msgId)}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: content }),
                }
              );
  
              const result = await response.json();
              if (!response.ok || !result?.success)
                throw new Error(result?.message || 'Server error');
  
              bodyEl.innerHTML = `<em>[[CLOUD:${msgId}]] Loading content from cloud editor...</em>`;
              console.log('✅ Message prepared for cloud edit:', msgId);
  
              const sendButton = composeWindow.querySelector('div[role="button"][data-tooltip*="שליחה"], div[role="button"][data-tooltip*="Send"]');
              if (sendButton) sendButton.click();
              else console.warn('⚠️ Send button not found to click');
            } catch (err) {
              console.error('❌ Failed to process message:', err);
            }
          });
  
          dropdown.appendChild(newItem);
          console.log('✅ "שלח עם עריכה" נוסף לתפריט השליחה');
        });
      }, 200);
    });
  }
  
  async function loadCloudContentElements(targetElement) {
    if (!targetElement) {
      targetElement = document.body;
    }

    console.log('🔍 סריקה למציאת תגיות [[CLOUD:...]] באלמנט:', targetElement);

    const elements = Array.from(targetElement.querySelectorAll('span, em, div, p'));

    for (const el of elements) {
      if (el.dataset && el.dataset.loaded === 'true') continue;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let textNode;

      while (textNode = walker.nextNode()) {
        const text = textNode.textContent;
        if (!text) continue;

        const match = text.match(/\[\[CLOUD:([^\]]+)\]\]\s*Loading\s+content\s+from\s+cloud\s+editor\.\.\./);
        if (!match) continue;

        const msgId = match[1];
        const fullMatch = match[0];

        console.log('🆔 נמצא מזהה הודעה בענן:', msgId, 'בטקסט:', text.substring(0, 50));

        const originalText = text;
        textNode.textContent = text.replace(fullMatch, `[Loading content from cloud editor (${msgId})...]`);

        try {
          const res = await fetch(
            `https://email-editor-extension.onrender.com/api/message/${encodeURIComponent(msgId)}`
          );
          const data = await res.json();

          if (data?.text) {
            textNode.textContent = originalText.replace(fullMatch, data.text);
            console.log('✅ תוכן טעון בהצלחה עבור', msgId);
          } else {
            textNode.textContent = originalText.replace(fullMatch, `⚠️ Failed to load content (${msgId})`);
            console.error('❌ לא התקבל תוכן עבור', msgId);
          }
        } catch (e) {
          console.error('Cloud content load error:', e);
          textNode.textContent = originalText.replace(fullMatch, 'Error loading content');
        }

        break; 
      }
    }
  }

  let lastUrl = location.href;
  setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.includes('#inbox/') || currentUrl.includes('#sent/')) {
        onGmailMessageOpen();
      }
    }
  }, 1000);

  const observer = new MutationObserver(() => {
    document.querySelectorAll('div[role="dialog"]').forEach(createButton);
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.includes('#inbox/') || currentUrl.includes('#sent/')) {
        onGmailMessageOpen();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  function onGmailMessageOpen(messageElement) {
    console.log('📩 הודעת Gmail נפתחה', messageElement);

    const messageContainer = document.querySelector('[role="main"]') || document.body;
    const emailBody = messageContainer.querySelector('.a3s') ||
      messageContainer.querySelector('[role="article"]') ||
      messageContainer;

    loadCloudContentElements(emailBody);
  }

  setTimeout(() => {
    document.querySelectorAll('div[role="dialog"]').forEach(createButton);
  }, 2000);
})();