"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { addDays, format, parse } from 'date-fns'
import { v4 as uuidv4 } from 'uuid';
import {
  Briefcase, Calendar, CheckSquare, Clock, Coffee, Copy, Download, Moon, Plus, RotateCcw, Save, Sun, Trash2, Utensils
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useLocalStorage } from "@/lib/hooks/use-local-storage"
import { generateSchedule } from "@/lib/scheduler"
import type { LiveAppState, ScheduleDay, ScheduleSummary, Settings, Skill, ScheduleBlock } from "@/lib/types"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required."),
  priority: z.enum(["High", "Medium", "Low"]),
  estHours: z.coerce.number().min(0.1, "Hours must be positive."),
});

const settingsSchema = z.object({
  mode: z.enum(["Daily", "Monthly"]),
  dailyHours: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  workBlockMins: z.coerce.number().min(25, "Work block must be at least 25 minutes."),
  breakMins: z.coerce.number().min(0),
  lunchEnabled: z.boolean(),
  lunchStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)").optional(),
  lunchDuration: z.coerce.number().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.mode === 'Daily' && (data.dailyHours === undefined || data.dailyHours <= 0)) {
    ctx.addIssue({ code: "custom", path: ["dailyHours"], message: "Daily hours are required for Daily mode." });
  }
  if (data.mode === 'Monthly') {
    if (!data.startDate || !data.endDate) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Start and end dates are required for Monthly mode." });
    } else if (new Date(data.startDate) > new Date(data.endDate)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after start date." });
    }
  }
  if (data.lunchEnabled) {
    if (!data.lunchStart) ctx.addIssue({ code: "custom", path: ["lunchStart"], message: "Lunch start time is required." });
    if (!data.lunchDuration) ctx.addIssue({ code: "custom", path: ["lunchDuration"], message: "Lunch duration is required." });
  }
});


const today = new Date();
const defaultAppState: LiveAppState = {
  skills: [
    { id: uuidv4(), name: "Python", priority: "High", estHours: 40 },
    { id: uuidv4(), name: "Java", priority: "High", estHours: 50 },
    { id: uuidv4(), name: "C", priority: "Medium", estHours: 30 },
    { id: uuidv4(), name: "C++", priority: "Medium", estHours: 35 },
    { id: uuidv4(), name: "SQL", priority: "High", estHours: 20 },
    { id: uuidv4(), name: "Aptitude", priority: "Medium", estHours: 25 },
    { id: uuidv4(), name: "3D Modeling", priority: "Low", estHours: 60 },
    { id: uuidv4(), name: "React", priority: "High", estHours: 45 },
    { id: uuidv4(), name: "Node.js", priority: "High", estHours: 40 },
    { id: uuidv4(), name: "Data Structures", priority: "High", estHours: 50 },
  ],
  settings: {
    mode: "Daily",
    dailyHours: 6,
    startDate: format(today, 'yyyy-MM-dd'),
    endDate: format(addDays(today, 29), 'yyyy-MM-dd'),
    startTime: "09:00",
    endTime: "17:00",
    workBlockMins: 50,
    breakMins: 10,
    lunch: { start: "13:00", duration: 60 }
  },
  schedule: null,
  summary: null,
  live: {
    time: format(new Date(), 'HH:mm:ss'),
    date: format(new Date(), 'yyyy-MM-dd'),
  }
};


export default function SkillPlanPage() {
  const { toast } = useToast()
  const [appState, setAppState] = useLocalStorage<LiveAppState>('skillScheduler:v2:live', defaultAppState);

  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setAppState(prev => ({
        ...prev,
        live: {
          time: format(now, 'HH:mm:ss'),
          date: format(now, 'yyyy-MM-dd'),
        }
      }))
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skillForm = useForm({
    resolver: zodResolver(skillSchema),
    defaultValues: { name: "", priority: "Medium" as const, estHours: 10 },
  });

  const settingsForm = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      ...appState.settings,
      lunchEnabled: !!appState.settings.lunch,
      lunchStart: appState.settings.lunch?.start || "13:00",
      lunchDuration: appState.settings.lunch?.duration || 60,
    },
  });

  const watchMode = settingsForm.watch('mode');
  const watchLunchEnabled = settingsForm.watch('lunchEnabled');
  
  React.useEffect(() => {
    settingsForm.reset({
      ...appState.settings,
      lunchEnabled: !!appState.settings.lunch,
      lunchStart: appState.settings.lunch?.start || "13:00",
      lunchDuration: appState.settings.lunch?.duration || 60,
    })
  }, [appState.settings, settingsForm]);

  const addSkill = (values: z.infer<typeof skillSchema>) => {
    const newSkill: Skill = { ...values, id: uuidv4() };
    if (appState.skills.some(s => s.name.toLowerCase() === newSkill.name.toLowerCase())) {
        toast({ variant: "destructive", title: "Duplicate Skill", description: "A skill with this name already exists." });
        return;
    }
    setAppState({ ...appState, skills: [...appState.skills, newSkill] });
    skillForm.reset();
  };

  const removeSkill = (id: string) => {
    setAppState({ ...appState, skills: appState.skills.filter(s => s.id !== id) });
  };
  
  const handleGenerate = (values: z.infer<typeof settingsSchema>) => {
    if (appState.skills.length === 0) {
      toast({ variant: "destructive", title: "No Skills", description: "Please add at least one skill to generate a schedule." });
      return;
    }

    const currentSettings: Settings = {
      ...values,
      lunch: values.lunchEnabled ? { start: values.lunchStart!, duration: values.lunchDuration! } : null,
    };
    
    try {
      const { schedule: newSchedule, summary: newSummary } = generateSchedule(appState.skills, currentSettings);
      setAppState({ ...appState, settings: currentSettings, schedule: newSchedule, summary: newSummary });
      toast({ title: "Schedule Generated", description: "Your new learning plan is ready!" });
    } catch (error) {
        if (error instanceof Error) {
            toast({ variant: "destructive", title: "Generation Failed", description: error.message });
        }
    }
  };

  const handleReset = () => {
    setAppState(defaultAppState);
    skillForm.reset();
    settingsForm.reset({
        ...defaultAppState.settings,
        lunchEnabled: !!defaultAppState.settings.lunch,
        lunchStart: defaultAppState.settings.lunch?.start || "13:00",
        lunchDuration: defaultAppState.settings.lunch?.duration || 60,
    });
    toast({ title: "Reset Successful", description: "All settings and skills have been reset to default." });
  };

  const handleCopyJson = () => {
    if (!appState.schedule) {
      toast({ variant: "destructive", title: "No Schedule", description: "Generate a schedule first before copying." });
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(appState, null, 2));
    toast({ title: "Copied to Clipboard", description: "Schedule JSON has been copied." });
  };
  
  const handlePrint = () => {
    if (!appState.schedule) {
        toast({ variant: "destructive", title: "No Schedule", description: "Generate a schedule first before printing." });
        return;
    }
    window.print();
  }

  const toggleTaskCompletion = (dayDate: string, blockId: string) => {
    if (!appState.schedule) return;
    
    const newSchedule = appState.schedule.map(day => {
      if (day.date === dayDate) {
        return {
          ...day,
          blocks: day.blocks.map(block => {
            if (block.id === blockId && block.type === 'work') {
              return { ...block, completed: !block.completed };
            }
            return block;
          })
        };
      }
      return day;
    });

    setAppState({ ...appState, schedule: newSchedule });
  };
  
  const getProgress = () => {
    if (!appState.live) return 0;
    const dayStart = parse(appState.settings.startTime, 'HH:mm', new Date());
    const dayEnd = parse(appState.settings.endTime, 'HH:mm', new Date());
    const now = parse(appState.live.time, 'HH:mm:ss', new Date());

    const totalSeconds = dayEnd.getTime() - dayStart.getTime();
    let elapsedSeconds = now.getTime() - dayStart.getTime();
    
    if (totalSeconds <= 0) return 0;
    if (elapsedSeconds < 0) return 0;
    if (elapsedSeconds > totalSeconds) return 100;

    return (elapsedSeconds / totalSeconds) * 100;
  }

  const getIconForBlock = (type: ScheduleBlock['type']) => {
    switch(type) {
      case 'work': return <Briefcase className="w-4 h-4 text-primary" />;
      case 'break': return <Coffee className="w-4 h-4 text-secondary-foreground/80" />;
      case 'lunch': return <Utensils className="w-4 h-4 text-accent" />;
      case 'buffer': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  }

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const defaultTab = appState.schedule?.find(d => d.date === todayDateStr)?.date || appState.schedule?.[0]?.date;
  
  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-primary" />
            <span className="font-bold text-lg">SkillPlan</span>
          </div>
           <div className="flex-1 justify-center items-center hidden md:flex">
             {appState.live && (
                <div className="font-mono text-lg font-semibold bg-muted px-4 py-1 rounded-lg">
                  {appState.live.time}
                </div>
              )}
           </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container py-8 print-container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 flex flex-col gap-8 no-print">
            
            <Card>
              <CardHeader>
                <CardTitle>1. Add Your Skills</CardTitle>
                <CardDescription>List the skills you want to learn, their priority, and estimated hours to master.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...skillForm}>
                  <form onSubmit={skillForm.handleSubmit(addSkill)} className="space-y-4">
                    <FormField name="name" control={skillForm.control} render={({ field }) => (
                      <FormItem><FormLabel>Skill Name</FormLabel><FormControl><Input placeholder="e.g., Python" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField name="priority" control={skillForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger></FormControl><SelectContent><SelectItem value="High">High</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <FormField name="estHours" control={skillForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Est. Hours</FormLabel><FormControl><Input type="number" step="0.5" placeholder="e.g., 20" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Skill</Button>
                  </form>
                </Form>
                <div className="mt-6 space-y-2">
                  <h4 className="font-medium">Your Skills</h4>
                  {appState.skills.length === 0 ? (<p className="text-sm text-muted-foreground">No skills added yet.</p>) : (
                    <ul className="space-y-2">
                      {appState.skills.map(skill => (
                        <li key={skill.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                          <div className="flex flex-col">
                            <span className="font-semibold">{skill.name}</span>
                            <span className="text-sm text-muted-foreground">{skill.priority} Priority &middot; {skill.estHours} hrs</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeSkill(skill.id)}><Trash2 className="h-4 w-4" /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Configure Your Schedule</CardTitle>
                <CardDescription>Set your availability and how you prefer to work.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...settingsForm}>
                  <form onSubmit={settingsForm.handleSubmit(handleGenerate)} className="space-y-6">
                    <FormField name="mode" control={settingsForm.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Scope</FormLabel>
                        <FormControl>
                          <Tabs defaultValue={field.value} onValueChange={field.onChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="Daily">Daily</TabsTrigger>
                              <TabsTrigger value="Monthly">Monthly</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    {watchMode === 'Daily' && (
                       <FormField name="dailyHours" control={settingsForm.control} render={({ field }) => (
                        <FormItem><FormLabel>Total Study Hours Per Day</FormLabel><FormControl><Input type="number" placeholder="e.g., 4" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    )}

                    {watchMode === 'Monthly' && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField name="startDate" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField name="endDate" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    )}
                    
                    <div>
                      <FormLabel>Working Window</FormLabel>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <FormField name="startTime" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs text-muted-foreground">From</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField name="endTime" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs text-muted-foreground">To</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>
                    
                    <div>
                      <FormLabel>Break Pattern</FormLabel>
                       <div className="grid grid-cols-2 gap-4 mt-2">
                        <FormField name="workBlockMins" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs text-muted-foreground">Work (mins)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField name="breakMins" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs text-muted-foreground">Break (mins)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <FormField name="lunchEnabled" control={settingsForm.control} render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Include Lunch Break?</FormLabel>
                        </div>
                        <FormControl>
                           <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={field.value} onChange={field.onChange} className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/80 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </FormControl>
                      </FormItem>
                    )} />
                    
                    {watchLunchEnabled && (
                       <div className="grid grid-cols-2 gap-4">
                        <FormField name="lunchStart" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel>Lunch Start</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField name="lunchDuration" control={settingsForm.control} render={({ field }) => (
                          <FormItem><FormLabel>Duration (mins)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    )}

                    <Button type="submit" size="lg" className="w-full sticky bottom-8">Generate Schedule</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 print-p-0">
             <Card className="print-card">
              <CardHeader className="no-print">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>3. Your Generated Schedule</CardTitle>
                        <CardDescription>Here is your optimized learning plan. You can now save, copy, or print it.</CardDescription>
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <Button onClick={handleReset} variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Reset</Button>
                        <Button onClick={handleCopyJson} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copy JSON</Button>
                        <Button onClick={handlePrint} variant="outline"><Download className="mr-2 h-4 w-4" /> Download as PDF</Button>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="print-p-0">
                {!appState.schedule ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>Your schedule will appear here once generated.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {appState.summary && (
                       <div className="print-card p-6">
                        <h3 className="font-bold text-lg mb-2">Schedule Summary</h3>
                         <Table>
                          <TableHeader>
                            <TableRow><TableHead>Skill</TableHead><TableHead className="text-right">Total Time</TableHead><TableHead className="text-right">Allocation</TableHead></TableRow>
                          </TableHeader>
                          <TableBody>
                            {appState.summary.map(item => (
                              <TableRow key={item.skillId}>
                                <TableCell>{item.skillName}</TableCell>
                                <TableCell className="text-right">{`${Math.floor(item.minutes / 60)}h ${item.minutes % 60}m`}</TableCell>
                                <TableCell className="text-right">{item.percent.toFixed(1)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    
                    <div className="print-card p-6 pt-0">
                       <h3 className="font-bold text-lg mb-2 pt-6">Daily Timetable</h3>
                       <Tabs defaultValue={defaultTab} className="w-full">
                        <TabsList className="no-print">
                          {appState.schedule.map(day => <TabsTrigger key={day.date} value={day.date}>{format(parse(day.date, 'yyyy-MM-dd', new Date()), 'EEE, MMM d')}</TabsTrigger>)}
                        </TabsList>
                        {appState.schedule.map(day => {
                          const isToday = day.date === appState.live?.date;
                          const progress = isToday ? getProgress() : (day.date < (appState.live?.date || '') ? 100 : 0);

                          return (
                          <TabsContent key={day.date} value={day.date} className="print-bg-transparent">
                             <div className="print-card mt-4">
                                <h4 className="font-semibold text-center mb-4 hidden print:block">{format(parse(day.date, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}</h4>
                                {isToday && <div className="w-full h-1 my-2 bg-muted rounded-full no-print">
                                  <div className="h-full bg-primary rounded-full" style={{width: `${progress}%`}}></div>
                                </div>}
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[120px]">Time</TableHead>
                                            <TableHead>Activity</TableHead>
                                            <TableHead className="text-right w-[120px]">Duration</TableHead>
                                            <TableHead className="w-[80px] no-print">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {day.blocks.map((block) => {
                                            const isPast = isToday && appState.live && block.end <= appState.live.time;
                                            return (
                                            <TableRow 
                                              key={block.id} 
                                              className={cn(
                                                block.completed && 'bg-green-100/50 dark:bg-green-900/20',
                                                isPast && !block.completed && 'bg-blue-100/40 dark:bg-blue-900/10'
                                              )}
                                            >
                                                <TableCell className="font-mono">{block.start} - {block.end}</TableCell>
                                                <TableCell>
                                                  <div className="flex items-center gap-2">
                                                    {getIconForBlock(block.type)}
                                                    <span>{block.skillName || (block.type.charAt(0).toUpperCase() + block.type.slice(1))}</span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">{block.minutes} min</TableCell>
                                                <TableCell className="no-print">
                                                  {block.type === 'work' && (
                                                    <div className="flex items-center justify-center">
                                                      <Checkbox
                                                        id={`task-${block.id}`}
                                                        checked={block.completed}
                                                        onCheckedChange={() => toggleTaskCompletion(day.date, block.id)}
                                                        aria-label={`Mark ${block.skillName} as complete`}
                                                      />
                                                    </div>
                                                  )}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                             </div>
                          </TabsContent>
                        )})}
                      </Tabs>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="container py-6 text-center text-sm text-muted-foreground no-print">
        <p>Developed by Santhosh_A</p>
      </footer>
    </div>
  )
}
