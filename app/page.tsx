"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PhotoIcon, MagnifyingGlassIcon, ClockIcon, TrashIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import { MenuGrid } from "@/components/menu-grid";
import Image from "next/image";

export interface MenuItem {
  menu_number: string;
  name_orig: string;
  name_zh_orig: string;
  name_zh: string;
  price: string;
  description_orig: string;
  description_zh: string;
  flavor_profile: string[];
  chinese_palate_score: number;
  chinese_palate_note: string;
  tags: string[];
  extra_info: string;
  category_name: string;
  images: { url: string; thumbnail_url: string; title: string }[];
  image_search_url: string;
  image_source: string;
}

const HISTORY_KEY = "whatdish-history";
const MAX_HISTORY = 10;

interface HistoryEntry {
  id: string;
  timestamp: number;
  imageDataUrl: string;
  menu: MenuItem[];
  meta: any;
  restaurantName: string;
  dishCount: number;
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch { /* localStorage 满了 */ }
}

export default function Home() {
  const exportRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [menuPreviewUrl, setMenuPreviewUrl] = useState<string | undefined>();
  const [status, setStatus] = useState<"initial" | "parsing" | "created">("initial");
  const [parsedMenu, setParsedMenu] = useState<MenuItem[]>([]);
  const [menuMeta, setMenuMeta] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [genMode, setGenMode] = useState<"individual" | "batch">("individual");
  const [batchPosterUrl, setBatchPosterUrl] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // 页面加载时恢复历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Esc 关闭灯箱
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 全景模式：自动截取海报图
  useEffect(() => {
    if (status !== "created" || menuMeta?.gen_mode !== "batch" || !posterRef.current) return;
    // 等图片加载完成后截图
    const timer = setTimeout(async () => {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(posterRef.current!, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          allowTaint: false,
        });
        setBatchPosterUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        console.error("[啥菜] Poster capture failed:", e);
      }
    }, 1500); // 等图片渲染完成
    return () => clearTimeout(timer);
  }, [status, menuMeta?.gen_mode, parsedMenu]);

  const handleFileChange = async (file: File) => {
    console.log("[啥菜] handleFileChange:", file.name, file.type, file.size);
    setMenuPreviewUrl(URL.createObjectURL(file));
    setStatus("parsing");
    setError("");

    const reader = new FileReader();
    reader.onerror = () => {
      console.error("[啥菜] FileReader error:", reader.error);
      setError("文件读取失败: " + (reader.error?.message || "未知错误"));
      setStatus("initial");
    };
    reader.onload = async (e) => {
      console.log("[啥菜] FileReader loaded");
      const imageDataUrl = e.target?.result as string;
      const base64 = imageDataUrl.split(",")[1]; // 去掉 data:... 前缀

      try {
        const res = await fetch("/api/parseMenu", {
          method: "POST",
          body: JSON.stringify({ imageBase64: base64, gen_mode: genMode }),
        });
        const json = await res.json();

        if (json.error) {
          // 非菜单图片 → 友好提示
          if (json.error === "NOT_MENU") {
            setError(json.message || "请上传餐厅菜单照片");
          } else {
            setError(json.error);
          }
          setStatus("initial");
          return;
        }

        const menu = json.menu || [];
        const meta = json.meta || {};

        setParsedMenu(menu);
        setMenuMeta(meta);
        setStatus("created");

        // 写入历史
        const entry: HistoryEntry = {
          id: Date.now().toString(36),
          timestamp: Date.now(),
          imageDataUrl,
          menu,
          meta,
          restaurantName: (meta.restaurant_name && meta.restaurant_name !== "未识别") ? meta.restaurant_name : "未知餐厅",
          dishCount: menu.length,
        };
        const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
        saveHistory(updated);
        setHistory(updated);
      } catch (err: any) {
        setError(err.message || "请求失败");
        setStatus("initial");
      }
    };
    reader.readAsDataURL(file);
  };

  const restoreHistory = useCallback((entry: HistoryEntry) => {
    setParsedMenu(entry.menu);
    setMenuMeta(entry.meta);
    setMenuPreviewUrl(entry.imageDataUrl);
    setStatus("created");
    setSearchTerm("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const deleteHistory = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }, [history]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(exportRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `whatdish-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const filteredMenu = parsedMenu.filter(
    (item) =>
      item.name_zh.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name_orig.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - ts) / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="container text-center px-4 py-8 bg-white max-w-5xl mx-auto">
      {/* Header */}
      <div className="max-w-2xl text-center mx-auto sm:mt-20 mt-2">
        <p className="mx-auto mb-5 w-fit rounded-2xl border px-4 py-1 text-sm text-slate-500">
          全球菜单，拍一下就知道 · 支持任意语言
        </p>
        <h1 className="mb-6 text-balance text-6xl font-bold text-zinc-800">
          啥菜
        </h1>
      </div>
      <div className="max-w-3xl text-center mx-auto">
        <p className="mb-8 text-lg text-gray-500 text-balance">
          拍下外文菜单，每道菜自动翻译成中文，匹配真实图片，标注中国胃适配度。
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Upload area */}
        {status === "initial" && (
          <label
            htmlFor="menu-file-input"
            className="mt-2 flex aspect-video cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors"
          >
            <input
              id="menu-file-input"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                console.log("[啥菜] File selected:", file?.name, file?.type, file?.size);
                if (file) handleFileChange(file);
              }}
            />
            <div className="text-center">
              <PhotoIcon className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <span className="relative rounded-md bg-white font-semibold text-gray-800">
                  <p className="text-xl">上传菜单照片</p>
                  <p className="mt-1 font-normal text-gray-600">点击此处选择文件</p>
                </span>
              </div>
            </div>
          </label>
        )}

        {/* 生图模式切换 */}
        {status === "initial" && (
          <div className="mt-6 flex flex-col items-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setGenMode("individual")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  genMode === "individual"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🍽️ 分别出图
              </button>
              <button
                onClick={() => setGenMode("batch")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  genMode === "batch"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                📸 合成一张
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {genMode === "batch"
                ? "所有菜品拼成一张带文字的海报，方便分享"
                : "每道菜单独出图，适合逐道浏览"}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Menu preview */}
        {menuPreviewUrl && (
          <div className="my-10 mx-auto flex flex-col items-center">
            <Image
              width={1024}
              height={768}
              src={menuPreviewUrl}
              alt="Menu"
              className="w-48 sm:w-64 rounded-lg shadow-md cursor-pointer hover:shadow-lg hover:scale-[1.02] transition"
              onClick={() => setLightboxSrc(menuPreviewUrl)}
            />
            <p className="mt-2 text-xs text-gray-400">点击图片可放大查看</p>
          </div>
        )}

        {/* Loading */}
        {status === "parsing" && (
          <div className="mt-10 flex flex-col items-center">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
              <p className="text-lg text-gray-600">正在分析菜单...</p>
            </div>
          </div>
        )}
      </div>

      {/* History — 初始状态 & 有历史记录时显示 */}
      {status === "initial" && history.length > 0 && (
        <div className="max-w-2xl mx-auto mt-10 text-left">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            历史记录
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                onClick={() => restoreHistory(entry)}
                className="group relative cursor-pointer rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="aspect-[4/3] bg-gray-100 relative">
                  <Image
                    src={entry.imageDataUrl}
                    alt={entry.restaurantName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    onClick={(e) => deleteHistory(entry.id, e)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    title="删除"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {entry.restaurantName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.dishCount} 道菜 · {formatTime(entry.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {parsedMenu.length > 0 && (
        <div ref={exportRef} className="mt-10">
          {/* Meta bar */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="text-left">
              <h2 className="text-4xl font-bold">
                {(menuMeta?.restaurant_name && menuMeta.restaurant_name !== "未识别" ? menuMeta.restaurant_name : "菜单")} · {parsedMenu.length} 道菜
              </h2>
              {menuMeta?.country && (
                <p className="text-gray-500 mt-1">
                  {menuMeta.country} · {menuMeta.language} ·
                  <span className="ml-1 text-xs text-gray-400">
                    模型: {menuMeta.model_used}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStatus("initial");
                  setParsedMenu([]);
                  setMenuMeta(null);
                  setMenuPreviewUrl(undefined);
                  setSearchTerm("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              >
                ← 返回
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                导出图片
              </button>
            </div>
          </div>

          {/* 全景海报（batch 模式自动生成） */}
          {menuMeta?.gen_mode === "batch" && (
            <div className="mb-6">
              {batchPosterUrl ? (
                <div className="rounded-xl overflow-hidden shadow-lg border border-gray-100">
                  <Image
                    src={batchPosterUrl}
                    alt="菜单全景海报"
                    width={1200}
                    height={1600}
                    className="w-full object-contain cursor-pointer"
                    unoptimized
                    onClick={() => setLightboxSrc(batchPosterUrl)}
                  />
                  <p className="text-center text-sm text-gray-400 py-2 bg-gray-50">
                    📸 全景菜单海报（可长按保存）
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 mr-3" />
                  正在生成全景海报...
                </div>
              )}
            </div>
          )}

          {/* 隐藏的海报纸版（供 html2canvas 截图） */}
          {menuMeta?.gen_mode === "batch" && (
            <div
              ref={posterRef}
              className="fixed left-[-9999px] top-0"
              style={{ width: "600px" }}
            >
              <div className="bg-white p-8">
                {/* 海报头部 */}
                <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
                  <h1 className="text-3xl font-bold text-gray-800 mb-1">
                    {(menuMeta?.restaurant_name && menuMeta.restaurant_name !== "未识别")
                      ? menuMeta.restaurant_name
                      : "菜单"}
                  </h1>
                  {menuMeta?.country && (
                    <p className="text-sm text-gray-500">
                      {menuMeta.country} · {menuMeta.language} · {parsedMenu.length} 道菜
                    </p>
                  )}
                </div>
                {/* 菜品列表 */}
                <div className="space-y-6">
                  {parsedMenu.map((item, idx) => (
                    <div key={idx} className="border-b border-gray-100 pb-4 last:border-b-0">
                      {/* 图片 */}
                      <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden mb-3">
                        {item.images.length > 0 ? (
                          <img
                            src={item.images[0].url}
                            alt={item.name_zh}
                            className="w-full h-full object-cover cursor-pointer"
                            crossOrigin="anonymous"
                            onClick={() => setLightboxSrc(item.images[0].url)}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                            暂无图片
                          </div>
                        )}
                      </div>
                      {/* 文字信息 */}
                      <div className="flex items-baseline gap-2 mb-1">
                        {item.menu_number && (
                          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {item.menu_number}
                          </span>
                        )}
                        <h3 className="text-base font-bold text-gray-800">
                          {item.name_zh}
                        </h3>
                      </div>
                      {item.name_zh_orig && item.name_zh_orig !== item.name_zh && (
                        <p className="text-sm text-gray-400 mb-0.5">菜单原名：{item.name_zh_orig}</p>
                      )}
                      <p className="text-sm text-gray-700 font-medium mb-1">
                        {item.name_orig}
                      </p>
                      {item.description_orig && (
                        <p className="text-xs text-gray-400 italic mb-1 line-clamp-1">
                          {item.description_orig}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {item.description_zh}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-blue-600">
                          {item.price}
                        </span>
                        <span className="text-xs text-yellow-700">
                          🥢 {item.chinese_palate_note || `${"⭐".repeat(item.chinese_palate_score || 3)}`}
                        </span>
                      </div>
                      {item.extra_info && (
                        <p className="text-xs text-gray-400 mt-1">📌 {item.extra_info}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* 海报底部 */}
                <div className="text-center mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-300">由 啥菜 WhatDish 生成</p>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-6">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="搜索菜品..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <MenuGrid items={filteredMenu} onImageClick={setLightboxSrc} />
        </div>
      )}

      {/* 图片灯箱 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 w-10 h-10 flex items-center justify-center rounded-full bg-black/30"
            onClick={() => setLightboxSrc(null)}
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="放大查看"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
