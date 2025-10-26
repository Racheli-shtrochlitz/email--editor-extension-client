(() => {
  console.log('📬 Gmail Cloud Editor Extension Loaded');

  function createButton(composeWindow) {
    if (composeWindow.querySelector('.custom-send-edit')) return;

    const newBtn = document.createElement('div');
    newBtn.className = 'custom-send-edit';
    newBtn.textContent = 'שלח עם עריכה';
    newBtn.style.cssText = `
      position: absolute;
      bottom: 110px;
      right: 20px;
      background: #007bff;
      color: white;
      border-radius: 4px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 9999;
    `;

    newBtn.addEventListener('click', async () => {
      try {
        const bodyEl = composeWindow.querySelector(
          'div[aria-label="Message Body"], div[aria-label="Message body"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
        );
        if (!bodyEl) return console.warn('❌ Body not found');

        const content = bodyEl.innerHTML;
        const msgId = 'msg-' + Date.now();
        console.log('Preparing to send message with ID:', msgId, 'content: ', content);

        const response = await fetch(
          `https://email-editor-extension.onrender.com/api/message/${encodeURIComponent(msgId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: content }),
          }
        );

        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Server error');
        }

        const placeholder = `
        <em>[[CLOUD:${msgId}]] Loading content from cloud editor...</em>
        `;

        bodyEl.innerHTML = placeholder;

        console.log('✅ Message prepared for cloud edit:', msgId);
      } catch (e) {
        console.error('❌ Failed to process message:', e);
      }
    });

    composeWindow.style.position = 'relative';
    composeWindow.appendChild(newBtn);
    console.log('✅ כפתור "Send with Edit" נוסף לחלון כתיבה');
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