import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

export default function Header() {
  return (
    // <header data-tauri-drag-region className="h-8 bg-[#1e1e1e] text-white flex items-center px-3 select-none">
    <header className="h-8 bg-[#1e1e1e] text-white flex items-center px-3 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <button
            className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] hover:brightness-110"
            onClick={() => win.close()}
            aria-label="Close"
          />
          <button
            className="w-2.5 h-2.5 rounded-full bg-[#febc2e] hover:brightness-110"
            onClick={() => win.minimize()}
            aria-label="Minimize"
          />
          <button
            className="w-2.5 h-2.5 rounded-full bg-[#28c840] hover:brightness-110"
            onClick={() => win.toggleMaximize()}
            aria-label="Maximize"
          />
        </div>

        {/* <nav className="flex items-center gap-1">
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">File</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Edit</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Selection</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">View</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Go</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Run</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Terminal</a>
          <a href="#" className="px-2 py-1 text-[11px] text-white hover:bg-[#2a2a2a] hover:text-white visited:text-white rounded-sm transition-colors">Help</a>
        </nav> */}
      </div>
    </header>
  );
}