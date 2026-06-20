/**
 * 图片搜索 —— 调用 OpenSERP 获取真实菜品图片。
 *
 * OpenSERP 是自部署的免费图片搜索引擎聚合，支持百度+必应。
 * Docker 部署：docker run -d -p 7000:7000 sergeevgit/openserp
 */
import { loadConfig } from "./config";

export interface SearchResult {
  url: string;
  thumbnail_url: string;
  title: string;
}

export async function searchDishImages(
  dishName: string,
  context: string = "",
  maxImages: number = 3
): Promise<{ images: SearchResult[]; searchUrl: string; source: string }> {
  const url = loadConfig().image_search.openserp_url;
  const query = encodeURIComponent(`${dishName} ${context} food dish`.trim());
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${query}`;

  if (!url) {
    return { images: [], searchUrl, source: "not_configured" };
  }

  // 尝试百度
  try {
    const images = await fetchFromOpenSERP(url, "baidu", query, maxImages);
    if (images.length > 0) {
      return { images, searchUrl, source: "baidu" };
    }
  } catch { /* fall through */ }

  // 尝试必应
  try {
    const images = await fetchFromOpenSERP(url, "bing", query, maxImages);
    if (images.length > 0) {
      return { images, searchUrl, source: "bing" };
    }
  } catch { /* fall through */ }

  return { images: [], searchUrl, source: "none" };
}

async function fetchFromOpenSERP(
  baseURL: string,
  engine: "baidu" | "bing",
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const apiUrl = `${baseURL}/${engine}/image?text=${query}&limit=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.results || data?.images || [];
    return results.slice(0, limit).map((r: any) => ({
      url: r.url || r.link || "",
      thumbnail_url: r.thumbnail_url || r.thumbnail || r.url || "",
      title: r.title || "",
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
