/**
 * PicSpeeder - Player Core Logic
 * Manages decoding states and animation loops per image instance.
 */

window.ImagePlayer = {
  instances: new Map(),

  // Get existing state for the element, or initialize a new one
  getOrCreate(imgElement) {
    if (!this.instances.has(imgElement)) {
      this.instances.set(imgElement, {
        frames: [],       
        currentIdx: 0,    
        isPlaying: false, 
        timerId: null,    
        speed1: 1.0,      
        speed2: 1,
        canvas: null,
        toolbar: null,
        lastMimeType: '' 
      });
    }
    return this.instances.get(imgElement);
  },

  // Clear data and release memory references
  reset(imgElement) {
    const p = this.instances.get(imgElement);
    if (!p) return;
    if (p.timerId) clearTimeout(p.timerId);
    p.frames.forEach(f => f.bitmap.close());
    if (p.canvas) p.canvas.remove();
    if (p.toolbar) p.toolbar.remove();
    this.instances.delete(imgElement);
  },

  // Requests background fetch and decodes the image via ImageDecoder
  async decode(imgElement) {
    const p = this.getOrCreate(imgElement);
    if (p.frames.length > 0) return true; // Already decoded

    try {
      const imageUrl = imgElement.src;

      // Delegate fetch to background.js to bypass restrictions
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url: imageUrl }, resolve);
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : 'Background fetch failed');
      }

      p.lastMimeType = response.mimeType ? response.mimeType.toLowerCase() : '';

      // Create a response stream from the returned Base64 data
      const fetchedResponse = await fetch(response.dataUrl);
      const decoder = new ImageDecoder({
        data: fetchedResponse.body,
        type: response.mimeType
      });

      // Wait for complete metadata and frame count parsing
      await decoder.completed;
      const track = decoder.tracks.selectedTrack;
      
      // Decode every single frame into an ImageBitmap
      for (let i = 0; i < track.frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const bitmap = await createImageBitmap(image);
        // Convert microsecond duration to milliseconds (default to 40ms if null)
        const duration = (image.duration || 40000) / 1000; 
        p.frames.push({ bitmap, duration });
        image.close(); // Release raw VideoFrame memory
      }
      return true;
    } catch (e) {
      console.error('[ImagePlayer Core] Decode Error:', e);
      return false;
    }
  }
};
