import { addDays, addMinutes, differenceInDays, format, parse } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Settings, Skill, ScheduleDay, ScheduleSummary, ScheduleBlock } from './types';

const PRIORITY_WEIGHTS = { High: 3, Medium: 2, Low: 1 };

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const roundTo5 = (num: number): number => Math.round(num / 5) * 5;

const getDatesInRange = (startDate: Date, endDate: Date): Date[] => {
  const dates = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }
  return dates;
};

export function generateSchedule(
  skills: Skill[],
  settings: Settings
): { schedule: ScheduleDay[]; summary: ScheduleSummary[] } {
  const skillMap = new Map(skills.map(s => [s.id, s.name]));
  const remainingHours = new Map(skills.map(s => [s.id, s.estHours * 60]));
  const totalMinutesPerSkill = new Map(skills.map(s => [s.id, 0]));

  const dates = settings.mode === 'Monthly'
    ? getDatesInRange(
        parse(settings.startDate, 'yyyy-MM-dd', new Date()), 
        parse(settings.endDate, 'yyyy-MM-dd', new Date())
      )
    : [new Date()];

  if (dates.length === 0 && settings.mode === 'Monthly') {
      throw new Error("Date range is invalid. Please select a valid start and end date.");
  }

  const generatedSchedule: ScheduleDay[] = [];
  let dayIndex = 0;

  for (const date of dates) {
    const blocks: ScheduleBlock[] = [];
    const windowStart = timeToMinutes(settings.startTime);
    const windowEnd = timeToMinutes(settings.endTime);
    
    let totalWindowMinutes = windowEnd - windowStart;
    if (totalWindowMinutes <= 0) throw new Error("End time must be after start time.");

    if (settings.lunch) {
      totalWindowMinutes -= settings.lunch.duration;
    }

    const allocatableTimeForDay = settings.mode === 'Daily' ? settings.dailyHours * 60 : totalWindowMinutes;
    if (allocatableTimeForDay <= 0) continue;

    const activeSkills = skills.filter(s => (remainingHours.get(s.id) ?? 0) > 0);
    if (activeSkills.length === 0) break;

    const totalWeight = activeSkills.reduce((sum, s) => sum + PRIORITY_WEIGHTS[s.priority], 0);
    if (totalWeight === 0) continue;
    
    const dailyAllocation = new Map(activeSkills.map(s => {
      const proportionalMinutes = (allocatableTimeForDay * PRIORITY_WEIGHTS[s.priority]) / totalWeight;
      return [s.id, roundTo5(Math.min(proportionalMinutes, remainingHours.get(s.id) ?? 0))];
    }));
    
    let totalAllocatedToday = Array.from(dailyAllocation.values()).reduce((a, b) => a + b, 0);

    let currentTime = windowStart;
    const { workBlockMins, breakMins } = settings;

    // Create sorted skill queue for round-robin
    const skillQueue = [...activeSkills].sort((a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]);
    // Rotate start skill each day
    if (dayIndex > 0) {
      skillQueue.push(skillQueue.shift()!);
    }

    let queueIndex = 0;

    while (currentTime < windowEnd && totalAllocatedToday > 0) {
      if (settings.lunch) {
        const lunchStart = timeToMinutes(settings.lunch.start);
        const lunchEnd = lunchStart + settings.lunch.duration;
        if (currentTime >= lunchStart && currentTime < lunchEnd) {
           if (blocks.length === 0 || blocks[blocks.length-1].type !== 'lunch') {
            blocks.push({
                id: uuidv4(),
                start: minutesToTime(lunchStart),
                end: minutesToTime(lunchEnd),
                type: 'lunch',
                minutes: settings.lunch.duration,
            });
           }
           currentTime = lunchEnd;
           continue;
        }
      }

      const skill = skillQueue[queueIndex % skillQueue.length];
      queueIndex++;
      
      const skillTimeLeft = dailyAllocation.get(skill.id);
      if (!skillTimeLeft || skillTimeLeft <= 0) {
        // If all skills for the day are done, exit loop
        if (Array.from(dailyAllocation.values()).every(t => t <= 0)) break;
        continue;
      }

      const blockDuration = Math.min(workBlockMins, skillTimeLeft);
      if (currentTime + blockDuration > windowEnd) {
        const remainingWindowTime = roundTo5(windowEnd - currentTime);
        if (remainingWindowTime > 0) {
          blocks.push({ id: uuidv4(), start: minutesToTime(currentTime), end: minutesToTime(currentTime + remainingWindowTime), type: 'work', skillId: skill.id, skillName: skill.name, minutes: remainingWindowTime, completed: false });
          dailyAllocation.set(skill.id, skillTimeLeft - remainingWindowTime);
          totalAllocatedToday -= remainingWindowTime;
          totalMinutesPerSkill.set(skill.id, (totalMinutesPerSkill.get(skill.id) || 0) + remainingWindowTime);
          remainingHours.set(skill.id, (remainingHours.get(skill.id) || 0) - remainingWindowTime);
        }
        break;
      }

      blocks.push({ id: uuidv4(), start: minutesToTime(currentTime), end: minutesToTime(currentTime + blockDuration), type: 'work', skillId: skill.id, skillName: skill.name, minutes: blockDuration, completed: false });
      currentTime += blockDuration;
      dailyAllocation.set(skill.id, skillTimeLeft - blockDuration);
      totalAllocatedToday -= blockDuration;
      totalMinutesPerSkill.set(skill.id, (totalMinutesPerSkill.get(skill.id) || 0) + blockDuration);
      remainingHours.set(skill.id, (remainingHours.get(skill.id) || 0) - blockDuration);

      if (breakMins > 0 && currentTime + breakMins <= windowEnd && totalAllocatedToday > 0) {
        blocks.push({ id: uuidv4(), start: minutesToTime(currentTime), end: minutesToTime(currentTime + breakMins), type: 'break', minutes: breakMins });
        currentTime += breakMins;
      }
    }
    
    // Add lunch block if it hasn't been added and falls within the day
    if (settings.lunch && !blocks.some(b => b.type === 'lunch')) {
        const lunchStart = timeToMinutes(settings.lunch.start);
        if (lunchStart >= windowStart && lunchStart < windowEnd) {
            blocks.push({
                id: uuidv4(),
                start: minutesToTime(lunchStart),
                end: minutesToTime(lunchStart + settings.lunch.duration),
                type: 'lunch',
                minutes: settings.lunch.duration,
            });
        }
    }
    
    blocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // Fill remaining gaps with buffer time
    let lastBlockEnd = windowStart;
    const finalBlocks: ScheduleBlock[] = [];
    blocks.forEach(block => {
        const blockStart = timeToMinutes(block.start);
        if(blockStart > lastBlockEnd) {
            const bufferMinutes = blockStart - lastBlockEnd;
             if (bufferMinutes > 0) {
                finalBlocks.push({ id: uuidv4(), start: minutesToTime(lastBlockEnd), end: minutesToTime(blockStart), type: 'buffer', minutes: bufferMinutes });
            }
        }
        finalBlocks.push(block);
        lastBlockEnd = timeToMinutes(block.end);
    });

    if (lastBlockEnd < windowEnd) {
        const bufferMinutes = windowEnd - lastBlockEnd;
        if(bufferMinutes > 0) {
            finalBlocks.push({ id: uuidv4(), start: minutesToTime(lastBlockEnd), end: minutesToTime(windowEnd), type: 'buffer', minutes: bufferMinutes });
        }
    }


    generatedSchedule.push({ date: format(date, 'yyyy-MM-dd'), blocks: finalBlocks });
    dayIndex++;
  }

  const grandTotalMinutes = Array.from(totalMinutesPerSkill.values()).reduce((a, b) => a + b, 0);

  const summary: ScheduleSummary[] = skills.map(skill => ({
    skillId: skill.id,
    skillName: skill.name,
    minutes: totalMinutesPerSkill.get(skill.id) || 0,
    percent: grandTotalMinutes > 0 ? ((totalMinutesPerSkill.get(skill.id) || 0) / grandTotalMinutes) * 100 : 0,
  }));
  
  if (generatedSchedule.length === 0) {
      throw new Error("Could not generate any schedule. Check your settings. The available time might be too short.");
  }

  return { schedule: generatedSchedule, summary };
}