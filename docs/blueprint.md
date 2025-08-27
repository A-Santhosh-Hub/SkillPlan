# **App Name**: SkillPlan

## Core Features:

- Skill Input Form: Form to capture skills (name, priority, estimated hours), available time (daily or monthly), working hours window, and break pattern.
- Generate Schedule Button: Button to generate schedule using weighted priority scheduling algorithm.
- Schedule Display: Results section showing a calendar-like table per day, plus total hours per skill, stop when estHours reached. Add edge cases such as total weights=0 to show friendly warning.
- Save/Reset/Copy Controls: Controls to save to localStorage, reset, and copy JSON to clipboard.
- Download as PDF Control: Control to download schedule as PDF (use window.print() styles).
- Timetable View: Displays total time in timetable (for each day, list blocks with timestamps, skill, duration).
- Footer: Footer with text: Developed by Santhosh_A.

## Style Guidelines:

- Primary color: #3B82F6 (a vibrant blue) to represent focus and productivity.
- Background color: #F7FAFC (light desaturated blue) for a clean, calming backdrop.
- Accent color: #6366F1 (analogous purple) for interactive elements and highlights.
- Body and headline font: 'Inter' (sans-serif) for a modern, readable interface.
- Simple, outlined icons for a clean and consistent visual language.
- Card-based layout with rounded corners and soft shadows for a modern, organized feel.
- Subtle transitions and animations for interactive elements to provide feedback and enhance the user experience.