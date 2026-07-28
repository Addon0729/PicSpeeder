/**
 * PicSpeeder - Background Service Worker
 * Bypasses CORS/CSP restrictions and fetches raw image data safely.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_IMAGE') {
    // Fetch image from the independent background context
    fetch(message.url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        
        // Retrieve accurate MIME type from headers (default to image/gif)
        const contentType = response.headers.get('content-type') || 'image/gif';
        return response.blob().then(blob => ({ blob, contentType }));
      })
      .then(({ blob, contentType }) => {
        // Convert binary blob to Base64 data URL to send across contexts
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result, mimeType: contentType });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('[ImagePlayer Background] Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Required to use sendResponse asynchronously
  }
});
