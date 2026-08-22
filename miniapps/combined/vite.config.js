import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const uniTags = new Set(['view', 'text', 'image', 'picker', 'scroll-view', 'navigator', 'swiper', 'swiper-item', 'movable-area', 'movable-view', 'cover-view', 'cover-image', 'rich-text', 'icon', 'progress', 'checkbox-group', 'checkbox', 'radio-group', 'radio', 'slider', 'switch', 'form', 'label', 'canvas', 'map', 'video', 'audio', 'live-player', 'live-pusher', 'web-view', 'official-account', 'open-data', 'ad', 'ad-custom']);

function transformVue(code) {
  // 1. 去掉 <style scoped>
  let noScoped = code.replace(/<style\b([^>]*)\bscoped\b([^>]*)>/g, (m, a1, a2) => `<style${a1.replace(/\s*scoped\s*/g, '')}${a2}>`);

  // 2. rpx 转 CSS 变量（支持负数）
  let rpxReplaced = noScoped.replace(/(-?\d+(?:\.\d+)?)rpx/g, (match, num) => `calc(var(--rpx) * ${num})`);

  // 3. 把 template 里的 uni-app 标签转成标准 HTML 标签
  const tagMap = {
    view: 'div',
    text: 'span',
    image: 'img',
    'scroll-view': 'div',
    'cover-view': 'div',
    'cover-image': 'img',
    'movable-area': 'div',
    'movable-view': 'div',
    'rich-text': 'div',
    icon: 'span',
    progress: 'div',
    slider: 'input',
    switch: 'input',
    checkbox: 'input',
    radio: 'input',
    'checkbox-group': 'div',
    'radio-group': 'div',
    form: 'form',
    label: 'label',
    canvas: 'canvas',
    navigator: 'a',
    video: 'video',
    audio: 'audio',
    'web-view': 'iframe',
    picker: 'div',
  };

  // 在 template 区块内替换标签
  rpxReplaced = rpxReplaced.replace(/<template>([\s\S]*?)<\/template>/g, (match, template) => {
    let transformed = template;
    for (const [from, to] of Object.entries(tagMap)) {
      // 开头标签 <view ...> 或 <view/>
      transformed = transformed.replace(new RegExp(`<${from}\\b`, 'g'), `<${to}`);
      // 自闭合 /> 也要处理，但 view 通常不是自闭合
      transformed = transformed.replace(new RegExp(`<${from}\\b([^>]*)/>`, 'g'), `<${to}$1>`);
      // 结束标签
      transformed = transformed.replace(new RegExp(`</${from}>`, 'g'), `</${to}>`);
    }
    return `<template>${transformed}</template>`;
  });

  return rpxReplaced === code ? null : rpxReplaced;
}

function rpxToVar() {
  return {
    name: 'rpx-to-var',
    transform(code, id) {
      if (id.endsWith('.vue')) return transformVue(code);
      if (id.endsWith('.css')) {
        const replaced = code.replace(/(\d+(?:\.\d+)?)rpx/g, (match, num) => `calc(var(--rpx) * ${num})`);
        if (replaced !== code) return replaced;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    rpxToVar(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement(tag) {
            return uniTags.has(tag);
          },
        },
      },
    }),
  ],
  server: {
    port: 5178,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        bypass(req) {
          if (req.url && req.url.match(/\.(js|vue|ts|css)$/)) return req.url;
        },
      },
    },
  },
});
