import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const themes = [
  { value: 'light' as const, icon: Sun, label: '浅色' },
  { value: 'dark' as const, icon: Moon, label: '深色' },
  { value: 'system' as const, icon: Monitor, label: '跟随系统' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const current = themes.find((t) => t.value === theme) || themes[2];
  const CurrentIcon = current.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          className="rounded-full"
          aria-label="切换主题"
        >
          <CurrentIcon className="h-5 w-5 transition-all" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>当前: {current.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
