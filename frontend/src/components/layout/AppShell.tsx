import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PageTransition from "./PageTransition";

export default function AppShell() {
  const location = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 scroll-smooth overflow-y-auto scrollbar-thin focus:outline-none">
          <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait">
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
