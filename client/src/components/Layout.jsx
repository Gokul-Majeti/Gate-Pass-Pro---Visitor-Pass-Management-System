import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarPlus,
  ClipboardList,
  FileSpreadsheet,
  LogOut,
  Menu,
  QrCode,
  ScanLine,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_BY_ROLE = {
  visitor: [
    { to: '/visitor', label: 'My Visits', icon: ClipboardList, end: true },
    { to: '/visitor/pre-register', label: 'Pre-Register Visit', icon: CalendarPlus },
    { to: '/passes', label: 'Digital Passes', icon: QrCode },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  host: [
    { to: '/host', label: 'Host Dashboard', icon: UserCheck, end: true },
    { to: '/host/invite', label: 'Invite Visitor', icon: UserPlus },
    { to: '/passes', label: 'Visitor Passes', icon: QrCode },
    { to: '/checklogs', label: 'Arrival Logs', icon: Activity },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  security: [
    { to: '/security', label: 'Gate QR Scanner', icon: ScanLine, end: true },
    { to: '/security/walk-in', label: 'Walk-In Desk', icon: UserPlus },
    { to: '/passes', label: 'Issue & Manage Passes', icon: QrCode },
    { to: '/checklogs', label: 'Check-In / Out Logs', icon: Activity },
    { to: '/visitors', label: 'Visitor Directory', icon: Users },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ],
  admin: [
    { to: '/admin', label: 'Analytics Dashboard', icon: BarChart3, end: true },
    { to: '/admin/reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { to: '/security', label: 'Gate QR Scanner', icon: ScanLine, end: true },
    { to: '/security/walk-in', label: 'Walk-In Desk', icon: UserPlus },
    { to: '/passes', label: 'All Passes & Visits', icon: QrCode },
    { to: '/visitors', label: 'Visitors & Watchlist', icon: Users },
    { to: '/admin/staff', label: 'Staff Management', icon: UserCheck },
    { to: '/admin/organization', label: 'Locations & Settings', icon: Building2 },
    { to: '/notifications', label: 'Notification Logs', icon: Bell },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
  ],
};

export function Layout({ children }) {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = NAV_BY_ROLE[user?.role] || [];
  const primaryColor = organization?.settings?.primaryColor || '#2563eb';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-68 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-xl text-white flex items-center justify-center shadow-xs"
              style={{ backgroundColor: primaryColor }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm leading-tight">GatePass Pro</div>
              <div className="text-[11px] text-slate-500 truncate max-w-[155px]">
                {organization?.name || 'MERN Visitor System'}
              </div>
            </div>
          </Link>
          <button
            type="button"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
          {!user?.isVerified && (
            <Link
              to="/verify-otp"
              className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 hover:bg-amber-100"
            >
              <BadgeCheck className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Verify account with OTP</span>
            </Link>
          )}

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {user?.name?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 capitalize truncate">
                {user?.role} • {user?.locationName}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{organization?.name}</span>
              <span>•</span>
              <span>{organization?.locations?.length || 1} active location(s)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
              Role: {user?.role}
            </span>
            {user?.isVerified && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
