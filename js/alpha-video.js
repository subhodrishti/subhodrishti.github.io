/* The couple's looping clips, drawn with their transparency.
 *
 * A clip (assets/avatars/<look>.mp4, made by tools/cutout_videos.py) holds
 * colour and alpha side by side: the left half is the couple premultiplied
 * onto black, the right half the alpha as grey. A small WebGL shader puts them
 * back together on a canvas laid exactly over the look's still. No single
 * transparent video format plays on both iPhones and Android; H.264 does.
 *
 * The still always stays underneath. Anything that goes wrong (no WebGL, a
 * codec the browser lacks, autoplay refused in Low Power Mode, a lost GL
 * context, pixels unreadable on file://) removes the canvas for good and the
 * still simply stays. Reduced motion and Save-Data never load a clip.
 *
 * create() returns { canvas, video, start, pause, stop, snap, showing }:
 *   start()  plays; after stop() it begins again on frame 0, the still's pose
 *   pause()  holds the frame on screen (off-screen, hidden tab, a change beginning)
 *   stop()   hides the canvas, showing the still again
 *   snap()   redraws the held frame so the outfit change can sample it
 */
(function () {
  const { h, reducedMotion } = window.Invite;

  const VERT = `
    attribute vec2 p;
    uniform vec2 k;
    varying vec2 uv;
    void main() {
      uv = vec2((p.x * 0.5 + 0.5) * k.x, (p.y * 0.5 + 0.5) * k.y);
      gl_Position = vec4(p, 0.0, 1.0);
    }`;
  // Colour from the left half; alpha is the right half's luma, which chroma
  // noise from the encoder can't shift. Premultiplied colour never exceeds alpha.
  const FRAG = `
    precision mediump float;
    uniform sampler2D t;
    uniform float off;
    varying vec2 uv;
    void main() {
      vec3 c = texture2D(t, uv).rgb;
      float a = dot(texture2D(t, uv + vec2(off, 0.0)).rgb, vec3(0.2126, 0.7152, 0.0722));
      a = clamp((a - 0.01) / 0.98, 0.0, 1.0);
      gl_FragColor = vec4(min(c, vec3(a)), a);
    }`;

  let codec = null;
  /** Whether clips may play here at all. Checked again before every start. */
  function supported() {
    if (reducedMotion.matches || location.protocol === "file:") return false;
    if (navigator.connection?.saveData) return false;
    if (codec === null) codec = !!document.createElement("video").canPlayType('video/mp4; codecs="avc1.640028"');
    return codec;
  }

  function program(gl) {
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    return prog;
  }

  function create({ src, width, height }) {
    const canvas = h("canvas", { class: "wardrobe__motion", "aria-hidden": "true", width, height });
    // Kept in the document but never rendered; the canvas is what guests see.
    const video = h("video", {
      class: "wardrobe__video", hidden: true, muted: true, playsinline: true, loop: true,
      preload: "none", disablepictureinpicture: true, disableremoteplayback: true, "aria-hidden": "true",
    });
    video.muted = true;
    video.playsInline = true;

    let gl = null, uni = null;
    let failed = false, wanted = false, drawn = false;
    let vfc = 0, raf = 0;

    function fail() {
      if (failed) return;
      failed = true;
      wanted = false;
      cancelLoop();
      canvas.remove();
      video.removeAttribute("src");
      video.load(); // drop the download
      video.remove();
    }

    function setup() {
      gl = canvas.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: false, antialias: false, depth: false });
      if (!gl) return false;
      try {
        const prog = program(gl);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        uni = { k: gl.getUniformLocation(prog, "k"), off: gl.getUniformLocation(prog, "off") };
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
      } catch {
        return false;
      }
      canvas.addEventListener("webglcontextlost", fail);
      return true;
    }

    function draw() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); // throws where pixels can't be read
      } catch {
        fail();
        return;
      }
      // The frame is `width` px of each `vw / 2` px half; flipped rows put the top at v = 1.
      gl.uniform2f(uni.k, width / vw, 1);
      gl.uniform1f(uni.off, 0.5);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!drawn) {
        drawn = true;
        canvas.classList.add("is-playing");
      }
    }

    function cancelLoop() {
      if (vfc) video.cancelVideoFrameCallback?.(vfc);
      if (raf) cancelAnimationFrame(raf);
      vfc = raf = 0;
    }

    function loop() {
      cancelLoop();
      if (!wanted || failed) return;
      if (video.requestVideoFrameCallback) {
        vfc = video.requestVideoFrameCallback(() => { vfc = 0; draw(); loop(); });
      } else {
        let last = -1;
        const tick = () => {
          raf = 0;
          if (!wanted || failed) return;
          if (video.readyState >= 2 && video.currentTime !== last) { last = video.currentTime; draw(); }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    }

    function start() {
      if (failed || wanted) return;
      if (!supported()) return;
      if (!gl && !setup()) { fail(); return; }
      wanted = true;
      if (!video.getAttribute("src")) {
        video.addEventListener("error", fail, { once: true });
        video.src = src;
      }
      if (!drawn && video.currentTime) video.currentTime = 0;
      const p = video.play();
      loop();
      // Refused (Low Power Mode, data saver, a policy): the still stays.
      p?.catch((err) => { if (err?.name !== "AbortError") fail(); });
    }

    function pause() {
      wanted = false;
      cancelLoop();
      if (!failed) video.pause();
    }

    function stop() {
      pause();
      drawn = false;
      canvas.classList.remove("is-playing");
    }

    /** Redraw the frame on screen, so the canvas can be read in this same task
     *  (the drawing buffer isn't kept between frames; that's cheaper on phones). */
    function snap() {
      if (drawn && !failed) draw();
    }

    return {
      canvas, video, start, pause, stop, snap,
      get showing() { return drawn && !failed; },
      get failed() { return failed; },
    };
  }

  window.Invite.alphaVideo = { create, supported };
})();
