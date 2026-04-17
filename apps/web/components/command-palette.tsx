"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { LayoutDashboard, Users2, WalletCards, Link2, Target, Boxes, Settings, Search } from "lucide-react";


export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/80 pt-[20vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div 
        className="w-full max-w-2xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command 
          className="flex h-full w-full flex-col overflow-hidden bg-transparent"
          label="Global Command Menu"
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input 
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" 
              placeholder="搜索页面或执行命令..." 
              autoFocus
            />
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">没有找到匹配的命令或页面。</Command.Empty>
            
            <Command.Group heading={<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">页面导航</div>}>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/dashboard"))}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>仪表盘</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/accounts"))}
              >
                <Users2 className="mr-2 h-4 w-4" />
                <span>账号管理</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/offers"))}
              >
                <WalletCards className="mr-2 h-4 w-4" />
                <span>Offer 管理</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/link-swap"))}
              >
                <Link2 className="mr-2 h-4 w-4" />
                <span>换链接管理</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/google-ads"))}
              >
                <Target className="mr-2 h-4 w-4" />
                <span>Google Ads</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/click-farm"))}
              >
                <Boxes className="mr-2 h-4 w-4" />
                <span>补点击任务</span>
              </Command.Item>
              <Command.Item 
                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-primary/10 aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                onSelect={() => runCommand(() => router.push("/settings"))}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>系统设置</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
