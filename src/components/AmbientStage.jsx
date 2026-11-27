import React, { useEffect, useRef } from "react";

const CRYPTO_CODES = ["btc", "eth", "usdt", "bnb", "sol", "usdc", "trx", "xrp", "ada", "doge", "ltc", "dot"];
const FIAT_SYMS = ["¥", "$", "€", "£"];

export function AmbientStage() {
  const rainCanvasRef = useRef(null);
  const coinLayerRef = useRef(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const rainCanvas = rainCanvasRef.current;
    const coinEl = coinLayerRef.current;
    let rafId = null;
    let coinInterval = null;
    const timeouts = [];

    if (rainCanvas && rainCanvas.getContext) {
      const ctx = rainCanvas.getContext("2d");
      const fontSize = 16;
      let columns = [];
      let lastFrame = 0;

      const resizeRain = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        rainCanvas.width = window.innerWidth * ratio;
        rainCanvas.height = window.innerHeight * ratio;
        rainCanvas.style.width = window.innerWidth + "px";
        rainCanvas.style.height = window.innerHeight + "px";
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const count = Math.ceil(window.innerWidth / fontSize);
        columns = Array.from({ length: count }, () => ({
          y: Math.random() * window.innerHeight,
          speed: 0.55 + Math.random() * 1.15,
          length: 7 + Math.floor(Math.random() * 12),
        }));
      };

      const drawRain = (now) => {
        if (!document.hidden && now - lastFrame >= 40) {
          lastFrame = now;
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
          ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
          ctx.textAlign = "center";

          columns.forEach((col, index) => {
            const x = index * fontSize + fontSize / 2;
            for (let i = 0; i < col.length; i++) {
              if (Math.random() > 0.52) continue;
              const y = col.y - i * fontSize;
              if (y < 0 || y > window.innerHeight) continue;

              const digit = Math.random() > 0.5 ? "1" : "0";
              const isLead = i === 0;
              const bright = Math.random() > 0.94;

              ctx.fillStyle = isLead
                ? "rgba(250, 236, 210, 0.85)"
                : bright
                  ? "rgba(228, 192, 130, 0.48)"
                  : `rgba(184, 137, 70, ${0.14 + Math.random() * 0.16})`;

              ctx.shadowColor = isLead ? "rgba(228, 192, 130, 0.55)" : "transparent";
              ctx.shadowBlur = isLead ? 8 : 0;
              ctx.fillText(digit, x, y);
            }
            ctx.shadowBlur = 0;
            col.y += col.speed;
            if (col.y - col.length * fontSize > window.innerHeight) {
              col.y = -Math.random() * window.innerHeight * 0.4;
              col.speed = 0.55 + Math.random() * 1.15;
              col.length = 7 + Math.floor(Math.random() * 12);
            }
          });
        }
        rafId = requestAnimationFrame(drawRain);
      };

      window.addEventListener("resize", resizeRain);
      resizeRain();
      rafId = requestAnimationFrame(drawRain);

      const spawnAmbientCoin = () => {
        if (!coinEl || document.hidden || coinEl.childElementCount >= 10) return;
        const isCrypto = Math.random() < 0.82;
        const c = document.createElement("div");
        c.className = isCrypto ? "bg-coin crypto" : "bg-coin";
        if (isCrypto) {
          const code = CRYPTO_CODES[Math.floor(Math.random() * CRYPTO_CODES.length)];
          const img = document.createElement("img");
          img.src = `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${code}.svg`;
          img.alt = code.toUpperCase();
          img.onerror = () => {
            img.remove();
            c.textContent = code.toUpperCase();
            c.style.color = "#faecd2";
            c.style.fontSize = "10px";
            c.style.fontWeight = "800";
          };
          c.appendChild(img);
        } else {
          c.textContent = FIAT_SYMS[Math.floor(Math.random() * FIAT_SYMS.length)];
        }
        coinEl.appendChild(c);

        const size = isCrypto ? 38 : 34;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const startX = Math.random() * Math.max(1, w - size);
        const startY = -50 - Math.random() * 60;
        const sway = (Math.random() - 0.5) * 90;
        const endX = Math.min(Math.max(0, startX + sway), Math.max(0, w - size));
        const endY = h + 60;
        const dur = 9000 + Math.random() * 5500;
        const spin = (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 140);

        if (c.animate) {
          const anim = c.animate(
            [
              { transform: `translate3d(${startX}px, ${startY}px, 0) rotate(0deg) scale(0.85)`, opacity: 0 },
              {
                transform: `translate3d(${(startX + endX) / 2}px, ${h * 0.48}px, 0) rotate(${spin * 0.5}deg) scale(1)`,
                opacity: 1,
                offset: 0.45,
              },
              { transform: `translate3d(${endX}px, ${endY}px, 0) rotate(${spin}deg) scale(0.88)`, opacity: 0 },
            ],
            { duration: dur, easing: "linear", fill: "forwards" },
          );
          anim.onfinish = () => c.remove();
        } else {
          c.remove();
        }
      };

      coinInterval = setInterval(spawnAmbientCoin, 1100);
      for (let i = 0; i < 5; i++) {
        timeouts.push(setTimeout(spawnAmbientCoin, i * 450));
      }

      return () => {
        window.removeEventListener("resize", resizeRain);
        if (rafId) cancelAnimationFrame(rafId);
        if (coinInterval) clearInterval(coinInterval);
        timeouts.forEach(clearTimeout);
        if (coinEl) coinEl.innerHTML = "";
      };
    }
  }, []);

  return (
    <>
      <div className="ambient-glow-tl anim-glow-pulse" aria-hidden="true" />
      <div className="ambient-glow-br" aria-hidden="true" />
      <div id="bg-ambient-stage" aria-hidden="true">
        <canvas ref={rainCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div ref={coinLayerRef} className="absolute inset-0 z-[1]" />
      </div>
    </>
  );
}
