
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { getRelapseCalendarData, getRelapseData, updateCalendarDay } from '../utils/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { isSameDay, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { DayContentProps } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface RelapseCalendarProps {
  userId?: string;
  showStats?: boolean;
  editable?: boolean;
}

interface DayInfo {
  date: Date;
  hadRelapse: boolean;
  relapseInfo: {
    triggers: string;
    notes: string;
  } | null;
}

const RelapseCalendar: React.FC<RelapseCalendarProps> = ({ userId, showStats = false, editable = false }) => {
  const [calendarData, setCalendarData] = useState<DayInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());
  const [stats, setStats] = useState({ cleanDays: 0, relapseDays: 0, netGrowth: 0 });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayData, setSelectedDayData] = useState<DayInfo | null>(null);
  const [editMarkAsRelapse, setEditMarkAsRelapse] = useState(false);
  const [editTriggers, setEditTriggers] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Get calendar visualization data
      const data = await getRelapseCalendarData(userId);
      setCalendarData(data);
      
      // Get analytics data for accurate stats
      const relapseData = await getRelapseData(userId, 'all');
      setStats({
        cleanDays: relapseData.cleanDays,
        relapseDays: relapseData.relapseDays,
        netGrowth: relapseData.netGrowth
      });
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const handleDayClick = (day: Date) => {
    if (!editable || !userId) return;
    const dayData = calendarData.find(d => isSameDay(d.date, day)) || null;
    setSelectedDay(day);
    setSelectedDayData(dayData);
    setEditMarkAsRelapse(dayData?.hadRelapse ?? false);
    setEditTriggers(dayData?.relapseInfo?.triggers ?? '');
    setEditNotes(dayData?.relapseInfo?.notes ?? '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!userId || !selectedDay) return;
    setIsSaving(true);
    try {
      const success = await updateCalendarDay(
        userId,
        selectedDay,
        editMarkAsRelapse,
        editMarkAsRelapse ? editTriggers : undefined,
        editMarkAsRelapse ? editNotes : undefined
      );
      if (success) {
        toast.success(editMarkAsRelapse ? 'Day marked as relapse' : 'Day marked as clean');
        setEditDialogOpen(false);
        await fetchData();
      } else {
        toast.error('Failed to update day');
      }
    } catch (error) {
      toast.error('Failed to update day');
    } finally {
      setIsSaving(false);
    }
  };

  // Custom day rendering with dots for relapse status
  const renderDay = (props: DayContentProps) => {
    const day = props.date;
    
    // Find data for this day
    const dayData = calendarData.find(d => isSameDay(d.date, day));
    
    if (!dayData) return null;
    
    const dotColor = dayData.hadRelapse ? 'bg-red-500' : 'bg-green-500';
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`relative w-full h-full flex items-center justify-center ${editable ? 'cursor-pointer' : ''}`}
            onClick={editable ? () => handleDayClick(day) : undefined}
          >
            <div className="w-7 h-7 flex items-center justify-center">
              {day.getDate()}
            </div>
            <div className={`absolute bottom-0 w-2 h-2 rounded-full ${dotColor}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="p-2">
            <p className="font-bold">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(day)}</p>
            {dayData.hadRelapse ? (
              <div>
                <p className="text-red-500">Relapse reported</p>
                <p className="text-sm">Trigger: {dayData.relapseInfo?.triggers}</p>
                {dayData.relapseInfo?.notes && (
                  <p className="text-sm italic">{dayData.relapseInfo.notes}</p>
                )}
              </div>
            ) : (
              <p className="text-green-500">Clean day</p>
            )}
            {editable && <p className="text-xs text-muted-foreground mt-1">Click to edit</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Find consecutive days to connect dots
  const modifiers = {
    relapse: calendarData
      .filter(day => day.hadRelapse)
      .map(day => new Date(day.date)),
    clean: calendarData
      .filter(day => !day.hadRelapse)
      .map(day => new Date(day.date))
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 w-full">
        <h3 className="font-medium text-lg">Recovery Calendar</h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <Card className="p-4 w-full">
            {editable && (
              <p className="text-xs text-muted-foreground mb-2 text-center">Click any day to mark it as clean or relapse</p>
            )}
            <Calendar 
              mode="default"
              month={month}
              onMonthChange={setMonth}
              selected={[]}
              className="w-full mx-auto"
              styles={{
                months: { width: '100%' },
                month: { width: '100%' },
                table: { width: '100%' },
                row: { width: '100%', display: 'flex', justifyContent: 'space-between' },
                cell: { width: 'calc(100% / 7)', margin: '0', padding: '2px' },
                head_row: { width: '100%', display: 'flex', justifyContent: 'space-between' },
                head_cell: { width: 'calc(100% / 7)', textAlign: 'center' }
              }}
              components={{ DayContent: renderDay }}
              modifiers={modifiers}
              modifiersClassNames={{
                relapse: "relapse-day",
                clean: "clean-day"
              }}
            />

            <div className="flex justify-center gap-8 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Clean Day</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm">Relapse Day</span>
              </div>
            </div>
          </Card>
        )}

        {/* Edit day dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Day – {selectedDay ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDay) : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-3">
                <Button
                  variant={editMarkAsRelapse ? 'outline' : 'default'}
                  className={!editMarkAsRelapse ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                  onClick={() => setEditMarkAsRelapse(false)}
                >
                  Clean Day
                </Button>
                <Button
                  variant={editMarkAsRelapse ? 'destructive' : 'outline'}
                  onClick={() => setEditMarkAsRelapse(true)}
                >
                  Relapse Day
                </Button>
              </div>

              {editMarkAsRelapse && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="edit-triggers">Triggers</Label>
                    <Input
                      id="edit-triggers"
                      placeholder="What triggered this?"
                      value={editTriggers}
                      onChange={e => setEditTriggers(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-notes">Notes (optional)</Label>
                    <Textarea
                      id="edit-notes"
                      placeholder="Any additional notes..."
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default RelapseCalendar;
