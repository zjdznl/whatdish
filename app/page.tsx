"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PhotoIcon, MagnifyingGlassIcon, ClockIcon, TrashIcon, CameraIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/24/outline";
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
  _source_images: number[];
  images: { url: string; thumbnail_url: string; title: string }[];
  image_search_url: string;
  image_source: string;
  gen_status?: "pending" | "generating" | "done";
}

const HISTORY_KEY = "whatdish-history";
const MAX_HISTORY = 10;
const MAX_CONCURRENT_GEN = 5;
const IMAGE_FILE_EXTENSION_RE = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;

// 加载时轮播的趣味冷知识
const FOOD_FACTS = [
  // 日本
  "日本菜单上的「盛り合わせ」就是拼盘/拼盘的意思 🍣",
  "日料店的「おまかせ」(Omakase) 意思是'交给师傅安排'，没有固定菜单 👨‍🍳",
  "日本「定食」= 套餐，通常含主菜+米饭+味噌汤+漬物 🍱",
  "拉面菜单上的「替玉」不是加蛋，是加一份面 🍜",
  "「刺身」和「寿司」不是一回事——刺身是纯生鱼片，寿司有醋饭 🐟",
  "日本咖喱和印度咖喱完全不同，日式咖喱浓稠偏甜，配福神渍吃 🍛",
  "「燒鳥」(Yakitori) 不一定是鸡肉——也包含鸡内脏串烧 🔥",
  "居酒屋的「お通し」(Otoshi) 是自动上的餐前小菜，会收钱 💰",
  "日本「唐揚げ」= 日式炸鸡，外酥里嫩腌过酱油和姜 🍗",
  "「天ぷら」其实是葡萄牙传教士带到日本的，不是日本原创 🇵🇹",

  // 韩国
  "韩国菜单的「찜」(jjim) 是蒸或炖，不是烤 🇰🇷",
  "韩料店的「반찬」(Banchan) 是小菜，通常免费无限续 🥗",
  "「삼겹살」直译是'三层肉'，就是烤五花肉 🥩",
  "韩国「떡볶이」= 辣炒年糕，街头小吃之王 🌶️",
  "「비빔밥」= 拌饭，吃之前要把所有食材和辣酱拌匀 🥄",
  "韩国的「찌개」和「탕」都是汤，但찌개更浓稠、탕汤更多 🍲",

  // 东南亚
  "泰国的冬阴功汤，其实是配饭吃的，不是单独喝的汤 🍜",
  "泰国「ผัดไทย」(Pad Thai) = 泰式炒河粉，国民级街头美食 🥡",
  "「ส้มตำ」(Som Tam) = 青木瓜沙拉，泰国的'酸辣土豆丝' 🥗",
  "越南 Pho 的汤底要熬 8 小时以上，精华在汤不在粉 🍲",
  "越南「Bánh mì」= 法棍三明治，是法国殖民留下的饮食遗产 🥖",
  "「Phở」和「Bún」都是米粉，Phở 是扁的，Bún 是圆的 🍜",
  "泰国菜单上看到「พริก」(Prik) 就是辣椒，加了这道菜偏辣 🌶️",
  "印尼「Nasi Goreng」= 炒饭，Nasi = 饭，Goreng = 炸/炒 🍚",
  "马来西亚「Nasi Lemak」= 椰浆饭，用椰奶煮的米饭配参巴酱 🇲🇾",
  "菲律宾「Adobo」是醋和酱油慢炖的肉，国民第一菜 🇵🇭",
  "新加坡「辣椒螃蟹」其实不太辣，主要是番茄和蛋花酱汁 🦀",
  "缅甸「Mohinga」= 鱼汤米粉，被称作缅甸的国民早餐 🐟",

  // 中东 & 中亚
  "中东菜单里的 Kebab 不一定是串，也可能是肉饼或肉丸 🥙",
  "「Hummus」= 鹰嘴豆泥，中东餐桌上的必备蘸料 🇱🇧",
  "「Shawarma」= 旋转烤肉，就是中东版的'肉夹馍' 🥙",
  "「Falafel」= 炸鹰嘴豆丸子，中东最流行的素食选择 🧆",
  "「Tabbouleh」= 塔布勒沙拉，主要成分是欧芹碎+小麦粒 🥗",
  "「Baklava」是中东/地中海的果仁蜜饼，极甜，配茶吃 🍯",
  "土耳其「Pide」长得像披萨，其实是船形薄饼 🇹🇷",
  "「Manti」= 土耳其小饺子，一口一个，配酸奶酱吃 🥟",
  "波斯菜里的「Zereshk Polo」= 小檗米饭，酸酸甜甜很开胃 🇮🇷",

  // 印度 & 南亚
  "印度菜单上的 Masala 不是一种香料，是混合香料的统称 🍛",
  "印度「Biryani」= 香料饭，一层米饭一层肉，慢火焖出来的 🍚",
  "「Tandoori」= 泥窑烤制的，Tandoor 是那种大缸一样的烤炉 🔥",
  "「Naan」= 馕，印度烤饼；「Roti」= 全麦薄饼，都不含酵母 🫓",
  "印度菜单上「Paneer」= 印度奶酪块，素食者的蛋白质来源 🧀",
  "「Dal」= 豆子汤/豆泥，印度每顿饭几乎都有它 🥣",
  "「Samosa」= 印度三角饺，油炸的，里面是土豆泥或肉馅 🥟",
  "「Lassi」= 印度酸奶饮，咸的配餐、甜的当甜品 🥤",
  "斯里兰卡的「Hoppers」= 碗状米饼，中间打个蛋叫 Egg Hopper 🇱🇰",
  "尼泊尔「Momo」= 蒸饺，受西藏影响，蘸辣酱吃 🥟",

  // 欧洲
  "意大利菜单上的 Antipasti 是前菜，Primi 是第一道（面/饭），Secondi 是第二道（肉/鱼）🇮🇹",
  "法国菜单上的 Entrée 在美国指主菜，在法国指前菜 🥐",
  "西班牙 Tapas 最初是盖在酒杯上的面包片，免费送的 🇪🇸",
  "意大利「Risotto」= 烩饭，要一直搅拌才能做出 creamy 口感 🍚",
  "「Bruschetta」的正确发音是'布鲁斯凯塔'，不是'布鲁谢塔' 🇮🇹",
  "「Carpaccio」= 生牛肉薄片，也泛指任何生切薄片 🇮🇹",
  "西班牙「Paella」从海鲜到兔肉都有，海鲜版其实是最不正宗的 🇪🇸",
  "德国「Schnitzel」= 炸肉排，奥地利的比德国更有名 🇩🇪",
  "「Bratwurst」≠ 任何德国香肠，特指煎烤用的细香肠 🌭",
  "希腊「Moussaka」= 茄子肉酱千层，希腊的国菜 🇬🇷",
  "「Souvlaki」= 希腊烤肉串，Pita 卷着吃才是街头吃法 🇬🇷",
  "匈牙利「Goulash」既是汤也是炖菜，核心灵魂是 Paprika 辣椒粉 🇭🇺",
  "葡萄牙「Pastel de Nata」= 葡式蛋挞，焦糖面是精髓 🇵🇹",
  "俄罗斯「Borscht」红菜汤其实起源于乌克兰 🇺🇦",
  "北欧的「Smørrebrød」= 开放式三明治，黑面包上铺满料 🇩🇰",

  // 美洲
  "墨西哥 Taco 正宗吃法是不用餐具，用手拿着吃 🌮",
  "「Burrito」直译是'小驴'，不知道为什么叫这个名 🐴",
  "「Quesadilla」= 奶酪夹心烤饼，Queso = 奶酪 🇲🇽",
  "「Guacamole」= 牛油果酱，核心就是牛油果+青柠+盐+香菜 🥑",
  "「Enchilada」= 卷饼浇酱，红色是干辣椒酱，绿色是青番茄酱 🌯",
  "秘鲁「Ceviche」= 柠檬汁腌生鱼，酸到上瘾的国民菜 🇵🇪",
  "巴西「Feijoada」= 黑豆炖肉杂烩，周末才能吃到的国民美食 🇧🇷",
  "阿根廷的「Asado」不只是烤肉，是一种社交仪式 🇦🇷",
  "美国「Buffalo Wings」其实和水牛没关系，诞生于纽约 Buffalo 市 🍗",
  "「Corn Dog」= 玉米面包裹的热狗，美国嘉年华必吃 🌽",
  "「Clam Chowder」= 蛤蜊浓汤，波士顿和新英格兰的最有名 🥣",

  // 非洲
  "摩洛哥「Tagine」既是菜名也是锅名——那种锥形盖的陶锅 🇲🇦",
  "「Couscous」= 北非小米，其实是一种小麦粉做的颗粒，不是米 🍚",
  "埃塞俄比亚「Injera」= 酸味海绵饼，既是主食也是餐具 🇪🇹",
  "南非「Biltong」= 风干肉条，南非人的零食之魂 🇿🇦",
  "「Bunny Chow」不是兔子，是南非德班的咖喱面包碗 🇿🇦",

  // 通用 / 跨国
  "「À la carte」= 单点，每道菜分别定价；「Set Menu」= 套餐，一口价 📋",
  "菜单上标注「MP」或「Market Price」= 时价，通常是海鲜 🦞",
  "「Side」= 配菜/小食，不包含在主菜里，要单独点 🍟",
  "一道菜后面标注「(V)」或「(VG)」= Vegetarian(素食) / Vegan(纯素) 🥬",
  "「Gluten-free」= 无麸质，常见于欧美菜单，不代表更健康 🌾",
  "「Aperitif」= 开胃酒，餐前喝；「Digestif」= 餐后酒，助消化 🍸",
  "「Prix Fixe」= 固定价格套餐，通常是三道式（前菜+主菜+甜点）🍽️",
  "菜单上的「Chef\'s Special」或「Today\'s Special」通常是当天推荐，最值得尝试 ⭐",
  "「Al Dente」专门形容意面'弹牙'的口感，是意大利面的黄金标准 🍝",
  "很多菜名里的「à la」是法语，意思是'以某种方式做的'——à la crème = 加奶油 🥛",
  "「Seasonal」= 当季的，通常意味着最新鲜，但也可能最贵 🌿",
  "「Artisan」或「House-made」= 手工/自制，比「Homemade」更有含金量 🏠",
  "「Fusion」= 融合料理，混搭两国风味，成功率和翻车率都高 🔀",
  "很多菜名带地名——不是产自那里，只是烹饪风格：Bolognese 是肉酱风格 🗺️",
  "看到「Confit」= 油封，用油脂慢煮的技法，最出名的是油封鸭腿 🦆",
];

interface HistoryEntry {
  id: string;
  timestamp: number;
  imageDataUrl?: string;    // 旧版兼容
  imageDataUrls?: string[];  // 新版多图
  menu: MenuItem[];
  meta: any;
  restaurantName: string;
  dishCount: number;
}

interface UploadDebugEntry {
  id: string;
  time: string;
  message: string;
  detail?: string;
}

/** 兼容新旧历史记录格式，统一返回数组 */
function getHistoryImageUrls(entry: HistoryEntry): string[] {
  if (entry.imageDataUrls && entry.imageDataUrls.length > 0) return entry.imageDataUrls;
  if (entry.imageDataUrl) return [entry.imageDataUrl];
  return [];
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (!file.type) return true;
  return file.type === "application/octet-stream" && IMAGE_FILE_EXTENSION_RE.test(file.name);
}

function getFileDebugInfo(file: File) {
  return {
    name: file.name || "(empty)",
    type: file.type || "(empty)",
    size: file.size,
    lastModified: file.lastModified,
    accepted: isImageFile(file),
  };
}

// 餐厅摘要计算
function computeSummary(items: MenuItem[]): {
  avgScore: number; avgPrice: string; mainFlavor: string; isSpicy: boolean; signatureCount: number;
} {
  let totalScore = 0, priceSum = 0, priceCount = 0;
  let hasSpicy = false, signatureCount = 0;
  const flavorCount: Record<string, number> = {};
  for (const item of items) {
    totalScore += item.chinese_palate_score || 3;
    const p = parseFloat((item.price || "").replace(/[^0-9.]/g, ""));
    if (!isNaN(p)) { priceSum += p; priceCount++; }
    if (item.tags?.includes("辛辣")) hasSpicy = true;
    if (item.tags?.includes("招牌") || item.tags?.includes("推荐")) signatureCount++;
    for (const f of item.flavor_profile || []) {
      flavorCount[f] = (flavorCount[f] || 0) + 1;
    }
  }
  const mainFlavor = Object.entries(flavorCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const avgScore = items.length > 0 ? Math.round((totalScore / items.length) * 10) / 10 : 0;
  const avgPrice = priceCount > 0 ? `¥${Math.round(priceSum / priceCount)}` : "";
  return { avgScore, avgPrice, mainFlavor, isSpicy: hasSpicy, signatureCount };
}

// Top 3 推荐
function computeTop3(items: MenuItem[]): number[] {
  return items
    .map((item, idx) => {
      let score = (item.chinese_palate_score || 3) * 2;
      if (item.tags?.includes("招牌")) score += 3;
      if (item.tags?.includes("推荐")) score += 2;
      if (item.tags?.includes("当地特色")) score += 1;
      return { idx, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.idx);
}

export default function Home() {
  const exportRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuPreviewUrls, setMenuPreviewUrls] = useState<{ id: string; dataUrl: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File; dataUrl: string }[]>([]);
  const [status, setStatus] = useState<"initial" | "parsing" | "created">("initial");
  const [parsedMenu, setParsedMenu] = useState<MenuItem[]>([]);
  const [menuMeta, setMenuMeta] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [genMode, setGenMode] = useState<"individual" | "batch">("individual");
  const [batchPosterUrl, setBatchPosterUrl] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("全部");
  const [showRecommend, setShowRecommend] = useState(false);
  const [loadingFact, setLoadingFact] = useState(0);
  const [parsingProgress, setParsingProgress] = useState("");
  const [debugUpload, setDebugUpload] = useState(false);
  const [uploadDebugLogs, setUploadDebugLogs] = useState<UploadDebugEntry[]>([]);

  // 背景生图池 ref（避免闭包问题）
  const genPoolRef = useRef<Set<number>>(new Set());
  const menuRef = useRef<MenuItem[]>([]);

  // 轮播冷知识
  useEffect(() => {
    if (status !== "parsing") return;
    const interval = setInterval(() => {
      setLoadingFact(Math.floor(Math.random() * FOOD_FACTS.length));
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  // 页面加载时恢复历史
  useEffect(() => { setHistory(loadHistory()); }, []);

  // 手机上传问题排查：支持 URL 开关，也支持页面按钮持久开启。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search);
    const enabledByUrl = query.has("debugUpload") || window.location.hash.includes("debugUpload");
    const enabledByStorage = localStorage.getItem("whatdish-debug-upload") === "1";
    setDebugUpload(enabledByUrl || enabledByStorage);
  }, []);

  const appendUploadDebug = useCallback((message: string, detail?: unknown) => {
    const entry: UploadDebugEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toLocaleTimeString(),
      message,
      detail: detail === undefined ? undefined : JSON.stringify(detail, null, 2),
    };
    console.log("[upload-debug]", message, detail ?? "");
    setUploadDebugLogs((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  // Esc 关闭灯箱
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 全景海报截图
  useEffect(() => {
    if (status !== "created" || menuMeta?.gen_mode !== "batch" || !posterRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(posterRef.current!, { backgroundColor: "#ffffff", scale: 2, useCORS: true, allowTaint: false });
        setBatchPosterUrl(canvas.toDataURL("image/png"));
      } catch (e) { console.error("[啥菜] Poster capture failed:", e); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [status, menuMeta?.gen_mode, parsedMenu]);

  // ============================================================
  // 文件管理：添加到待处理列表（不立即分析）
  // ============================================================
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    appendUploadDebug("addFiles called", {
      count: files.length,
      files: files.map(getFileDebugInfo),
    });

    const newFiles = files
      .filter(isImageFile)
      .map((f) => {
        try {
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            file: f,
            dataUrl: URL.createObjectURL(f),
          };
        } catch (err: any) {
          appendUploadDebug("createObjectURL failed", {
            file: getFileDebugInfo(f),
            error: err?.message || String(err),
          });
          return null;
        }
      })
      .filter((f): f is { id: string; file: File; dataUrl: string } => Boolean(f));

    if (newFiles.length === 0) {
      appendUploadDebug("no usable images after filtering", {
        count: files.length,
        files: files.map(getFileDebugInfo),
      });
      setError("没有识别到可用的图片，请选择菜单照片或改用拍照上传。");
      return;
    }
    setError("");
    appendUploadDebug("pending files added", {
      added: newFiles.length,
      totalAfterAdd: pendingFiles.length + newFiles.length,
    });
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, [appendUploadDebug, pendingFiles.length]);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ============================================================
  // 确认并开始分析
  // ============================================================
  const confirmAndAnalyze = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    const files = pendingFiles.map((f) => f.file);
    const previews = pendingFiles.map((f) => ({ id: f.id, dataUrl: f.dataUrl }));
    setPendingFiles([]);
    setMenuPreviewUrls(previews);
    setStatus("parsing");
    setError("");
    setParsingProgress("");

    // 读取所有文件为 base64
    const imageBase64List: string[] = [];
    for (const file of files) {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      imageBase64List.push(b64);
    }

    try {
      setParsingProgress(`正在识别第 1/${imageBase64List.length} 张...`);

      const res = await fetch("/api/parseMenu", {
        method: "POST",
        body: JSON.stringify({
          images: imageBase64List,
          gen_mode: genMode,
          skip_gen: true,
        }),
      });
      const json = await res.json();

      if (json.error) {
        if (json.error === "NOT_MENU") setError(json.message || "请上传餐厅菜单照片");
        else setError(json.error);
        setStatus("initial");
        return;
      }

      const menu: MenuItem[] = (json.menu || []).map((item: any) => ({
        ...item,
        gen_status: item.images?.length > 0 ? "done" as const : "pending" as const,
      }));
      const meta = json.meta || {};

      setParsedMenu(menu);
      setMenuMeta(meta);
      menuRef.current = menu;
      setStatus("created");

      const entry: HistoryEntry = {
        id: Date.now().toString(36),
        timestamp: Date.now(),
        imageDataUrls: previews.map((p) => p.dataUrl),
        menu,
        meta,
        restaurantName: meta.restaurant_name || "未知餐厅",
        dishCount: menu.length,
      };
      const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
      saveHistory(updated);
      setHistory(updated);

      const context = `${meta?.country || ""} ${meta?.language || ""} cuisine`;
      const maxGen = meta?.max_gen_images ?? Infinity;
      startBackgroundGen(menu, context, maxGen);
    } catch (err: any) {
      setError(err.message || "请求失败");
      setStatus("initial");
    }
  }, [pendingFiles, genMode]);

  // ============================================================
  // 后台并发生图池（最多 5 个并发，一个完成踢下一个）
  // ============================================================
  const startBackgroundGen = useCallback((menu: MenuItem[], context: string, maxGen: number) => {
    const pending = menu
      .map((item, idx) => ({ idx, item }))
      .filter(({ item }) => item.gen_status === "pending")
      .slice(0, maxGen);

    if (pending.length === 0) return;

    const queue = [...pending];
    genPoolRef.current = new Set();

    const updateItem = (idx: number, updates: Partial<MenuItem>) => {
      setParsedMenu((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], ...updates };
        return next;
      });
      // 同步更新 ref，避免闭包读到陈旧状态
      if (menuRef.current[idx]) {
        menuRef.current[idx] = { ...menuRef.current[idx], ...updates };
      }
    };

    // 每个菜最多重试 2 次
    const retryCount = new Map<number, number>();

    const genOne = async (idx: number, item: MenuItem) => {
      updateItem(idx, { gen_status: "generating" });
      try {
        const res = await fetch("/api/generateImage", {
          method: "POST",
          body: JSON.stringify({
            name_orig: item.name_orig,
            name_zh: item.name_zh,
            description_zh: item.description_zh,
            context,
          }),
        });
        const data = await res.json();
        if (data.image_base64) {
          const b64Url = `data:image/png;base64,${data.image_base64}`;
          updateItem(idx, {
            images: [...item.images, { url: b64Url, thumbnail_url: b64Url, title: `${item.name_orig} (AI 生成)` }],
            image_source: item.image_source === "none" ? "ai_generated" : item.image_source,
            gen_status: "done",
          });
          retryCount.delete(idx);
        } else {
          // API 返回了但没有图片（如 500），重试
          const tries = (retryCount.get(idx) || 0) + 1;
          if (tries <= 2) {
            retryCount.set(idx, tries);
            updateItem(idx, { gen_status: "pending" });
            console.log(`[啥菜/gen] Retry ${tries}/2 for dish ${idx}: ${item.name_orig}`);
          } else {
            updateItem(idx, { gen_status: "done" });
            retryCount.delete(idx);
            console.log(`[啥菜/gen] Giving up on dish ${idx}: ${item.name_orig}`);
          }
        }
      } catch {
        const tries = (retryCount.get(idx) || 0) + 1;
        if (tries <= 2) {
          retryCount.set(idx, tries);
          updateItem(idx, { gen_status: "pending" });
          console.log(`[啥菜/gen] Retry ${tries}/2 after network error for dish ${idx}`);
        } else {
          updateItem(idx, { gen_status: "done" });
          retryCount.delete(idx);
          console.log(`[啥菜/gen] Giving up on dish ${idx} after network errors`);
        }
      } finally {
        genPoolRef.current.delete(idx);
        // 踢下一个（menuRef 已通过 updateItem 同步更新，读到的是最新状态）
        const next = queue.find(({ idx: i }) =>
          !genPoolRef.current.has(i) && menuRef.current[i]?.gen_status === "pending"
        );
        if (next) {
          genPoolRef.current.add(next.idx);
          genOne(next.idx, next.item);
        }
      }
    };

    // 启动首批（错峰 300ms，避免同时打爆 API 限流）
    const initial = queue.slice(0, MAX_CONCURRENT_GEN);
    for (let i = 0; i < initial.length; i++) {
      const { idx, item } = initial[i];
      genPoolRef.current.add(idx);
      setTimeout(() => genOne(idx, item), i * 300);
    }
  }, []);

  // ============================================================
  // 历史记录恢复
  // ============================================================
  const restoreHistory = useCallback((entry: HistoryEntry) => {
    setParsedMenu(entry.menu);
    setMenuMeta(entry.meta);
    const urls = getHistoryImageUrls(entry);
    setMenuPreviewUrls(urls.map((url, i) => ({ id: `${entry.id}-${i}`, dataUrl: url })));
    setStatus("created");
    setSearchTerm("");
    setError("");
    setActiveFilter("全部");
    setShowRecommend(false);
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
    const canvas = await html2canvas(exportRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `whatdish-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // ============================================================
  // 筛选 & 搜索 & 推荐
  // ============================================================
  const FILTERS = ["全部", "招牌/推荐", "素食", "不辣", "主食", "甜点"];
  const recommendations = showRecommend ? computeTop3(parsedMenu) : [];
  const highlightKeys: Set<string> | undefined = showRecommend && recommendations.length > 0
    ? new Set(recommendations.map((i) => parsedMenu[i]?.name_orig).filter(Boolean))
    : undefined;

  const filteredMenu = parsedMenu.filter((item) => {
    // 推荐模式：只显示 Top 3
    if (showRecommend && recommendations.length > 0) {
      const idx = parsedMenu.indexOf(item);
      if (!recommendations.includes(idx)) return false;
    }
    // 筛选
    if (activeFilter === "招牌/推荐") return item.tags?.includes("招牌") || item.tags?.includes("推荐");
    if (activeFilter === "素食") return item.tags?.includes("素食");
    if (activeFilter === "不辣") return !item.tags?.includes("辛辣");
    if (activeFilter === "主食") return item.tags?.includes("主食");
    if (activeFilter === "甜点") return item.tags?.includes("甜点");
    return true;
  }).filter((item) => {
    // 搜索
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return item.name_zh.toLowerCase().includes(s) || item.name_orig.toLowerCase().includes(s);
  });

  const summary = parsedMenu.length > 0 ? computeSummary(parsedMenu) : null;

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
        <h1 className="mb-6 text-balance text-6xl font-bold text-zinc-800">啥菜</h1>
      </div>
      <div className="max-w-3xl text-center mx-auto">
        <p className="mb-8 text-lg text-gray-500 text-balance">
          拍下外文菜单，每道菜自动翻译成中文，匹配真实图片，标注中国胃适配度。
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Upload area */}
        {status === "initial" && (
          <>
	            {/* 多选相册 input — sr-only 而非 hidden，保证移动端 label 能触达 */}
	            <input
	              ref={fileInputRef}
	              id="album-input"
	              type="file"
	              accept="image/*"
	              multiple
	              className="fixed -left-[9999px] top-0 h-px w-px opacity-0"
	              tabIndex={-1}
	              onChange={(e) => {
	                const files = e.target.files;
	                appendUploadDebug("album input change", {
	                  value: e.currentTarget.value,
	                  filesLength: files?.length ?? 0,
	                  files: files ? Array.from(files).map(getFileDebugInfo) : [],
	                });
	                if (files?.length) addFiles(files);
	                else setError("没有选择到照片，请重试或改用拍照上传。");
	                e.target.value = "";
	              }}
	            />

            {/* 拍照 input */}
	            <input
	              id="camera-input"
	              type="file"
	              accept="image/*"
	              capture="environment"
	              className="fixed -left-[9999px] top-0 h-px w-px opacity-0"
	              tabIndex={-1}
	              onChange={(e) => {
	                const files = e.target.files;
	                appendUploadDebug("camera input change", {
	                  value: e.currentTarget.value,
	                  filesLength: files?.length ?? 0,
	                  files: files ? Array.from(files).map(getFileDebugInfo) : [],
	                });
	                if (files?.length) addFiles(files);
	                else setError("没有拍到照片，请重试或改用从相册选择。");
	                e.target.value = "";
	              }}
	            />

	            <div
	              className="mt-2 grid grid-cols-2 gap-3"
	              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("rounded-lg", "bg-blue-50"); }}
	              onDragLeave={(e) => { e.currentTarget.classList.remove("rounded-lg", "bg-blue-50"); }}
	              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("rounded-lg", "bg-blue-50"); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files); }}
	            >
	              <label
	                htmlFor="camera-input"
	                className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 text-base font-medium text-white transition hover:bg-blue-600 active:bg-blue-700"
	                onClick={() => {
	                  const input = document.getElementById("camera-input") as HTMLInputElement;
	                  if (!input) return;
	                  input.value = "";
	                  appendUploadDebug("camera label click", {
	                    userAgent: navigator.userAgent,
	                    capture: input.getAttribute("capture"),
	                  });
	                }}
	              >
	                <CameraIcon className="h-5 w-5" />
	                拍照
	              </label>
	              <label
	                htmlFor="album-input"
	                className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-base font-medium text-gray-800 transition hover:bg-gray-50 active:bg-gray-100"
	              >
	                <PhotoIcon className="h-5 w-5 text-gray-500" />
	                相册
	              </label>
	            </div>

            {/* 待确认文件预览 */}
            {pendingFiles.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">已选择 {pendingFiles.length} 张照片，确认后开始分析：</p>
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  {pendingFiles.map((f) => (
                    <div key={f.id} className="relative w-20 h-20 rounded-lg overflow-hidden shadow-sm border border-gray-200 group">
                      <Image src={f.dataUrl} alt="待上传" fill className="object-cover" unoptimized />
                      <button
                        onClick={() => removePendingFile(f.id)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={confirmAndAnalyze}
                    className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
                  >
                    🔍 开始分析
                  </button>
                  <button
                    onClick={() => setPendingFiles([])}
                    className="px-4 py-2.5 text-gray-500 hover:text-gray-700 transition text-sm"
                  >
                    清空重选
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* 生图模式切换 — 暂时隐藏，后续重新设计合成一张的交互 */}
        {false && status === "initial" && pendingFiles.length === 0 && (
          <div className="mt-6 flex flex-col items-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setGenMode("individual")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${genMode === "individual" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >🍽️ 分别出图</button>
              <button
                onClick={() => setGenMode("batch")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${genMode === "batch" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >📸 合成一张</button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {genMode === "batch" ? "所有菜品拼成一张带文字的海报，方便分享" : "每道菜单独出图，适合逐道浏览"}
            </p>
          </div>
        )}

        {/* Error */}
	        {error && (
	          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
	        )}

	        {status === "initial" && (
	          <div className="mt-3 flex justify-center">
	            <button
	              type="button"
	              onClick={() => {
	                const next = !debugUpload;
	                setDebugUpload(next);
	                localStorage.setItem("whatdish-debug-upload", next ? "1" : "0");
	                appendUploadDebug(next ? "debug panel enabled manually" : "debug panel disabled manually", {
	                  href: window.location.href,
	                  userAgent: navigator.userAgent,
	                });
	              }}
	              className="text-xs text-gray-400 underline decoration-dotted underline-offset-2"
	            >
	              {debugUpload ? "关闭上传调试" : "开启上传调试"}
	            </button>
	          </div>
	        )}

	        {debugUpload && (
	          <div className="mt-4 text-left rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
	            <div className="mb-2 flex items-center justify-between gap-3">
	              <p className="font-semibold">上传调试</p>
	              <button
	                type="button"
	                onClick={() => setUploadDebugLogs([])}
	                className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-800"
	              >
	                清空
	              </button>
	            </div>
	            <p className="mb-2 break-all">UA: {typeof navigator !== "undefined" ? navigator.userAgent : ""}</p>
	            <p className="mb-2">已选择: {pendingFiles.length} 张</p>
	            {uploadDebugLogs.length === 0 ? (
	              <p className="text-amber-700">还没有上传事件。点上传后这里会显示浏览器返回的文件信息。</p>
	            ) : (
	              <div className="max-h-64 space-y-2 overflow-auto">
	                {uploadDebugLogs.map((log) => (
	                  <div key={log.id} className="rounded bg-white/70 p-2">
	                    <p className="font-medium">{log.time} · {log.message}</p>
	                    {log.detail && <pre className="mt-1 whitespace-pre-wrap break-all">{log.detail}</pre>}
	                  </div>
	                ))}
	              </div>
	            )}
	          </div>
	        )}

	        {/* Menu preview thumbnails */}
        {menuPreviewUrls.length > 0 && (
          <div className="my-6 mx-auto">
            <div className="flex flex-wrap justify-center gap-3">
              {menuPreviewUrls.map((p) => (
                <div key={p.id} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm border border-gray-100">
                  <Image src={p.dataUrl} alt="菜单预览" fill className="object-cover cursor-pointer" unoptimized onClick={() => setLightboxSrc(p.dataUrl)} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">点击缩略图可放大查看</p>
          </div>
        )}

        {/* Loading — 趣味冷知识 */}
        {status === "parsing" && (
          <div className="mt-10 flex flex-col items-center">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
              <p className="text-lg text-gray-600">
                {parsingProgress || "正在分析菜单..."}
              </p>
            </div>
            <div className="max-w-md mx-auto bg-blue-50 border border-blue-100 rounded-xl p-4 transition-all duration-500">
              <p className="text-sm text-blue-700">💡 {FOOD_FACTS[loadingFact]}</p>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {status === "initial" && history.length > 0 && (
        <div className="max-w-2xl mx-auto mt-10 text-left">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />历史记录
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {history.map((entry) => (
              <div key={entry.id} onClick={() => restoreHistory(entry)} className="group relative cursor-pointer rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all overflow-hidden">
                <div className="aspect-[4/3] bg-gray-100 relative">
                  <Image src={getHistoryImageUrls(entry)[0] || ""} alt={entry.restaurantName} fill className="object-cover" unoptimized />
                  {getHistoryImageUrls(entry).length > 1 && (
                    <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">{getHistoryImageUrls(entry).length} 张</span>
                  )}
                  <button onClick={(e) => deleteHistory(entry.id, e)} className="absolute top-1 right-1 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500" title="删除">
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{entry.restaurantName}</p>
                  <p className="text-xs text-gray-400">{entry.dishCount} 道菜 · {formatTime(entry.timestamp)}</p>
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="text-left">
              <h2 className="text-4xl font-bold">
                {(menuMeta?.restaurant_name && menuMeta.restaurant_name !== "未识别" ? menuMeta.restaurant_name : "菜单")} · {parsedMenu.length} 道菜
              </h2>
              {menuMeta?.country && (
                <p className="text-gray-500 mt-1 text-sm">
                  {menuMeta.country} · {menuMeta.language} ·
                  <span className="ml-1 text-xs text-gray-400">模型: {menuMeta.model_used}</span>
                  {menuMeta.image_count > 1 && <span className="ml-1 text-xs text-gray-400">· {menuMeta.image_count} 张照片</span>}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStatus("initial"); setParsedMenu([]); setMenuMeta(null); setMenuPreviewUrls([]); setSearchTerm(""); setActiveFilter("全部"); setShowRecommend(false); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">← 返回</button>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"><ArrowDownTrayIcon className="h-5 w-5" />导出图片</button>
            </div>
          </div>

          {/* 餐厅速览摘要 */}
          {summary && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
                {summary.mainFlavor && <span>🍽️ 主风味：<strong>{summary.mainFlavor}</strong></span>}
                {summary.avgPrice && <span>💰 均价：<strong>{summary.avgPrice}</strong></span>}
                <span>🥢 中国胃友好度：<strong>{summary.avgScore >= 4 ? "⭐⭐⭐⭐" : summary.avgScore >= 3.5 ? "⭐⭐⭐" : "⭐⭐"} {summary.avgScore}/5</strong></span>
                <span>🌶️ 整体：<strong>{summary.isSpicy ? "有辣有淡" : "偏温和不辣"}</strong></span>
                {summary.signatureCount > 0 && <span>⭐ <strong>{summary.signatureCount} 道招牌/推荐</strong></span>}
              </div>
            </div>
          )}

          {/* 筛选条 + 帮我选 */}
          <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setActiveFilter(f); setShowRecommend(false); }}
                  className={`px-3 py-1.5 rounded-full text-sm transition ${activeFilter === f && !showRecommend ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >{f}</button>
              ))}
            </div>
            <button
              onClick={() => { setShowRecommend(!showRecommend); if (!showRecommend) setActiveFilter("全部"); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm transition ${showRecommend ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"}`}
            >
              <SparklesIcon className="h-4 w-4" />
              {showRecommend ? "显示全部" : "帮我选"}
            </button>
          </div>

          {/* "帮我选" 推荐结果 */}
          {showRecommend && recommendations.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-700">
              💡 根据中国胃评分和招牌推荐，为你精选 Top 3：
              {recommendations.map((idx, i) => (
                <span key={idx} className="font-medium">
                  {i > 0 && (i < recommendations.length - 1 ? "、" : " 和 ")}
                  「{parsedMenu[idx]?.name_zh}」
                </span>
              ))}
            </div>
          )}

          {/* 全景海报 */}
          {menuMeta?.gen_mode === "batch" && (
            <div className="mb-6">
              {batchPosterUrl ? (
                <div className="rounded-xl overflow-hidden shadow-lg border border-gray-100">
                  <Image src={batchPosterUrl} alt="菜单全景海报" width={1200} height={1600} className="w-full object-contain cursor-pointer" unoptimized onClick={() => setLightboxSrc(batchPosterUrl)} />
                  <p className="text-center text-sm text-gray-400 py-2 bg-gray-50">📸 全景菜单海报（可长按保存）</p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 mr-3" />正在生成全景海报...
                </div>
              )}
            </div>
          )}

          {/* 隐藏海报（供截图） */}
          {menuMeta?.gen_mode === "batch" && (
            <div ref={posterRef} className="fixed left-[-9999px] top-0" style={{ width: "600px" }}>
              <div className="bg-white p-8">
                <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
                  <h1 className="text-3xl font-bold text-gray-800 mb-1">
                    {(menuMeta?.restaurant_name && menuMeta.restaurant_name !== "未识别") ? menuMeta.restaurant_name : "菜单"}
                  </h1>
                  {menuMeta?.country && <p className="text-sm text-gray-500">{menuMeta.country} · {menuMeta.language} · {parsedMenu.length} 道菜</p>}
                </div>
                <div className="space-y-6">
                  {parsedMenu.map((item, idx) => (
                    <div key={idx} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden mb-3">
                        {item.images.length > 0 ? <img src={item.images[0].url} alt={item.name_zh} className="w-full h-full object-cover cursor-pointer" crossOrigin="anonymous" onClick={() => setLightboxSrc(item.images[0].url)} /> : <div className="flex items-center justify-center h-full text-gray-300 text-sm">暂无图片</div>}
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        {item.menu_number && <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{item.menu_number}</span>}
                        <h3 className="text-base font-bold text-gray-800">{item.name_zh}</h3>
                      </div>
                      {item.name_zh_orig && item.name_zh_orig !== item.name_zh && <p className="text-sm text-gray-400 mb-0.5">菜单原名：{item.name_zh_orig}</p>}
                      <p className="text-sm text-gray-700 font-medium mb-1">{item.name_orig}</p>
                      {item.description_orig && <p className="text-xs text-gray-400 italic mb-1 line-clamp-1">{item.description_orig}</p>}
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description_zh}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-blue-600">{item.price}</span>
                        <span className="text-xs text-yellow-700">🥢 {item.chinese_palate_note || `${"⭐".repeat(item.chinese_palate_score || 3)}`}</span>
                      </div>
                      {item.extra_info && <p className="text-xs text-gray-400 mt-1">📌 {item.extra_info}</p>}
                    </div>
                  ))}
                </div>
                <div className="text-center mt-6 pt-4 border-t border-gray-100"><p className="text-xs text-gray-300">由 啥菜 WhatDish 生成</p></div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input type="text" placeholder="搜索菜品..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>

          {/* 后台生图进度 */}
          {parsedMenu.some((i) => i.gen_status === "generating" || i.gen_status === "pending") && (
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-blue-400" />
              {parsedMenu.filter((i) => i.gen_status === "done").length}/{parsedMenu.filter((i) => i.gen_status === "pending" || i.gen_status === "generating" || i.gen_status === "done").length} 张图片已就绪
              {genPoolRef.current.size > 0 && <span>（{genPoolRef.current.size} 个正在生成）</span>}
            </div>
          )}

          <MenuGrid items={filteredMenu} onImageClick={setLightboxSrc} highlightKeys={highlightKeys} />
        </div>
      )}

      {/* 图片灯箱 */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 w-10 h-10 flex items-center justify-center rounded-full bg-black/30" onClick={() => setLightboxSrc(null)}>✕</button>
          <img src={lightboxSrc} alt="放大查看" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
