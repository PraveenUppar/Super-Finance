'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import {
  Home,
  ClipboardCheck,
  FileText,
  ClipboardList,
  ClipboardX,
  Download,
  ListChecks,
  AlertTriangle,
  Users,
  History,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Home', icon: Home },
      { href: '/eligibility', label: 'Eligibility', icon: ClipboardCheck },
      { href: '/intake', label: 'Intake', icon: ClipboardList },
      { href: '/document/gaps', label: 'Gap Report', icon: ClipboardX },
      { href: '/document', label: 'Document', icon: FileText },
      { href: '/review/risks', label: 'Risks', icon: AlertTriangle },
    ],
  },
  {
    label: 'Review',
    items: [
      { href: '/review', label: 'Review', icon: ListChecks },
      { href: '/export', label: 'Export', icon: Download },
      // Was deliberately left out of navigation for a solo demo, where it
      // was only ever watching your own role-switches get recorded. Real
      // organizations and real identity exist now (lib/auth/require-role.ts,
      // the decision-log entry superseding D8/D71) — a real reviewer asking
      // "who did what" needs to be able to find this page.
      { href: '/review/audit', label: 'Audit Log', icon: History },
    ],
  },
  {
    label: 'Project',
    items: [{ href: '/settings/members', label: 'Members', icon: Users }],
  },
];

/**
 * The persistent left navigation, built on shadcn's Sidebar primitive
 * (`components/ui/sidebar.tsx`) rather than plain divs — real collapse-to-
 * icon, a mobile drawer, and a Cmd/Ctrl+B shortcut come from that primitive
 * for free. Active state is exact-path, since Review and Risks are siblings
 * under /review, not a hierarchy.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          {/* The org switcher replaces the static logo — the org itself IS
              the project (see the decision-log entry superseding D8/D71),
              so naming which one you're in belongs at the very top. */}
          <div className="group-data-[collapsible=icon]:hidden">
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
          </div>
          <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <UserButton />
          <span className="text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Account</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarPrimitive>
  );
}
