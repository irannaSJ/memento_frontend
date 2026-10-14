import type { NavigationItemId } from '../../components/navigation/FloatingNavigation'

export type FeatureId = 'projects' | 'tasks' | 'todo' | 'activity'

export interface FeatureRecord {
  id: string
  name: string
  description: string
  status?: string
}

export interface FeatureDefinition {
  id: FeatureId
  doctype:string
  navItem: NavigationItemId
  number: string
  eyebrow: string
  title: string
  description: string
  icon: string
  tone: 'violet' | 'mint' | 'amber' | 'blue'
  layout: 'visual-left' | 'visual-right'
  visualLabel: string
  metricValue: string
  metricLabel: string
  capabilities: string[]
  viewLabel: string
  createLabel: string
  createDialogTitle: string
  itemPlural: string
  sampleItems: FeatureRecord[]
}

export const featureCards: FeatureDefinition[] = [
  {
    id: 'projects',
    doctype :'My Projects',
    navItem: 'projects',
    number: '01',
    eyebrow: 'PLAN WITH CLARITY',
    title: 'Turn big ideas into clear progress.',
    description:
      'Bring your work together in one organized space. Track project progress, understand priorities, and see what needs attention next.',
    icon: 'ri-folder-3-line',
    tone: 'violet',
    layout: 'visual-left',
    visualLabel: 'PROJECT OVERVIEW',
    metricValue: '06',
    metricLabel: 'ACTIVE PROJECTS',
    capabilities: [
      'Project progress',
      'Milestones',
      'Deadlines',
    ],
    viewLabel: 'View projects',
    createLabel: 'Create project',
    createDialogTitle: 'Create a project',
    itemPlural: 'projects',
    sampleItems: [
      {
        id: 'project-001',
        name: 'Website refresh',
        description: '4 of 6 milestones completed',
        status: 'In progress',
      },
      {
        id: 'project-002',
        name: 'WorkPulse launch',
        description: 'Planning and implementation',
        status: 'Planning',
      },
      {
        id: 'project-003',
        name: 'Personal portfolio',
        description: 'Final design review',
        status: 'Review',
      },
    ],
  },
  {
    id: 'tasks',
    doctype: 'Tasks',
    navItem: 'tasks',
    number: '02',
    eyebrow: 'MAKE PROGRESS VISIBLE',
    title: 'Small steps. Meaningful results.',
    description:
      'Turn projects into manageable tasks. Keep priorities visible, organize work by status, and make the next action easy to find.',
    icon: 'ri-task-line',
    tone: 'mint',
    layout: 'visual-right',
    visualLabel: 'TASK BOARD',
    metricValue: '18',
    metricLabel: 'OPEN TASKS',
    capabilities: [
      'Task priorities',
      'Status tracking',
      'Due dates',
    ],
    viewLabel: 'View tasks',
    createLabel: 'Create task',
    createDialogTitle: 'Create a task',
    itemPlural: 'tasks',
    sampleItems: [
      {
        id: 'task-001',
        name: 'Polish dashboard layout',
        description: 'Improve spacing and visual hierarchy',
        status: 'In progress',
      },
      {
        id: 'task-002',
        name: 'Review API changes',
        description: 'Check the integration requirements',
        status: 'Due today',
      },
      {
        id: 'task-003',
        name: 'Prepare sprint notes',
        description: 'Summarize the current work',
        status: 'To do',
      },
    ],
  },
  {
    id: 'todo',
    doctype:'Daily ToDo',
    navItem: 'todo',
    number: '03',
    eyebrow: 'FOCUS ON TODAY',
    title: 'A clearer plan for your day.',
    description:
      'Keep daily intentions simple. Capture the tasks that matter today, check them off as you finish, and stay focused without unnecessary clutter.',
    icon: 'ri-calendar-check-line',
    tone: 'amber',
    layout: 'visual-left',
    visualLabel: 'TODAY AT A GLANCE',
    metricValue: '03',
    metricLabel: 'DAILY PRIORITIES',
    capabilities: [
      'Daily checklist',
      'Quick capture',
      'Completion tracking',
    ],
    viewLabel: 'View to-do list',
    createLabel: 'Create to-do',
    createDialogTitle: 'Create a daily to-do',
    itemPlural: 'daily to-do items',
    sampleItems: [
      {
        id: 'todo-001',
        name: 'Plan top priorities',
        description: 'Choose the three most important tasks',
        status: 'Today',
      },
      {
        id: 'todo-002',
        name: 'Review project progress',
        description: 'Check what moved forward',
        status: 'Queued',
      },
      {
        id: 'todo-003',
        name: 'Finish daily review',
        description: 'Prepare for the next day',
        status: 'Completed',
      },
    ],
  },
  {
    id: 'activity',
    doctype: 'Task Log',
    navItem: 'activity',
    number: '04',
    eyebrow: 'KEEP THE CONTEXT',
    title: 'Know what changed and when.',
    description:
      'Bring recent work into view. Review changes, follow progress, and quickly understand the actions that have shaped your workspace.',
    icon: 'ri-history-line',
    tone: 'blue',
    layout: 'visual-right',
    visualLabel: 'RECENT ACTIVITY',
    metricValue: '12',
    metricLabel: 'RECENT UPDATES',
    capabilities: [
      'Recent changes',
      'Activity history',
      'Audit trail foundation',
    ],
    viewLabel: 'View activity',
    createLabel: 'Create entry',
    createDialogTitle: 'Create an activity entry',
    itemPlural: 'activity entries',
    sampleItems: [
      {
        id: 'activity-001',
        name: 'Task moved to Done',
        description: 'Dashboard layout task updated',
        status: '2 min ago',
      },
      {
        id: 'activity-002',
        name: 'Project created',
        description: 'WorkPulse launch added',
        status: '18 min ago',
      },
      {
        id: 'activity-003',
        name: 'Deadline updated',
        description: 'Website refresh milestone changed',
        status: '1 hour ago',
      },
    ],
  },
]