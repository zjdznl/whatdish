import { MenuItem } from "@/app/page";
import Image from "next/image";

interface MenuGridProps {
  items: MenuItem[];
}

function PalateScore({ score }: { score: number }) {
  const stars = "⭐".repeat(Math.min(5, Math.max(1, score)));
  const labels: Record<number, string> = {
    1: "需适应",
    2: "有点挑",
    3: "可接受",
    4: "挺对胃",
    5: "中国胃",
  };
  return (
    <span className="text-xs" title={`中国胃适配: ${score}/5`}>
      {stars} {labels[score] || ""}
    </span>
  );
}

export function MenuGrid({ items }: MenuGridProps) {
  return (
    <div className="space-y-8">
      {/* Group by category */}
      {groupByCategory(items).map((group) => (
        <div key={group.name}>
          {group.name && (
            <h3 className="text-2xl font-bold text-left mb-4 text-gray-700 border-b pb-2">
              {group.name}
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {group.items.map((item, idx) => (
              <div
                key={`${item.name_orig}-${idx}`}
                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                <div className="relative h-48 bg-gray-100">
                  {item.images.length > 0 ? (
                    <Image
                      src={item.images[0].thumbnail_url || item.images[0].url}
                      alt={item.name_zh}
                      fill
                      className="object-cover"
                      unoptimized // 外部图片可能不是 next/image 优化的
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <span className="text-sm">暂无图片</span>
                    </div>
                  )}
                  {/* Image source badge */}
                  {item.image_source && item.image_source !== "none" && (
                    <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.image_source === "baidu" ? "百度" : item.image_source === "bing" ? "必应" : item.image_source}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 text-left">
                  {/* Name */}
                  <h4 className="text-lg font-bold text-gray-800">{item.name_zh}</h4>
                  <p className="text-sm text-gray-400 mb-2">{item.name_orig}</p>

                  {/* Price & Score */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold text-blue-600">
                      {item.price}
                    </span>
                    <PalateScore score={item.chinese_palate_score} />
                  </div>

                  {/* Chinese palate note */}
                  {item.chinese_palate_note && (
                    <div className="mb-2 px-2 py-1 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-700">
                      🥢 {item.chinese_palate_note}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {item.description_zh}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Flavor profile */}
                  {item.flavor_profile?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.flavor_profile.map((flavor) => (
                        <span
                          key={flavor}
                          className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"
                        >
                          {flavor}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* More images link */}
                  {item.image_search_url && (
                    <a
                      href={item.image_search_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-2 inline-block"
                    >
                      🔍 查看更多图片
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 按 category 分组 */
function groupByCategory(items: MenuItem[]): { name: string; items: MenuItem[] }[] {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = item.category_name || "";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
}
