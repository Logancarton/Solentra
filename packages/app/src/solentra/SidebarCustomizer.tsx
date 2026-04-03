// Solentra Sidebar Customizer
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconClipboardList,
  IconFlask,
  IconForms,
  IconGripVertical,
  IconId,
  IconLayoutDashboard,
  IconLock,
  IconMessage,
  IconMicrophone,
  IconPill,
  IconPlus,
  IconStar,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SidebarLink {
  label: string;
  href: string;
  icon: string; // icon key
}

export interface SidebarSection {
  id: string;
  title: string;
  links: SidebarLink[];
}

// ── Available icons map ───────────────────────────────────────────────────────

export const ICON_MAP: Record<string, JSX.Element> = {
  dashboard:   <IconLayoutDashboard size={18} />,
  patients:    <IconStar size={18} />,
  schedule:    <IconCalendar size={18} />,
  inbox:       <IconClipboardList size={18} />,
  messages:    <IconMessage size={18} />,
  notes:       <IconForms size={18} />,
  labs:        <IconFlask size={18} />,
  medications: <IconPill size={18} />,
  scribe:      <IconMicrophone size={18} />,
  staff:       <IconUsers size={18} />,
  practitioner:<IconId size={18} />,
  security:    <IconLock size={18} />,
};

// ── Default sidebar config ────────────────────────────────────────────────────

export const DEFAULT_SIDEBAR: SidebarSection[] = [
  {
    id: 'solentra',
    title: 'Solentra',
    links: [
      { label: 'Dashboard',    href: '/dashboard', icon: 'dashboard' },
      { label: 'Schedule',     href: '/schedule',  icon: 'schedule' },
      { label: 'Inbox',        href: '/inbox',     icon: 'inbox' },
      { label: 'Scribe',       href: '/scribe',    icon: 'scribe' },
    ],
  },
  {
    id: 'clinical',
    title: 'Clinical',
    links: [
      { label: 'Patients',     href: '/Patient',         icon: 'patients' },
      { label: 'Notes',        href: '/Encounter',       icon: 'notes' },
      { label: 'Labs',         href: '/DiagnosticReport',icon: 'labs' },
      { label: 'Medications',  href: '/MedicationRequest',icon: 'medications' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    links: [
      { label: 'Staff',        href: '/Practitioner',    icon: 'practitioner' },
      { label: 'Messages',     href: '/Communication',   icon: 'messages' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    links: [
      { label: 'Security',     href: '/security',        icon: 'security' },
    ],
  },
];

// ── Available items library ───────────────────────────────────────────────────

const AVAILABLE_ITEMS: SidebarLink[] = [
  { label: 'Dashboard',      href: '/dashboard',          icon: 'dashboard' },
  { label: 'Schedule',       href: '/schedule',           icon: 'schedule' },
  { label: 'Inbox',          href: '/inbox',              icon: 'inbox' },
  { label: 'Scribe',         href: '/scribe',             icon: 'scribe' },
  { label: 'Patients',       href: '/Patient',            icon: 'patients' },
  { label: 'Notes',          href: '/Encounter',          icon: 'notes' },
  { label: 'Labs',           href: '/DiagnosticReport',   icon: 'labs' },
  { label: 'Medications',    href: '/MedicationRequest',  icon: 'medications' },
  { label: 'Messages',       href: '/Communication',      icon: 'messages' },
  { label: 'Staff',          href: '/Practitioner',       icon: 'practitioner' },
  { label: 'Questionnaires', href: '/Questionnaire',      icon: 'notes' },
  { label: 'Security',       href: '/security',           icon: 'security' },
];

const STORAGE_KEY = 'solentra-sidebar';

export function loadSidebarConfig(): SidebarSection[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SIDEBAR;
  } catch {
    return DEFAULT_SIDEBAR;
  }
}

function saveSidebarConfig(config: SidebarSection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ── Customizer Drawer ─────────────────────────────────────────────────────────

interface SidebarCustomizerProps {
  opened: boolean;
  onClose: () => void;
  onSave: (config: SidebarSection[]) => void;
}

export function SidebarCustomizer({ opened, onClose, onSave }: SidebarCustomizerProps): JSX.Element {
  const [sections, setSections] = useState<SidebarSection[]>(loadSidebarConfig);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  const save = (): void => {
    saveSidebarConfig(sections);
    onSave(sections);
    onClose();
  };

  const reset = (): void => {
    setSections(DEFAULT_SIDEBAR);
  };

  // Section operations
  const moveSection = (i: number, dir: -1 | 1): void => {
    const next = [...sections];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setSections(next);
  };

  const removeSection = (i: number): void => {
    setSections(sections.filter((_, idx) => idx !== i));
  };

  const addSection = (): void => {
    if (!newSectionTitle.trim()) return;
    setSections([...sections, { id: Date.now().toString(), title: newSectionTitle.trim(), links: [] }]);
    setNewSectionTitle('');
  };

  const renameSection = (i: number, title: string): void => {
    setSections(sections.map((s, idx) => idx === i ? { ...s, title } : s));
  };

  // Link operations
  const removeLink = (sectionIdx: number, linkIdx: number): void => {
    setSections(sections.map((s, i) =>
      i === sectionIdx ? { ...s, links: s.links.filter((_, j) => j !== linkIdx) } : s
    ));
  };

  const moveLink = (sectionIdx: number, linkIdx: number, dir: -1 | 1): void => {
    const next = sections.map((s, i) => {
      if (i !== sectionIdx) return s;
      const links = [...s.links];
      const target = linkIdx + dir;
      if (target < 0 || target >= links.length) return s;
      [links[linkIdx], links[target]] = [links[target], links[linkIdx]];
      return { ...s, links };
    });
    setSections(next);
  };

  const addLink = (sectionIdx: number, link: SidebarLink): void => {
    setSections(sections.map((s, i) =>
      i === sectionIdx ? { ...s, links: [...s.links, link] } : s
    ));
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="sm">Customize Sidebar</Text>}
      position="left"
      size={360}
      offset={8}
      radius="md"
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Reorder sections and links, add or remove items, or rename sections.
          Changes save when you click Save.
        </Text>

        {sections.map((section, sIdx) => (
          <Box key={section.id} style={{ border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden' }}>
            {/* Section header */}
            <Box p="xs" style={{ background: '#f8f9fa' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <IconGripVertical size={14} color="#adb5bd" />
                  <TextInput
                    size="xs"
                    value={section.title}
                    onChange={(e) => renameSection(sIdx, e.currentTarget.value)}
                    variant="unstyled"
                    fw={600}
                    style={{ flex: 1 }}
                  />
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Move up">
                    <ActionIcon size="xs" variant="subtle" onClick={() => moveSection(sIdx, -1)}>
                      <IconChevronUp size={12} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Move down">
                    <ActionIcon size="xs" variant="subtle" onClick={() => moveSection(sIdx, 1)}>
                      <IconChevronDown size={12} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove section">
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeSection(sIdx)}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Box>

            {/* Links */}
            <Stack gap={0} px="xs" py={4}>
              {section.links.map((link, lIdx) => (
                <Group key={link.href} justify="space-between" py={4} wrap="nowrap">
                  <Group gap={6} wrap="nowrap">
                    <IconGripVertical size={12} color="#ced4da" />
                    <Box style={{ color: '#868e96' }}>{ICON_MAP[link.icon]}</Box>
                    <Text size="xs">{link.label}</Text>
                  </Group>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon size="xs" variant="subtle" onClick={() => moveLink(sIdx, lIdx, -1)}>
                      <IconChevronUp size={11} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" onClick={() => moveLink(sIdx, lIdx, 1)}>
                      <IconChevronDown size={11} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeLink(sIdx, lIdx)}>
                      <IconTrash size={11} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}

              {/* Add link dropdown */}
              <Box pt={4} pb={2}>
                <Text size="xs" c="dimmed" mb={4}>Add item:</Text>
                <Group gap={4} wrap="wrap">
                  {AVAILABLE_ITEMS
                    .filter((item) => !section.links.some((l) => l.href === item.href))
                    .map((item) => (
                      <Badge
                        key={item.href}
                        size="xs"
                        variant="outline"
                        style={{ cursor: 'pointer' }}
                        leftSection={<IconPlus size={9} />}
                        onClick={() => addLink(sIdx, item)}
                      >
                        {item.label}
                      </Badge>
                    ))}
                </Group>
              </Box>
            </Stack>
          </Box>
        ))}

        {/* Add new section */}
        <Divider label="Add Section" labelPosition="center" />
        <Group gap="xs">
          <TextInput
            flex={1}
            size="xs"
            placeholder="Section name..."
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSection()}
          />
          <Button size="xs" onClick={addSection} leftSection={<IconPlus size={12} />}>Add</Button>
        </Group>

        {/* Actions */}
        <Divider />
        <Group justify="space-between">
          <Button size="xs" variant="subtle" color="red" onClick={reset}>Reset to Default</Button>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={onClose}>Cancel</Button>
            <Button size="xs" onClick={save}>Save</Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
