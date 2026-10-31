import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface SidebarItem {
  icon: string;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
  { icon: '❓', label: 'Questions', path: '/admin/questions' },
  { icon: '📝', label: 'Tests', path: '/admin/tests' },
  { icon: '👥', label: 'Users', path: '/admin/users', superAdminOnly: true },
  { icon: '🎓', label: 'Exams', path: '/admin/exams' },
  { icon: '📚', label: 'Subjects', path: '/admin/subjects' },
  { icon: '📥', label: 'Import', path: '/admin/import' },
  { icon: '📋', label: 'Activity', path: '/admin/activity' },
];

/**
 * Admin-specific layout with sidebar navigation.
 * - Desktop: fixed 240px left sidebar
 * - Tablet: collapsible sidebar
 * - Mobile: drawer overlay
 */
export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userRole = (user as { role?: string } | null)?.role;
  const userName = (user as { fullName?: string } | null)?.fullName || 'Admin';

  const filteredItems = sidebarItems.filter(
    (item) => !item.superAdminOnly || userRole === 'super_admin',
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get current page title from sidebar items
  const currentItem = sidebarItems.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = currentItem?.label || 'Admin';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 z-50
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
        </div>

        {/* Navigation items */}
        <nav className="p-4 space-y-1">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb / page title */}
            <span className="text-sm text-gray-500">Admin</span>
            <span className="text-sm text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-900">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
