import { FaGithub } from "react-icons/fa";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <p className="text-gray-500">
              啥菜 · 基于{" "}
              <a
                href="https://github.com/Nutlope/picmenu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-900 transition-colors underline-offset-4 underline"
              >
                picMenu
              </a>
              {" "}二次开发 · 面向中国游客优化
            </p>
          </div>
          <div className="flex space-x-4">
            <a
              href="https://github.com/zjdznl/whatdish"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1"
            >
              <FaGithub className="h-5 w-5" />
              <span className="text-sm">zjdznl/whatdish</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
