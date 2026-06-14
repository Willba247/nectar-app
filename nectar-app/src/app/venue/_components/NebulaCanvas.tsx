"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;

void main() {
  vec2 uv = vUv;
  vec2 p1 = vec2(0.30 + 0.15 * sin(uTime * 0.18), 0.32 + 0.12 * cos(uTime * 0.15));
  vec2 p2 = vec2(0.72 + 0.12 * cos(uTime * 0.12), 0.55 + 0.14 * sin(uTime * 0.16));
  vec2 p3 = vec2(0.50 + 0.18 * sin(uTime * 0.10), 0.80 + 0.10 * cos(uTime * 0.13));

  float a1 = smoothstep(0.55, 0.0, distance(uv, p1));
  float a2 = smoothstep(0.55, 0.0, distance(uv, p2));
  float a3 = smoothstep(0.50, 0.0, distance(uv, p3));

  vec3 pink = vec3(1.000, 0.412, 0.706);
  vec3 blue = vec3(0.255, 0.412, 0.882);
  vec3 teal = vec3(0.051, 0.824, 0.714);

  vec3 col = pink * a1 + blue * a2 + teal * a3;
  float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0) * 0.5;
  gl_FragColor = vec4(col, alpha);
}
`;

export default function NebulaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { uTime: { value: 0 } };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let running = true;
    const start = performance.now();

    const loop = () => {
      if (!running) return;
      uniforms.uTime.value = (performance.now() - start) / 1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        loop();
      } else if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
