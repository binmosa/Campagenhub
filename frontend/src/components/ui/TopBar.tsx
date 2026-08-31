import React from 'react';
import { AppLayout, Navbar } from '@heroui-pro/react';
import { SearchField, Button, Tooltip } from '@heroui/react';
import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * TopBar — the sticky navbar slotted into <AppShell navbar={...}/>.
 *
 * Per design-taste rules: header carries ONLY contextual controls.
 * Brand + user identity live in the sidebar; the navbar holds:
 *   - mobile menu toggle (HeroUI AppLayout.MenuToggle)
 *   - global SearchField (purpose-built; has built-in icon + clear button)
 *   - notifications bell (icon-only, wrapped in Tooltip for a11y)
 *   - light/dark mode toggle (icon-only, wrapped in Tooltip)
 */
interface TopBarProps {
  onNotificationsClick?: () => void;
  searchPlaceholder?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onNotificationsClick,
  searchPlaceholder = 'Search campaigns, creators, brands…',
}) => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <Navbar>
      <AppLayout.MenuToggle tooltip="Toggle navigation" />

      <div className="flex-1 max-w-xl">
        <SearchField aria-label="Search">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Toggle theme"
              onPress={toggleDarkMode}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            {darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          </Tooltip.Content>
        </Tooltip>

        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Notifications"
              onPress={onNotificationsClick}
            >
              <Bell size={18} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Notifications</Tooltip.Content>
        </Tooltip>
      </div>
    </Navbar>
  );
};

export default TopBar;
