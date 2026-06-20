import Link from "next/link";
import { MdRestaurantMenu } from "react-icons/md";
import { FaGithub } from "react-icons/fa";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <MdRestaurantMenu className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold text-gray-800">啥菜</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              拍一下就知道
            </span>
          </Link>
          <a
            className="flex max-w-fit items-center justify-center space-x-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 shadow-md transition-colors hover:bg-gray-100"
            href="https://github.com/zjdznl/whatdish"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub className="h-5 w-5" />
            <p>View on GitHub</p>
          </a>
        </div>
      </div>
    </header>
  );
}
