import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Button,
  Drawer,
  DrawerContent,
  DrawerBody,
} from "@heroui/react";
import { Menu, LogOut, Moon, Sun } from "lucide-react";
import Sidebar from "./Sidebar";
import FloatingPhone from "./FloatingPhone";
import NotificationBell from "./NotificationBell";
import { PhoneProvider } from "@/context/PhoneContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    (user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}` || user?.email || "SA")
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <PhoneProvider>
    <NotificationProvider>
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <Drawer
        isOpen={mobileOpen}
        onOpenChange={setMobileOpen}
        placement="left"
        size="xs"
      >
        <DrawerContent>
          <DrawerBody className="p-0">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-divider bg-content1 px-4">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              className="lg:hidden"
              onPress={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button isIconOnly variant="light" onPress={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /> : <Moon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            </Button>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <button className="flex items-center gap-2 rounded-full outline-none">
                  <Avatar size="sm" name={initials} className="bg-primary text-primary-foreground" />
                </button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Account">
                <DropdownItem key="profile" isReadOnly className="opacity-100" textValue="account">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "SuperAdmin"}
                    </span>
                    <span className="text-xs text-default-500">{user?.email}</span>
                  </div>
                </DropdownItem>
                <DropdownItem
                  key="signout"
                  color="danger"
                  startContent={<LogOut className="h-4 w-4" />}
                  onPress={signOut}
                >
                  Sign out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* App-wide draggable softphone widget (full phone view off the /phone page) */}
      <FloatingPhone />
    </div>
    </NotificationProvider>
    </PhoneProvider>
  );
}
