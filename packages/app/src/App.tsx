// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { ActionIcon, Tooltip } from '@mantine/core';
import { MEDPLUM_VERSION } from '@medplum/core';
import type { NavbarMenu } from '@medplum/react';
import { AppShell, Loading, Logo, useMedplum } from '@medplum/react';
import { IconSettings2 } from '@tabler/icons-react';
import type { JSX } from 'react';
import { Suspense, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { AppRoutes } from './AppRoutes';
import { ICON_MAP, loadSidebarConfig, SidebarCustomizer } from './solentra/SidebarCustomizer';
import type { SidebarSection } from './solentra/SidebarCustomizer';

import './App.css';

export function App(): JSX.Element {
  const medplum = useMedplum();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sidebarConfig, setSidebarConfig] = useState<SidebarSection[]>(loadSidebarConfig);

  if (medplum.isLoading()) {
    return <Loading />;
  }

  const menus = buildMenus(sidebarConfig, () => setCustomizerOpen(true));

  return (
    <>
      <AppShell
        logo={<Logo size={24} />}
        pathname={location.pathname}
        searchParams={searchParams}
        version={MEDPLUM_VERSION}
        menus={menus}
        layoutVersion="v2"
      >
        <Suspense fallback={<Loading />}>
          <AppRoutes />
        </Suspense>
      </AppShell>

      <SidebarCustomizer
        opened={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        onSave={(config) => setSidebarConfig(config)}
      />
    </>
  );
}

function buildMenus(sections: SidebarSection[], onCustomize: () => void): NavbarMenu[] {
  const menus: NavbarMenu[] = sections.map((section) => ({
    title: section.title,
    links: section.links.map((link) => ({
      label: link.label,
      href: link.href,
      icon: ICON_MAP[link.icon],
    })),
  }));

  // Always add customize button at the bottom
  menus.push({
    title: '',
    links: [
      {
        label: 'Customize Sidebar',
        href: '#customize',
        icon: (
          <Tooltip label="Customize Sidebar" position="right">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => { e.preventDefault(); onCustomize(); }}
            >
              <IconSettings2 size={18} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
  });

  return menus;
}
