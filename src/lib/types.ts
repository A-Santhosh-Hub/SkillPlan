export interface Skill {
  id: string;
  name: string;
  priority: 'High' | 'Medium' | 'Low';
  estHours: number;
}

export interface Lunch {
  start: string;
  duration: number; // in minutes
}

export interface Settings {
  mode: 'Daily' | 'Monthly';
  dailyHours: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  workBlockMins: number;
  breakMins: number;
  lunch: Lunch | null;
}

export interface ScheduleBlock {
  start: string;
  end: string;
  type: 'work' | 'break' | 'lunch' | 'buffer';
  skillId?: string;
  skillName?: string;
  minutes: number;
}

export interface ScheduleDay {
  date: string;
  blocks: ScheduleBlock[];
}

export interface ScheduleSummary {
  skillId: string;
  skillName: string;
  minutes: number;
  percent: number;
}

export interface AppState {
  skills: Skill[];
  settings: Settings;
}
